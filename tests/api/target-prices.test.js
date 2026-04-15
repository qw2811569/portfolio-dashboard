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

describe('api/target-prices', () => {
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

  it('surfaces source and count headers from the stored snapshot', async () => {
    list.mockResolvedValue({
      blobs: [{ url: 'https://blob.example/3491.json' }],
    })
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '3491',
        name: '昇達科',
        targets: {
          source: 'gemini',
          reports: [
            { firm: '凱基投顧', target: 1680, date: '2026-04-15' },
            { firm: '元大投顧', target: 1650, date: '2026-04-12' },
          ],
        },
      }),
    })

    const { default: handler } = await import('../../api/target-prices.js')
    const req = { method: 'GET', query: { code: '3491' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.headers['x-target-price-source']).toBe('gemini')
    expect(res.headers['x-target-price-count']).toBe('2')
    expect(res.payload).toMatchObject({
      code: '3491',
      targets: {
        source: 'gemini',
      },
    })
  })
})
