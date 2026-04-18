import { withApiAuth } from './_lib/auth-middleware.js'
import { get } from '@vercel/blob'
import { getPrivateBlobToken } from './_lib/blob-tokens.js'

const TARGET_PRICE_PREFIX = 'target-prices'

function normalizeTargetSource(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (['gemini', 'rss', 'cnyes', 'cmoney'].includes(normalized)) return normalized
  if (normalized === 'per-band' || normalized === 'finmind-per-band') return 'per-band'
  return 'rss'
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const code = String(req.query?.code || '').trim()
  if (!code) return res.status(400).json({ error: 'code query param is required' })

  const token = getPrivateBlobToken()
  if (!token) return res.status(500).json({ error: 'blob token not configured' })

  try {
    const blobResult = await get(`${TARGET_PRICE_PREFIX}/${code}.json`, {
      access: 'private',
      token,
      useCache: false,
    })

    if (!blobResult) {
      return res.status(404).json({ error: `no target-price snapshot for ${code}` })
    }

    const snapshot = await new Response(blobResult.stream).json()
    const reportCount = Array.isArray(snapshot?.targets?.reports)
      ? snapshot.targets.reports.length
      : 0
    res.setHeader('x-target-price-source', normalizeTargetSource(snapshot?.targets?.source))
    res.setHeader('x-target-price-count', String(reportCount))
    res.setHeader(
      'x-target-price-coverage-state',
      String(snapshot?.targets?.coverageState || 'none')
    )
    return res.status(200).json(snapshot)
  } catch (error) {
    console.error(`[target-prices] failed for ${code}:`, error)
    return res.status(500).json({ error: error?.message || 'internal error' })
  }
}

export default withApiAuth(handler)
