import { withApiAuth } from './_lib/auth-middleware.js'
import { get, head } from '@vercel/blob'

const NEWS_BLOB_KEY = 'news-feed/latest.json'

async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  if (!['GET', 'HEAD'].includes(req.method))
    return res.status(405).json({ error: 'Method not allowed' })

  const token = String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
  if (!token) return res.status(500).json({ error: 'blob token not configured' })

  try {
    if (req.method === 'HEAD') {
      try {
        await head(NEWS_BLOB_KEY, { token })
      } catch (error) {
        if (error?.name !== 'BlobNotFoundError') throw error
      }
      return res.status(200).end()
    }

    const blobResult = await get(NEWS_BLOB_KEY, { access: 'public', token })
    if (!blobResult) {
      return res.status(200).json({ items: [], collectedAt: null })
    }

    const feed = await new Response(blobResult.stream).json()

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

export default withApiAuth(handler)
