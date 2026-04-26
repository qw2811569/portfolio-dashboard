import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { readTargetPriceSnapshot } = vi.hoisted(() => ({
  readTargetPriceSnapshot: vi.fn(),
}))

vi.mock('../../api/_lib/target-prices-store.js', () => ({
  readTargetPriceSnapshot,
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

describe('api/target-prices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token'
  })

  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN
  })

  it('surfaces source and count headers from the stored snapshot', async () => {
    readTargetPriceSnapshot.mockResolvedValue({
      code: '3491',
      name: '昇達科',
      targets: {
        source: 'gemini',
        reports: [
          { firm: '凱基投顧', target: 1680, date: '2026-04-15' },
          { firm: '元大投顧', target: 1650, date: '2026-04-12' },
        ],
      },
    })

    const { default: handler } = await import('../../api/target-prices.js')
    const req = { method: 'GET', query: { code: '3491' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(readTargetPriceSnapshot).toHaveBeenCalledWith('3491')
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-target-price-source']).toBe('gemini')
    expect(res.headers['x-target-price-count']).toBe('2')
    expect(res.headers['x-target-price-coverage-state']).toBe('none')
    expect(res.payload).toMatchObject({
      code: '3491',
      targets: {
        source: 'gemini',
      },
    })
  })

  it('preserves cnyes source for aggregate-only snapshots', async () => {
    readTargetPriceSnapshot.mockResolvedValue({
      code: '2330',
      name: '台積電',
      targets: {
        source: 'cnyes',
        coverageState: 'aggregate-only',
        reports: [],
        aggregate: {
          medianTarget: 2352.5,
          firmsCount: 36,
        },
      },
    })

    const { default: handler } = await import('../../api/target-prices.js')
    const req = { method: 'GET', query: { code: '2330' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(readTargetPriceSnapshot).toHaveBeenCalledWith('2330')
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-target-price-source']).toBe('cnyes')
    expect(res.headers['x-target-price-count']).toBe('0')
    expect(res.headers['x-target-price-coverage-state']).toBe('aggregate-only')
  })
})
