import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FINMIND_DATASET_KEYS,
  fetchBalanceSheet,
  fetchCashFlowStatements,
  fetchDividendResults,
  fetchShareholdingHistory,
  fetchStockDossierData,
  fetchStockNews,
} from '../../src/lib/dataAdapters/finmindAdapter.js'

function getDatasetFromCall(callIndex = 0) {
  const [input] = global.fetch.mock.calls[callIndex]
  return new URL(String(input), 'http://localhost').searchParams.get('dataset')
}

function getStartDateFromCall(callIndex = 0) {
  const [input] = global.fetch.mock.calls[callIndex]
  return new URL(String(input), 'http://localhost').searchParams.get('start_date')
}

describe('lib/dataAdapters/finmindAdapter', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T09:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('fetches balance sheet and cash flow datasets through /api/finmind', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ date: '2025-12-31', assets: 100 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ date: '2025-12-31', operatingCashFlow: 50 }] }),
      })

    const balanceSheet = await fetchBalanceSheet('2330', '2024-01-01')
    const cashFlow = await fetchCashFlowStatements('2330', '2024-01-01')

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch.mock.calls[0][0]).toBe(
      '/api/finmind?dataset=balanceSheet&code=2330&start_date=2024-01-01'
    )
    expect(global.fetch.mock.calls[1][0]).toBe(
      '/api/finmind?dataset=cashFlow&code=2330&start_date=2024-01-01'
    )
    expect(balanceSheet).toEqual([{ date: '2025-12-31', assets: 100 }])
    expect(cashFlow).toEqual([{ date: '2025-12-31', operatingCashFlow: 50 }])
  })

  it('uses day windows for dividend results, shareholding, and stock news', async () => {
    global.fetch = vi.fn(async (input) => {
      const url = new URL(String(input), 'http://localhost')
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              dataset: url.searchParams.get('dataset'),
              startDate: url.searchParams.get('start_date'),
            },
          ],
        }),
      }
    })

    const dividendResult = await fetchDividendResults('2330', 30)
    const shareholding = await fetchShareholdingHistory('2330', 60)
    const news = await fetchStockNews('2330', 7)

    expect(getDatasetFromCall(0)).toBe('dividendResult')
    expect(getStartDateFromCall(0)).toBe('2026-03-03')
    expect(getDatasetFromCall(1)).toBe('shareholding')
    expect(getStartDateFromCall(1)).toBe('2026-02-01')
    expect(getDatasetFromCall(2)).toBe('news')
    expect(getStartDateFromCall(2)).toBe('2026-03-26')
    expect(dividendResult[0]).toMatchObject({ dataset: 'dividendResult', startDate: '2026-03-03' })
    expect(shareholding[0]).toMatchObject({ dataset: 'shareholding', startDate: '2026-02-01' })
    expect(news[0]).toMatchObject({ dataset: 'news', startDate: '2026-03-26' })
  })

  it('returns all dossier datasets and degrades failed requests to empty arrays', async () => {
    global.fetch = vi.fn(async (input) => {
      const url = new URL(String(input), 'http://localhost')
      const dataset = url.searchParams.get('dataset')

      if (dataset === 'shareholding') {
        return {
          ok: false,
          json: async () => ({ error: 'shareholding unavailable' }),
        }
      }

      if (dataset === 'news') {
        throw new Error('network down')
      }

      return {
        ok: true,
        json: async () => ({ data: [{ dataset }] }),
      }
    })

    const result = await fetchStockDossierData('2330')

    expect(global.fetch).toHaveBeenCalledTimes(11)
    expect(Object.keys(result)).toEqual(FINMIND_DATASET_KEYS)
    expect(result).toEqual({
      institutional: [{ dataset: 'institutional' }],
      margin: [{ dataset: 'margin' }],
      valuation: [{ dataset: 'valuation' }],
      financials: [{ dataset: 'financials' }],
      balanceSheet: [{ dataset: 'balanceSheet' }],
      cashFlow: [{ dataset: 'cashFlow' }],
      dividend: [{ dataset: 'dividend' }],
      dividendResult: [{ dataset: 'dividendResult' }],
      revenue: [{ dataset: 'revenue' }],
      shareholding: [],
      news: [],
    })
  })

  it('can bypass cached FinMind responses when forceFresh is requested', async () => {
    const storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
      setItem: vi.fn((key, value) => storage.set(key, value)),
      removeItem: vi.fn((key) => storage.delete(key)),
    })

    const response = {
      ok: true,
      json: async () => ({ data: [{ dataset: 'shareholding', refreshed: true }] }),
    }
    global.fetch = vi.fn().mockResolvedValue(response)

    await fetchShareholdingHistory('2330', 60)
    await fetchShareholdingHistory('2330', 60)
    await fetchShareholdingHistory('2330', 60, { forceFresh: true })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(getDatasetFromCall(0)).toBe('shareholding')
    expect(getDatasetFromCall(1)).toBe('shareholding')
  })

  it('keys cache entries by request range so distinct end dates do not collide', async () => {
    const storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
      setItem: vi.fn((key, value) => storage.set(key, value)),
      removeItem: vi.fn((key) => storage.delete(key)),
      key: vi.fn((i) => Array.from(storage.keys())[i] || null),
      get length() {
        return storage.size
      },
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ dataset: 'shareholding' }] }),
    })

    await fetchShareholdingHistory('2330', 60, { endDate: '2026-03-31' })
    await fetchShareholdingHistory('2330', 60, { endDate: '2026-03-15' })

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  describe('evictEmptyFinMindCache module-load cleanup', () => {
    it('removes poisoned empty fm-cache-* entries and preserves non-empty entries', async () => {
      // Seed localStorage with a mix of poisoned empty and valid entries
      const storage = new Map()
      storage.set('fm-cache-revenue-3006', JSON.stringify({ data: [], ts: Date.now() }))
      storage.set('fm-cache-financials-3006', JSON.stringify({ data: [], ts: Date.now() }))
      storage.set(
        'fm-cache-revenue-2308',
        JSON.stringify({ data: [{ date: '2026-03-01', revenue: 1000 }], ts: Date.now() })
      )
      storage.set('unrelated-key', 'should-be-ignored')

      const removeItemSpy = vi.fn((key) => storage.delete(key))
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
        setItem: vi.fn((key, value) => storage.set(key, value)),
        removeItem: removeItemSpy,
        key: vi.fn((i) => Array.from(storage.keys())[i] || null),
        get length() {
          return storage.size
        },
      })

      // Re-import the adapter to trigger module-load eviction
      vi.resetModules()
      await import('../../src/lib/dataAdapters/finmindAdapter.js')

      expect(storage.has('fm-cache-revenue-3006')).toBe(false)
      expect(storage.has('fm-cache-financials-3006')).toBe(false)
      expect(storage.has('fm-cache-revenue-2308')).toBe(true)
      expect(storage.has('unrelated-key')).toBe(true)
    })
  })

  describe('degraded response handling (rate-limit cache poisoning fix)', () => {
    it('does NOT write cache when the backend response is degraded:true', async () => {
      const storage = new Map()
      const setItemSpy = vi.fn((key, value) => storage.set(key, value))
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
        setItem: setItemSpy,
        removeItem: vi.fn((key) => storage.delete(key)),
        key: vi.fn((i) => Array.from(storage.keys())[i] || null),
        get length() {
          return storage.size
        },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          degraded: true,
          reason: 'rate_limited',
          data: [],
        }),
      })

      const result = await fetchShareholdingHistory('2330', 60)

      expect(result).toEqual([])
      // The cache key was NOT written — no calls with the cache key
      const cacheWrites = setItemSpy.mock.calls.filter(([key]) =>
        String(key).startsWith('fm-cache-')
      )
      expect(cacheWrites).toEqual([])
    })

    it('still caches non-degraded empty responses (genuine "no data" case)', async () => {
      const storage = new Map()
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
        setItem: vi.fn((key, value) => storage.set(key, value)),
        removeItem: vi.fn((key) => storage.delete(key)),
        key: vi.fn((i) => Array.from(storage.keys())[i] || null),
        get length() {
          return storage.size
        },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      })

      await fetchShareholdingHistory('2330', 60)

      // A genuine non-degraded empty response is cached normally so we don't
      // re-fetch stocks that legitimately have no shareholding history.
      // (This mirrors pre-fix behavior for the non-degraded path.)
      const cacheKeys = Array.from(storage.keys()).filter((k) => k.startsWith('fm-cache-'))
      expect(cacheKeys).toHaveLength(1)
    })

    it('caps concurrent FinMind fetches at 3 global in-flight requests', async () => {
      // Override timers that may have been set up by other tests
      vi.useRealTimers()

      // No localStorage cache — force every call to go to fetch
      const storage = new Map()
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
        setItem: vi.fn((key, value) => storage.set(key, value)),
        removeItem: vi.fn((key) => storage.delete(key)),
        key: vi.fn((i) => Array.from(storage.keys())[i] || null),
        get length() {
          return storage.size
        },
      })

      let concurrent = 0
      let peak = 0
      const pending = []

      global.fetch = vi.fn(async () => {
        concurrent += 1
        peak = Math.max(peak, concurrent)
        return new Promise((resolve) => {
          pending.push(() => {
            concurrent -= 1
            resolve({
              ok: true,
              json: async () => ({ data: [{ ok: true }] }),
            })
          })
        })
      })

      // Fire 10 concurrent requests for different codes (so cache never hits)
      const fetches = Array.from({ length: 10 }, (_, i) =>
        fetchShareholdingHistory(`stock${i}`, 60)
      )

      // Let microtasks run so the first 3 enter fetch()
      await new Promise((r) => setTimeout(r, 10))

      expect(peak).toBeLessThanOrEqual(3)
      expect(concurrent).toBeLessThanOrEqual(3)

      // Drain: resolve all pending responses, then confirm everything completes
      while (pending.length > 0 || concurrent > 0) {
        const next = pending.shift()
        if (next) next()
        await new Promise((r) => setTimeout(r, 5))
      }
      await Promise.all(fetches)

      // Final peak should never have exceeded 3 even after all fires
      expect(peak).toBeLessThanOrEqual(3)
      expect(global.fetch).toHaveBeenCalledTimes(10)
    })

    it('degraded response on one dataset does not poison the cache (retry on next call)', async () => {
      const storage = new Map()
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
        setItem: vi.fn((key, value) => storage.set(key, value)),
        removeItem: vi.fn((key) => storage.delete(key)),
        key: vi.fn((i) => Array.from(storage.keys())[i] || null),
        get length() {
          return storage.size
        },
      })

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount += 1
        if (callCount === 1) {
          return {
            ok: true,
            json: async () => ({ success: true, degraded: true, data: [] }),
          }
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [{ dataset: 'shareholding', real: true }] }),
        }
      })

      const first = await fetchShareholdingHistory('2330', 60)
      expect(first).toEqual([])

      const second = await fetchShareholdingHistory('2330', 60)
      expect(second).toEqual([{ dataset: 'shareholding', real: true }])
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})
