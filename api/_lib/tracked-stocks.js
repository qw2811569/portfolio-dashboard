import { list } from '@vercel/blob'
import { INIT_HOLDINGS, INIT_HOLDINGS_JINLIANCHENG } from '../../src/seedData.js'
import { getPrivateBlobToken } from './blob-tokens.js'
import { extractBlobPathname, fetchSignedBlobJson } from './signed-url.js'
import { readTrackedStocks, writeTrackedStocksIfVersion } from './tracked-stocks-store.js'

const TRACKED_STOCKS_SCHEMA_VERSION = 1
const TRACKED_STOCKS_PREFIX = 'tracked-stocks/'
const TRACKED_STOCKS_LEGACY_KEYS = ['tracked-stocks/latest.json', 'tracked-stocks.json']
const ACTIVE_PORTFOLIOS_KEY = 'portfolios/active.json'
const OWNER_PORTFOLIO_ID = 'me'

function assertPortfolioId(portfolioId) {
  const normalized = String(portfolioId || '').trim()
  if (!normalized) throw new Error('portfolioId is required')
  return normalized
}

function dedupePortfolioIds(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

function pickBlobPathname(blob) {
  return extractBlobPathname(blob?.pathname || blob?.url)
}

function pickLastSyncedAt(payload, blob) {
  return (
    String(payload?.lastSyncedAt || payload?.updatedAt || blob?.uploadedAt || '').trim() || null
  )
}

export function getBlobToken() {
  return getPrivateBlobToken()
}

export function getTrackedStocksBlobKey(portfolioId) {
  return `${TRACKED_STOCKS_PREFIX}${assertPortfolioId(portfolioId)}/latest.json`
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
    candidates.push(
      payload.stocks,
      payload.items,
      payload.holdings,
      payload.watchlist,
      payload.trackedStocks
    )
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

async function listAllBlobs(prefix, { token = getBlobToken(), listImpl = list } = {}) {
  if (!token) return []

  const blobs = []
  let cursor = null

  do {
    const page = await listImpl({
      prefix,
      token,
      cursor: cursor || undefined,
      limit: 1000,
    })
    blobs.push(...(Array.isArray(page?.blobs) ? page.blobs : []))
    cursor = page?.cursor || null
  } while (cursor)

  return blobs
}

async function readBlobJson(pathname, { origin, fetchImpl = fetch } = {}) {
  return fetchSignedBlobJson(pathname, {
    origin,
    fetchImpl,
  })
}

async function readJsonFromFirstBlob(
  prefix,
  { token = getBlobToken(), listImpl = list, fetchImpl = fetch, origin } = {}
) {
  if (!token) return null

  const response = await listImpl({ prefix, token, limit: 1 })
  const blob = Array.isArray(response?.blobs) ? response.blobs[0] : null
  const pathname = pickBlobPathname(blob)
  if (!pathname) return null

  return readBlobJson(pathname, { origin, fetchImpl })
}

export async function loadActivePortfolioIds({
  token = getBlobToken(),
  listImpl = list,
  fetchImpl = fetch,
  origin,
} = {}) {
  try {
    const payload = await readJsonFromFirstBlob(ACTIVE_PORTFOLIOS_KEY, {
      token,
      listImpl,
      fetchImpl,
      origin,
    })
    const portfolioIds = dedupePortfolioIds(payload?.portfolioIds || payload?.activePortfolioIds)
    if (portfolioIds.length > 0) return portfolioIds
  } catch {
    // Fall back to the owner portfolio when no registry exists yet.
  }

  return [OWNER_PORTFOLIO_ID]
}

function normalizeTrackedStocksRecord({
  portfolioId = '',
  trackedStocks = [],
  source = '',
  lastSyncedAt = null,
} = {}) {
  const normalizedPortfolioId = String(portfolioId || '').trim()
  const normalizedTrackedStocks = dedupeTrackedStocks(trackedStocks)

  if (!normalizedPortfolioId || normalizedTrackedStocks.length === 0) return null

  return {
    portfolioId: normalizedPortfolioId,
    trackedStocks: normalizedTrackedStocks,
    source: String(source || '').trim() || 'unknown',
    lastSyncedAt: String(lastSyncedAt || '').trim() || null,
  }
}

export function mergeTrackedStocksRecords(records = []) {
  const normalizedRecords = (Array.isArray(records) ? records : [])
    .map((record) => normalizeTrackedStocksRecord(record))
    .filter(Boolean)
  const trackedStocks = dedupeTrackedStocks(
    normalizedRecords.flatMap((record) => record.trackedStocks)
  )
  const lastSyncedAt =
    normalizedRecords
      .map((record) => record.lastSyncedAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null

  return {
    trackedStocks,
    lastSyncedAt,
    portfolioIds: dedupePortfolioIds(normalizedRecords.map((record) => record.portfolioId)),
  }
}

function extractPortfolioIdFromTrackedStocksPath(pathname = '') {
  const match = /^tracked-stocks\/([^/]+)\/latest\.json$/.exec(String(pathname || '').trim())
  return match ? match[1] : ''
}

function extractSnapshotDateFromPath(pathname = '') {
  const match = /^portfolios\/([^/]+)\/snapshots\/(\d{4}-\d{2}-\d{2})\.json$/.exec(
    String(pathname || '').trim()
  )
  if (!match) return null
  return { portfolioId: match[1], date: match[2] }
}

export async function readTrackedStocksForPortfolio(portfolioId, options = {}) {
  const snapshot = await readTrackedStocksSnapshotState(portfolioId, options)
  return snapshot.record
}

export async function readTrackedStocksSnapshotState(
  portfolioId,
  { logger = console, ...storeOptions } = {}
) {
  const key = getTrackedStocksBlobKey(portfolioId)

  try {
    const snapshot = await readTrackedStocks(portfolioId, {
      logger,
      ...storeOptions,
    })
    if (!snapshot) {
      return {
        key,
        pathname: key,
        versionToken: null,
        etag: null,
        record: null,
      }
    }

    const trackedStocks = extractTrackedStocksFromPayload(snapshot.payload)
    if (trackedStocks.length === 0) {
      logger.warn(`[tracked-stocks] blob ${key} did not contain a usable stock list`)
      return {
        key,
        pathname: key,
        versionToken: snapshot.versionToken,
        etag: snapshot.versionToken,
        record: null,
      }
    }

    return {
      key,
      pathname: key,
      versionToken: snapshot.versionToken,
      etag: snapshot.versionToken,
      record: normalizeTrackedStocksRecord({
        portfolioId,
        trackedStocks,
        source: 'live-sync',
        lastSyncedAt: pickLastSyncedAt(snapshot.payload, null),
      }),
    }
  } catch (error) {
    logger.warn(`[tracked-stocks] portfolio blob read failed for ${key}:`, error)
    return {
      key,
      pathname: key,
      versionToken: null,
      etag: null,
      record: null,
    }
  }
}

async function readPidScopedTrackedStocksBlobs({
  token = getBlobToken(),
  listImpl = list,
  fetchImpl = fetch,
  origin,
  logger = console,
} = {}) {
  const blobs = await listAllBlobs(TRACKED_STOCKS_PREFIX, { token, listImpl })
  const records = []

  for (const blob of blobs) {
    const pathname = pickBlobPathname(blob)
    const portfolioId = extractPortfolioIdFromTrackedStocksPath(pathname)
    if (!portfolioId) continue

    try {
      const payload = await readBlobJson(pathname, { origin, fetchImpl })
      const trackedStocks = extractTrackedStocksFromPayload(payload)
      if (trackedStocks.length === 0) {
        logger.warn(`[tracked-stocks] blob ${pathname} did not contain a usable stock list`)
        continue
      }

      records.push(
        normalizeTrackedStocksRecord({
          portfolioId,
          trackedStocks,
          source: 'live-sync',
          lastSyncedAt: pickLastSyncedAt(payload, blob),
        })
      )
    } catch (error) {
      logger.warn(`[tracked-stocks] pid-scoped blob read failed for ${pathname}:`, error)
    }
  }

  return records.filter(Boolean)
}

async function readLegacyTrackedStocksBlob({
  token = getBlobToken(),
  listImpl = list,
  fetchImpl = fetch,
  origin,
  logger = console,
} = {}) {
  if (!token) return null

  for (const key of TRACKED_STOCKS_LEGACY_KEYS) {
    try {
      const response = await listImpl({ prefix: key, token, limit: 1 })
      const blob = Array.isArray(response?.blobs) ? response.blobs[0] : null
      const pathname = pickBlobPathname(blob)
      if (!pathname) continue

      const payload = await readBlobJson(pathname, { origin, fetchImpl })
      const trackedStocks = extractTrackedStocksFromPayload(payload)
      if (trackedStocks.length === 0) {
        logger.warn(`[tracked-stocks] blob ${key} did not contain a usable stock list`)
        continue
      }

      return {
        trackedStocks,
        source: 'legacy-global-blob',
        lastSyncedAt: pickLastSyncedAt(payload, blob),
      }
    } catch (error) {
      logger.warn(`[tracked-stocks] legacy blob read failed for ${key}:`, error)
    }
  }

  return null
}

async function readTrackedStocksFromSnapshots({
  portfolioIds = null,
  token = getBlobToken(),
  listImpl = list,
  fetchImpl = fetch,
  origin,
  logger = console,
} = {}) {
  const resolvedPortfolioIds =
    dedupePortfolioIds(portfolioIds).length > 0
      ? dedupePortfolioIds(portfolioIds)
      : await loadActivePortfolioIds({
          token,
          listImpl,
          fetchImpl,
          origin,
        })
  const records = []

  for (const portfolioId of resolvedPortfolioIds) {
    try {
      const blobs = await listAllBlobs(`portfolios/${portfolioId}/snapshots/`, {
        token,
        listImpl,
      })
      const latestSnapshot = blobs
        .map((blob) => {
          const pathname = pickBlobPathname(blob)
          const snapshotMeta = extractSnapshotDateFromPath(pathname)
          if (!snapshotMeta || snapshotMeta.portfolioId !== portfolioId) return null
          return { blob, pathname, date: snapshotMeta.date }
        })
        .filter(Boolean)
        .sort((left, right) => left.date.localeCompare(right.date))
        .slice(-1)[0]

      if (!latestSnapshot?.pathname) continue

      const payload = await readBlobJson(latestSnapshot.pathname, { origin, fetchImpl })
      const trackedStocks = extractTrackedStocksFromPayload(payload)
      if (trackedStocks.length === 0) continue

      records.push(
        normalizeTrackedStocksRecord({
          portfolioId,
          trackedStocks,
          source: 'snapshot-derived',
          lastSyncedAt: pickLastSyncedAt(payload, latestSnapshot.blob) || latestSnapshot.date,
        })
      )
    } catch (error) {
      logger.warn(`[tracked-stocks] snapshot fallback failed for ${portfolioId}:`, error)
    }
  }

  return records.filter(Boolean)
}

export async function loadTrackedStocksFromBlob(options = {}) {
  const pidRecords = await readPidScopedTrackedStocksBlobs(options)
  if (pidRecords.length > 0) {
    return {
      ...mergeTrackedStocksRecords(pidRecords),
      source: 'live-sync',
      records: pidRecords,
    }
  }

  const legacyBlob = await readLegacyTrackedStocksBlob(options)
  if (legacyBlob) {
    return {
      trackedStocks: legacyBlob.trackedStocks,
      source: legacyBlob.source,
      lastSyncedAt: legacyBlob.lastSyncedAt,
      portfolioIds: [],
      records: [],
    }
  }

  return null
}

export async function loadTrackedStocksWithFallback({
  token = getBlobToken(),
  listImpl = list,
  fetchImpl = fetch,
  origin,
  logger = console,
} = {}) {
  const activePortfolioIds = await loadActivePortfolioIds({
    token,
    listImpl,
    fetchImpl,
    origin,
  })
  const pidRecords = await readPidScopedTrackedStocksBlobs({
    token,
    listImpl,
    fetchImpl,
    origin,
    logger,
  })

  if (pidRecords.length > 0) {
    const liveSyncPortfolioIds = new Set(pidRecords.map((record) => record.portfolioId))
    const missingPortfolioIds = activePortfolioIds.filter(
      (portfolioId) => !liveSyncPortfolioIds.has(portfolioId)
    )
    const snapshotRecords =
      missingPortfolioIds.length > 0
        ? await readTrackedStocksFromSnapshots({
            portfolioIds: missingPortfolioIds,
            token,
            listImpl,
            fetchImpl,
            origin,
            logger,
          })
        : []
    const records = [...pidRecords, ...snapshotRecords]

    return {
      ...mergeTrackedStocksRecords(records),
      source: snapshotRecords.length > 0 ? 'snapshot-derived' : 'live-sync',
      records,
    }
  }

  const legacyBlob = await readLegacyTrackedStocksBlob({
    token,
    listImpl,
    fetchImpl,
    origin,
    logger,
  })
  if (legacyBlob) {
    return {
      trackedStocks: legacyBlob.trackedStocks,
      source: legacyBlob.source,
      lastSyncedAt: legacyBlob.lastSyncedAt,
      portfolioIds: [],
      records: [],
    }
  }

  const snapshotRecords = await readTrackedStocksFromSnapshots({
    portfolioIds: activePortfolioIds,
    token,
    listImpl,
    fetchImpl,
    origin,
    logger,
  })
  if (snapshotRecords.length > 0) {
    return {
      ...mergeTrackedStocksRecords(snapshotRecords),
      source: 'snapshot-derived',
      records: snapshotRecords,
    }
  }

  const trackedStocks = getFallbackTrackedStocks()
  logger.warn('[tracked-stocks] using fallback tracked stocks from seedData')
  return {
    trackedStocks,
    source: 'seedData-fallback',
    lastSyncedAt: null,
    portfolioIds: [],
    records: [],
  }
}

export function buildTrackedStocksSnapshot({
  portfolioId,
  stocks = [],
  now = new Date(),
  source = 'live-sync',
} = {}) {
  const lastSyncedAt = new Date(now).toISOString()
  const normalizedStocks = dedupeTrackedStocks(stocks)

  return {
    schemaVersion: TRACKED_STOCKS_SCHEMA_VERSION,
    portfolioId: assertPortfolioId(portfolioId),
    source,
    count: normalizedStocks.length,
    lastSyncedAt,
    updatedAt: lastSyncedAt,
    stocks: normalizedStocks,
  }
}

export async function writeTrackedStocksSnapshot(
  portfolioId,
  snapshot,
  { ifMatch = null, expectedVersionToken = null, ...storeOptions } = {}
) {
  await writeTrackedStocksIfVersion(
    portfolioId,
    snapshot,
    expectedVersionToken ?? ifMatch ?? null,
    storeOptions
  )
  return snapshot
}
