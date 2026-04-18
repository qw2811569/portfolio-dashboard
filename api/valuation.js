import { list } from '@vercel/blob'
import { withApiAuth } from './_lib/auth-middleware.js'

const TOKEN_KEY = 'PUB_BLOB_READ_WRITE_TOKEN'
const VALUATION_PREFIX = 'valuation'

function normalizeMethod(value) {
  const method = String(value || '').trim()
  if (['historical-per-band', 'eps-negative', 'insufficient-data'].includes(method)) {
    return method
  }
  return 'insufficient-data'
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const code = String(req.query?.code || '').trim()
  if (!code) return res.status(400).json({ error: 'code query param is required' })

  const token = String(process.env[TOKEN_KEY] || '').trim()
  if (!token) return res.status(500).json({ error: 'blob token not configured' })

  try {
    const { blobs } = await list({
      prefix: `${VALUATION_PREFIX}/${code}.json`,
      limit: 1,
      token,
    })

    if (!blobs.length) {
      return res.status(304).json({
        code,
        hint: 'compute required',
      })
    }

    const response = await fetch(blobs[0].url)
    if (!response.ok) {
      return res.status(502).json({ error: `blob read failed (${response.status})` })
    }

    const snapshot = await response.json()
    res.setHeader('x-valuation-method', normalizeMethod(snapshot?.method))
    res.setHeader('x-valuation-confidence', String(snapshot?.confidence || 'low'))
    res.setHeader('x-valuation-position', String(snapshot?.positionInBand || 'unknown'))
    return res.status(200).json(snapshot)
  } catch (error) {
    console.error(`[valuation] failed for ${code}:`, error)
    return res.status(500).json({ error: error?.message || 'internal error' })
  }
}

export default withApiAuth(handler)
