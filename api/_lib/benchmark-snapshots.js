import { put } from '@vercel/blob'
import {
  getBenchmarkSnapshotStoreKey,
  listBenchmarkSnapshotKeys,
  readBenchmarkSnapshot,
  writeBenchmarkSnapshotStore,
} from './benchmark-snapshot-store.js'

const DEFAULT_TIMEZONE = 'Asia/Taipei'
const DEFAULT_HISTORY_DAYS = 90

export const BENCHMARK_SNAPSHOT_SCHEMA_VERSION = 1
export const BENCHMARK_SNAPSHOT_PREFIX = 'snapshot/benchmark'
export const DEFAULT_BENCHMARK_CODE = '0050'
export const DEFAULT_BENCHMARK_LABEL = '元大台灣50'
export const DEFAULT_BENCHMARK_PROXY_FOR = '^TWII'
export const DEFAULT_BENCHMARK_SOURCE = 'finmind:TaiwanStockPrice'

function formatDateParts(value, timeZone = DEFAULT_TIMEZONE) {
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

export function formatBenchmarkSnapshotDate(value = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const { year, month, day } = formatDateParts(value, timeZone)
  return `${year}-${month}-${day}`
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
}

function assertSnapshotDate(date) {
  const normalized = String(date || '').trim()
  if (!isIsoDate(normalized)) throw new Error('benchmark snapshot date must be YYYY-MM-DD')
  return normalized
}

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function toFiniteOrNull(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeText(value, fallback = null) {
  const text = String(value || '').trim()
  return text || fallback
}

function getDefaultDateRange(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const toDate = formatBenchmarkSnapshotDate(now, timeZone)
  const fromDate = shiftDate(toDate, -(DEFAULT_HISTORY_DAYS - 1))
  return { fromDate, toDate }
}

export function getBenchmarkSnapshotKey(date) {
  return getBenchmarkSnapshotStoreKey(assertSnapshotDate(date))
}

export function normalizeBenchmarkSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null

  const date = assertSnapshotDate(snapshot.date)
  const close = toFiniteOrNull(snapshot.close)
  const prevClose = toFiniteOrNull(snapshot.prevClose)
  const spread =
    toFiniteOrNull(snapshot.spread) ??
    (close != null && prevClose != null ? Math.round((close - prevClose) * 1000) / 1000 : null)
  const returnPct =
    toFiniteOrNull(snapshot.returnPct) ??
    (close != null && prevClose != null && prevClose > 0
      ? Math.round((close / prevClose - 1) * 100 * 10000) / 10000
      : null)

  return {
    ...snapshot,
    schemaVersion: Math.max(1, Math.trunc(Number(snapshot.schemaVersion)) || 1),
    date,
    code: normalizeText(snapshot.code, DEFAULT_BENCHMARK_CODE),
    label: normalizeText(snapshot.label, DEFAULT_BENCHMARK_LABEL),
    proxyFor: normalizeText(snapshot.proxyFor, DEFAULT_BENCHMARK_PROXY_FOR),
    source: normalizeText(snapshot.source, DEFAULT_BENCHMARK_SOURCE),
    close,
    prevClose,
    spread,
    returnPct,
    open: toFiniteOrNull(snapshot.open),
    high: toFiniteOrNull(snapshot.high),
    low: toFiniteOrNull(snapshot.low),
    volume: toFiniteOrNull(snapshot.volume),
    fetchedAt: normalizeText(snapshot.fetchedAt),
  }
}

export async function writeBenchmarkSnapshot(
  snapshot,
  { token, putImpl = put } = {}
) {
  const normalized = normalizeBenchmarkSnapshot(snapshot)
  if (!normalized) throw new Error('benchmark snapshot payload is required')

  await writeBenchmarkSnapshotStore(normalized.date, normalized, {
    token,
    putImpl,
  })

  return normalized
}

export async function readBenchmarkSnapshots(
  { fromDate, toDate } = {},
  options = {}
) {
  const { now = new Date(), timeZone = DEFAULT_TIMEZONE } = options
  const range =
    isIsoDate(fromDate) && isIsoDate(toDate)
      ? { fromDate, toDate }
      : getDefaultDateRange(now, timeZone)

  const keys = await listBenchmarkSnapshotKeys(options)
  const dates = keys
    .map((key) => /^snapshot\/benchmark\/(\d{4}-\d{2}-\d{2})\.json$/.exec(String(key))?.[1] || null)
    .filter((date) => date && date >= range.fromDate && date <= range.toDate)

  const snapshots = await Promise.all(
    dates.map((date) => readBenchmarkSnapshot(date, options))
  )

  return snapshots
    .map((snapshot) => normalizeBenchmarkSnapshot(snapshot))
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date))
}
