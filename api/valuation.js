import { withApiAuth } from './_lib/auth-middleware.js'
import { readValuationSnapshot } from './_lib/valuation-store.js'

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

  try {
    const snapshot = await readValuationSnapshot(code)
    if (!snapshot) {
      return res.status(304).json({
        code,
        hint: 'compute required',
      })
    }

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
