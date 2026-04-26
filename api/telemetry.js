import { readTelemetry, writeTelemetry } from './_lib/telemetry-store.js'

const TELEMETRY_LIMIT = 200

function normalizeDiagnosticEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const kind = String(value.kind || 'unknown').trim()
  const timestamp = String(value.timestamp || new Date().toISOString()).trim()
  const error =
    value.error && typeof value.error === 'object' && !Array.isArray(value.error)
      ? {
          name: String(value.error.name || 'RuntimeDiagnostic').trim(),
          message: String(value.error.message || 'unknown').trim(),
          stack: typeof value.error.stack === 'string' ? value.error.stack : null,
        }
      : {
          name: 'RuntimeDiagnostic',
          message: String(value.error || 'unknown'),
          stack: null,
        }

  return {
    id: String(value.id || `${timestamp}-${Math.random().toString(16).slice(2, 8)}`),
    kind,
    timestamp,
    level: ['warn', 'error'].includes(String(value.level || '').trim())
      ? String(value.level).trim()
      : 'error',
    error,
    context:
      value.context && typeof value.context === 'object' && !Array.isArray(value.context)
        ? value.context
        : {},
  }
}

function normalizeTelemetryEntries(entries) {
  const seen = new Set()
  return (Array.isArray(entries) ? entries : [])
    .map(normalizeDiagnosticEntry)
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry.id)) return false
      seen.add(entry.id)
      return true
    })
    .sort((left, right) => {
      const leftTime = Date.parse(left.timestamp) || 0
      const rightTime = Date.parse(right.timestamp) || 0
      return rightTime - leftTime
    })
    .slice(0, TELEMETRY_LIMIT)
}

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const action = req.query?.action || 'recent'
      if (action !== 'recent') {
        return res.status(400).json({ error: '未知 action' })
      }

      const current = normalizeTelemetryEntries((await readTelemetry()) || [])
      return res.status(200).json({ entries: current.slice(0, 50) })
    }

    if (req.method === 'POST') {
      const { action, data } = req.body || {}
      if (action !== 'capture-diagnostics') {
        return res.status(400).json({ error: '未知 action' })
      }

      const incoming = normalizeTelemetryEntries(data?.entries || [])
      const current = normalizeTelemetryEntries((await readTelemetry()) || [])
      const next = normalizeTelemetryEntries([...incoming, ...current])

      await writeTelemetry(next)
      return res.status(200).json({
        ok: true,
        accepted: incoming.length,
        stored: next.length,
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'telemetry handler failed' })
  }
}

export default handler
