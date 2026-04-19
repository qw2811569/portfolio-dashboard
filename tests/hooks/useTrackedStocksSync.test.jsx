import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTrackedStocksSync } from '../../src/hooks/useTrackedStocksSync.js'

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
  const storage = createStorageMock(seed)
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
  return storage
}

describe('hooks/useTrackedStocksSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    installStorage()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('debounces holdings changes and posts tracked stocks to the sync endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        totalTracked: 2,
        lastSyncedAt: '2026-04-19T06:00:00.000Z',
      }),
    })

    renderHook(() =>
      useTrackedStocksSync({
        activePortfolioId: 'me',
        holdings: [
          { code: '2330', name: '台積電', type: '股票', qty: 1 },
          { code: '2454', name: '聯發科', type: '股票', qty: 2 },
        ],
        fetchImpl,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999)
    })
    expect(fetchImpl).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
      await Promise.resolve()
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith('/api/tracked-stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolioId: 'me',
        pid: 'me',
        stocks: [
          { code: '2330', name: '台積電', type: '股票' },
          { code: '2454', name: '聯發科', type: '股票' },
        ],
      }),
      signal: expect.any(AbortSignal),
    })

    const syncState = JSON.parse(localStorage.getItem('pf-me-tracked-sync-v1'))
    expect(syncState).toMatchObject({
      portfolioId: 'me',
      status: 'fresh',
      totalTracked: 2,
      source: 'live-sync',
      lastSyncedAt: '2026-04-19T06:00:00.000Z',
    })
  })

  it('records the last attempt and preserves the last successful sync on failure', async () => {
    installStorage({
      'pf-me-tracked-sync-v1': {
        portfolioId: 'me',
        status: 'fresh',
        lastSyncedAt: '2026-04-18T06:00:00.000Z',
        totalTracked: 1,
        source: 'live-sync',
      },
    })

    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))

    renderHook(() =>
      useTrackedStocksSync({
        activePortfolioId: 'me',
        holdings: [{ code: '2317', name: '鴻海', type: '股票', qty: 3 }],
        fetchImpl,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const syncState = JSON.parse(localStorage.getItem('pf-me-tracked-sync-v1'))
    expect(syncState).toMatchObject({
      portfolioId: 'me',
      status: 'failed',
      lastSyncedAt: '2026-04-18T06:00:00.000Z',
      source: 'live-sync',
      lastError: 'network down',
      errorStatus: '5xx',
    })
    expect(syncState.lastAttemptAt).toBeTruthy()
  })
})
