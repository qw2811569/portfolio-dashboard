import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return payload
    },
    end() {},
  }
}

describe('api/finmind', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T07:00:00.000Z'))
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
  })

  it('returns empty degraded payload instead of 500 when FinMind rate limits', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () =>
        '{"msg":"Requests reach the upper limit. https://finmindtrade.com/","status":402}',
    })

    vi.resetModules()
    const { default: handler } = await import('../../api/finmind.js')

    const req = {
      method: 'GET',
      query: { dataset: 'balanceSheet', code: '2308', start_date: '2024-04-02' },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      success: true,
      degraded: true,
      reason: 'rate_limited',
      dataset: 'balanceSheet',
      code: '2308',
      count: 0,
      data: [],
    })
  })

  it('short-circuits repeated calls during the rate limit cooldown window', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () =>
        '{"msg":"Requests reach the upper limit. https://finmindtrade.com/","status":402}',
    })

    vi.resetModules()
    const { default: handler } = await import('../../api/finmind.js')

    const firstReq = {
      method: 'GET',
      query: { dataset: 'news', code: '1717', start_date: '2026-03-19' },
    }
    const firstRes = createMockResponse()

    await handler(firstReq, firstRes)

    const secondReq = {
      method: 'GET',
      query: { dataset: 'balanceSheet', code: '2308', start_date: '2024-04-02' },
    }
    const secondRes = createMockResponse()

    await handler(secondReq, secondRes)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(secondRes.statusCode).toBe(200)
    expect(secondRes.payload).toMatchObject({
      degraded: true,
      reason: 'rate_limited',
      count: 0,
      data: [],
    })
  })

  it('still surfaces unexpected upstream failures as 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server exploded',
    })

    vi.resetModules()
    const { default: handler } = await import('../../api/finmind.js')

    const req = {
      method: 'GET',
      query: { dataset: 'valuation', code: '2308', start_date: '2026-01-01' },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.payload).toMatchObject({
      error: 'FinMind TaiwanStockPER failed (500): server exploded',
      source: 'finmind',
    })
  })

  it('rejects unsupported datasets before any upstream request fires', async () => {
    global.fetch = vi.fn()

    vi.resetModules()
    const { default: handler } = await import('../../api/finmind.js')

    const req = {
      method: 'GET',
      query: { dataset: 'foo_bar', code: '2308' },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.payload).toMatchObject({
      error: '不支援的 dataset: foo_bar',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('aggregates English institutional participant labels into foreign/investment/dealer buckets', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        msg: 'success',
        data: [
          { date: '2026-04-10', name: 'Foreign_Investor', buy: 50000, sell: 19515 },
          { date: '2026-04-10', name: 'Foreign_Dealer_Self', buy: 3200, sell: 1200 },
          { date: '2026-04-10', name: 'Investment_Trust', buy: 1000, sell: 7000 },
          { date: '2026-04-10', name: 'Dealer_self', buy: 1000, sell: 2000 },
          { date: '2026-04-10', name: 'Dealer_Hedging', buy: 40000, sell: 6535 },
        ],
      }),
    })

    vi.resetModules()
    const { default: handler } = await import('../../api/finmind.js')

    const req = {
      method: 'GET',
      query: { dataset: 'institutional', code: '6862', start_date: '2026-04-10' },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      success: true,
      dataset: 'institutional',
      code: '6862',
      count: 1,
      data: [
        {
          date: '2026-04-10',
          foreign: 32485,
          investment: -6000,
          dealer: 32465,
        },
      ],
    })
  })

  it('normalizes ytd-cumulative financial rows into standalone quarter values', async () => {
    global.fetch = vi.fn(async (url) => {
      const requestUrl = new URL(url)
      const dataset = requestUrl.searchParams.get('dataset')

      if (dataset === 'TaiwanStockFinancialStatements') {
        return {
          ok: true,
          json: async () => ({
            status: 200,
            msg: 'success',
            data: [
              { date: '2025-03-31', type: 'Revenue', value: 500000 },
              { date: '2025-03-31', type: 'GrossProfit', value: 250000 },
              { date: '2025-03-31', type: 'OperatingIncome', value: 100000 },
              { date: '2025-03-31', type: 'IncomeAfterTaxes', value: 80000 },
              { date: '2025-03-31', type: 'EPS', value: 1.0 },
              { date: '2025-06-30', type: 'Revenue', value: 1200000 },
              { date: '2025-06-30', type: 'GrossProfit', value: 600000 },
              { date: '2025-06-30', type: 'OperatingIncome', value: 250000 },
              { date: '2025-06-30', type: 'IncomeAfterTaxes', value: 180000 },
              { date: '2025-06-30', type: 'EPS', value: 2.2 },
            ],
          }),
        }
      }

      if (dataset === 'TaiwanStockMonthRevenue') {
        return {
          ok: true,
          json: async () => ({
            status: 200,
            msg: 'success',
            data: [
              { revenue_year: 2025, revenue_month: 1, revenue: 100000 },
              { revenue_year: 2025, revenue_month: 2, revenue: 200000 },
              { revenue_year: 2025, revenue_month: 3, revenue: 200000 },
              { revenue_year: 2025, revenue_month: 4, revenue: 100000 },
              { revenue_year: 2025, revenue_month: 5, revenue: 300000 },
              { revenue_year: 2025, revenue_month: 6, revenue: 300000 },
            ],
          }),
        }
      }

      throw new Error(`unexpected dataset ${dataset}`)
    })

    vi.resetModules()
    const { default: handler } = await import('../../api/finmind.js')

    const req = {
      method: 'GET',
      query: { dataset: 'financials', code: '2330', start_date: '2025-01-01' },
    }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload.data[0]).toMatchObject({
      date: '2025-06-30',
      quarter: '2025Q2',
      statementPeriodMode: 'ytd-cumulative-derived',
      Revenue: 700000,
      GrossProfit: 350000,
      OperatingIncome: 150000,
      IncomeAfterTaxes: 100000,
      EPS: 1.2,
      reportedRevenue: 1200000,
    })
  })
})
