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

const TRADE_AUDIT_FILE_REGEX = /^trade-audit-\d{4}-\d{2}\.jsonl$/u

export function getTradeAuditLogPath(now = new Date()) {
  return path.join(resolveWorkspaceRoot(), 'logs', `trade-audit-${formatMonthStamp(now)}.jsonl`)
}

function normalizeTradeAuditReadLimit(value, fallback = 60) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, 240)
}

function normalizeTradeAuditPortfolioFilter(value = '') {
  return String(value || '').trim()
}

function parseTradeAuditJsonLine(line = '') {
  const raw = String(line || '').trim()
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export async function listTradeAuditLogPaths({ root = resolveWorkspaceRoot() } = {}) {
  const logsDir = path.join(root, 'logs')

  try {
    const fileNames = await fsPromises.readdir(logsDir)
    return fileNames
      .filter((fileName) => TRADE_AUDIT_FILE_REGEX.test(fileName))
      .sort((left, right) => right.localeCompare(left))
      .map((fileName) => path.join(logsDir, fileName))
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

export async function readTradeAuditEntries({
  portfolioId = '',
  limit = 60,
  filePaths = null,
} = {}) {
  const normalizedPortfolioId = normalizeTradeAuditPortfolioFilter(portfolioId)
  const normalizedLimit = normalizeTradeAuditReadLimit(limit)
  const targetFilePaths =
    Array.isArray(filePaths) && filePaths.length > 0 ? filePaths : await listTradeAuditLogPaths()
  const entries = []

  for (const filePath of targetFilePaths) {
    let content = ''

    try {
      content = await fsPromises.readFile(filePath, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }

    const lines = content.split(/\r?\n/u)

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const parsed = parseTradeAuditJsonLine(lines[index])
      if (!parsed) continue
      if (
        normalizedPortfolioId &&
        normalizeTradeAuditPortfolioFilter(parsed?.portfolioId) !== normalizedPortfolioId
      ) {
        continue
      }

      entries.push({
        ...parsed,
        sourceFile: path.basename(filePath),
      })

      if (entries.length >= normalizedLimit) {
        return entries
      }
    }
  }

  return entries
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
