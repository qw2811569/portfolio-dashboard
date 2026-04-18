import { withApiAuth } from './_lib/auth-middleware.js'
import { getCachedResponse, setCachedResponse } from './_lib/cache.js'
import { queryFinMindDataset } from './_lib/finmind-governor.js'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
]

const TAG_CELL_REGEX = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
const TAG_ROW_REGEX = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function stripHtml(value = '') {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeStockCode(value = '') {
  return String(value || '')
    .trim()
    .match(/\d{4,6}[A-Z]?L?/i)?.[0]
}

function parseNumberCell(value = '') {
  const normalized = String(value || '')
    .replace(/[,\s]/g, '')
    .replace(/元/g, '')
    .trim()
  if (!normalized || normalized === '--' || normalized === '-') return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function parsePercentCell(value = '') {
  const normalized = String(value || '')
    .replace(/[%％]/g, '')
    .replace(/[,\s]/g, '')
    .trim()
  if (!normalized || normalized === '--' || normalized === '-') return null
  const number = Number(normalized)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null
}

function formatRevenueMonth(year, month) {
  return `${year}/${String(month).padStart(2, '0')}`
}

function buildRevenueFallbackWindow(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month + 1, 15))
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

function extractRowCells(rowHtml = '') {
  return Array.from(String(rowHtml || '').matchAll(TAG_CELL_REGEX))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
}

export function parseRevenueRowCells(cells = [], { code = '' } = {}) {
  const rowCodeIndex = cells.findIndex((cell) => cell === code || /^\d{4,6}[A-Z]?L?$/.test(cell))
  if (rowCodeIndex < 0) return null

  const revenue = parseNumberCell(cells[rowCodeIndex + 2])
  const lastMonthRevenue = parseNumberCell(cells[rowCodeIndex + 3])
  const lastYearRevenue = parseNumberCell(cells[rowCodeIndex + 4])
  const revenueMoM =
    parsePercentCell(cells[rowCodeIndex + 5]) ??
    (revenue != null && lastMonthRevenue
      ? Math.round(((revenue - lastMonthRevenue) / lastMonthRevenue) * 10000) / 100
      : null)
  const revenueYoY =
    parsePercentCell(cells[rowCodeIndex + 6]) ??
    (revenue != null && lastYearRevenue
      ? Math.round(((revenue - lastYearRevenue) / lastYearRevenue) * 10000) / 100
      : null)
  const cumulativeRevenue = parseNumberCell(cells[rowCodeIndex + 7])
  const lastYearCumulativeRevenue = parseNumberCell(cells[rowCodeIndex + 8])
  const cumulativeYoY =
    parsePercentCell(cells[rowCodeIndex + 9]) ??
    (cumulativeRevenue != null && lastYearCumulativeRevenue
      ? Math.round(
          ((cumulativeRevenue - lastYearCumulativeRevenue) / lastYearCumulativeRevenue) * 10000
        ) / 100
      : null)

  if (revenue == null) return null

  return {
    available: true,
    code: cells[rowCodeIndex],
    name: cells[rowCodeIndex + 1] || '',
    revenue,
    revenueYoY,
    revenueMoM,
    cumulativeRevenue,
    cumulativeYoY,
  }
}

export function parseMopsRevenueHtml(html, { code = '' } = {}) {
  const rows = Array.from(String(html || '').matchAll(TAG_ROW_REGEX)).map((match) => match[0])

  for (const rowHtml of rows) {
    const parsed = parseRevenueRowCells(extractRowCells(rowHtml), { code })
    if (parsed) return parsed
  }

  return {
    available: false,
    reason: '找不到對應公司的月營收列',
  }
}

export function mapFinMindRevenueFallback(row, { year, month } = {}) {
  const rowYear = Number(row?.revenue_year ?? row?.revenueYear)
  const rowMonth = Number(row?.revenue_month ?? row?.revenueMonth)
  if (!Number.isFinite(rowYear) || !Number.isFinite(rowMonth)) return null
  if (rowYear !== Number(year) || rowMonth !== Number(month)) return null

  return {
    available: true,
    revenue: parseNumberCell(row?.revenue),
    revenueYoY: parsePercentCell(row?.revenue_year_growth_rate ?? row?.revenueYoY),
    revenueMoM: parsePercentCell(row?.revenue_month_growth_rate ?? row?.revenueMoM),
    cumulativeRevenue: parseNumberCell(
      row?.accumulated_revenue ??
        row?.accumulate_revenue ??
        row?.cumulative_revenue ??
        row?.cumulativeRevenue
    ),
    cumulativeYoY: parsePercentCell(
      row?.accumulated_revenue_growth_rate ??
        row?.accumulate_growth_rate ??
        row?.cumulative_yoy ??
        row?.cumulativeYoY
    ),
  }
}

async function fetchMopsRevenueHtml({ code, year, month }) {
  await sleep(1000 + Math.floor(Math.random() * 1000))

  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  const rocYear = Number(year) - 1911
  const response = await fetch('https://mops.twse.com.tw/mops/web/ajax_t05st10_ifrs', {
    method: 'POST',
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://mops.twse.com.tw/mops/web/t05st10_ifrs',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-TW,zh;q=0.9',
    },
    body: new URLSearchParams({
      encodeURIComponent: 1,
      step: 1,
      firstin: 1,
      off: 1,
      queryName: 'co_id',
      inpuType: 'co_id',
      TYPEK: 'all',
      isnew: 'false',
      co_id: code,
      year: String(rocYear),
      month: String(month).padStart(2, '0'),
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`MOPS 回應錯誤：${response.status}`)
  }

  return response.text()
}

async function loadFinMindRevenueFallback({ code, year, month }) {
  const { startDate, endDate } = buildRevenueFallbackWindow(Number(year), Number(month))
  const rows = await queryFinMindDataset('revenue', {
    code,
    startDate,
    endDate,
    timeoutMs: 5000,
  })

  return (Array.isArray(rows) ? rows : [])
    .map((row) => mapFinMindRevenueFallback(row, { year, month }))
    .find((item) => item?.available && item.revenue != null)
}

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const stockId = normalizeStockCode(req.query?.stockId)
  const year = String(req.query?.year || '').trim()
  const month = String(req.query?.month || '').trim()

  if (!stockId) {
    return res.status(400).json({ error: '缺少 stockId 參數' })
  }

  if (!/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: '年份格式錯誤，請使用 YYYY 格式' })
  }

  if (!/^\d{1,2}$/.test(month) || Number(month) < 1 || Number(month) > 12) {
    return res.status(400).json({ error: '月份格式錯誤，請使用 1-12' })
  }

  const monthNum = Number(month)
  const cacheKey = `mops-revenue-${stockId}-${year}-${monthNum}`
  const cached = getCachedResponse(cacheKey)
  if (cached) {
    return res.status(200).json(cached)
  }

  let payload = null
  let degraded = false
  let reason = ''

  try {
    const html = await fetchMopsRevenueHtml({ code: stockId, year, month: monthNum })
    const parsed = parseMopsRevenueHtml(html, { code: stockId })
    if (parsed.available) {
      payload = {
        stockId,
        year,
        month: monthNum,
        revenueMonth: formatRevenueMonth(Number(year), monthNum),
        source: 'MOPS',
        degraded: false,
        ...parsed,
      }
    } else {
      reason = parsed.reason || 'MOPS parse failed'
      degraded = true
    }
  } catch (error) {
    degraded = true
    reason = error?.message || 'MOPS revenue fetch failed'
  }

  if (!payload) {
    try {
      const fallback = await loadFinMindRevenueFallback({ code: stockId, year, month: monthNum })
      if (fallback) {
        payload = {
          stockId,
          year,
          month: monthNum,
          revenueMonth: formatRevenueMonth(Number(year), monthNum),
          source: 'FinMind fallback',
          degraded: true,
          ...fallback,
        }
      }
    } catch (fallbackError) {
      reason = reason || fallbackError?.message || 'FinMind revenue fallback failed'
    }
  }

  const result = payload || {
    stockId,
    year,
    month: monthNum,
    revenueMonth: formatRevenueMonth(Number(year), monthNum),
    available: false,
    revenue: null,
    revenueYoY: null,
    revenueMoM: null,
    cumulativeRevenue: null,
    cumulativeYoY: null,
    source: 'degraded',
    degraded: true,
    reason: reason || '月營收資料暫不可用',
  }

  result.fetchedAt = new Date().toISOString()
  setCachedResponse(cacheKey, result, 30 * 24 * 60 * 60)
  return res.status(200).json(result)
}

export default withApiAuth(handler)
