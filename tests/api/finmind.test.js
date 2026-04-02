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
      text: async () => '{"msg":"Requests reach the upper limit. https://finmindtrade.com/","status":402}',
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
      text: async () => '{"msg":"Requests reach the upper limit. https://finmindtrade.com/","status":402}',
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
})
