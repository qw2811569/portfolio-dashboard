import { list, put } from '@vercel/blob'

const DEFAULT_TIMEZONE = 'Asia/Taipei'
const DEFAULT_HISTORY_DAYS = 365
const MIN_MDD_HISTORY_DAYS = 7
const SNAPSHOT_SCHEMA_VERSION = 1

function getBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
}

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

export function formatSnapshotDate(value = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const { year, month, day } = formatDateParts(value, timeZone)
  return `${year}-${month}-${day}`
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
}

function assertPortfolioId(portfolioId) {
  const normalized = String(portfolioId || '').trim()
  if (!normalized) throw new Error('portfolioId is required')
  return normalized
}

function assertSnapshotDate(date) {
  const normalized = String(date || '').trim()
  if (!isIsoDate(normalized)) throw new Error('snapshot.date must be YYYY-MM-DD')
  return normalized
}

function toNumberOrZero(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeSnapshotSchemaVersion(value) {
  const numeric = Math.trunc(Number(value))
  return numeric >= 1 ? numeric : SNAPSHOT_SCHEMA_VERSION
}

export function getPortfolioSnapshotKey(portfolioId, date) {
  return `portfolios/${assertPortfolioId(portfolioId)}/snapshots/${assertSnapshotDate(date)}.json`
}

export function normalizePortfolioSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null

  const date = assertSnapshotDate(snapshot.date)
  const totalValue = toNumberOrZero(snapshot.totalValue)
  const totalCost = toNumberOrZero(snapshot.totalCost)
  const holdingsCount = Math.max(0, Math.trunc(toNumberOrZero(snapshot.holdingsCount)))
  const schemaVersion = normalizeSnapshotSchemaVersion(snapshot.schemaVersion)

  return {
    ...snapshot,
    schemaVersion,
    date,
    totalValue,
    totalCost,
    holdingsCount,
  }
}

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function getDefaultDateRange(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const toDate = formatSnapshotDate(now, timeZone)
  const fromDate = shiftDate(toDate, -(DEFAULT_HISTORY_DAYS - 1))
  return { fromDate, toDate }
}

function buildDateSeries(fromDate, toDate) {
  const dates = []
  for (let cursor = fromDate; cursor <= toDate; cursor = shiftDate(cursor, 1)) {
    dates.push(cursor)
  }
  return dates
}

async function listAllBlobs(prefix, { token = getBlobToken(), listImpl = list } = {}) {
  if (!token) throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for snapshot reads')

  const blobs = []
  let cursor

  do {
    const page = await listImpl({
      prefix,
      token,
      cursor,
      limit: 1000,
    })

    blobs.push(...(Array.isArray(page?.blobs) ? page.blobs : []))
    cursor = page?.cursor || null
  } while (cursor)

  return blobs
}

async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`snapshot fetch failed (${response.status})`)
  }
  return response.json()
}

async function loadRawSnapshots(
  portfolioId,
  { token = getBlobToken(), fetchImpl = fetch, listImpl = list } = {}
) {
  const prefix = `portfolios/${assertPortfolioId(portfolioId)}/snapshots/`
  const blobs = await listAllBlobs(prefix, { token, listImpl })
  const snapshots = []

  for (const blob of blobs) {
    const payload = normalizePortfolioSnapshot(await fetchJson(blob.url, fetchImpl))
    snapshots.push(payload)
  }

  return snapshots.sort((a, b) => a.date.localeCompare(b.date))
}

export function forwardFillSnapshots(snapshots = [], { fromDate, toDate } = {}) {
  if (!isIsoDate(fromDate) || !isIsoDate(toDate)) return []

  const sorted = [...(Array.isArray(snapshots) ? snapshots : [])]
    .map((snapshot) => normalizePortfolioSnapshot(snapshot))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))

  const byDate = new Map(sorted.map((snapshot) => [snapshot.date, snapshot]))
  let lastKnown = null
  let firstFuture = null

  for (const snapshot of sorted) {
    if (snapshot.date <= fromDate) lastKnown = snapshot
    if (snapshot.date > fromDate) {
      firstFuture = snapshot
      break
    }
  }

  return buildDateSeries(fromDate, toDate)
    .map((date) => {
      const exact = byDate.get(date)
      if (exact) {
        lastKnown = exact
        return exact
      }
      if (!lastKnown) {
        if (firstFuture && date >= firstFuture.date) {
          lastKnown = firstFuture
          firstFuture = null
        } else {
          return null
        }
      }
      return {
        ...lastKnown,
        date,
        filledFromDate: lastKnown.date,
      }
    })
    .filter(Boolean)
}

export async function writePortfolioSnapshot(
  portfolioId,
  snapshot,
  { token = getBlobToken(), putImpl = put } = {}
) {
  if (!token) {
    throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for snapshot writes')
  }

  const normalized = normalizePortfolioSnapshot(snapshot)
  const key = getPortfolioSnapshotKey(portfolioId, normalized.date)

  await putImpl(key, JSON.stringify(normalized, null, 2), {
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    access: 'public',
    contentType: 'application/json',
  })

  return normalized
}

export async function readPortfolioSnapshots(
  portfolioId,
  { fromDate, toDate } = {},
  {
    token = getBlobToken(),
    fetchImpl = fetch,
    listImpl = list,
    now = new Date(),
    timeZone = DEFAULT_TIMEZONE,
  } = {}
) {
  const range =
    isIsoDate(fromDate) && isIsoDate(toDate)
      ? { fromDate, toDate }
      : getDefaultDateRange(now, timeZone)

  const rawSnapshots = await loadRawSnapshots(portfolioId, {
    token,
    fetchImpl,
    listImpl,
  })

  const bounded = rawSnapshots.filter((snapshot) => snapshot.date <= range.toDate)
  return forwardFillSnapshots(bounded, range)
}

export async function calculateMDD(portfolioId, options = {}, deps = {}) {
  const snapshots = await readPortfolioSnapshots(portfolioId, options, deps)
  if (snapshots.length < MIN_MDD_HISTORY_DAYS) {
    return { mdd: null, reason: 'insufficient_history', snapshots: snapshots.length }
  }

  let runningPeak = null
  let maxDrawdown = 0
  let maxPeak = null
  let maxTrough = null
  let zeroPeakSnapshot = null
  let hasPositivePeak = false

  for (const snapshot of snapshots) {
    const value = Number(snapshot.totalValue)
    if (!Number.isFinite(value) || value < 0) continue

    if (!runningPeak || value >= runningPeak.totalValue) {
      runningPeak = snapshot
    }

    if (!runningPeak) continue

    if (runningPeak.totalValue === 0) {
      zeroPeakSnapshot ||= runningPeak
      continue
    }

    hasPositivePeak = true

    const drawdown = (runningPeak.totalValue - value) / runningPeak.totalValue
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
      maxPeak = runningPeak
      maxTrough = snapshot
    }
  }

  if (!hasPositivePeak) {
    return {
      mdd: null,
      reason: 'zero_peak',
      snapshots: snapshots.length,
      peak: zeroPeakSnapshot?.totalValue ?? 0,
      trough: zeroPeakSnapshot?.totalValue ?? 0,
      peakDate: zeroPeakSnapshot?.date ?? null,
      troughDate: zeroPeakSnapshot?.date ?? null,
    }
  }

  if (!maxPeak || !maxTrough) {
    const terminal = snapshots.at(-1) || null
    return {
      mdd: 0,
      snapshots: snapshots.length,
      peak: terminal?.totalValue ?? null,
      trough: terminal?.totalValue ?? null,
      peakDate: terminal?.date ?? null,
      troughDate: terminal?.date ?? null,
    }
  }

  return {
    mdd: Number(maxDrawdown.toFixed(6)),
    snapshots: snapshots.length,
    peak: maxPeak.totalValue,
    trough: maxTrough.totalValue,
    peakDate: maxPeak.date,
    troughDate: maxTrough.date,
  }
}
