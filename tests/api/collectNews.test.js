import { describe, it, expect, vi } from 'vitest'
import { fetchStockNews, collectNewsFeed } from '../../api/cron/collect-news.js'

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

describe('collect-news', () => {
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
})
