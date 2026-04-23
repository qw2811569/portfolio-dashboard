import { withApiAuth } from './_lib/auth-middleware.js'
import { appendTradeAuditEntry } from './_lib/trade-audit.js'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { entry, filePath } = await appendTradeAuditEntry(req.body || {})
    return res.status(200).json({
      saved: true,
      portfolioId: entry.portfolioId,
      filePath,
      ts: entry.ts,
    })
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'trade audit append failed' })
  }
}

export default withApiAuth(handler)
