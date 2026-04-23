import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'

const AUDIT_USER_ALIASES = Object.freeze({
  me: 'xiaokui',
  7865: 'jinliancheng-chairwoman',
  jinliancheng: 'jinliancheng-chairwoman',
})

function resolveWorkspaceRoot() {
  const explicit = String(process.env.WORKSPACE_ROOT || '').trim()
  if (explicit) return explicit

  const candidates = [explicit, process.cwd(), path.resolve(process.cwd(), '..')].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
  }

  return explicit || process.cwd()
}

function normalizeIsoString(value, fallback = new Date()) {
  const parsed = value ? new Date(value) : fallback
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function formatMonthStamp(value = new Date()) {
  return normalizeIsoString(value).slice(0, 7)
}

export function getTradeAuditLogPath(now = new Date()) {
  return path.join(resolveWorkspaceRoot(), 'logs', `trade-audit-${formatMonthStamp(now)}.jsonl`)
}

function resolveAuditUserId(portfolioId, requestUserId = '') {
  const normalizedRequestUserId = String(requestUserId || '').trim()
  if (normalizedRequestUserId) return normalizedRequestUserId
  return AUDIT_USER_ALIASES[String(portfolioId || '').trim()] || String(portfolioId || '').trim()
}

function normalizeAuditPayload(payload = {}) {
  const portfolioId = String(payload.portfolioId || payload.pid || '').trim()
  if (!portfolioId) throw new Error('portfolioId is required')

  const action = String(payload.action || '').trim() || 'trade.confirm'
  if (!payload.before || typeof payload.before !== 'object') {
    throw new Error('before snapshot is required')
  }
  if (!payload.after || typeof payload.after !== 'object') {
    throw new Error('after snapshot is required')
  }

  return {
    ts: normalizeIsoString(payload.ts),
    userId: resolveAuditUserId(portfolioId, payload.userId),
    portfolioId,
    action,
    before: payload.before,
    after: payload.after,
    disclaimerAckedAt: String(payload.disclaimerAckedAt || '').trim() || null,
  }
}

async function appendJsonLine(filePath, record) {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
  const payload = `${JSON.stringify(record)}\n`

  try {
    const stats = await fsPromises.stat(filePath)
    if (stats.size > 0) {
      const handle = await fsPromises.open(filePath, 'r')
      try {
        const buffer = Buffer.alloc(1)
        await handle.read(buffer, 0, 1, stats.size - 1)
        const prefix = buffer[0] === 0x0a ? '' : '\n'
        await fsPromises.appendFile(filePath, `${prefix}${payload}`, 'utf-8')
        return
      } finally {
        await handle.close()
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  await fsPromises.appendFile(filePath, payload, 'utf-8')
}

export async function appendTradeAuditEntry(payload, { filePath = null } = {}) {
  const entry = normalizeAuditPayload({
    ...payload,
    ts: payload?.ts || new Date().toISOString(),
  })
  const targetPath = filePath || getTradeAuditLogPath(entry.ts)
  await appendJsonLine(targetPath, entry)
  return {
    entry,
    filePath: targetPath,
  }
}
