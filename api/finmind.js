import { withApiAuth } from './_lib/auth-middleware.js'
import { isFinMindRateLimitError, queryFinMindDataset } from './_lib/finmind-governor.js'
import { readLatestFinMindSnapshotFallback } from './_lib/finmind-snapshot-fallback.js'
// Vercel Serverless Function — FinMind 台股資料 API
// 來源：https://finmindtrade.com
// 免費使用，不需 API key（有 token 可提升 rate limit）
// Rate limit：無 token 300/hr，有 token 600/hr
//
// 支援的 dataset：
//   institutional   — 三大法人買賣超
//   margin          — 融資融券
//   valuation       — PER/PBR/殖利率
//   financials      — 綜合損益表
//   balanceSheet    — 資產負債表
//   cashFlow        — 現金流量表
//   dividend        — 股利政策
//   dividendResult  — 除權息實際結果
//   capitalReductionReferencePrice — 減資恢復買賣參考價格
//   revenue         — 月營收（含歷史）
//   shareholding    — 外資持股比率
//   news            — 個股新聞（提供 Qwen 建動態事件來源）

import { normalizeFinancialStatementRows } from '../src/lib/finmindPeriodUtils.js'
import {
  FINMIND_DATASET_KEYS,
  getFinMindDatasetConfig,
} from '../src/lib/dataAdapters/finmindDatasetRegistry.js'

const FINMIND_RETRY_ATTEMPTS = 3
const FINMIND_RETRY_DELAY_MS = 300

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function sortByDateDesc(rows = []) {
  return [...rows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}

function toRevenueMonthInfo(row) {
  const year = Number(row?.revenue_year ?? row?.revenueYear)
  const month = Number(row?.revenue_month ?? row?.revenueMonth)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null
  const paddedMonth = String(month).padStart(2, '0')
  return {
    year,
    month,
    label: `${year}-${paddedMonth}`,
    periodDate: `${year}-${paddedMonth}-01`,
  }
}

function sortRevenueRowsDesc(rows = []) {
  return [...rows].sort((left, right) => {
    const leftInfo = toRevenueMonthInfo(left)
    const rightInfo = toRevenueMonthInfo(right)
    if (leftInfo && rightInfo) {
      if (leftInfo.year !== rightInfo.year) return rightInfo.year - leftInfo.year
      if (leftInfo.month !== rightInfo.month) return rightInfo.month - leftInfo.month
    }
    return String(right?.date || '').localeCompare(String(left?.date || ''))
  })
}

function normalizeInstitutionalName(name = '') {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function getInstitutionalBucket(name = '') {
  const normalized = normalizeInstitutionalName(name)
  if (
    name.includes('外資') ||
    name.includes('陸資') ||
    normalized.includes('foreign') ||
    normalized.includes('overseas') ||
    normalized.includes('foreign_dealer')
  ) {
    return 'foreign'
  }
  if (name.includes('投信') || normalized.includes('investment_trust')) return 'investment'
  if (name.includes('自營') || normalized.includes('dealer')) {
    return 'dealer'
  }
  return null
}

function transformInstitutional(rows = []) {
  const byDate = {}
  for (const row of rows) {
    if (!row?.date) continue
    if (!byDate[row.date]) {
      byDate[row.date] = { date: row.date, foreign: 0, investment: 0, dealer: 0 }
    }
    const net = toNumber(row.buy) - toNumber(row.sell)
    const name = String(row.name || '')
    const bucket = getInstitutionalBucket(name)
    if (bucket) byDate[row.date][bucket] += net
  }
  return sortByDateDesc(Object.values(byDate))
}

function transformMarginTrading(rows = []) {
  return sortByDateDesc(
    rows.map((row) => ({
      date: row.date,
      marginBuy: toNumber(row.MarginPurchaseBuy),
      marginSell: toNumber(row.MarginPurchaseSell),
      marginBalance: toNumber(row.MarginPurchaseTodayBalance),
      marginPrevBalance: toNumber(row.MarginPurchaseYesterdayBalance),
      shortBuy: toNumber(row.ShortSaleBuy),
      shortSell: toNumber(row.ShortSaleSell),
      shortBalance: toNumber(row.ShortSaleTodayBalance),
      shortPrevBalance: toNumber(row.ShortSaleYesterdayBalance),
    }))
  )
}

function transformValuation(rows = []) {
  return sortByDateDesc(
    rows.map((row) => ({
      date: row.date,
      per: Number.isFinite(Number(row.PER)) ? Number(row.PER) : null,
      pbr: Number.isFinite(Number(row.PBR)) ? Number(row.PBR) : null,
      dividendYield: Number.isFinite(Number(row.dividend_yield))
        ? Number(row.dividend_yield)
        : null,
    }))
  )
}

function pivotStatementRows(rows = [], { revenueRows = [] } = {}) {
  const byDate = {}
  for (const row of rows) {
    if (!row?.date) continue
    const type = String(row.type || row.origin_name || '').trim()
    if (!type) continue
    if (!byDate[row.date]) byDate[row.date] = { date: row.date }
    byDate[row.date][type] = toNumber(row.value)
  }
  return normalizeFinancialStatementRows(sortByDateDesc(Object.values(byDate)), revenueRows)
}

function transformDividend(rows = []) {
  return sortByDateDesc(
    rows.map((row) => {
      const cashDividend = toNumber(row.CashEarningsDistribution)
      const stockDividend = toNumber(row.StockEarningsDistribution)
      return {
        date: row.date,
        year: String(row.year || '').trim() || null,
        cashDividend,
        stockDividend,
        totalDividend: cashDividend + stockDividend,
        exDividendDate: row.CashExDividendTradingDate || null,
        exRightsDate: row.StockExDividendTradingDate || null,
        announcementTime: row.AnnouncementTime || null,
      }
    })
  )
}

function transformDividendResult(rows = []) {
  return sortByDateDesc(
    rows.map((row) => ({
      date: row.date,
      beforePrice: Number.isFinite(Number(row.before_price)) ? Number(row.before_price) : null,
      afterPrice: Number.isFinite(Number(row.after_price)) ? Number(row.after_price) : null,
      dividendValue: Number.isFinite(Number(row.stock_and_cache_dividend))
        ? Number(row.stock_and_cache_dividend)
        : null,
      dividendType: String(row.stock_or_cache_dividend || '').trim() || null,
      referencePrice: Number.isFinite(Number(row.reference_price))
        ? Number(row.reference_price)
        : null,
      openPrice: Number.isFinite(Number(row.open_price)) ? Number(row.open_price) : null,
      maxPrice: Number.isFinite(Number(row.max_price)) ? Number(row.max_price) : null,
      minPrice: Number.isFinite(Number(row.min_price)) ? Number(row.min_price) : null,
    }))
  )
}

function transformCapitalReductionReferencePrice(rows = []) {
  return sortByDateDesc(
    rows.map((row) => ({
      date: row.date,
      closingPriceOnLastTradingDay: Number.isFinite(Number(row.ClosingPriceonTheLastTradingDay))
        ? Number(row.ClosingPriceonTheLastTradingDay)
        : null,
      postReductionReferencePrice: Number.isFinite(Number(row.PostReductionReferencePrice))
        ? Number(row.PostReductionReferencePrice)
        : null,
      openingReferencePrice: Number.isFinite(Number(row.OpeningReferencePrice))
        ? Number(row.OpeningReferencePrice)
        : null,
      exRightReferencePrice: Number.isFinite(Number(row.ExrightReferencePrice))
        ? Number(row.ExrightReferencePrice)
        : null,
      limitUp: Number.isFinite(Number(row.LimitUp)) ? Number(row.LimitUp) : null,
      limitDown: Number.isFinite(Number(row.LimitDown)) ? Number(row.LimitDown) : null,
      reasonForCapitalReduction: String(row.ReasonforCapitalReduction || '').trim() || null,
    }))
  )
}

function transformMonthlyRevenue(rows = []) {
  return sortRevenueRowsDesc(
    rows.map((row) => {
      const monthInfo = toRevenueMonthInfo(row)
      const announcedAt = String(row.date || '').trim() || null
      return {
        // FinMind revenue row `date` is the announcement month. Downstream
        // consumers care about the actual revenue month, so normalize `date`
        // to the owned month and keep the original announcement date separately.
        date: monthInfo?.periodDate || announcedAt,
        announcedAt,
        revenueMonth: monthInfo?.month ?? row.revenue_month ?? null,
        revenueYear: monthInfo?.year ?? row.revenue_year ?? null,
        revenuePeriod: monthInfo?.label || null,
        revenue: toNumber(row.revenue),
        revenueYoY: Number.isFinite(Number(row.revenue_year_growth_rate))
          ? Number(row.revenue_year_growth_rate)
          : null,
        revenueMoM: Number.isFinite(Number(row.revenue_month_growth_rate))
          ? Number(row.revenue_month_growth_rate)
          : null,
      }
    })
  )
}

function transformShareholding(rows = []) {
  return sortByDateDesc(
    rows.map((row) => ({
      date: row.date,
      stockName: String(row.stock_name || '').trim() || null,
      foreignShares: toNumber(row.ForeignInvestmentShares),
      foreignRemainingShares: toNumber(row.ForeignInvestmentRemainingShares),
      foreignShareRatio: Number.isFinite(Number(row.ForeignInvestmentSharesRatio))
        ? Number(row.ForeignInvestmentSharesRatio)
        : null,
      foreignRemainRatio: Number.isFinite(Number(row.ForeignInvestmentRemainRatio))
        ? Number(row.ForeignInvestmentRemainRatio)
        : null,
      foreignUpperLimitRatio: Number.isFinite(Number(row.ForeignInvestmentUpperLimitRatio))
        ? Number(row.ForeignInvestmentUpperLimitRatio)
        : null,
      sharesIssued: toNumber(row.NumberOfSharesIssued),
      declaredAt: row.RecentlyDeclareDate || null,
      note: String(row.note || '').trim() || null,
    }))
  )
}

function transformNews(rows = []) {
  return sortByDateDesc(
    rows.map((row) => ({
      date: row.date,
      title: String(row.title || '').trim(),
      description: String(row.description || '').trim(),
      link: String(row.link || '').trim() || null,
      source: String(row.source || '').trim() || null,
    }))
  )
}

const DATASET_TRANSFORMS = {
  institutional: transformInstitutional,
  margin: transformMarginTrading,
  valuation: transformValuation,
  financials: pivotStatementRows,
  balanceSheet: pivotStatementRows,
  cashFlow: pivotStatementRows,
  dividend: transformDividend,
  dividendResult: transformDividendResult,
  capitalReductionReferencePrice: transformCapitalReductionReferencePrice,
  revenue: transformMonthlyRevenue,
  shareholding: transformShareholding,
  news: transformNews,
}

function isTimeoutLikeError(error) {
  return (
    error?.name === 'TimeoutError' ||
    error?.name === 'AbortError' ||
    /timeout|timed out|aborted/i.test(String(error?.message || ''))
  )
}

function isRetryableFinMindError(error) {
  if (isFinMindRateLimitError(error)) return false
  if (isTimeoutLikeError(error)) return true

  const status = Number(error?.status)
  if (!Number.isFinite(status)) return false
  return [408, 425, 500, 502, 503, 504].includes(status)
}

function classifyFinMindDegradedReason(error) {
  if (isFinMindRateLimitError(error)) return 'quota-exceeded'
  if (isTimeoutLikeError(error)) return 'api-timeout'

  const status = Number(error?.status)
  if (status === 429) return 'quota-exceeded'
  if ([408, 425, 500, 502, 503, 504].includes(status)) return 'api-timeout'
  return ''
}

async function queryFinMindDatasetWithRetry(datasetKey, { code, startDate, endDate } = {}) {
  let attempt = 0

  while (true) {
    try {
      return await queryFinMindDataset(datasetKey, { code, startDate, endDate })
    } catch (error) {
      const shouldRetry = isRetryableFinMindError(error) && attempt + 1 < FINMIND_RETRY_ATTEMPTS
      if (!shouldRetry) throw error
      attempt += 1
      await sleep(FINMIND_RETRY_DELAY_MS * attempt)
    }
  }
}

function buildDegradedPayload({
  dataset,
  code,
  startDate,
  endDate,
  reason,
  error,
  fallbackSnapshot,
}) {
  const fallbackAt =
    String(
      fallbackSnapshot?.updatedAt ||
        fallbackSnapshot?.exportedAt ||
        fallbackSnapshot?.uploadedAt ||
        ''
    ).trim() || null

  return {
    success: true,
    degraded: true,
    dataset,
    code,
    startDate,
    endDate: endDate || null,
    count: 0,
    data: [],
    source: fallbackSnapshot ? 'snapshot-fallback' : 'finmind-degraded',
    fetchedAt: new Date().toISOString(),
    degradedMeta: {
      reason,
      liveError: String(error?.message || '').trim() || null,
      attempts: FINMIND_RETRY_ATTEMPTS,
      fallbackAt,
      snapshotDate: fallbackSnapshot?.snapshotDate || null,
      snapshotPath: fallbackSnapshot?.snapshotPath || null,
      portfolioId: fallbackSnapshot?.portfolioId || null,
      hasFallbackSnapshot: Boolean(fallbackSnapshot),
    },
    fallbackSnapshot: fallbackSnapshot
      ? {
          snapshotDate: fallbackSnapshot.snapshotDate || null,
          exportedAt: fallbackSnapshot.exportedAt || null,
          updatedAt: fallbackAt,
          portfolioId: fallbackSnapshot.portfolioId || null,
          dossier: fallbackSnapshot.dossier || null,
          fundamentals: fallbackSnapshot.fundamentals || null,
          targetsEntry: fallbackSnapshot.targetsEntry || null,
        }
      : null,
  }
}

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { dataset, code, start_date, end_date } = req.query
  const available = FINMIND_DATASET_KEYS

  if (!dataset || !code) {
    return res.status(400).json({
      error: '需要 dataset 和 code 參數',
      available,
      example: '/api/finmind?dataset=institutional&code=2308&start_date=2026-03-01',
    })
  }

  const config = getFinMindDatasetConfig(dataset)
  const transform = DATASET_TRANSFORMS[dataset]
  if (!config || typeof transform !== 'function') {
    return res.status(400).json({
      error: `不支援的 dataset: ${dataset}`,
      available,
    })
  }

  const startDate = start_date || defaultStartDate(config.defaultWindowDays)

  try {
    const rows = await queryFinMindDatasetWithRetry(dataset, { code, startDate, endDate: end_date })
    let revenueRows = []
    if (dataset === 'financials') {
      revenueRows = await queryFinMindDatasetWithRetry('revenue', {
        code,
        startDate,
        endDate: end_date,
      })
    }
    const data = transform(rows, { revenueRows })

    return res.status(200).json({
      success: true,
      dataset,
      code,
      startDate,
      endDate: end_date || null,
      count: data.length,
      data,
      source: 'finmind',
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    const degradedReason = classifyFinMindDegradedReason(error)
    if (degradedReason) {
      const fallbackSnapshot = await readLatestFinMindSnapshotFallback(code).catch(
        (_fallbackError) => null
      )

      return res.status(200).json(
        buildDegradedPayload({
          dataset,
          code,
          startDate,
          endDate: end_date,
          reason: degradedReason,
          error,
          fallbackSnapshot,
        })
      )
    }

    return res.status(500).json({ error: error.message, source: 'finmind' })
  }
}

function defaultStartDate(days = 90) {
  const d = new Date()
  d.setDate(d.getDate() - Number(days || 90))
  return d.toISOString().slice(0, 10)
}

export default withApiAuth(handler)
