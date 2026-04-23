import { get } from '@vercel/blob'
import { withApiAuth } from './_lib/auth-middleware.js'
import { computeDailySnapshotHealth } from './_lib/daily-snapshot.js'
import { getPrivateBlobToken } from './_lib/blob-tokens.js'
import { readLastSuccessMarker } from '../src/lib/cronLastSuccess.js'

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = getPrivateBlobToken()
  if (!token) {
    return res.status(500).json({ error: 'blob token not configured' })
  }

  const marker = await readLastSuccessMarker('daily-snapshot', {
    token,
    getImpl: get,
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
