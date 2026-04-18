import { appendPendingDecisionAnswer, listPendingDecisions } from './pending-decisions-store.js'

function getBooleanQuery(value) {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === '1' || raw === 'true'
}

export async function handlePendingDecisionsList(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const includeHistory = getBooleanQuery(req?.query?.history)
  const payload = await listPendingDecisions({ includeHistory })
  return res.status(200).json(payload)
}

export async function handlePendingDecisionAnswer(req, res, id) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await appendPendingDecisionAnswer(id, req?.body || {})
    return res.status(200).json({
      ok: true,
      decision: result,
    })
  } catch (error) {
    const message = error?.message || 'Failed to answer pending decision'
    const statusCode = message === 'Decision not found' ? 404 : 400
    return res.status(statusCode).json({ error: message })
  }
}
