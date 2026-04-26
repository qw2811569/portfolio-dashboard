import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { readNewsFeed, headNewsFeed } = vi.hoisted(() => ({
  readNewsFeed: vi.fn(),
  headNewsFeed: vi.fn(),
}))

vi.mock('../../api/_lib/news-feed-store.js', () => ({
  readNewsFeed,
  headNewsFeed,
}))

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    ended: false,
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
    end() {
      this.ended = true
    },
  }
}

describe('api/news-feed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T10:00:45.215Z'))
    process.env.PUB_BLOB_READ_WRITE_TOKEN = 'blob-token'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.PUB_BLOB_READ_WRITE_TOKEN
  })

  it('reads the latest feed directly from blob storage', async () => {
    readNewsFeed.mockResolvedValue({
      items: [
        {
          title: '台積電法說會前市場觀望',
          pubDate: '2026-04-15T08:00:00.000Z',
          relatedStocks: [{ code: '2330', name: '台積電' }],
        },
        {
          title: '聯發科 5G 晶片出貨增溫',
          pubDate: '2026-04-14T08:00:00.000Z',
          relatedStocks: [{ code: '2454', name: '聯發科' }],
        },
      ],
      collectedAt: '2026-04-15T10:00:45.215Z',
    })

    const { default: handler } = await import('../../api/news-feed.js')
    const req = { method: 'GET', query: { codes: '2330', days: '3' } }
    const res = createMockResponse()

    await handler(req, res)

    expect(readNewsFeed).toHaveBeenCalledWith({ token: 'blob-token' })
    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      collectedAt: '2026-04-15T10:00:45.215Z',
    })
    expect(res.payload.items).toHaveLength(1)
    expect(res.payload.items[0].relatedStocks[0].code).toBe('2330')
  })

  it('returns an empty feed when the blob does not exist', async () => {
    readNewsFeed.mockResolvedValue(null)

    const { default: handler } = await import('../../api/news-feed.js')
    const req = { method: 'GET', query: {} }
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ items: [], collectedAt: null })
  })

  it('responds to HEAD for health checks', async () => {
    headNewsFeed.mockResolvedValue({
      pathname: 'news-feed/latest.json',
      url: 'https://blob.example/news-feed/latest.json',
    })

    const { default: handler } = await import('../../api/news-feed.js')
    const req = { method: 'HEAD', query: {} }
    const res = createMockResponse()

    await handler(req, res)

    expect(headNewsFeed).toHaveBeenCalledWith({ token: 'blob-token' })
    expect(res.statusCode).toBe(200)
    expect(res.ended).toBe(true)
  })
})
