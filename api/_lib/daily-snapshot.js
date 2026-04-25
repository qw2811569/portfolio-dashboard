import path from 'node:path'
import { createHash } from 'node:crypto'
import { get, put } from '@vercel/blob'
import { getPrivateBlobToken } from './blob-tokens.js'
import { getSnapshotBrainPrefix } from './snapshot-brain-store.js'
import { getSnapshotPortfolioStatePrefix } from './snapshot-portfolio-state-store.js'
import { getSnapshotResearchPrefix } from './snapshot-research-store.js'

export const DAILY_SNAPSHOT_SCHEMA_VERSION = 1
export const DAILY_SNAPSHOT_TIMEZONE = 'Asia/Taipei'
export const DAILY_SNAPSHOT_STALE_AFTER_HOURS = 36
export const DAILY_SNAPSHOT_HOT_RETENTION_DAYS = 30
export const DAILY_SNAPSHOT_COLD_RETENTION_DAYS = 90

export const DAILY_SNAPSHOT_LOG_PREFIX = 'logs/daily-snapshot'
export const RESTORE_REHEARSAL_LOG_PREFIX = 'logs/restore-rehearsal'

export const PORTFOLIO_STATE_FIELD_SPECS = Object.freeze([
  Object.freeze({ suffix: 'holdings-v2', fileName: 'holdings.json', emptyValue: [] }),
  Object.freeze({ suffix: 'log-v2', fileName: 'tradeLog.json', emptyValue: [] }),
  Object.freeze({ suffix: 'targets-v1', fileName: 'targets.json', emptyValue: {} }),
  Object.freeze({ suffix: 'fundamentals-v1', fileName: 'fundamentals.json', emptyValue: {} }),
  Object.freeze({ suffix: 'news-events-v1', fileName: 'newsEvents.json', emptyValue: [] }),
])

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function formatDateParts(value = new Date(), timeZone = DAILY_SNAPSHOT_TIMEZONE) {
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

export function formatDailySnapshotDate(value = new Date(), timeZone = DAILY_SNAPSHOT_TIMEZONE) {
  const { year, month, day } = formatDateParts(value, timeZone)
  return `${year}-${month}-${day}`
}

export function formatYearMonth(value = new Date(), timeZone = DAILY_SNAPSHOT_TIMEZONE) {
  const { year, month } = formatDateParts(value, timeZone)
  return `${year}-${month}`
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
}

export function getDailySnapshotManifestKey(date) {
  const normalized = String(date || '').trim()
  if (!isIsoDate(normalized)) throw new Error('daily snapshot date must be YYYY-MM-DD')
  return `snapshot/daily-manifest/${normalized}.json`
}

export function getDailySnapshotResearchPrefix(date) {
  return trimTrailingSlash(getSnapshotResearchPrefix(date))
}

export function getDailySnapshotBrainPrefix(date) {
  return trimTrailingSlash(getSnapshotBrainPrefix(date))
}

export function getDailySnapshotPortfolioStatePrefix(date) {
  return trimTrailingSlash(getSnapshotPortfolioStatePrefix(date))
}

export function getDailySnapshotLocalStorageKey(date) {
  const normalized = String(date || '').trim()
  if (!isIsoDate(normalized)) throw new Error('daily snapshot date must be YYYY-MM-DD')
  return `snapshot/localStorage-checkpoint/${normalized}.json`
}

export function getDailySnapshotDatedMarkerKey(date) {
  const normalized = String(date || '').trim()
  if (!isIsoDate(normalized)) throw new Error('daily snapshot date must be YYYY-MM-DD')
  return `last-success/daily-snapshot/${normalized}.txt`
}

export function getDailySnapshotLogKey(value = new Date(), timeZone = DAILY_SNAPSHOT_TIMEZONE) {
  return `${DAILY_SNAPSHOT_LOG_PREFIX}-${formatYearMonth(value, timeZone)}.jsonl`
}

export function getRestoreRehearsalLogKey(value = new Date(), timeZone = DAILY_SNAPSHOT_TIMEZONE) {
  return `${RESTORE_REHEARSAL_LOG_PREFIX}-${formatYearMonth(value, timeZone)}.jsonl`
}

export function sha256Text(value) {
  return createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex')
}

function toBlobText(blobResult) {
  if (!blobResult?.stream) return ''
  return new Response(blobResult.stream).text()
}

export async function readBlobText(
  pathname,
  { token = getPrivateBlobToken(), getImpl = get } = {}
) {
  if (!token) return null

  try {
    const blobResult = await getImpl(pathname, {
      access: 'private',
      token,
      useCache: false,
    })
    if (!blobResult) return null
    return await toBlobText(blobResult)
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
  }
}

export async function appendBlobJsonLine(
  key,
  entry,
  { token = getPrivateBlobToken(), getImpl = get, putImpl = put } = {}
) {
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for blob log writes')
  }

  const existing = (await readBlobText(key, { token, getImpl })) || ''
  const nextLine = `${JSON.stringify(entry)}\n`
  const nextText =
    existing.trim().length > 0 ? `${existing.replace(/\s*$/, '\n')}${nextLine}` : nextLine

  await putImpl(key, nextText, {
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    access: 'private',
    contentType: 'application/x-ndjson',
  })

  return {
    key,
    line: nextLine.trimEnd(),
  }
}

function cloneEmptyValue(value) {
  if (Array.isArray(value)) return [...value]
  if (value && typeof value === 'object') return { ...value }
  return value
}

function extractPortfolioIds(storage = {}) {
  const ids = new Set(['me'])
  const declared = Array.isArray(storage?.['pf-portfolios-v1']) ? storage['pf-portfolios-v1'] : []
  for (const portfolio of declared) {
    const id = String(portfolio?.id || '').trim()
    if (id) ids.add(id)
  }

  for (const key of Object.keys(storage || {})) {
    if (!key.startsWith('pf-')) continue
    for (const spec of PORTFOLIO_STATE_FIELD_SPECS) {
      const suffix = `-${spec.suffix}`
      if (!key.endsWith(suffix)) continue
      const id = key.slice(3, -suffix.length).trim()
      if (id) ids.add(id)
    }
  }

  return Array.from(ids)
}

export function extractPortfolioStateFromBackup(backupPayload = {}) {
  const storage =
    backupPayload?.storage &&
    typeof backupPayload.storage === 'object' &&
    !Array.isArray(backupPayload.storage)
      ? backupPayload.storage
      : null

  if (!storage) {
    throw new Error('localStorage backup payload missing storage object')
  }

  const portfolioIds = extractPortfolioIds(storage)
  const portfolios = {}

  for (const portfolioId of portfolioIds) {
    portfolios[portfolioId] = {}
    for (const spec of PORTFOLIO_STATE_FIELD_SPECS) {
      const storageKey = `pf-${portfolioId}-${spec.suffix}`
      const value = Object.prototype.hasOwnProperty.call(storage, storageKey)
        ? storage[storageKey]
        : cloneEmptyValue(spec.emptyValue)
      portfolios[portfolioId][spec.fileName] = value
    }
  }

  return {
    storage,
    portfolioIds,
    portfolios,
    global: {
      portfolios: Array.isArray(storage['pf-portfolios-v1']) ? storage['pf-portfolios-v1'] : [],
      activePortfolioId: String(storage['pf-active-portfolio-v1'] || '').trim() || 'me',
      viewMode: String(storage['pf-view-mode-v1'] || '').trim() || 'portfolio',
      schemaVersion: Number(storage['pf-schema-version'] || 0) || null,
    },
  }
}

function toMillis(value) {
  const time = Date.parse(String(value || ''))
  return Number.isFinite(time) ? time : null
}

function roundToOneDecimal(value) {
  return Math.round(Number(value) * 10) / 10
}

export function computeDailySnapshotHealth(
  marker,
  { now = new Date(), staleAfterHours = DAILY_SNAPSHOT_STALE_AFTER_HOURS } = {}
) {
  const lastSuccessAt = String(marker?.lastSuccessAt || '').trim() || null
  const lastAttemptAt = String(marker?.lastAttemptAt || '').trim() || null
  const lastAttemptStatus = String(marker?.lastAttemptStatus || '').trim() || 'unknown'
  const successMs = toMillis(lastSuccessAt)
  const attemptMs = toMillis(lastAttemptAt)
  const nowMs = now instanceof Date ? now.getTime() : Date.now()
  const ageHours =
    successMs != null && Number.isFinite(nowMs)
      ? roundToOneDecimal((nowMs - successMs) / 36e5)
      : null

  let badgeStatus = 'fresh'
  if (!lastSuccessAt) {
    badgeStatus = 'missing'
  } else if (
    lastAttemptStatus === 'failed' &&
    attemptMs != null &&
    (successMs == null || attemptMs >= successMs)
  ) {
    badgeStatus = 'failed'
  } else if (ageHours != null && ageHours > staleAfterHours) {
    badgeStatus = 'stale'
  }

  return {
    job: String(marker?.job || '').trim() || 'daily-snapshot',
    stale: badgeStatus !== 'fresh',
    badgeStatus,
    lastSuccessAt,
    lastAttemptAt,
    lastAttemptStatus,
    ageHours,
    staleAfterHours,
    expectedCadence: String(marker?.expectedCadence || '').trim() || 'daily',
  }
}

export function buildManifestFileRecord({
  pathname,
  content,
  url = null,
  schemaVersion = null,
  contentType = 'application/json',
  source = '',
}) {
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  return {
    pathname,
    content: text,
    contentType,
    checksum: sha256Text(text),
    sizeBytes: Buffer.byteLength(text),
    url,
    schemaVersion: Number.isFinite(Number(schemaVersion)) ? Number(schemaVersion) : null,
    source: String(source || '').trim() || null,
  }
}

export function inferArtifactSchemaVersion(payload) {
  const numeric = Number(payload?.schemaVersion)
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null
}

export function toAnalysisHistoryDataPath(pathname) {
  return path.join('data', String(pathname || '').replace(/\//g, '__'))
}
