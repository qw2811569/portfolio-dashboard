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
//   revenue         — 月營收（含歷史）
//   shareholding    — 外資持股比率
//   news            — 個股新聞（提供 Qwen 建動態事件來源）

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data'
const TOKEN = process.env.FINMIND_TOKEN || ''
const FINMIND_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000
let finmindRateLimitedUntil = 0

class FinMindApiError extends Error {
  constructor(message, { status = 500, code = 'unknown', body = '' } = {}) {
    super(message)
    this.name = 'FinMindApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function sortByDateDesc(rows = []) {
  return [...rows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}

function getInstitutionalBucket(name = '') {
  if (
    name.includes('外資') ||
    name.includes('陸資') ||
    name === 'Foreign_Investor' ||
    name === 'Foreign_Dealer_Self'
  ) {
    return 'foreign'
  }
  if (name.includes('投信') || name === 'Investment_Trust') return 'investment'
  if (name.includes('自營') || name === 'Dealer_self' || name === 'Dealer_Hedging') {
    return 'dealer'
  }
  return null
}

async function queryFinMind(dataset, params = {}) {
  if (Date.now() < finmindRateLimitedUntil) {
    throw new FinMindApiError('FinMind requests temporarily rate limited', {
      status: 402,
      code: 'rate_limited_cached',
    })
  }

  const searchParams = new URLSearchParams({
    dataset,
    ...Object.fromEntries(
      Object.entries(params).filter(([, value]) => value != null && String(value).trim() !== '')
    ),
  })

  const headers = { 'User-Agent': 'portfolio-dashboard/1.0' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

  const res = await fetch(`${FINMIND_BASE}?${searchParams}`, {
    headers,
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    const text = await res.text()
    const snippet = text.slice(0, 160)

    if (res.status === 402 && /upper limit/i.test(text)) {
      finmindRateLimitedUntil = Date.now() + FINMIND_RATE_LIMIT_COOLDOWN_MS
      throw new FinMindApiError(`FinMind ${dataset} requests reached upper limit`, {
        status: 402,
        code: 'rate_limited',
        body: snippet,
      })
    }

    throw new FinMindApiError(`FinMind ${dataset} failed (${res.status}): ${snippet}`, {
      status: res.status,
      code: 'upstream_error',
      body: snippet,
    })
  }

  const data = await res.json()
  if (data.status !== 200 && data.msg !== 'success') {
    if (Number(data.status) === 402 || /upper limit/i.test(String(data.msg || ''))) {
      finmindRateLimitedUntil = Date.now() + FINMIND_RATE_LIMIT_COOLDOWN_MS
      throw new FinMindApiError(`FinMind ${dataset} requests reached upper limit`, {
        status: 402,
        code: 'rate_limited',
        body: String(data.msg || '').slice(0, 160),
      })
    }

    throw new FinMindApiError(`FinMind ${dataset}: ${data.msg || 'unknown error'}`, {
      status: Number(data.status) || 500,
      code: 'upstream_payload_error',
      body: String(data.msg || '').slice(0, 160),
    })
  }

  return Array.isArray(data.data) ? data.data : []
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

function pivotStatementRows(rows = []) {
  const byDate = {}
  for (const row of rows) {
    if (!row?.date) continue
    const type = String(row.type || row.origin_name || '').trim()
    if (!type) continue
    if (!byDate[row.date]) byDate[row.date] = { date: row.date }
    byDate[row.date][type] = toNumber(row.value)
  }
  return sortByDateDesc(Object.values(byDate))
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

function transformMonthlyRevenue(rows = []) {
  return sortByDateDesc(
    rows.map((row) => ({
      date: row.date,
      revenueMonth: row.revenue_month || null,
      revenueYear: row.revenue_year || null,
      revenue: toNumber(row.revenue),
      revenueYoY: Number.isFinite(Number(row.revenue_year_growth_rate))
        ? Number(row.revenue_year_growth_rate)
        : null,
      revenueMoM: Number.isFinite(Number(row.revenue_month_growth_rate))
        ? Number(row.revenue_month_growth_rate)
        : null,
    }))
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

const DATASET_MAP = {
  institutional: {
    finmindDataset: 'TaiwanStockInstitutionalInvestorsBuySell',
    transform: transformInstitutional,
    defaultWindowDays: 90,
  },
  margin: {
    finmindDataset: 'TaiwanStockMarginPurchaseShortSale',
    transform: transformMarginTrading,
    defaultWindowDays: 90,
  },
  valuation: {
    finmindDataset: 'TaiwanStockPER',
    transform: transformValuation,
    defaultWindowDays: 365,
  },
  financials: {
    finmindDataset: 'TaiwanStockFinancialStatements',
    transform: pivotStatementRows,
    defaultWindowDays: 730,
  },
  balanceSheet: {
    finmindDataset: 'TaiwanStockBalanceSheet',
    transform: pivotStatementRows,
    defaultWindowDays: 730,
  },
  cashFlow: {
    finmindDataset: 'TaiwanStockCashFlowsStatement',
    transform: pivotStatementRows,
    defaultWindowDays: 730,
  },
  dividend: {
    finmindDataset: 'TaiwanStockDividend',
    transform: transformDividend,
    defaultWindowDays: 1825,
  },
  dividendResult: {
    finmindDataset: 'TaiwanStockDividendResult',
    transform: transformDividendResult,
    defaultWindowDays: 1825,
  },
  revenue: {
    finmindDataset: 'TaiwanStockMonthRevenue',
    transform: transformMonthlyRevenue,
    defaultWindowDays: 365,
  },
  shareholding: {
    finmindDataset: 'TaiwanStockShareholding',
    transform: transformShareholding,
    defaultWindowDays: 120,
  },
  news: {
    finmindDataset: 'TaiwanStockNews',
    transform: transformNews,
    defaultWindowDays: 21,
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { dataset, code, start_date, end_date } = req.query
  const available = Object.keys(DATASET_MAP)

  if (!dataset || !code) {
    return res.status(400).json({
      error: '需要 dataset 和 code 參數',
      available,
      example: '/api/finmind?dataset=institutional&code=2308&start_date=2026-03-01',
    })
  }

  const config = DATASET_MAP[dataset]
  if (!config) {
    return res.status(400).json({
      error: `不支援的 dataset: ${dataset}`,
      available,
    })
  }

  const startDate = start_date || defaultStartDate(config.defaultWindowDays)

  try {
    const rows = await queryFinMind(config.finmindDataset, {
      data_id: code,
      start_date: startDate,
      end_date,
    })
    const data = config.transform(rows)

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
    if (isFinMindRateLimitError(error)) {
      return res.status(200).json({
        success: true,
        degraded: true,
        reason: 'rate_limited',
        warning: 'FinMind requests temporarily rate limited; returned empty dataset fallback',
        dataset,
        code,
        startDate,
        endDate: end_date || null,
        count: 0,
        data: [],
        source: 'finmind',
        fetchedAt: new Date().toISOString(),
      })
    }

    return res.status(500).json({ error: error.message, source: 'finmind' })
  }
}

function defaultStartDate(days = 90) {
  const d = new Date()
  d.setDate(d.getDate() - Number(days || 90))
  return d.toISOString().slice(0, 10)
}

function isFinMindRateLimitError(error) {
  return error instanceof FinMindApiError && String(error.code || '').startsWith('rate_limited')
}
