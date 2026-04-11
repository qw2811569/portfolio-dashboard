import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
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
})
