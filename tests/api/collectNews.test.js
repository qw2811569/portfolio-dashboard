import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { list, put, get } = vi.hoisted(() => ({
  list: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  list,
  put,
  get,
}))

import handler, { fetchStockNews, collectNewsFeed } from '../../api/cron/collect-news.js'

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>台積電 台股 - Google 新聞</title>
<item>
<title>台積電法說會前站上2000元</title>
<link>https://news.google.com/articles/abc123</link>
<pubDate>Sat, 12 Apr 2026 19:20:02 GMT</pubDate>
<source url="https://finance.ltn.com.tw">自由財經</source>
</item>
<item>
<title>華爾街建議買入台積電</title>
<link>https://news.google.com/articles/def456</link>
<pubDate>Sat, 12 Apr 2026 18:11:00 GMT</pubDate>
<source url="https://tw.stock.yahoo.com">Yahoo股市</source>
</item>
</channel>
</rss>`

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

describe('collect-news', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-14T02:30:00.000Z'))
    vi.clearAllMocks()
    process.env.PUB_BLOB_READ_WRITE_TOKEN = 'blob-token'
    delete process.env.CRON_SECRET
    global.fetch = vi.fn()
    put.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
    delete process.env.PUB_BLOB_READ_WRITE_TOKEN
    delete process.env.CRON_SECRET
  })

  describe('fetchStockNews', () => {
    it('parses RSS XML and returns news items with relatedStocks', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_RSS,
      })

      const items = await fetchStockNews({ code: '2330', name: '台積電' }, { fetchImpl: mockFetch })

      expect(items).toHaveLength(2)
      expect(items[0].title).toBe('台積電法說會前站上2000元')
      expect(items[0].link).toContain('abc123')
      expect(items[0].source).toBe('自由財經')
      expect(items[0].relatedStocks).toEqual([{ code: '2330', name: '台積電' }])
    })

    it('returns empty array on fetch failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 })
      const items = await fetchStockNews({ code: '2330', name: '台積電' }, { fetchImpl: mockFetch })
      expect(items).toEqual([])
    })

    it('returns empty array on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('network error'))
      const items = await fetchStockNews({ code: '2330', name: '台積電' }, { fetchImpl: mockFetch })
      expect(items).toEqual([])
    })
  })

  describe('collectNewsFeed', () => {
    it('fetches news for all stocks and deduplicates', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_RSS,
      })

      const feed = await collectNewsFeed({
        stocks: [
          { code: '2330', name: '台積電' },
          { code: '2382', name: '廣達' },
        ],
        fetchImpl: mockFetch,
        logger: { info: vi.fn() },
      })

      expect(feed.stockCount).toBe(2)
      expect(feed.mergedCount).toBeGreaterThan(0)
      expect(feed.collectedAt).toBeTruthy()
      // Both stocks searched same RSS → deduped by link
      expect(feed.items.length).toBeLessThanOrEqual(2)
      // Deduped items should have both stocks in relatedStocks
      const first = feed.items[0]
      expect(first.relatedStocks.length).toBe(2)
      expect(first.relatedStocks.map((s) => s.code)).toContain('2330')
      expect(first.relatedStocks.map((s) => s.code)).toContain('2382')
    })

    it('handles partial failures gracefully', async () => {
      let callCount = 0
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount <= 1) return { ok: true, text: async () => SAMPLE_RSS }
        return { ok: false, status: 500 }
      })

      const feed = await collectNewsFeed({
        stocks: [
          { code: '2330', name: '台積電' },
          { code: '2382', name: '廣達' },
        ],
        fetchImpl: mockFetch,
        logger: { info: vi.fn() },
      })

      // First stock succeeds, second fails — should still have items
      expect(feed.mergedCount).toBeGreaterThan(0)
    })
  })

  it('writes a last-success marker and warns when the previous weekday run is late', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Codex HF-2: src/lib/cronLastSuccess.js no longer routes through api/_lib/last-success-store
    // and reads markers via @vercel/blob `get(key)` directly. Mock get() to return the previous
    // marker payload as JSON so the lateness check sees it.
    get.mockImplementation(async (key) => {
      if (key === 'last-success-collect-news.json') {
        return {
          json: async () => ({
            job: 'collect-news',
            lastSuccessAt: '2026-04-10T02:00:00.000Z',
          }),
        }
      }
      return null
    })

    global.fetch.mockImplementation(async () => ({
      ok: true,
      text: async () => SAMPLE_RSS,
    }))

    const req = { method: 'GET', headers: {} }
    const res = createMockResponse()

    const pending = handler(req, res)
    await vi.runAllTimersAsync()
    await pending

    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({
      ok: true,
    })
    expect(put).toHaveBeenNthCalledWith(
      1,
      'news-feed/latest.json',
      expect.any(String),
      expect.objectContaining({
        token: 'blob-token',
      })
    )
    expect(put).toHaveBeenNthCalledWith(
      2,
      'last-success-collect-news.json',
      expect.any(String),
      expect.objectContaining({
        token: 'blob-token',
        addRandomSuffix: false,
        allowOverwrite: true,
        access: 'public',
        contentType: 'application/json',
      })
    )
    expect(JSON.parse(put.mock.calls[1][1])).toMatchObject({
      job: 'collect-news',
      lateness: {
        late: true,
        elapsedWeekdays: 2,
        previousSuccessAt: '2026-04-10T02:00:00.000Z',
      },
    })
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('lateness alert for collect-news: 2 weekday gaps')
    )
    infoSpy.mockRestore()
    warnSpy.mockRestore()
  })
})
