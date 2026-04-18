import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const list = vi.fn()
const put = vi.fn()

vi.mock('@vercel/blob', () => ({
  list,
  put,
}))

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

function createJsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }
}

function getRequestedBlobPath(url) {
  const parsed = new URL(String(url), 'http://127.0.0.1:3002')
  return parsed.searchParams.get('path') || parsed.pathname.replace(/^\/+/, '')
}

describe('api/_lib/portfolio-snapshots', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.PUB_BLOB_READ_WRITE_TOKEN = 'blob-token'
    process.env.VITEST = '1'
    global.fetch = vi.fn()
    put.mockResolvedValue(undefined)
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.PUB_BLOB_READ_WRITE_TOKEN
    delete process.env.VITEST
  })

  it('writes a dated snapshot to the portfolio snapshot path', async () => {
    const { writePortfolioSnapshot } = await import('../../api/_lib/portfolio-snapshots.js')

    await writePortfolioSnapshot('me', {
      date: '2026-04-16',
      totalValue: 1200000,
      totalCost: 1000000,
      holdingsCount: 4,
    })

    expect(put).toHaveBeenCalledWith(
      'portfolios/me/snapshots/2026-04-16.json',
      expect.any(String),
      expect.objectContaining({
        token: 'blob-token',
        addRandomSuffix: false,
        allowOverwrite: true,
        access: 'private',
        contentType: 'application/json',
      })
    )
    expect(JSON.parse(put.mock.calls[0][1])).toMatchObject({
      schemaVersion: 1,
      date: '2026-04-16',
    })
  })

  it('upserts the same day snapshot with overwrite enabled', async () => {
    const { writePortfolioSnapshot } = await import('../../api/_lib/portfolio-snapshots.js')

    await writePortfolioSnapshot('me', {
      date: '2026-04-16',
      totalValue: 100,
      totalCost: 90,
      holdingsCount: 1,
    })
    await writePortfolioSnapshot('me', {
      date: '2026-04-16',
      totalValue: 105,
      totalCost: 90,
      holdingsCount: 1,
    })

    expect(put).toHaveBeenCalledTimes(2)
    const latestPayload = JSON.parse(put.mock.calls[1][1])
    expect(latestPayload.schemaVersion).toBe(1)
    expect(latestPayload.totalValue).toBe(105)
  })

  it('normalizes legacy snapshots without schemaVersion on read', async () => {
    const { readPortfolioSnapshots } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: [{ url: 'https://blob.example/legacy-2026-04-10' }],
    })
    global.fetch.mockResolvedValue(
      createJsonResponse({
        date: '2026-04-10',
        totalValue: 100,
        totalCost: 80,
        holdingsCount: 1,
      })
    )

    const snapshots = await readPortfolioSnapshots('me', {
      fromDate: '2026-04-10',
      toDate: '2026-04-10',
    })

    expect(snapshots).toEqual([expect.objectContaining({ schemaVersion: 1, date: '2026-04-10' })])
  })

  it('reads a snapshot range and forward-fills missing dates', async () => {
    const { readPortfolioSnapshots } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: [
        { url: 'https://blob.example/2026-04-10' },
        { url: 'https://blob.example/2026-04-12' },
      ],
    })
    global.fetch.mockImplementation((url) => {
      if (getRequestedBlobPath(url) === '2026-04-10') {
        return Promise.resolve(
          createJsonResponse({
            date: '2026-04-10',
            totalValue: 100,
            totalCost: 80,
            holdingsCount: 1,
          })
        )
      }
      if (getRequestedBlobPath(url) === '2026-04-12') {
        return Promise.resolve(
          createJsonResponse({
            date: '2026-04-12',
            totalValue: 110,
            totalCost: 80,
            holdingsCount: 1,
          })
        )
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const snapshots = await readPortfolioSnapshots('me', {
      fromDate: '2026-04-10',
      toDate: '2026-04-12',
    })

    expect(snapshots).toEqual([
      expect.objectContaining({ date: '2026-04-10', totalValue: 100 }),
      expect.objectContaining({
        date: '2026-04-11',
        totalValue: 100,
        filledFromDate: '2026-04-10',
      }),
      expect.objectContaining({ date: '2026-04-12', totalValue: 110 }),
    ])
  })

  it('seeds forward fill from the last snapshot before fromDate', async () => {
    const { readPortfolioSnapshots } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: [
        { url: 'https://blob.example/2026-04-09' },
        { url: 'https://blob.example/2026-04-12' },
      ],
    })
    global.fetch.mockImplementation((url) => {
      if (getRequestedBlobPath(url) === '2026-04-09') {
        return Promise.resolve(
          createJsonResponse({
            date: '2026-04-09',
            totalValue: 95,
            totalCost: 80,
            holdingsCount: 1,
          })
        )
      }
      if (getRequestedBlobPath(url) === '2026-04-12') {
        return Promise.resolve(
          createJsonResponse({
            date: '2026-04-12',
            totalValue: 110,
            totalCost: 80,
            holdingsCount: 1,
          })
        )
      }
      throw new Error(`unexpected fetch ${url}`)
    })

    const snapshots = await readPortfolioSnapshots('me', {
      fromDate: '2026-04-10',
      toDate: '2026-04-12',
    })

    expect(snapshots[0]).toMatchObject({
      date: '2026-04-10',
      totalValue: 95,
      filledFromDate: '2026-04-09',
    })
  })

  it('starts from the first future snapshot when none exists on or before fromDate', async () => {
    const { readPortfolioSnapshots } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: [{ url: 'https://blob.example/2026-04-12' }],
    })
    global.fetch.mockResolvedValue(
      createJsonResponse({
        date: '2026-04-12',
        totalValue: 110,
        totalCost: 80,
        holdingsCount: 1,
      })
    )

    const snapshots = await readPortfolioSnapshots('me', {
      fromDate: '2026-04-10',
      toDate: '2026-04-14',
    })

    expect(snapshots).toEqual([
      expect.objectContaining({ date: '2026-04-12', totalValue: 110 }),
      expect.objectContaining({
        date: '2026-04-13',
        totalValue: 110,
        filledFromDate: '2026-04-12',
      }),
      expect.objectContaining({
        date: '2026-04-14',
        totalValue: 110,
        filledFromDate: '2026-04-12',
      }),
    ])
  })

  it('returns an empty range when all snapshots are after toDate', async () => {
    const { readPortfolioSnapshots } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: [{ url: 'https://blob.example/2026-04-15' }],
    })
    global.fetch.mockResolvedValue(
      createJsonResponse({
        date: '2026-04-15',
        totalValue: 120,
        totalCost: 80,
        holdingsCount: 1,
      })
    )

    const snapshots = await readPortfolioSnapshots('me', {
      fromDate: '2026-04-10',
      toDate: '2026-04-14',
    })

    expect(snapshots).toEqual([])
  })

  it('calculates MDD when enough history exists', async () => {
    const { calculateMDD } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: [
        { url: 'https://blob.example/1' },
        { url: 'https://blob.example/2' },
        { url: 'https://blob.example/3' },
        { url: 'https://blob.example/4' },
        { url: 'https://blob.example/5' },
        { url: 'https://blob.example/6' },
        { url: 'https://blob.example/7' },
      ],
    })
    ;[
      ['https://blob.example/1', '2026-04-01', 100],
      ['https://blob.example/2', '2026-04-02', 120],
      ['https://blob.example/3', '2026-04-03', 90],
      ['https://blob.example/4', '2026-04-04', 95],
      ['https://blob.example/5', '2026-04-05', 130],
      ['https://blob.example/6', '2026-04-06', 125],
      ['https://blob.example/7', '2026-04-07', 140],
    ].forEach(([url, date, totalValue]) => {
      global.fetch.mockImplementationOnce(() =>
        Promise.resolve(createJsonResponse({ date, totalValue, totalCost: 80, holdingsCount: 1 }))
      )
    })

    const result = await calculateMDD('me', {
      fromDate: '2026-04-01',
      toDate: '2026-04-07',
    })

    expect(result).toMatchObject({
      mdd: 0.25,
      snapshots: 7,
      peak: 120,
      trough: 90,
      peakDate: '2026-04-02',
      troughDate: '2026-04-03',
    })
  })

  it('returns insufficient_history when fewer than 7 snapshots exist', async () => {
    const { calculateMDD } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: [{ url: 'https://blob.example/only' }],
    })
    global.fetch.mockResolvedValue(
      createJsonResponse({
        date: '2026-04-16',
        totalValue: 100,
        totalCost: 90,
        holdingsCount: 1,
      })
    )

    const result = await calculateMDD('me', {
      fromDate: '2026-04-10',
      toDate: '2026-04-16',
    })

    expect(result).toEqual({
      mdd: null,
      reason: 'insufficient_history',
      snapshots: 1,
    })
  })

  it('keeps the earlier drawdown when a new peak appears on the last day', async () => {
    const { calculateMDD } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: Array.from({ length: 7 }, (_, index) => ({
        url: `https://blob.example/${index + 1}`,
      })),
    })
    ;[
      ['2026-04-01', 100],
      ['2026-04-02', 95],
      ['2026-04-03', 90],
      ['2026-04-04', 92],
      ['2026-04-05', 94],
      ['2026-04-06', 96],
      ['2026-04-07', 110],
    ].forEach(([date, totalValue]) => {
      global.fetch.mockImplementationOnce(() =>
        Promise.resolve(createJsonResponse({ date, totalValue, totalCost: 80, holdingsCount: 1 }))
      )
    })

    const result = await calculateMDD('me', {
      fromDate: '2026-04-01',
      toDate: '2026-04-07',
    })

    expect(result).toMatchObject({
      mdd: 0.1,
      peak: 100,
      trough: 90,
      peakDate: '2026-04-01',
      troughDate: '2026-04-03',
    })
  })

  it('treats zero-value snapshots as a real trough in MDD calculation', async () => {
    const { calculateMDD } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: Array.from({ length: 7 }, (_, index) => ({
        url: `https://blob.example/zero-${index + 1}`,
      })),
    })
    ;[
      ['2026-04-01', 100],
      ['2026-04-02', 120],
      ['2026-04-03', 0],
      ['2026-04-04', 20],
      ['2026-04-05', 40],
      ['2026-04-06', 60],
      ['2026-04-07', 80],
    ].forEach(([date, totalValue]) => {
      global.fetch.mockImplementationOnce(() =>
        Promise.resolve(createJsonResponse({ date, totalValue, totalCost: 80, holdingsCount: 1 }))
      )
    })

    const result = await calculateMDD('me', {
      fromDate: '2026-04-01',
      toDate: '2026-04-07',
    })

    expect(result).toMatchObject({
      mdd: 1,
      snapshots: 7,
      peak: 120,
      trough: 0,
      peakDate: '2026-04-02',
      troughDate: '2026-04-03',
    })
  })

  it('returns zero_peak when the series never rises above zero', async () => {
    const { calculateMDD } = await import('../../api/_lib/portfolio-snapshots.js')

    list.mockResolvedValue({
      blobs: Array.from({ length: 7 }, (_, index) => ({
        url: `https://blob.example/flat-zero-${index + 1}`,
      })),
    })

    Array.from({ length: 7 }, (_, index) => `2026-04-0${index + 1}`).forEach((date) => {
      global.fetch.mockImplementationOnce(() =>
        Promise.resolve(createJsonResponse({ date, totalValue: 0, totalCost: 0, holdingsCount: 0 }))
      )
    })

    const result = await calculateMDD('me', {
      fromDate: '2026-04-01',
      toDate: '2026-04-07',
    })

    expect(result).toEqual({
      mdd: null,
      reason: 'zero_peak',
      snapshots: 7,
      peak: 0,
      trough: 0,
      peakDate: '2026-04-01',
      troughDate: '2026-04-01',
    })
  })
})

describe('api/portfolio-mdd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'))
    process.env.PUB_BLOB_READ_WRITE_TOKEN = 'blob-token'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.PUB_BLOB_READ_WRITE_TOKEN
  })

  it('returns 400 when portfolioId is missing', async () => {
    const { default: handler } = await import('../../api/portfolio-mdd.js')
    const req = { method: 'GET', query: {} }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.payload).toEqual({ error: 'portfolioId is required' })
  })

  it('returns insufficient history payload from the endpoint', async () => {
    list.mockResolvedValue({
      blobs: [{ url: 'https://blob.example/only' }],
    })
    global.fetch = vi.fn().mockResolvedValue(
      createJsonResponse({
        date: '2026-04-16',
        totalValue: 100,
        totalCost: 90,
        holdingsCount: 1,
      })
    )

    const { default: handler } = await import('../../api/portfolio-mdd.js')
    const req = { method: 'GET', query: { portfolioId: 'me' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({
      portfolioId: 'me',
      mdd: null,
      reason: 'insufficient_history',
      // readPortfolioSnapshots forward-fills the bounded date range, so one
      // stored blob can still yield two calendar-day snapshots here.
      snapshots: 2,
      peak: null,
      trough: null,
    })
  })

  it('returns 405 on non-GET methods', async () => {
    const { default: handler } = await import('../../api/portfolio-mdd.js')
    const req = { method: 'POST', query: { portfolioId: 'me' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.payload).toEqual({ error: 'Method not allowed' })
  })
})

describe('api/cron/snapshot-portfolios', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.PUB_BLOB_READ_WRITE_TOKEN = 'blob-token'
    delete process.env.CRON_SECRET
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.PUB_BLOB_READ_WRITE_TOKEN
    delete process.env.CRON_SECRET
  })

  it('uses query portfolioIds when manually triggered over GET', async () => {
    const { default: handler } = await import('../../api/cron/snapshot-portfolios.js')
    const req = {
      method: 'GET',
      query: { portfolioIds: 'alpha,beta' },
      headers: { host: 'localhost:3002', 'x-forwarded-proto': 'http' },
    }
    const res = createMockResponse()

    list.mockResolvedValue({ blobs: [] })
    global.fetch.mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/api/brain')) {
        return Promise.resolve(createJsonResponse({ holdings: [] }))
      }
      return Promise.resolve(createJsonResponse([]))
    })

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      ok: true,
      processed: 2,
      skipped: 2,
      succeeded: 0,
      failed: 0,
    })
  })
})
