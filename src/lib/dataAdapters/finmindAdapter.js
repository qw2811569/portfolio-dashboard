/**
 * FinMind Data Adapter — wraps /api/finmind into the unified data adapter interface.
 *
 * Data sources (all from FinMind free API):
 *   institutional — 三大法人買賣超明細
 *   margin        — 融資融券餘額
 *   valuation     — PER / PBR / 殖利率歷史
 *   financials    — 完整財報（損益/資產負債/現金流）
 *   dividend      — 股利政策歷史
 *   revenue       — 月營收（含 YoY/MoM）
 */

async function fetchFinMind(dataset, code, startDate) {
  const params = new URLSearchParams({ dataset, code })
  if (startDate) params.set('start_date', startDate)

  const res = await fetch(`/api/finmind?${params}`, {
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `FinMind ${dataset} failed (${res.status})`)
  }

  const json = await res.json()
  return json.data || []
}

/**
 * 取得個股三大法人近 N 天買賣超
 * @param {string} code — 股票代碼
 * @param {number} days — 回看天數（預設 30）
 * @returns {Promise<Array<{date, foreign, investment, dealer}>>}
 */
export async function fetchInstitutionalChip(code, days = 30) {
  const start = daysAgo(days)
  return fetchFinMind('institutional', code, start)
}

/**
 * 取得個股融資融券
 * @param {string} code
 * @param {number} days
 */
export async function fetchMarginTrading(code, days = 30) {
  const start = daysAgo(days)
  return fetchFinMind('margin', code, start)
}

/**
 * 取得個股 PER/PBR/殖利率歷史
 * @param {string} code
 * @param {number} days — 預設 365（看一年）
 */
export async function fetchValuationHistory(code, days = 365) {
  const start = daysAgo(days)
  return fetchFinMind('valuation', code, start)
}

/**
 * 取得個股財務報表
 * @param {string} code
 * @param {string} startDate — 預設 2 年前
 */
export async function fetchFinancialStatements(code, startDate) {
  const start = startDate || daysAgo(730)
  return fetchFinMind('financials', code, start)
}

/**
 * 取得個股股利歷史
 * @param {string} code
 */
export async function fetchDividendHistory(code) {
  return fetchFinMind('dividend', code, daysAgo(1825)) // 5 年
}

/**
 * 取得個股月營收（含 YoY/MoM）
 * @param {string} code
 * @param {number} months — 回看月數（預設 12）
 */
export async function fetchRevenueHistory(code, months = 12) {
  const start = daysAgo(months * 31)
  return fetchFinMind('revenue', code, start)
}

/**
 * 組合查詢：一次取得個股的籌碼 + 估值 + 最近營收
 * 用於 holding dossier 充實
 * @param {string} code
 * @returns {Promise<{institutional, margin, valuation, revenue}>}
 */
export async function fetchStockDossierData(code) {
  const [institutional, margin, valuation, revenue] = await Promise.allSettled([
    fetchInstitutionalChip(code, 20),
    fetchMarginTrading(code, 20),
    fetchValuationHistory(code, 90),
    fetchRevenueHistory(code, 6),
  ])

  return {
    institutional: institutional.status === 'fulfilled' ? institutional.value : [],
    margin: margin.status === 'fulfilled' ? margin.value : [],
    valuation: valuation.status === 'fulfilled' ? valuation.value : [],
    revenue: revenue.status === 'fulfilled' ? revenue.value : [],
  }
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
