import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { get, put } from '@vercel/blob'
import { appendLogLine } from './append-log-store.js'
import { getPrivateBlobToken } from './blob-tokens.js'
import {
  getMorningNoteSnapshotStoreKey,
  readMorningNoteSnapshotStore,
  writeMorningNoteSnapshotStore,
} from './morning-note-snapshot-store.js'
import { getTaipeiClock } from '../../src/lib/datetime.js'

export const MORNING_NOTE_SCHEMA_VERSION = 1
export const MORNING_NOTE_TIMEZONE = 'Asia/Taipei'
export const MORNING_NOTE_SNAPSHOT_PREFIX = 'snapshot/morning-note'
export const MORNING_NOTE_LOG_PREFIX = 'logs/morning-note'
export const MORNING_NOTE_FALLBACK_COPY = '今日無 pre-open 更新 · 請等開盤 T1'

export const MORNING_NOTE_PORTFOLIOS = Object.freeze({
  me: Object.freeze({
    snapshotKey: 'me',
    policyId: 'me',
    displayName: '我',
    complianceMode: 'retail',
    aliases: ['me', 'owner', 'xiaokui'],
  }),
  7865: Object.freeze({
    snapshotKey: '7865',
    policyId: 'jinliancheng',
    displayName: '7865 金聯成',
    complianceMode: 'insider',
    aliases: ['7865', 'jinliancheng', '金聯成', '金聯成組合'],
  }),
})

const MORNING_NOTE_PORTFOLIO_LIST = Object.values(MORNING_NOTE_PORTFOLIOS)

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function formatDateParts(value = new Date(), timeZone = MORNING_NOTE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: byType.year,
    month: byType.month,
    day: byType.day,
  }
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
}

function readBlobToken() {
  return getPrivateBlobToken()
}

function resolveWorkspaceRoot() {
  const explicit = String(process.env.WORKSPACE_ROOT || '').trim()
  if (explicit) return explicit

  const candidates = [process.cwd(), path.resolve(process.cwd(), '..')]
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
  }

  return process.cwd()
}

function buildEmptySections() {
  return {
    todayEvents: [],
    holdingStatus: [],
    institutional: null,
    watchlistAlerts: [],
    announcements: [],
  }
}

async function readBlobText(pathname, { token = readBlobToken(), getImpl = get } = {}) {
  if (!token) return null

  try {
    const blobResult = await getImpl(pathname, {
      access: 'private',
      token,
      useCache: false,
    })
    if (!blobResult) return null
    return await new Response(blobResult.stream).text()
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
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

export function resolveMorningNotePortfolioKey(value, { portfolioName = '', viewMode = '' } = {}) {
  const normalizedViewMode = normalizeId(viewMode)
  if (normalizedViewMode === 'insider-compressed') return '7865'

  const normalizedPortfolioName = normalizeId(portfolioName)
  if (normalizedPortfolioName) {
    const nameMatched = MORNING_NOTE_PORTFOLIO_LIST.find((portfolio) =>
      portfolio.aliases.some((alias) => normalizeId(alias) === normalizedPortfolioName)
    )
    if (nameMatched) return nameMatched.snapshotKey
  }

  const normalized = normalizeId(value)
  if (!normalized) return 'me'

  const matched = MORNING_NOTE_PORTFOLIO_LIST.find((portfolio) =>
    portfolio.aliases.some((alias) => normalizeId(alias) === normalized)
  )
  return matched?.snapshotKey || 'me'
}

export function resolveMorningNotePortfolioMeta(value, options = {}) {
  return (
    MORNING_NOTE_PORTFOLIOS[resolveMorningNotePortfolioKey(value, options)] ||
    MORNING_NOTE_PORTFOLIOS.me
  )
}

export function listMorningNotePortfolioKeys() {
  return MORNING_NOTE_PORTFOLIO_LIST.map((portfolio) => portfolio.snapshotKey)
}

export function formatMorningNoteMarketDate(value = new Date(), timeZone = MORNING_NOTE_TIMEZONE) {
  const { year, month, day } = formatDateParts(value, timeZone)
  return `${year}-${month}-${day}`
}

export function formatMorningNoteDisplayDate(value = new Date(), timeZone = MORNING_NOTE_TIMEZONE) {
  return formatMorningNoteMarketDate(value, timeZone).replace(/-/g, '/')
}

export function getMorningNoteSnapshotKey(date = formatMorningNoteMarketDate()) {
  return getMorningNoteSnapshotStoreKey(date)
}

export function getMorningNoteLogKey(value = new Date(), timeZone = MORNING_NOTE_TIMEZONE) {
  const { year, month } = formatDateParts(value, timeZone)
  return `${MORNING_NOTE_LOG_PREFIX}-${year}-${month}.jsonl`
}

export function getMorningNoteAlertPath() {
  return path.join(resolveWorkspaceRoot(), 'coordination', 'llm-bus', 'alerts.jsonl')
}

export function buildMorningNoteFallbackNote({
  portfolioKey = 'me',
  marketDate = formatMorningNoteMarketDate(),
  date = formatMorningNoteDisplayDate(),
  staleStatus = 'missing',
  reason = '',
  message = MORNING_NOTE_FALLBACK_COPY,
  blockedReason = null,
  generatedAt = null,
  source = 'morning-note-fallback',
} = {}) {
  const meta = resolveMorningNotePortfolioMeta(portfolioKey)

  return {
    portfolioId: meta.snapshotKey,
    policyId: meta.policyId,
    displayName: meta.displayName,
    complianceMode: meta.complianceMode,
    marketDate,
    date,
    generatedAt,
    staleStatus,
    staleReasons: reason ? [reason] : [],
    source,
    accuracyStatus: blockedReason ? 'blocked' : 'fallback',
    headline: '',
    summary: '',
    lead: '',
    focusPoints: [],
    sections: buildEmptySections(),
    blockedReason: String(blockedReason || '').trim() || null,
    fallbackMessage: String(message || MORNING_NOTE_FALLBACK_COPY).trim(),
  }
}

export function coerceMorningNotePortfolio(note, { portfolioKey = 'me', marketDate } = {}) {
  if (!note || typeof note !== 'object' || Array.isArray(note)) {
    return buildMorningNoteFallbackNote({
      portfolioKey,
      marketDate,
      date: marketDate ? marketDate.replace(/-/g, '/') : undefined,
      reason: 'missing_note_payload',
    })
  }

  const meta = resolveMorningNotePortfolioMeta(portfolioKey)
  const normalizedMarketDate = String(note.marketDate || marketDate || '').trim()
  const displayDate =
    String(note.date || '').trim() ||
    (normalizedMarketDate && isIsoDate(normalizedMarketDate)
      ? normalizedMarketDate.replace(/-/g, '/')
      : formatMorningNoteDisplayDate())

  return {
    portfolioId: meta.snapshotKey,
    policyId: meta.policyId,
    displayName: meta.displayName,
    complianceMode: meta.complianceMode,
    marketDate: normalizedMarketDate || formatMorningNoteMarketDate(),
    date: displayDate,
    generatedAt: String(note.generatedAt || '').trim() || null,
    staleStatus: String(note.staleStatus || '').trim() || 'fresh',
    staleReasons: Array.isArray(note.staleReasons) ? note.staleReasons.filter(Boolean) : [],
    source: String(note.source || '').trim() || 'morning-note',
    accuracyStatus: String(note.accuracyStatus || '').trim() || 'pass',
    headline: String(note.headline || '').trim(),
    summary: String(note.summary || '').trim(),
    lead: String(note.lead || '').trim(),
    focusPoints: Array.isArray(note.focusPoints) ? note.focusPoints.filter(Boolean) : [],
    sections:
      note.sections && typeof note.sections === 'object' && !Array.isArray(note.sections)
        ? {
            ...buildEmptySections(),
            ...note.sections,
          }
        : buildEmptySections(),
    blockedReason: String(note.blockedReason || '').trim() || null,
    fallbackMessage: String(note.fallbackMessage || '').trim() || null,
  }
}

export async function readMorningNoteSnapshot(
  date = formatMorningNoteMarketDate(),
  { token = readBlobToken(), getImpl = get } = {}
) {
  return readMorningNoteSnapshotStore(date, { token, getImpl })
}

export async function writeMorningNoteSnapshot(
  snapshot,
  { token = readBlobToken(), putImpl = put } = {}
) {
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for morning note writes')
  }

  const marketDate = String(snapshot?.marketDate || '').trim()
  if (!isIsoDate(marketDate)) {
    throw new Error('snapshot.marketDate must be YYYY-MM-DD')
  }

  const payload = {
    schemaVersion: MORNING_NOTE_SCHEMA_VERSION,
    timeZone: MORNING_NOTE_TIMEZONE,
    ...snapshot,
  }

  await writeMorningNoteSnapshotStore(marketDate, payload, {
    token,
    putImpl,
  })

  return payload
}

export async function appendMorningNoteLog(
  entry,
  { token = readBlobToken(), getImpl = get, putImpl = put, ...options } = {}
) {
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for morning note log writes')
  }

  const now = entry?.ts ? new Date(entry.ts) : new Date()
  const logKey = getMorningNoteLogKey(now)
  const line = JSON.stringify(entry)
  await appendLogLine('morning_note_log', logKey, line, {
    token,
    getImpl,
    putImpl,
    ...options,
  })

  return {
    key: logKey,
    line,
  }
}

export async function appendMorningNoteAlert(entry, { filePath = getMorningNoteAlertPath() } = {}) {
  await appendJsonLine(filePath, entry)
  return filePath
}

export function getMorningNoteClock(now = new Date()) {
  return getTaipeiClock(now)
}
