import { withApiAuth } from './_lib/auth-middleware.js'
import { calculateMDD } from './_lib/portfolio-snapshots.js'
import { resolveSignedBlobOrigin } from './_lib/signed-url.js'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const portfolioId = String(req.query?.portfolioId || '').trim()
  if (!portfolioId) {
    return res.status(400).json({ error: 'portfolioId is required' })
  }

  try {
    const result = await calculateMDD(portfolioId, {}, { origin: resolveSignedBlobOrigin(req) })
    if (result.reason === 'insufficient_history') {
      return res.status(200).json({
        portfolioId,
        mdd: null,
        reason: result.reason,
        snapshots: result.snapshots || 0,
        peak: null,
        trough: null,
      })
    }

    return res.status(200).json({
      portfolioId,
      mdd: result.mdd,
      snapshots: result.snapshots,
      peak: result.peak,
      trough: result.trough,
      peakDate: result.peakDate,
      troughDate: result.troughDate,
    })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'portfolio mdd failed' })
  }
}

export default withApiAuth(handler)
