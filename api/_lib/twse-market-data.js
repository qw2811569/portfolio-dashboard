const TWSE_OPENAPI_BASE = 'https://openapi.twse.com.tw/v1'
const TWSE_SITE_BASE = 'https://www.twse.com.tw'
const TWSE_TIMEOUT_MS = 8000
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (portfolio-dashboard/1.0; TWSE market data adapter)',
}

function createHttpError(url, response) {
  return new Error(`TWSE request failed (${response.status}) for ${url}`)
}

function createTimeoutError(url, timeoutMs) {
  const error = new Error(`TWSE request timed out after ${timeoutMs}ms for ${url}`)
  error.name = 'TimeoutError'
  error.reason = 'timeout'
  error.timeoutMs = timeoutMs
  return error
}

function parseJsonSafely(response) {
  return response.json().catch(() => null)
}

function sanitizeText(value) {
  return String(value ?? '')
    .replace(/\u3000/g, ' ')
    .trim()
}

function parseTwseNumber(value) {
  const raw = sanitizeText(value).replace(/,/g, '')
  if (!raw || raw === '--' || raw === '---') return null

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeTwseDate(value) {
  const raw = sanitizeText(value)
  if (!raw) return null

  const compact = raw.replace(/[/-]/g, '')
  if (/^\d{8}$/.test(compact)) {
    const year = Number(compact.slice(0, 4))
    const month = compact.slice(4, 6)
    const day = compact.slice(6, 8)

    if (year > 1911) {
      return `${year}-${month}-${day}`
    }
  }

  if (/^\d{7}$/.test(compact)) {
    const rocYear = Number(compact.slice(0, 3))
    const month = compact.slice(3, 5)
    const day = compact.slice(5, 7)
    return `${rocYear + 1911}-${month}-${day}`
  }

  if (/^\d{6}$/.test(compact)) {
    const rocYear = Number(compact.slice(0, 2))
    const month = compact.slice(2, 4)
    const day = compact.slice(4, 6)
    return `${rocYear + 1911}-${month}-${day}`
  }

  return null
}

function normalizeRequestedDate(value) {
  const raw = sanitizeText(value)
  if (!raw) return null

  if (/^\d{8}$/.test(raw)) {
    return normalizeTwseDate(raw)
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }

  return normalizeTwseDate(raw)
}

async function fetchTwseArray(url, { fetchImpl = fetch, timeoutMs = TWSE_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url, { headers: DEFAULT_HEADERS, signal: controller.signal })
    if (!response.ok) {
      throw createHttpError(url, response)
    }

    const payload = await parseJsonSafely(response)
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.data)) return payload.data
    return []
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createTimeoutError(url, timeoutMs)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function normalizeCatalogRow(row) {
  return {
    code: sanitizeText(row['公司代號']),
    name: sanitizeText(row['公司名稱']),
    shortName: sanitizeText(row['公司簡稱']),
    date: normalizeTwseDate(row['出表日期']),
    industryCode: sanitizeText(row['產業別']) || null,
    listedAt: normalizeTwseDate(row['上市日期']),
  }
}

function normalizeDailyPriceRow(row) {
  const name = sanitizeText(row.Name)
  return {
    code: sanitizeText(row.Code),
    name,
    shortName: name,
    date: normalizeTwseDate(row.Date),
    tradeVolume: parseTwseNumber(row.TradeVolume),
    tradeValue: parseTwseNumber(row.TradeValue),
    openingPrice: parseTwseNumber(row.OpeningPrice),
    highestPrice: parseTwseNumber(row.HighestPrice),
    lowestPrice: parseTwseNumber(row.LowestPrice),
    closingPrice: parseTwseNumber(row.ClosingPrice),
    change: parseTwseNumber(row.Change),
    transactions: parseTwseNumber(row.Transaction),
  }
}

function normalizeValuationRow(row) {
  const name = sanitizeText(row.Name)
  return {
    code: sanitizeText(row.Code),
    name,
    shortName: name,
    date: normalizeTwseDate(row.Date),
    peRatio: parseTwseNumber(row.PEratio),
    priceBookRatio: parseTwseNumber(row.PBratio),
    dividendYield: parseTwseNumber(row.DividendYield),
  }
}

function normalizeInstitutionalRow(row, normalizedDate) {
  const name = sanitizeText(row[1])
  const foreignBuy = parseTwseNumber(row[2])
  const foreignSell = parseTwseNumber(row[3])
  const foreignNet = parseTwseNumber(row[4])
  const foreignDealerBuy = parseTwseNumber(row[5])
  const foreignDealerSell = parseTwseNumber(row[6])
  const foreignDealerNet = parseTwseNumber(row[7])
  const investmentTrustBuy = parseTwseNumber(row[8])
  const investmentTrustSell = parseTwseNumber(row[9])
  const investmentTrustNet = parseTwseNumber(row[10])
  const dealerSelfNet = parseTwseNumber(row[14])
  const dealerHedgeNet = parseTwseNumber(row[17])

  return {
    code: sanitizeText(row[0]),
    name,
    shortName: name,
    date: normalizedDate,
    foreignBuy,
    foreignSell,
    foreignNet,
    foreignDealerBuy,
    foreignDealerSell,
    foreignDealerNet,
    investmentTrustBuy,
    investmentTrustSell,
    investmentTrustNet,
    dealerNet: parseTwseNumber(row[11]),
    dealerBuy: (parseTwseNumber(row[12]) ?? 0) + (parseTwseNumber(row[15]) ?? 0),
    dealerSell: (parseTwseNumber(row[13]) ?? 0) + (parseTwseNumber(row[16]) ?? 0),
    dealerSelfBuy: parseTwseNumber(row[12]),
    dealerSelfSell: parseTwseNumber(row[13]),
    dealerSelfNet,
    dealerHedgeBuy: parseTwseNumber(row[15]),
    dealerHedgeSell: parseTwseNumber(row[16]),
    dealerHedgeNet,
    totalNet: parseTwseNumber(row[18]),
  }
}

function createInstitutionalUrl(date) {
  const compactDate = sanitizeText(date).replace(/-/g, '')
  return `${TWSE_SITE_BASE}/rwd/zh/fund/T86?date=${compactDate}&selectType=ALLBUT0999&response=json`
}

export async function fetchListedStocksCatalog({
  timeoutMs = TWSE_TIMEOUT_MS,
  fetchImpl = fetch,
} = {}) {
  const rows = await fetchTwseArray(`${TWSE_OPENAPI_BASE}/opendata/t187ap03_L`, {
    fetchImpl,
    timeoutMs,
  })
  return rows.map(normalizeCatalogRow).filter((row) => row.code)
}

export async function fetchAllStockDailyPrices(
  date,
  { timeoutMs = TWSE_TIMEOUT_MS, fetchImpl = fetch } = {}
) {
  const rows = await fetchTwseArray(
    `${TWSE_OPENAPI_BASE}/exchangeReport/STOCK_DAY_ALL?response=json`,
    {
      fetchImpl,
      timeoutMs,
    }
  )
  const requestedDate = normalizeRequestedDate(date)

  return rows
    .map(normalizeDailyPriceRow)
    .filter((row) => row.code)
    .filter((row) => !requestedDate || row.date === requestedDate)
}

export async function fetchValuationMetrics(
  date,
  { timeoutMs = TWSE_TIMEOUT_MS, fetchImpl = fetch } = {}
) {
  const rows = await fetchTwseArray(
    `${TWSE_OPENAPI_BASE}/exchangeReport/BWIBBU_ALL?response=json`,
    {
      fetchImpl,
      timeoutMs,
    }
  )
  const requestedDate = normalizeRequestedDate(date)

  return rows
    .map(normalizeValuationRow)
    .filter((row) => row.code)
    .filter((row) => !requestedDate || row.date === requestedDate)
}

export async function fetchInstitutionalInvestors(
  date,
  { timeoutMs = TWSE_TIMEOUT_MS, fetchImpl = fetch } = {}
) {
  const requestedDate = normalizeRequestedDate(date)
  const queryDate = requestedDate
    ? requestedDate.replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const url = createInstitutionalUrl(queryDate)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url, { headers: DEFAULT_HEADERS, signal: controller.signal })

    if (!response.ok) {
      throw createHttpError(url, response)
    }

    const payload = await parseJsonSafely(response)
    const rows = Array.isArray(payload?.data) ? payload.data : []
    const resolvedDate = normalizeRequestedDate(payload?.date) || requestedDate

    return rows.map((row) => normalizeInstitutionalRow(row, resolvedDate)).filter((row) => row.code)
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createTimeoutError(url, timeoutMs)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
