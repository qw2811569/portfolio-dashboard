// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APPLIED_TRADE_PATCHES_KEY,
  OWNER_PORTFOLIO_ID,
  PORTFOLIO_ALIAS_TO_SUFFIX,
} from '../../src/constants.js'
import {
  applyTradeBackfillPatchesIfNeeded,
  loadPortfolioData,
  pfKey,
  readStorageValue,
  savePortfolioData,
} from '../../src/lib/portfolioUtils.js'

function createStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]))

  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value))
    }),
    removeItem: vi.fn((key) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    key: vi.fn((index) => Array.from(store.keys())[index] || null),
    get length() {
      return store.size
    },
  }
}

function installStorage(seed = {}) {
  const mock = createStorageMock(seed)
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  })
  return mock
}

describe('lib/portfolioUtils.js applyTradeBackfillPatchesIfNeeded', () => {
  beforeEach(async () => {
    installStorage()
    await savePortfolioData(OWNER_PORTFOLIO_ID, PORTFOLIO_ALIAS_TO_SUFFIX.holdings, [
      {
        code: '039108',
        name: '禾伸堂元富57購',
        qty: 8000,
        cost: 2.1,
        price: 2.1,
        type: '股票',
      },
    ])
    await savePortfolioData(OWNER_PORTFOLIO_ID, PORTFOLIO_ALIAS_TO_SUFFIX.tradeLog, [])
  })

  it('applies missing trade backfill patch once and syncs owner holdings upstream', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const changed = await applyTradeBackfillPatchesIfNeeded({ fetchImpl })

    expect(changed).toBe(1)
    expect(readStorageValue(APPLIED_TRADE_PATCHES_KEY)).toEqual(['2026-03-25-sell-039108-5000'])

    const tradeLog = readStorageValue(pfKey(OWNER_PORTFOLIO_ID, PORTFOLIO_ALIAS_TO_SUFFIX.tradeLog))
    expect(tradeLog[0]).toMatchObject({
      patchId: '2026-03-25-sell-039108-5000',
      action: '賣出',
      code: '039108',
      qty: 5000,
    })

    const holdings = readStorageValue(pfKey(OWNER_PORTFOLIO_ID, PORTFOLIO_ALIAS_TO_SUFFIX.holdings))
    expect(holdings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: '039108',
          qty: 3000,
        }),
      ])
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/brain',
      expect.objectContaining({
        method: 'POST',
      })
    )
  })

  it('is idempotent when the patch has already been applied', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    await applyTradeBackfillPatchesIfNeeded({ fetchImpl })
    const changed = await applyTradeBackfillPatchesIfNeeded({ fetchImpl })

    expect(changed).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const tradeLog = readStorageValue(pfKey(OWNER_PORTFOLIO_ID, PORTFOLIO_ALIAS_TO_SUFFIX.tradeLog))
    const patchedEntries = tradeLog.filter(
      (item) => item?.patchId === '2026-03-25-sell-039108-5000'
    )
    expect(patchedEntries).toHaveLength(1)
  })

  it('normalizes legacy watchlist tone keys when reading persisted storage', async () => {
    const watchlistKey = pfKey(OWNER_PORTFOLIO_ID, PORTFOLIO_ALIAS_TO_SUFFIX.watchlist)
    localStorage.setItem(
      watchlistKey,
      JSON.stringify([{ code: '4588', name: '玖鼎電力', scKey: 'olive' }])
    )

    const watchlist = await loadPortfolioData(
      OWNER_PORTFOLIO_ID,
      PORTFOLIO_ALIAS_TO_SUFFIX.watchlist,
      []
    )

    expect(watchlist).toEqual([
      expect.objectContaining({
        code: '4588',
        name: '玖鼎電力',
        scKey: 'positive',
      }),
    ])
  })
})
