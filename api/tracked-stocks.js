import { withApiAuth } from './_lib/auth-middleware.js'
import { getPortfolioPolicy } from './_lib/portfolio-policy.js'
import { PortfolioAccessError, requirePortfolio } from './_lib/require-portfolio.js'
import { resolveSignedBlobOrigin } from './_lib/signed-url.js'
import {
  buildTrackedStocksSnapshot,
  dedupeTrackedStocks,
  getBlobToken,
  readTrackedStocksSnapshotState,
  writeTrackedStocksSnapshot,
} from './_lib/tracked-stocks.js'

const TRACKED_STOCKS_WRITE_RETRY_LIMIT = 3
const TRACKED_STOCKS_WRITE_RETRY_BASE_MS = 25

function resolvePortfolioId(req) {
  return String(req?.body?.portfolioId || req?.body?.pid || req?.query?.portfolioId || '').trim()
}

function isLocalDevRequest() {
  return !process.env.VERCEL && process.env.VERCEL_ENV !== 'production'
}

function buildLocalDevPortfolio(portfolioId) {
  const normalizedPortfolioId = String(portfolioId || '').trim()
  if (!normalizedPortfolioId) return null

  const knownPortfolio = getPortfolioPolicy(normalizedPortfolioId)
  if (knownPortfolio) return knownPortfolio

  return {
    id: normalizedPortfolioId,
    name: normalizedPortfolioId,
    owner: normalizedPortfolioId,
    compliance_mode: 'retail',
  }
}

function isTrackedStocksWriteConflict(error) {
  return ['BlobPreconditionFailedError', 'BlobAlreadyExistsError'].includes(
    String(error?.name || '').trim()
  )
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = getBlobToken()
  if (!token) {
    return res.status(500).json({ error: 'blob token not configured' })
  }

  const portfolioId = resolvePortfolioId(req)
  let portfolio = null

  try {
    portfolio = requirePortfolio(req, portfolioId)
  } catch (error) {
    if (
      error instanceof PortfolioAccessError &&
      ['missing_auth_claim', 'portfolio_not_found'].includes(error.code) &&
      isLocalDevRequest()
    ) {
      portfolio = buildLocalDevPortfolio(portfolioId)
      if (!portfolio) {
        return res
          .status(404)
          .json({ error: `Unknown portfolio: ${portfolioId}`, code: 'portfolio_not_found' })
      }
    } else if (error instanceof PortfolioAccessError) {
      return res.status(error.status).json({ error: error.message, code: error.code })
    } else {
      throw error
    }
  }

  const incomingStocks = dedupeTrackedStocks(req.body?.stocks)
  if (incomingStocks.length === 0) {
    return res.status(400).json({ error: 'stocks is required' })
  }

  try {
    const origin = resolveSignedBlobOrigin(req)

    for (let attempt = 1; attempt <= TRACKED_STOCKS_WRITE_RETRY_LIMIT; attempt += 1) {
      const current = await readTrackedStocksSnapshotState(portfolio.id, {
        token,
        origin,
        logger: console,
      })
      const mergedStocks = dedupeTrackedStocks([
        ...(current?.record?.trackedStocks || []),
        ...incomingStocks,
      ])
      const snapshot = buildTrackedStocksSnapshot({
        portfolioId: portfolio.id,
        stocks: mergedStocks,
        now: new Date(),
        source: 'live-sync',
      })

      try {
        await writeTrackedStocksSnapshot(portfolio.id, snapshot, {
          token,
          ifMatch: current?.etag || null,
        })

        return res.status(200).json({
          updated: true,
          totalTracked: snapshot.count,
          lastSyncedAt: snapshot.lastSyncedAt,
          portfolioId: portfolio.id,
        })
      } catch (error) {
        if (!isTrackedStocksWriteConflict(error) || attempt >= TRACKED_STOCKS_WRITE_RETRY_LIMIT) {
          throw error
        }

        console.warn(
          `[api/tracked-stocks] blob write conflict for ${portfolio.id}; retry ${attempt}/${TRACKED_STOCKS_WRITE_RETRY_LIMIT}`
        )
        await sleep(TRACKED_STOCKS_WRITE_RETRY_BASE_MS * attempt)
      }
    }

    throw new Error('tracked stocks sync exhausted write retries')
  } catch (error) {
    console.error('[api/tracked-stocks] sync failed:', error)
    return res.status(500).json({ error: error?.message || 'tracked stocks sync failed' })
  }
}

export default withApiAuth(handler)
