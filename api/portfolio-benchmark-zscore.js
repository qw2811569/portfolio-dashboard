import { withApiAuth } from './_lib/auth-middleware.js'
import {
  DEFAULT_BENCHMARK_CODE,
  DEFAULT_BENCHMARK_LABEL,
  DEFAULT_BENCHMARK_PROXY_FOR,
  DEFAULT_BENCHMARK_SOURCE,
  readBenchmarkSnapshots,
} from './_lib/benchmark-snapshots.js'
import { readRawPortfolioSnapshots } from './_lib/portfolio-snapshots.js'
import { resolveSignedBlobOrigin } from './_lib/signed-url.js'
import {
  buildReturnSeriesFromValueSnapshots,
  calculateX1ZScore,
  X1_RECENT_WINDOW_DAYS,
  X1_TRAILING_STD_DAYS,
} from '../src/lib/x1ZScore.js'
import { getTaipeiClock } from '../src/lib/datetime.js'

const LOOKBACK_DAYS = 90
const SOFT_FALLBACK_MESSAGE = '今天對比大盤，稍後再看'

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function buildBenchmarkMeta() {
  return {
    code: DEFAULT_BENCHMARK_CODE,
    label: DEFAULT_BENCHMARK_LABEL,
    proxyFor: DEFAULT_BENCHMARK_PROXY_FOR,
    source: DEFAULT_BENCHMARK_SOURCE,
  }
}

function buildUnavailablePayload({ portfolioId, reason, sampleSize = 0, recentSeries = [] } = {}) {
  return {
    ok: false,
    status: 'unavailable',
    portfolioId,
    benchmark: buildBenchmarkMeta(),
    reason,
    message: SOFT_FALLBACK_MESSAGE,
    trailingWindow: X1_TRAILING_STD_DAYS,
    recentWindow: X1_RECENT_WINDOW_DAYS,
    sampleSize,
    recentSeries,
  }
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const portfolioId = String(req.query?.portfolioId || '').trim()
  if (!portfolioId) {
    return res.status(400).json({ error: 'portfolioId is required' })
  }

  const origin = resolveSignedBlobOrigin(req)
  const toDate = getTaipeiClock(new Date()).marketDate
  const fromDate = shiftDate(toDate, -(LOOKBACK_DAYS - 1))

  try {
    const [portfolioSnapshots, benchmarkSnapshots] = await Promise.all([
      readRawPortfolioSnapshots(portfolioId, { fromDate, toDate }, { origin }),
      readBenchmarkSnapshots({ fromDate, toDate }, { origin }),
    ])

    if (portfolioSnapshots.length < 2) {
      return res
        .status(200)
        .json(buildUnavailablePayload({ portfolioId, reason: 'portfolio_history_missing' }))
    }

    if (benchmarkSnapshots.length < 2) {
      return res
        .status(200)
        .json(buildUnavailablePayload({ portfolioId, reason: 'benchmark_history_missing' }))
    }

    const portfolioDailyReturns = buildReturnSeriesFromValueSnapshots(
      portfolioSnapshots,
      'totalValue'
    )
    const benchmarkDailyReturns = buildReturnSeriesFromValueSnapshots(benchmarkSnapshots, 'close')
    const x1 = calculateX1ZScore({
      portfolioDailyReturns,
      benchmarkDailyReturns,
      trailingWindow: X1_TRAILING_STD_DAYS,
      recentWindow: X1_RECENT_WINDOW_DAYS,
    })

    if (x1.zScore == null) {
      return res.status(200).json(
        buildUnavailablePayload({
          portfolioId,
          reason: x1.reason || 'insufficient_history',
          sampleSize: x1.sampleSize || 0,
          recentSeries: x1.recentSeries || [],
        })
      )
    }

    return res.status(200).json({
      ok: true,
      status: 'ready',
      portfolioId,
      benchmark: buildBenchmarkMeta(),
      marketDate: x1.latestDate,
      message: null,
      trailingWindow: X1_TRAILING_STD_DAYS,
      recentWindow: X1_RECENT_WINDOW_DAYS,
      zScore: x1.zScore,
      interpretation: x1.interpretation,
      latestPortfolioReturnPct: x1.latestPortfolioReturnPct,
      latestBenchmarkReturnPct: x1.latestBenchmarkReturnPct,
      latestDiffPct: x1.latestDiffPct,
      volatilityPct: x1.volatilityPct,
      sampleSize: x1.sampleSize,
      recentSeries: x1.recentSeries,
    })
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'portfolio benchmark z-score failed',
      message: SOFT_FALLBACK_MESSAGE,
      portfolioId,
      benchmark: buildBenchmarkMeta(),
    })
  }
}

export default withApiAuth(handler)
