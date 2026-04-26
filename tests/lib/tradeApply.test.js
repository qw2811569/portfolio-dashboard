// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { persistTradeApply, previewTradeApply } from '../../src/lib/tradeApply.js'

describe('lib/tradeApply', () => {
  beforeEach(() => {
    window.localStorage.clear()
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  })

  it('previews holdings quantity changes before apply', () => {
    const preview = previewTradeApply({
      holdings: [{ code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, value: 9500 }],
      trades: [{ code: '2330', name: '台積電', action: '買進', qty: 5, price: 960 }],
    })

    expect(preview.changes[0]).toMatchObject({
      code: '2330',
      beforeQty: 10,
      afterQty: 15,
    })
  })

  it('applies trades to holdings, tradeLog, localStorage, and audit endpoint', async () => {
    const setHoldings = vi.fn()
    const setTradeLog = vi.fn()

    const result = await persistTradeApply({
      portfolioId: 'me',
      holdings: [{ code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, value: 9500 }],
      tradeLog: [],
      setHoldings,
      setTradeLog,
      trades: [{ code: '2454', name: '聯發科', action: '買進', qty: 2, price: 1250 }],
      tradeDate: '2026-04-26',
      now: new Date('2026-04-26T04:00:00.000Z'),
      disclaimerAckedAt: '2026-04-26T00:00:00.000Z',
    })

    expect(result.entries[0]).toMatchObject({ code: '2454', qty: 2, price: 1250 })
    expect(setHoldings).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ code: '2454' })])
    )
    expect(setTradeLog).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ code: '2454' })])
    )
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'pf-me-holdings-v2',
      expect.stringContaining('2454')
    )
    expect(global.fetch).toHaveBeenCalledWith('/api/trade-audit', expect.any(Object))
  })
})
