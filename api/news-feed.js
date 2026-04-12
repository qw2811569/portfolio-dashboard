import { list } from '@vercel/blob'

const NEWS_BLOB_KEY = 'news-feed/latest.json'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
  if (!token) return res.status(500).json({ error: 'blob token not configured' })

  try {
    const { blobs } = await list({ prefix: NEWS_BLOB_KEY, limit: 1, token })
    if (!blobs.length) {
      return res.status(200).json({ items: [], collectedAt: null })
    }
    const response = await fetch(blobs[0].url)
    if (!response.ok) {
      return res.status(502).json({ error: `blob read failed (${response.status})` })
    }
    const feed = await response.json()

    // Optional: filter by stock codes from query param
    const codes = String(req.query?.codes || '')
      .split(',')
      .filter(Boolean)
    if (codes.length > 0) {
      const codeSet = new Set(codes)
      feed.items = (feed.items || []).filter((item) =>
        (item.relatedStocks || []).some((s) => codeSet.has(s.code))
      )
    }

    // Optional: limit days from query param (default 3)
    const days = Number(req.query?.days) || 3
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    feed.items = (feed.items || []).filter((item) => {
      const d = new Date(item.pubDate)
      return !Number.isNaN(d.getTime()) && d >= cutoff
    })

    return res.status(200).json(feed)
  } catch (error) {
    console.error('[news-feed] failed:', error)
    return res.status(500).json({ error: error?.message || 'news feed read failed' })
  }
}
