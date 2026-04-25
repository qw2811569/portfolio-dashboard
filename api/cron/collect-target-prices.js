import { list, put } from '@vercel/blob'
import { buildInternalAuthHeaders } from '../_lib/auth-middleware.js'
import { resolveInternalApiOrigin } from '../_lib/signed-url.js'
import { writeTargetPriceSnapshot } from '../_lib/target-prices-store.js'
import {
  dedupeTrackedStocks,
  getBlobToken,
  loadTrackedStocksWithFallback,
  normalizeTrackedStock,
  extractTrackedStocksFromPayload,
  getFallbackTrackedStocks,
} from '../_lib/tracked-stocks.js'
import { markCronSuccess } from '../../src/lib/cronLastSuccess.js'
import { isSkippedTargetPriceInstrumentType } from '../../src/lib/instrumentTypes.js'

export {
  normalizeTrackedStock,
  dedupeTrackedStocks,
  extractTrackedStocksFromPayload,
  getFallbackTrackedStocks,
} from '../_lib/tracked-stocks.js'

const PROCESSING_PAUSE_MS = 250

function getCronSecret() {
  return String(process.env.CRON_SECRET || '').trim()
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function isSkippedInstrumentType(type) {
  return isSkippedTargetPriceInstrumentType(type)
}

export async function loadTrackedStocks(options = {}) {
  const result = await loadTrackedStocksWithFallback(options)
  const logger = options.logger || console
  logger.info(`[collect-target-prices] using tracked stocks source=${result.source}`)
  return result
}

function toSlashDate(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

function buildSnapshotTargetReports(items, fallbackDate) {
  const reports = []
  const seen = new Set()

  for (const item of Array.isArray(items) ? items : []) {
    const targetType = String(item?.targetType || '').trim()
    const target = Number(item?.target)
    if (!Number.isFinite(target) || target <= 0) continue
    if (targetType && targetType !== 'price-target') continue

    const firm = String(item?.firm || item?.source || '公開來源').trim() || '公開來源'
    const date = String(item?.publishedAt || fallbackDate).trim() || fallbackDate
    const dedupeKey = `${firm}|${date}|${target}`

    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    reports.push({ firm, target, date })
  }

  return reports
}

function normalizeTargetAggregate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const normalized = {
    medianTarget: Number.isFinite(Number(value.medianTarget)) ? Number(value.medianTarget) : null,
    meanTarget: Number.isFinite(Number(value.meanTarget)) ? Number(value.meanTarget) : null,
    min: Number.isFinite(Number(value.min)) ? Number(value.min) : null,
    max: Number.isFinite(Number(value.max)) ? Number(value.max) : null,
    firmsCount: Number.isFinite(Number(value.firmsCount)) ? Number(value.firmsCount) : null,
    numEst: Number.isFinite(Number(value.numEst)) ? Number(value.numEst) : null,
    rateDate: String(value.rateDate || '').trim() || null,
  }

  if (
    normalized.medianTarget == null &&
    normalized.meanTarget == null &&
    normalized.min == null &&
    normalized.max == null &&
    normalized.firmsCount == null &&
    normalized.numEst == null &&
    normalized.rateDate == null
  ) {
    return null
  }

  return normalized
}

export function buildTargetPriceSnapshot({ stock, analystPayload, now = new Date() }) {
  const collectedAt = now.toISOString()
  const items = Array.isArray(analystPayload?.items) ? analystPayload.items : []
  const reports = buildSnapshotTargetReports(items, toSlashDate(now))
  const aggregate = normalizeTargetAggregate(analystPayload?.aggregate)
  const targetSource = String(analystPayload?.targetPriceSource || '').trim() || 'rss'
  const coverageState = reports.length > 0 ? 'firm-reports' : aggregate ? 'aggregate-only' : 'none'

  return {
    code: stock.code,
    name: stock.name,
    type: stock.type,
    collectedAt,
    fetchedAt: String(analystPayload?.fetchedAt || collectedAt).trim() || collectedAt,
    totalFound: Number(analystPayload?.totalFound) || items.length,
    newCount: Number(analystPayload?.newCount) || items.length,
    targets: {
      reports,
      aggregate,
      coverageState,
      updatedAt: collectedAt,
      source: targetSource,
    },
    analystReports: {
      items,
      fetchedAt: String(analystPayload?.fetchedAt || collectedAt).trim() || collectedAt,
    },
  }
}

export function resolveRequestOrigin(req) {
  return resolveInternalApiOrigin(req)
}

async function readJsonSafely(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function fetchAnalystReports(stock, { origin, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(new URL('/api/analyst-reports?refresh=1', origin), {
    method: 'POST',
    headers: buildInternalAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      code: stock.code,
      name: stock.name,
    }),
  })

  const payload = await readJsonSafely(response)
  if (!response.ok) {
    throw new Error(
      payload?.detail || payload?.error || `analyst-reports failed (${response.status})`
    )
  }

  return payload || {}
}

export async function putTargetPriceSnapshot(code, snapshot, { token = getBlobToken() } = {}) {
  return writeTargetPriceSnapshot(code, snapshot, {
    token,
    putImpl: put,
  })
}

export async function collectTargetPriceSnapshots({
  trackedStocks = [],
  origin = 'http://127.0.0.1:3002',
  fetchImpl = fetch,
  writeSnapshot = (code, snapshot) => putTargetPriceSnapshot(code, snapshot),
  pauseMs = PROCESSING_PAUSE_MS,
  sleepFn = sleep,
  logger = console,
} = {}) {
  const normalizedStocks = dedupeTrackedStocks(trackedStocks)
  const eligibleCount = normalizedStocks.filter(
    (stock) => !isSkippedInstrumentType(stock.type)
  ).length
  const summary = { processed: 0, succeeded: 0, failed: 0, skipped: 0 }

  for (const stock of normalizedStocks) {
    if (isSkippedInstrumentType(stock.type)) {
      summary.skipped += 1
      logger.info(`[collect-target-prices] skipped ${stock.code} ${stock.name} (${stock.type})`)
      continue
    }

    summary.processed += 1
    logger.info(
      `[collect-target-prices] ${summary.processed}/${eligibleCount} start ${stock.code} ${stock.name}`
    )

    try {
      const analystPayload = await fetchAnalystReports(stock, { origin, fetchImpl })
      const snapshot = buildTargetPriceSnapshot({ stock, analystPayload })
      await writeSnapshot(stock.code, snapshot)
      summary.succeeded += 1
      logger.info(
        `[collect-target-prices] ${stock.code} saved (${snapshot.targets.reports.length} targets, ${snapshot.analystReports.items.length} items, source=${snapshot.targets.source}, coverage=${snapshot.targets.coverageState})`
      )
    } catch (error) {
      summary.failed += 1
      logger.error(`[collect-target-prices] ${stock.code} failed:`, error)
    }

    if (summary.processed < eligibleCount && pauseMs > 0) {
      logger.info(`[collect-target-prices] sleeping ${pauseMs}ms before next stock`)
      await sleepFn(pauseMs)
    }
  }

  return summary
}

export function isAuthorized(req) {
  const cronSecret = getCronSecret()
  if (!cronSecret) return true
  return req.headers.authorization === `Bearer ${cronSecret}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const origin = resolveRequestOrigin(req)
    const { trackedStocks } = await loadTrackedStocks({ logger: console, origin })
    const summary = await collectTargetPriceSnapshots({
      trackedStocks,
      origin,
      logger: console,
    })
    await markCronSuccess('collect-target-prices', {
      token: getBlobToken(),
      access: 'private',
      listImpl: list,
      putImpl: put,
      logger: console,
    })
    return res.status(200).json(summary)
  } catch (error) {
    console.error('[collect-target-prices] handler failed:', error)
    return res.status(500).json({ error: error?.message || 'collect target prices failed' })
  }
}
