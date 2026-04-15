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

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('api/cron/collect-target-prices', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.resetModules()
    process.env.PUB_BLOB_READ_WRITE_TOKEN = 'blob-token'
    delete process.env.CRON_SECRET
    put.mockResolvedValue(undefined)
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
    delete process.env.PUB_BLOB_READ_WRITE_TOKEN
    delete process.env.CRON_SECRET
  })

  it('processes stocks serially and skips ETF/權證 rows', async () => {
    const trackedStocksBlobUrl = 'https://blob.example/tracked-stocks.json'
    const firstAnalystResponse = createDeferred()
    const secondAnalystResponse = createDeferred()

    list.mockResolvedValue({
      blobs: [{ url: trackedStocksBlobUrl }],
    })

    global.fetch.mockImplementation((input, init = {}) => {
      const url = String(input)
      if (url === trackedStocksBlobUrl) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            stocks: [
              { code: '0050', name: '元大台灣50', type: 'ETF' },
              { code: '2330', name: '台積電', type: '股票' },
              { code: '053848', name: '亞翔凱基5B購', type: '權證' },
              { code: '2454', name: '聯發科', type: '股票' },
            ],
          }),
        })
      }

      if (url === 'http://localhost:3002/api/analyst-reports') {
        const body = JSON.parse(init.body)
        if (body.code === '2330') return firstAnalystResponse.promise
        if (body.code === '2454') return secondAnalystResponse.promise
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    const { default: handler } = await import('../../api/cron/collect-target-prices.js')
    const req = {
      method: 'GET',
      headers: {
        'x-forwarded-proto': 'http',
        host: 'localhost:3002',
      },
    }
    const res = createMockResponse()

    const pending = handler(req, res)

    const getAnalystCalls = () =>
      global.fetch.mock.calls.filter(([url]) => String(url).includes('/api/analyst-reports'))

    await vi.waitFor(() => {
      expect(getAnalystCalls()).toHaveLength(1)
    })
    expect(put).not.toHaveBeenCalled()

    firstAnalystResponse.resolve({
      ok: true,
      json: async () => ({
        fetchedAt: '2026-04-12T09:30:00.000Z',
        totalFound: 1,
        newCount: 1,
        items: [
          {
            id: 'r1',
            title: '台積電目標價更新',
            firm: '元大投顧',
            target: 1200,
            publishedAt: '2026/04/12',
          },
        ],
      }),
    })

    await vi.waitFor(() => {
      expect(put).toHaveBeenCalledTimes(1)
    })
    expect(getAnalystCalls()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(250)
    await vi.waitFor(() => {
      expect(getAnalystCalls()).toHaveLength(2)
    })

    secondAnalystResponse.resolve({
      ok: true,
      json: async () => ({
        fetchedAt: '2026-04-12T09:35:00.000Z',
        totalFound: 1,
        newCount: 1,
        items: [
          {
            id: 'r2',
            title: '聯發科目標價更新',
            firm: '凱基',
            target: 1800,
            publishedAt: '2026/04/12',
          },
        ],
      }),
    })

    await pending

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({
      processed: 2,
      succeeded: 2,
      failed: 0,
      skipped: 2,
    })

    const analystCodes = getAnalystCalls().map(([, init]) => JSON.parse(init.body).code)
    expect(analystCodes).toEqual(['2330', '2454'])

    expect(put).toHaveBeenNthCalledWith(
      1,
      'target-prices/2330.json',
      expect.any(String),
      expect.objectContaining({
        token: 'blob-token',
        addRandomSuffix: false,
        allowOverwrite: true,
        access: 'public',
        contentType: 'application/json',
      })
    )
    expect(put).toHaveBeenNthCalledWith(
      2,
      'target-prices/2454.json',
      expect.any(String),
      expect.objectContaining({
        token: 'blob-token',
        addRandomSuffix: false,
        allowOverwrite: true,
        access: 'public',
        contentType: 'application/json',
      })
    )

    const writtenSnapshots = put.mock.calls.map(([, body]) => JSON.parse(body))
    expect(writtenSnapshots[0]).toMatchObject({
      code: '2330',
      name: '台積電',
      targets: {
        reports: [{ firm: '元大投顧', target: 1200, date: '2026/04/12' }],
      },
    })
    expect(writtenSnapshots[1]).toMatchObject({
      code: '2454',
      name: '聯發科',
      targets: {
        reports: [{ firm: '凱基', target: 1800, date: '2026/04/12' }],
      },
    })
  })

  it('ignores non-target numeric headlines when building snapshot reports', async () => {
    const { buildTargetPriceSnapshot } = await import('../../api/cron/collect-target-prices.js')

    const snapshot = buildTargetPriceSnapshot({
      stock: { code: '2489', name: '瑞軒', type: '股票' },
      analystPayload: {
        items: [
          {
            id: 'false-positive',
            title: '瑞軒攻上漲停42.9元',
            firm: 'CMoney',
            target: null,
            targetType: 'none',
            publishedAt: '2026/04/15',
          },
          {
            id: 'real-target',
            title: '昇達科預估目標價為1700元',
            firm: '豐雲學堂',
            target: 1700,
            targetType: 'price-target',
            publishedAt: '2026/04/15',
          },
        ],
      },
    })

    expect(snapshot.targets.reports).toEqual([
      { firm: '豐雲學堂', target: 1700, date: '2026/04/15' },
    ])
  })
})
