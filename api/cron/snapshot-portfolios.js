import { list } from '@vercel/blob'
import { buildInternalAuthHeaders } from '../_lib/auth-middleware.js'
import { getPrivateBlobToken } from '../_lib/blob-tokens.js'
import { fetchSignedBlobJson } from '../_lib/signed-url.js'

import { fetchAllStockDailyPrices } from '../_lib/twse-market-data.js'
import { formatSnapshotDate, writePortfolioSnapshot } from '../_lib/portfolio-snapshots.js'
import { dedupeTrackedStocks } from '../_lib/tracked-stocks.js'
import { getPortfolioCost, getPortfolioValue, normalizeHoldings } from '../../src/lib/holdings.js'

const DEFAULT_TIMEZONE = 'Asia/Taipei'
const ACTIVE_PORTFOLIOS_KEY = 'portfolios/active.json'
const OWNER_PORTFOLIO_ID = 'me'

function getBlobToken() {
  return getPrivateBlobToken()
}

function getCronSecret() {
  return String(process.env.CRON_SECRET || '').trim()
}

function resolveRequestOrigin(req) {
  const protocol =
    req?.headers?.['x-forwarded-proto'] || (process.env.VERCEL_URL ? 'https' : 'http')
  const host = req?.headers?.host || process.env.VERCEL_URL || '127.0.0.1:3002'
  return `${protocol}://${host}`
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

async function readJsonFromFirstBlob(
  prefix,
  { token, listImpl = list, fetchImpl = fetch, origin } = {}
) {
  if (!token) return null

  const response = await listImpl({ prefix, token, limit: 1 })
  const blob = Array.isArray(response?.blobs) ? response.blobs[0] : null
  if (!blob?.url && !blob?.pathname) return null

  return fetchSignedBlobJson(blob?.pathname || blob?.url, {
    origin,
    fetchImpl,
  })
}

export async function loadActivePortfolioIds({
  requestedPortfolioIds = [],
  token = getBlobToken(),
  listImpl = list,
  fetchImpl = fetch,
  origin,
} = {}) {
  const requested = dedupePortfolioIds(requestedPortfolioIds)
  if (requested.length > 0) return requested

  try {
    const payload = await readJsonFromFirstBlob(ACTIVE_PORTFOLIOS_KEY, {
      token,
      listImpl,
      fetchImpl,
      origin,
    })
    const blobIds = dedupePortfolioIds(payload?.portfolioIds || payload?.activePortfolioIds || [])
    if (blobIds.length > 0) return blobIds
  } catch {
    // Fall back to the owner portfolio when no registry exists yet.
  }

  return [OWNER_PORTFOLIO_ID]
}

export async function loadPortfolioHoldings(
  portfolioId,
  {
    origin = 'http://127.0.0.1:3002',
    token = getBlobToken(),
    listImpl = list,
    fetchImpl = fetch,
  } = {}
) {
  if (portfolioId === OWNER_PORTFOLIO_ID) {
    const response = await fetchImpl(new URL('/api/brain', origin), {
      method: 'POST',
      headers: buildInternalAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'load-holdings' }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || `owner holdings load failed (${response.status})`)
    }

    return Array.isArray(payload?.holdings) ? payload.holdings : []
  }

  const payload = await readJsonFromFirstBlob(`portfolios/${portfolioId}/holdings/latest.json`, {
    token,
    listImpl,
    fetchImpl,
    origin,
  })

  return Array.isArray(payload?.holdings) ? payload.holdings : []
}

export function buildQuotesMap(dailyPrices = []) {
  return Object.fromEntries(
    (Array.isArray(dailyPrices) ? dailyPrices : [])
      .map((row) => {
        const code = String(row?.code || '').trim()
        const price = Number(row?.closingPrice)
        if (!code || !Number.isFinite(price) || price <= 0) return null
        return [code, { price }]
      })
      .filter(Boolean)
  )
}

export function buildPortfolioSnapshot(portfolioId, holdings, quotes, date) {
  const normalizedHoldings = normalizeHoldings(holdings, quotes)
  const trackedStocks = dedupeTrackedStocks(normalizedHoldings)

  return {
    portfolioId,
    date,
    totalValue: Math.round(getPortfolioValue(normalizedHoldings)),
    totalCost: Math.round(getPortfolioCost(normalizedHoldings)),
    holdingsCount: normalizedHoldings.length,
    pricedCount: normalizedHoldings.filter((item) => Number(item?.price) > 0).length,
    missingPriceCount: normalizedHoldings.filter((item) => Number(item?.price) <= 0).length,
    trackedStocks,
  }
}

export async function snapshotPortfolios({
  portfolioIds = [],
  origin = 'http://127.0.0.1:3002',
  token = getBlobToken(),
  listImpl = list,
  fetchImpl = fetch,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
  loadPrices = (date, options) => fetchAllStockDailyPrices(date, options),
  writeSnapshot = (portfolioId, snapshot, options) =>
    writePortfolioSnapshot(portfolioId, snapshot, options),
} = {}) {
  const resolvedPortfolioIds = await loadActivePortfolioIds({
    requestedPortfolioIds: portfolioIds,
    token,
    listImpl,
    fetchImpl,
    origin,
  })
  const date = formatSnapshotDate(now, timeZone)
  const dailyPrices = await loadPrices(date, { fetchImpl })
  const quotes = buildQuotesMap(dailyPrices)
  const summary = { processed: 0, succeeded: 0, failed: 0, skipped: 0, portfolioIds: [] }

  for (const portfolioId of resolvedPortfolioIds) {
    summary.processed += 1

    try {
      const holdings = await loadPortfolioHoldings(portfolioId, {
        origin,
        token,
        listImpl,
        fetchImpl,
      })

      if (!Array.isArray(holdings) || holdings.length === 0) {
        summary.skipped += 1
        continue
      }

      const snapshot = buildPortfolioSnapshot(portfolioId, holdings, quotes, date)
      await writeSnapshot(portfolioId, snapshot, { token })
      summary.succeeded += 1
      summary.portfolioIds.push(portfolioId)
    } catch {
      summary.failed += 1
    }
  }

  return summary
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = getCronSecret()
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = getBlobToken()
  if (!token) return res.status(500).json({ error: 'blob token not configured' })

  try {
    const bodyIds = dedupePortfolioIds(req.body?.portfolioIds)
    const queryIds = dedupePortfolioIds(String(req.query?.portfolioIds || '').split(','))
    const requestedIds = bodyIds.length > 0 ? bodyIds : queryIds

    const summary = await snapshotPortfolios({
      portfolioIds: requestedIds,
      origin: resolveRequestOrigin(req),
      token,
    })

    return res.status(200).json({ ok: true, ...summary })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'snapshot portfolios failed' })
  }
}
