import { withApiAuth } from './_lib/auth-middleware.js'
import { computeDailySnapshotHealth } from './_lib/daily-snapshot.js'
import { readLastSuccessMarker } from '../src/lib/cronLastSuccess.js'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let marker = null
  try {
    marker = await readLastSuccessMarker('daily-snapshot', {
      access: 'private',
      logger: console,
    })
  } catch (error) {
    if (error?.code === 'STORAGE_OUTAGE') {
      console.error('[daily-snapshot-status] storage outage while reading marker:', error)
      return res.status(500).json({
        ok: false,
        error: 'Storage outage while reading daily snapshot marker',
        code: 'STORAGE_OUTAGE',
      })
    }
    throw error
  }

  const health = computeDailySnapshotHealth(marker, { now: new Date() })

  return res.status(200).json({
    ok: !health.stale,
    ...health,
  })
}

export default withApiAuth(handler)
