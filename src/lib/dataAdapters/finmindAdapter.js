/**
 * FinMind Data Adapter — wraps /api/finmind into the unified data adapter interface.
 *
 * Data sources (all from FinMind free API):
 *   institutional — 三大法人買賣超明細
 *   margin        — 融資融券餘額
 *   valuation     — PER / PBR / 殖利率歷史
 *   financials    — 完整財報（損益/資產負債/現金流）
 *   balanceSheet  — 資產負債表
 *   cashFlow      — 現金流量表
 *   dividend      — 股利政策歷史
 *   dividendResult— 除權息實際結果
 *   revenue       — 月營收（含 YoY/MoM）
 *   shareholding  — 外資持股比率
 *   news          — 個股新聞（提供 Qwen 建動態事件來源）
 */

// ── FinMind 快取層 ── 同一天同一 dataset+code 只呼叫一次 API
const CACHE_PREFIX = 'fm-cache-'
const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 小時

// Global in-flight limiter: without this, a cold load fans out 11 datasets ×
// N holdings in parallel and blows past FinMind's 600/hr paid rate limit,
// which the backend then serves as `degraded: true` + empty data. Per
// multi-LLM consensus, cap concurrent requests at 3 globally.
const MAX_CONCURRENT_FINMIND = 3
let finmindInFlight = 0
const finmindPending = []

function acquireFinMindSlot() {
  return new Promise((resolve) => {
    if (finmindInFlight < MAX_CONCURRENT_FINMIND) {
      finmindInFlight += 1
      resolve()
      return
    }
    finmindPending.push(resolve)
  })
}

function releaseFinMindSlot() {
  const next = finmindPending.shift()
  if (next) {
    // Another waiter takes the slot without changing in-flight count.
    next()
    return
  }
  finmindInFlight = Math.max(0, finmindInFlight - 1)
}

function getCacheKey(dataset, code) {
  return `${CACHE_PREFIX}${dataset}-${code}`
}

// One-shot eviction on module load: any fm-cache-* entry whose stored data is
// an empty array is considered poisoned (either written during a rate-limit
// degrade or legitimately empty from a prior run). Deleting all of them forces
// the adapter to retry FinMind on the next call. Cheap scan — localStorage
// key count stays well under 500 even for heavy users.
function evictEmptyFinMindCache() {
  try {
    if (typeof localStorage === 'undefined') return
    const victims = []
    const len = localStorage.length || 0
    for (let i = 0; i < len; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(CACHE_PREFIX)) continue
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.data) && parsed.data.length === 0) {
          victims.push(key)
        }
      } catch {
        victims.push(key) // malformed entries also evicted
      }
    }
    for (const key of victims) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
    if (victims.length > 0 && typeof console !== 'undefined') {
      console.warn(`[finmindAdapter] evicted ${victims.length} empty cache entries`)
    }
  } catch {
    /* ignore — eviction is best-effort */
  }
}

// Run eviction at module load. Safe to run in tests because it no-ops when
// localStorage is undefined or empty.
evictEmptyFinMindCache()

function readCache(dataset, code) {
  try {
    const raw = localStorage.getItem(getCacheKey(dataset, code))
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(dataset, code))
      return null
    }
    return data
  } catch {
    return null
  }
}

function writeCache(dataset, code, data) {
  try {
    localStorage.setItem(getCacheKey(dataset, code), JSON.stringify({ data, ts: Date.now() }))
  } catch {
    /* storage full — ignore */
  }
}

async function fetchFinMind(dataset, code, startDate, { forceFresh = false } = {}) {
  // 先查快取
  const cached = forceFresh ? null : readCache(dataset, code)
  if (cached) return cached

  const params = new URLSearchParams({ dataset, code })
  if (startDate) params.set('start_date', startDate)

  await acquireFinMindSlot()
  try {
    const res = await fetch(`/api/finmind?${params}`, {
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `FinMind ${dataset} failed (${res.status})`)
    }

    const json = await res.json()
    const data = json.data || []

    // Skip cache when the backend reports a degraded (rate-limited) response.
    // Caching an empty degraded response would poison the cache for the full
    // TTL window and leave the user stuck with 'missing' freshness. Returning
    // the empty array preserves the caller contract (mapper returns null,
    // downstream falls back to 'missing'), but the next call will retry the
    // real API instead of serving stale empty from cache.
    if (json.degraded === true) {
      return data
    }

    // 寫入快取
    writeCache(dataset, code, data)
    return data
  } finally {
    releaseFinMindSlot()
  }
}

/**
 * 取得個股三大法人近 N 天買賣超
 * @param {string} code — 股票代碼
 * @param {number} days — 回看天數（預設 30）
 * @returns {Promise<Array<{date, foreign, investment, dealer}>>}
 */
export async function fetchInstitutionalChip(code, days = 30, options = {}) {
  const start = daysAgo(days)
  return fetchFinMind('institutional', code, start, options)
}

/**
 * 取得個股融資融券
 * @param {string} code
 * @param {number} days
 */
export async function fetchMarginTrading(code, days = 30, options = {}) {
  const start = daysAgo(days)
  return fetchFinMind('margin', code, start, options)
}

/**
 * 取得個股 PER/PBR/殖利率歷史
 * @param {string} code
 * @param {number} days — 預設 365（看一年）
 */
export async function fetchValuationHistory(code, days = 365, options = {}) {
  const start = daysAgo(days)
  return fetchFinMind('valuation', code, start, options)
}

/**
 * 取得個股財務報表
 * @param {string} code
 * @param {string} startDate — 預設 2 年前
 */
export async function fetchFinancialStatements(code, startDate, options = {}) {
  const start = startDate || daysAgo(730)
  return fetchFinMind('financials', code, start, options)
}

/**
 * 取得個股資產負債表
 * @param {string} code
 * @param {string} startDate
 */
export async function fetchBalanceSheet(code, startDate, options = {}) {
  const start = startDate || daysAgo(730)
  return fetchFinMind('balanceSheet', code, start, options)
}

/**
 * 取得個股現金流量表
 * @param {string} code
 * @param {string} startDate
 */
export async function fetchCashFlowStatements(code, startDate, options = {}) {
  const start = startDate || daysAgo(730)
  return fetchFinMind('cashFlow', code, start, options)
}

/**
 * 取得個股股利歷史
 * @param {string} code
 */
export async function fetchDividendHistory(code, options = {}) {
  return fetchFinMind('dividend', code, daysAgo(1825), options) // 5 年
}

/**
 * 取得個股除權息結果
 * @param {string} code
 * @param {number} days
 */
export async function fetchDividendResults(code, days = 1825, options = {}) {
  return fetchFinMind('dividendResult', code, daysAgo(days), options)
}

/**
 * 取得個股月營收（含 YoY/MoM）
 * @param {string} code
 * @param {number} months — 回看月數（預設 12）
 */
export async function fetchRevenueHistory(code, months = 12, options = {}) {
  const start = daysAgo(months * 31)
  return fetchFinMind('revenue', code, start, options)
}

/**
 * 取得外資持股變化
 * @param {string} code
 * @param {number} days
 */
export async function fetchShareholdingHistory(code, days = 120, options = {}) {
  return fetchFinMind('shareholding', code, daysAgo(days), options)
}

/**
 * 取得個股新聞（提供動態事件來源）
 * @param {string} code
 * @param {number} days
 */
export async function fetchStockNews(code, days = 21, options = {}) {
  return fetchFinMind('news', code, daysAgo(days), options)
}

/**
 * 組合查詢：一次取得個股的籌碼 + 估值 + 最近營收
 * 用於 holding dossier 充實
 * @param {string} code
 * @returns {Promise<{institutional, margin, valuation, financials, balanceSheet, cashFlow, dividend, dividendResult, revenue, shareholding, news}>}
 */
export async function fetchStockDossierData(code, options = {}) {
  const [
    institutional,
    margin,
    valuation,
    financials,
    balanceSheet,
    cashFlow,
    dividend,
    dividendResult,
    revenue,
    shareholding,
    news,
  ] = await Promise.allSettled([
    fetchInstitutionalChip(code, 20, options),
    fetchMarginTrading(code, 20, options),
    fetchValuationHistory(code, 90, options),
    fetchFinancialStatements(code, undefined, options),
    fetchBalanceSheet(code, undefined, options),
    fetchCashFlowStatements(code, undefined, options),
    fetchDividendHistory(code, options),
    fetchDividendResults(code, 1825, options),
    fetchRevenueHistory(code, 6, options),
    fetchShareholdingHistory(code, 90, options),
    fetchStockNews(code, 14, options),
  ])

  return {
    institutional: institutional.status === 'fulfilled' ? institutional.value : [],
    margin: margin.status === 'fulfilled' ? margin.value : [],
    valuation: valuation.status === 'fulfilled' ? valuation.value : [],
    financials: financials.status === 'fulfilled' ? financials.value : [],
    balanceSheet: balanceSheet.status === 'fulfilled' ? balanceSheet.value : [],
    cashFlow: cashFlow.status === 'fulfilled' ? cashFlow.value : [],
    dividend: dividend.status === 'fulfilled' ? dividend.value : [],
    dividendResult: dividendResult.status === 'fulfilled' ? dividendResult.value : [],
    revenue: revenue.status === 'fulfilled' ? revenue.value : [],
    shareholding: shareholding.status === 'fulfilled' ? shareholding.value : [],
    news: news.status === 'fulfilled' ? news.value : [],
  }
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
