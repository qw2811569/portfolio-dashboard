import { put, list } from '@vercel/blob'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { getTelemetryBlobToken } from './_lib/blob-tokens.js'

const TOKEN = getTelemetryBlobToken()
const DATA_DIR = join(process.cwd(), 'data')
const TELEMETRY_KEY = 'telemetry-events.json'
const TELEMETRY_LIMIT = 200

function localPath(key) {
  return join(DATA_DIR, key.replace(/\//g, '__'))
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

function readLocal(key) {
  try {
    const target = localPath(key)
    if (!existsSync(target)) return null
    return JSON.parse(readFileSync(target, 'utf-8'))
  } catch {
    return null
  }
}

function writeLocal(key, data) {
  try {
    ensureDataDir()
    writeFileSync(localPath(key), JSON.stringify(data, null, 2))
  } catch {
    /* best-effort local telemetry cache */
  }
}

async function readPath(pathname, opts) {
  try {
    const { blobs } = await list({ prefix: pathname, limit: 1, ...opts })
    if (!blobs.length) return null
    const response = await fetch(blobs[0].url)
    return response.json()
  } catch {
    return null
  }
}

async function write(pathname, data, opts) {
  writeLocal(pathname, data)
  try {
    await put(pathname, JSON.stringify(data), {
      contentType: 'application/json',
      access: 'public',
      addRandomSuffix: false,
      ...opts,
    })
  } catch {
    /* best-effort blob telemetry backup */
  }
}

async function read(pathname, opts) {
  const local = readLocal(pathname)
  if (local) return local
  const cloud = await readPath(pathname, opts)
  if (cloud) writeLocal(pathname, cloud)
  return cloud
}

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
  const opts = { token: TOKEN }

  try {
    if (req.method === 'GET') {
      const action = req.query?.action || 'recent'
      if (action !== 'recent') {
        return res.status(400).json({ error: '未知 action' })
      }

      const current = normalizeTelemetryEntries((await read(TELEMETRY_KEY, opts)) || [])
      return res.status(200).json({ entries: current.slice(0, 50) })
    }

    if (req.method === 'POST') {
      const { action, data } = req.body || {}
      if (action !== 'capture-diagnostics') {
        return res.status(400).json({ error: '未知 action' })
      }

      const incoming = normalizeTelemetryEntries(data?.entries || [])
      const current = normalizeTelemetryEntries((await read(TELEMETRY_KEY, opts)) || [])
      const next = normalizeTelemetryEntries([...incoming, ...current])

      await write(TELEMETRY_KEY, next, opts)
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
