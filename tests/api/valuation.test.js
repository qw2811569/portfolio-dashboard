import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const list = vi.fn()

vi.mock('@vercel/blob', () => ({
  list,
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

describe('api/valuation', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PUB_BLOB_READ_WRITE_TOKEN = 'blob-token'
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.PUB_BLOB_READ_WRITE_TOKEN
  })

  it('returns the stored valuation snapshot when blob exists', async () => {
    list.mockResolvedValue({
      blobs: [{ url: 'https://blob.example/7865.json' }],
    })
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '7865',
        method: 'historical-per-band',
        confidence: 'high',
        positionInBand: 'within',
        lowerBound: 30.2,
        midPoint: 37.5,
        upperBound: 44.8,
      }),
    })

    const { default: handler } = await import('../../api/valuation.js')
    const req = { method: 'GET', query: { code: '7865' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.headers['x-valuation-method']).toBe('historical-per-band')
    expect(res.headers['x-valuation-confidence']).toBe('high')
    expect(res.headers['x-valuation-position']).toBe('within')
    expect(res.payload).toMatchObject({
      code: '7865',
      method: 'historical-per-band',
    })
  })

  it('returns 304 with compute hint when no valuation blob exists', async () => {
    list.mockResolvedValue({ blobs: [] })

    const { default: handler } = await import('../../api/valuation.js')
    const req = { method: 'GET', query: { code: '2489' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(304)
    expect(res.payload).toEqual({
      code: '2489',
      hint: 'compute required',
    })
  })
})
