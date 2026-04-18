import { calculateMDD } from './_lib/portfolio-snapshots.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const portfolioId = String(req.query?.portfolioId || '').trim()
  if (!portfolioId) {
    return res.status(400).json({ error: 'portfolioId is required' })
  }

  try {
    const result = await calculateMDD(portfolioId)
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
