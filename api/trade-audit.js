import { withApiAuth } from './_lib/auth-middleware.js'
import { appendTradeAuditEntry, readTradeAuditEntries } from './_lib/trade-audit.js'

function getQueryValue(req, key) {
  const value = req?.query?.[key]
  if (Array.isArray(value)) return value[0]
  return value
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    if (req.method === 'GET') {
      const portfolioId = String(getQueryValue(req, 'portfolioId') || '').trim()
      const limit = getQueryValue(req, 'limit')
      const entries = await readTradeAuditEntries({ portfolioId, limit })

      return res.status(200).json({
        entries,
        summary: {
          portfolioId,
          count: entries.length,
          lastUpdatedAt: entries[0]?.ts || '',
        },
      })
    }

    const { entry, filePath } = await appendTradeAuditEntry(req.body || {})
    return res.status(200).json({
      saved: true,
      portfolioId: entry.portfolioId,
      filePath,
      ts: entry.ts,
    })
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'trade audit request failed' })
  }
}

export default withApiAuth(handler)
