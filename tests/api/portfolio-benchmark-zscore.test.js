import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { list } = vi.hoisted(() => ({
  list: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  list,
  put: vi.fn(),
  get: vi.fn(),
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

function buildIsoDate(index) {
  return `2026-04-${String(index).padStart(2, '0')}`
}

function buildSnapshots(diffs = []) {
  const portfolioSnapshots = []
  const benchmarkSnapshots = []
  let portfolioValue = 100
  let benchmarkClose = 100

  portfolioSnapshots.push({
    date: buildIsoDate(1),
    totalValue: portfolioValue,
    totalCost: 80,
    holdingsCount: 2,
  })
  benchmarkSnapshots.push({
    date: buildIsoDate(1),
    close: benchmarkClose,
    prevClose: null,
    returnPct: null,
  })

  diffs.forEach((diff, index) => {
    const date = buildIsoDate(index + 2)
    const benchmarkReturnPct = 1
    const portfolioReturnPct = benchmarkReturnPct + diff
    const previousBenchmarkClose = benchmarkClose

    benchmarkClose = Number((benchmarkClose * (1 + benchmarkReturnPct / 100)).toFixed(4))
    portfolioValue = Number((portfolioValue * (1 + portfolioReturnPct / 100)).toFixed(4))

    portfolioSnapshots.push({
      date,
      totalValue: portfolioValue,
      totalCost: 80,
      holdingsCount: 2,
    })
    benchmarkSnapshots.push({
      date,
      close: benchmarkClose,
      prevClose: previousBenchmarkClose,
      returnPct: benchmarkReturnPct,
    })
  })

  return { portfolioSnapshots, benchmarkSnapshots }
}

describe('api/portfolio-benchmark-zscore', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-24T08:30:00.000+08:00'))
    vi.clearAllMocks()
    vi.resetModules()
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token'
    process.env.VITEST = '1'
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.VITEST
  })

  it('returns a ready X1 payload when portfolio and benchmark history are aligned', async () => {
    const diffs = [
      0.2, -0.2, 0.1, -0.1, 0.15, -0.15, 0.2, -0.2, 0.1, -0.1, 0.15, -0.15, 0.2, -0.2, 0.1, -0.1,
      0.15, -0.15, 0.2, 1.8,
    ]
    const { portfolioSnapshots, benchmarkSnapshots } = buildSnapshots(diffs)
    const blobPayloads = new Map()

    list.mockImplementation(async ({ prefix }) => {
      if (prefix === 'portfolios/me/snapshots/') {
        return {
          blobs: portfolioSnapshots.map((snapshot) => ({
            url: `https://blob.example/portfolios/me/snapshots/${snapshot.date}.json`,
          })),
          cursor: null,
        }
      }

      if (prefix === 'snapshot/benchmark') {
        return {
          blobs: benchmarkSnapshots.map((snapshot) => ({
            url: `https://blob.example/snapshot/benchmark/${snapshot.date}.json`,
          })),
          cursor: null,
        }
      }

      return { blobs: [], cursor: null }
    })

    portfolioSnapshots.forEach((snapshot) => {
      blobPayloads.set(`portfolios/me/snapshots/${snapshot.date}.json`, snapshot)
    })
    benchmarkSnapshots.forEach((snapshot) => {
      blobPayloads.set(`snapshot/benchmark/${snapshot.date}.json`, snapshot)
    })

    global.fetch.mockImplementation((url) => {
      const pathname = getRequestedBlobPath(url)
      const payload = blobPayloads.get(pathname)
      if (!payload) {
        throw new Error(`unexpected fetch ${pathname}`)
      }
      return Promise.resolve(createJsonResponse(payload))
    })

    const { default: handler } = await import('../../api/portfolio-benchmark-zscore.js')
    const res = createMockResponse()

    await handler(
      {
        method: 'GET',
        query: { portfolioId: 'me' },
        headers: { host: 'localhost:3002' },
      },
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      ok: true,
      status: 'ready',
      portfolioId: 'me',
      marketDate: '2026-04-21',
      interpretation: 'anomaly',
      benchmark: {
        code: '0050',
        proxyFor: '^TWII',
      },
    })
    expect(res.payload.zScore).toBeGreaterThan(2)
    expect(res.payload.recentSeries).toHaveLength(7)
  })

  it('returns a soft unavailable payload when history is too short', async () => {
    const { portfolioSnapshots, benchmarkSnapshots } = buildSnapshots([0.2, -0.1, 0.3])
    const blobPayloads = new Map()

    list.mockImplementation(async ({ prefix }) => {
      if (prefix === 'portfolios/me/snapshots/') {
        return {
          blobs: portfolioSnapshots.map((snapshot) => ({
            url: `https://blob.example/portfolios/me/snapshots/${snapshot.date}.json`,
          })),
          cursor: null,
        }
      }

      if (prefix === 'snapshot/benchmark') {
        return {
          blobs: benchmarkSnapshots.map((snapshot) => ({
            url: `https://blob.example/snapshot/benchmark/${snapshot.date}.json`,
          })),
          cursor: null,
        }
      }

      return { blobs: [], cursor: null }
    })

    portfolioSnapshots.forEach((snapshot) => {
      blobPayloads.set(`portfolios/me/snapshots/${snapshot.date}.json`, snapshot)
    })
    benchmarkSnapshots.forEach((snapshot) => {
      blobPayloads.set(`snapshot/benchmark/${snapshot.date}.json`, snapshot)
    })

    global.fetch.mockImplementation((url) => {
      const pathname = getRequestedBlobPath(url)
      const payload = blobPayloads.get(pathname)
      if (!payload) {
        throw new Error(`unexpected fetch ${pathname}`)
      }
      return Promise.resolve(createJsonResponse(payload))
    })

    const { default: handler } = await import('../../api/portfolio-benchmark-zscore.js')
    const res = createMockResponse()

    await handler(
      {
        method: 'GET',
        query: { portfolioId: 'me' },
        headers: { host: 'localhost:3002' },
      },
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      ok: false,
      status: 'unavailable',
      reason: 'insufficient_history',
      message: '今天對比大盤，稍後再看',
    })
  })
})
