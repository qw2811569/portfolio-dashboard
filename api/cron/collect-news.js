import { put } from '@vercel/blob'
import { INIT_HOLDINGS, INIT_HOLDINGS_JINLIANCHENG, STOCK_META } from '../../src/seedData.js'

const NEWS_BLOB_KEY = 'news-feed/latest.json'
const MAX_ITEMS_PER_STOCK = 5
const MAX_TOTAL_ITEMS = 100
const FETCH_TIMEOUT_MS = 8000
const CONCURRENCY_LIMIT = 3
const PAUSE_BETWEEN_BATCHES_MS = 500

function getBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
}

function getTrackedStocks() {
  const seen = new Set()
  const stocks = []
  for (const h of [...INIT_HOLDINGS, ...INIT_HOLDINGS_JINLIANCHENG]) {
    if (seen.has(h.code)) continue
    seen.add(h.code)
    const type = String(h.type || STOCK_META[h.code]?.strategy || '').trim()
    // Skip non-company types — no meaningful news for warrants/ETF/index/bond
    if (['權證', 'ETF', '指數', '債券', 'ETF/指數'].includes(type)) continue
    stocks.push({ code: h.code, name: h.name })
  }
  return stocks
}

function buildGoogleNewsUrl(stockName) {
  const query = encodeURIComponent(`${stockName} 台股`)
  return `https://news.google.com/rss/search?q=${query}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
}

function parseRssXml(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''
    const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || ''
    if (!title.trim() || !link.trim()) continue
    items.push({
      title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
      link: link.trim(),
      pubDate: pubDate.trim(),
      source: source.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
    })
  }
  return items
}

export async function fetchStockNews(
  stock,
  { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}
) {
  const url = buildGoogleNewsUrl(stock.name)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: controller.signal })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRssXml(xml)
      .slice(0, MAX_ITEMS_PER_STOCK)
      .map((item) => ({
        ...item,
        relatedStocks: [{ code: stock.code, name: stock.name }],
      }))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

function dedupeAndMerge(allItems) {
  const byLink = new Map()
  for (const item of allItems) {
    const key = item.link
    if (byLink.has(key)) {
      const existing = byLink.get(key)
      // Merge relatedStocks
      const codes = new Set(existing.relatedStocks.map((s) => s.code))
      for (const s of item.relatedStocks) {
        if (!codes.has(s.code)) {
          existing.relatedStocks.push(s)
          codes.add(s.code)
        }
      }
    } else {
      byLink.set(key, { ...item })
    }
  }
  return Array.from(byLink.values())
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, MAX_TOTAL_ITEMS)
}

export async function collectNewsFeed({
  stocks = getTrackedStocks(),
  fetchImpl = fetch,
  logger = console,
} = {}) {
  const allItems = []
  // Batch with concurrency limit
  for (let i = 0; i < stocks.length; i += CONCURRENCY_LIMIT) {
    const batch = stocks.slice(i, i + CONCURRENCY_LIMIT)
    const results = await Promise.allSettled(
      batch.map((stock) => fetchStockNews(stock, { fetchImpl }))
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.length > 0) {
        allItems.push(...r.value)
      }
    }
    if (i + CONCURRENCY_LIMIT < stocks.length) {
      await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_BATCHES_MS))
    }
  }
  logger.info(`[collect-news] fetched ${allItems.length} raw items from ${stocks.length} stocks`)
  const merged = dedupeAndMerge(allItems)
  logger.info(`[collect-news] deduped to ${merged.length} items`)
  return {
    items: merged,
    collectedAt: new Date().toISOString(),
    stockCount: stocks.length,
    rawCount: allItems.length,
    mergedCount: merged.length,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = String(process.env.CRON_SECRET || '').trim()
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = getBlobToken()
  if (!token) return res.status(500).json({ error: 'blob token not configured' })

  try {
    const feed = await collectNewsFeed({ logger: console })
    await put(NEWS_BLOB_KEY, JSON.stringify(feed, null, 2), {
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      access: 'public',
      contentType: 'application/json',
    })
    return res.status(200).json({
      ok: true,
      stockCount: feed.stockCount,
      rawCount: feed.rawCount,
      mergedCount: feed.mergedCount,
    })
  } catch (error) {
    console.error('[collect-news] handler failed:', error)
    return res.status(500).json({ error: error?.message || 'collect news failed' })
  }
}
