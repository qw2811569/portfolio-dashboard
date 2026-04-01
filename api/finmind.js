// Vercel Serverless Function — FinMind 台股資料 API
// 來源：https://finmindtrade.com
// 免費使用，不需 API key（有 token 可提升 rate limit）
// Rate limit：無 token 300/hr，有 token 600/hr
//
// 支援的 dataset：
//   TaiwanStockInstitutionalInvestorsBuySell — 三大法人買賣超
//   TaiwanStockMarginPurchaseShortSale — 融資融券
//   TaiwanStockPER — PER/PBR/殖利率
//   TaiwanStockFinancialStatements — 財務報表
//   TaiwanStockDividend — 股利政策
//   TaiwanStockMonthRevenue — 月營收（含歷史）
//   TaiwanFuturesInstitutionalInvestors — 期貨法人

const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data'
const TOKEN = process.env.FINMIND_TOKEN || ''

async function queryFinMind(dataset, params = {}) {
  const searchParams = new URLSearchParams({
    dataset,
    ...params,
  })
  if (TOKEN) searchParams.set('token', TOKEN)

  const res = await fetch(`${FINMIND_BASE}?${searchParams}`, {
    headers: { 'User-Agent': 'portfolio-dashboard/1.0' },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`FinMind ${dataset} failed (${res.status}): ${text.slice(0, 100)}`)
  }

  const data = await res.json()
  if (data.status !== 200 && data.msg !== 'success') {
    throw new Error(`FinMind ${dataset}: ${data.msg || 'unknown error'}`)
  }

  return data.data || []
}

// ── 三大法人買賣超 ──
async function getInstitutional(code, startDate) {
  const rows = await queryFinMind('TaiwanStockInstitutionalInvestorsBuySell', {
    data_id: code,
    start_date: startDate,
  })

  // 彙總各法人
  const byDate = {}
  for (const row of rows) {
    if (!byDate[row.date])
      byDate[row.date] = { date: row.date, foreign: 0, investment: 0, dealer: 0 }
    const buy = Number(row.buy) || 0
    const sell = Number(row.sell) || 0
    const net = buy - sell

    if (row.name.includes('外資')) byDate[row.date].foreign += net
    else if (row.name.includes('投信')) byDate[row.date].investment += net
    else if (row.name.includes('自營')) byDate[row.date].dealer += net
  }

  return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date))
}

// ── 融資融券 ──
async function getMarginTrading(code, startDate) {
  const rows = await queryFinMind('TaiwanStockMarginPurchaseShortSale', {
    data_id: code,
    start_date: startDate,
  })

  return rows.map((row) => ({
    date: row.date,
    marginBuy: Number(row.MarginPurchaseBuy) || 0,
    marginSell: Number(row.MarginPurchaseSell) || 0,
    marginBalance: Number(row.MarginPurchaseCashRepayment) || 0,
    shortBuy: Number(row.ShortSaleBuy) || 0,
    shortSell: Number(row.ShortSaleSell) || 0,
    shortBalance: Number(row.ShortSaleBalance) || 0,
  }))
}

// ── PER / PBR / 殖利率 ──
async function getValuation(code, startDate) {
  const rows = await queryFinMind('TaiwanStockPER', {
    data_id: code,
    start_date: startDate,
  })

  return rows.map((row) => ({
    date: row.date,
    per: Number(row.PER) || null,
    pbr: Number(row.PBR) || null,
    dividendYield: Number(row.dividend_yield) || null,
  }))
}

// ── 財務報表 ──
async function getFinancials(code, startDate) {
  const rows = await queryFinMind('TaiwanStockFinancialStatements', {
    data_id: code,
    start_date: startDate,
  })

  // FinMind 回傳的是個別科目 row，需要 pivot 成季度
  const byQuarter = {}
  for (const row of rows) {
    const key = `${row.date}`
    if (!byQuarter[key]) byQuarter[key] = { date: row.date }
    byQuarter[key][row.type] = Number(row.value) || 0
  }

  return Object.values(byQuarter).sort((a, b) => b.date.localeCompare(a.date))
}

// ── 股利政策 ──
async function getDividend(code, startDate) {
  const rows = await queryFinMind('TaiwanStockDividend', {
    data_id: code,
    start_date: startDate,
  })

  return rows.map((row) => ({
    date: row.date,
    cashDividend: Number(row.CashEarningsDistribution) || 0,
    stockDividend: Number(row.StockEarningsDistribution) || 0,
    totalDividend:
      (Number(row.CashEarningsDistribution) || 0) + (Number(row.StockEarningsDistribution) || 0),
  }))
}

// ── 月營收（含歷史） ──
async function getMonthlyRevenue(code, startDate) {
  const rows = await queryFinMind('TaiwanStockMonthRevenue', {
    data_id: code,
    start_date: startDate,
  })

  return rows.map((row) => ({
    date: row.date,
    revenue: Number(row.revenue) || 0,
    revenueYoY: Number(row.revenue_year_growth_rate) || null,
    revenueMoM: Number(row.revenue_month_growth_rate) || null,
  }))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { dataset, code, start_date } = req.query

  if (!dataset || !code) {
    return res.status(400).json({
      error: '需要 dataset 和 code 參數',
      available: ['institutional', 'margin', 'valuation', 'financials', 'dividend', 'revenue'],
      example: '/api/finmind?dataset=institutional&code=2308&start_date=2026-03-01',
    })
  }

  const startDate = start_date || defaultStartDate()

  try {
    let data
    switch (dataset) {
      case 'institutional':
        data = await getInstitutional(code, startDate)
        break
      case 'margin':
        data = await getMarginTrading(code, startDate)
        break
      case 'valuation':
        data = await getValuation(code, startDate)
        break
      case 'financials':
        data = await getFinancials(code, startDate)
        break
      case 'dividend':
        data = await getDividend(code, startDate)
        break
      case 'revenue':
        data = await getMonthlyRevenue(code, startDate)
        break
      default:
        return res.status(400).json({ error: `不支援的 dataset: ${dataset}` })
    }

    return res.status(200).json({
      success: true,
      dataset,
      code,
      startDate,
      count: data.length,
      data,
      source: 'finmind',
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    return res.status(500).json({ error: error.message, source: 'finmind' })
  }
}

function defaultStartDate() {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return d.toISOString().slice(0, 10)
}
