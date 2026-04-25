import { withApiAuth } from './_lib/auth-middleware.js'
import { computeDailySnapshotHealth } from './_lib/daily-snapshot.js'
import { readLastSuccessMarker } from '../src/lib/cronLastSuccess.js'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const marker = await readLastSuccessMarker('daily-snapshot', {
    access: 'private',
    logger: console,
  })
  const health = computeDailySnapshotHealth(marker, { now: new Date() })

  return res.status(200).json({
    ok: !health.stale,
    ...health,
  })
}

export default withApiAuth(handler)
