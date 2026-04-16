import { list, put } from '@vercel/blob'
import { INIT_HOLDINGS, INIT_HOLDINGS_JINLIANCHENG } from '../../src/seedData.js'
import { isSkippedTargetPriceInstrumentType } from '../../src/lib/instrumentTypes.js'

const TRACKED_STOCKS_BLOB_KEYS = ['tracked-stocks/latest.json', 'tracked-stocks.json']
const TARGET_PRICE_PREFIX = 'target-prices'
const PROCESSING_PAUSE_MS = 250

function getCronSecret() {
  return String(process.env.CRON_SECRET || '').trim()
}

function getBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function isSkippedInstrumentType(type) {
  return isSkippedTargetPriceInstrumentType(type)
}

export function normalizeTrackedStock(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const code = String(value.code || '').trim()
  const name = String(value.name || '').trim()
  const type = String(value.type || '股票').trim() || '股票'

  if (!code || !name) return null

  return { code, name, type }
}

export function dedupeTrackedStocks(values = []) {
  const deduped = []
  const seen = new Set()

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeTrackedStock(value)
    if (!normalized || seen.has(normalized.code)) continue
    seen.add(normalized.code)
    deduped.push(normalized)
  }

  return deduped
}

export function extractTrackedStocksFromPayload(payload) {
  const candidates = []

  if (Array.isArray(payload)) candidates.push(payload)
  if (payload && typeof payload === 'object') {
    candidates.push(payload.stocks, payload.items, payload.holdings, payload.watchlist)
  }

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const trackedStocks = dedupeTrackedStocks(candidate)
    if (trackedStocks.length > 0) return trackedStocks
  }

  return []
}

export function getFallbackTrackedStocks() {
  return dedupeTrackedStocks([...INIT_HOLDINGS, ...INIT_HOLDINGS_JINLIANCHENG])
}

async function readTrackedStocksFromBlob({
  token = getBlobToken(),
  fetchImpl = fetch,
  logger = console,
} = {}) {
  if (!token) return null

  for (const key of TRACKED_STOCKS_BLOB_KEYS) {
    try {
      const { blobs } = await list({ prefix: key, limit: 1, token })
      if (!blobs.length) continue

      const response = await fetchImpl(blobs[0].url)
      if (!response.ok) {
        throw new Error(`blob read failed (${response.status})`)
      }

      const payload = await response.json()
      const trackedStocks = extractTrackedStocksFromPayload(payload)
      if (trackedStocks.length === 0) {
        logger.warn(`[collect-target-prices] blob ${key} did not contain a usable stock list`)
        continue
      }

      logger.info(`[collect-target-prices] using tracked stocks from blob: ${key}`)
      return { trackedStocks, source: key }
    } catch (error) {
      logger.warn(`[collect-target-prices] tracked stocks blob read failed for ${key}:`, error)
    }
  }

  return null
}

export async function loadTrackedStocks(options = {}) {
  const blobResult = await readTrackedStocksFromBlob(options)
  if (blobResult) return blobResult

  const trackedStocks = getFallbackTrackedStocks()
  const logger = options.logger || console
  logger.info('[collect-target-prices] using fallback tracked stocks from seedData')
  return { trackedStocks, source: 'seedData' }
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

export function buildTargetPriceSnapshot({ stock, analystPayload, now = new Date() }) {
  const collectedAt = now.toISOString()
  const items = Array.isArray(analystPayload?.items) ? analystPayload.items : []
  const reports = buildSnapshotTargetReports(items, toSlashDate(now))
  const targetSource = String(analystPayload?.targetPriceSource || '').trim() || 'rss'

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
  const protocol =
    req?.headers?.['x-forwarded-proto'] || (process.env.VERCEL_URL ? 'https' : 'http')
  const host = req?.headers?.host || process.env.VERCEL_URL || '127.0.0.1:3002'
  return `${protocol}://${host}`
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
    headers: {
      'Content-Type': 'application/json',
    },
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
  if (!token) {
    throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for target-price writes')
  }

  await put(`${TARGET_PRICE_PREFIX}/${code}.json`, JSON.stringify(snapshot, null, 2), {
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    access: 'public',
    contentType: 'application/json',
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
        `[collect-target-prices] ${stock.code} saved (${snapshot.targets.reports.length} targets, ${snapshot.analystReports.items.length} items)`
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
    const { trackedStocks } = await loadTrackedStocks({ logger: console })
    const summary = await collectTargetPriceSnapshots({
      trackedStocks,
      origin: resolveRequestOrigin(req),
      logger: console,
    })
    return res.status(200).json(summary)
  } catch (error) {
    console.error('[collect-target-prices] handler failed:', error)
    return res.status(500).json({ error: error?.message || 'collect target prices failed' })
  }
}
