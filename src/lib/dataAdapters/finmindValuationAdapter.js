import { normalizeFinancialStatementRows, quarterFromDate } from '../finmindPeriodUtils.js'
import { fetchCustomFinMindRawDataset, fetchFinMindRawDataset } from './finmindAdapter.js'
import { computeHistoricalPerBand, resolveValuationBandPosition } from '../valuationEngine.js'

const DEFAULT_PER_YEARS = 5
const DEFAULT_FINANCIAL_DAYS = 730
const DEFAULT_PRICE_DAYS = 45
const DEFAULT_FINMIND_TIMEOUT_MS = 20000
const DEFAULT_TIMEOUT_RETRIES = 1
const DEFAULT_RETRY_DELAY_MS = 250

function toFiniteNumber(value) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isoDate(value) {
  return new Date(value).toISOString().slice(0, 10)
}

function yearsAgo(years, now = new Date()) {
  const date = new Date(now)
  date.setFullYear(date.getFullYear() - Number(years || 0))
  return isoDate(date)
}

function daysAgo(days, now = new Date()) {
  const date = new Date(now)
  date.setDate(date.getDate() - Number(days || 0))
  return isoDate(date)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function sortByDateDesc(rows = []) {
  return [...rows].sort((left, right) =>
    String(right?.date || '').localeCompare(String(left?.date || ''))
  )
}

function pivotStatementRows(rows = []) {
  const byDate = new Map()

  for (const row of Array.isArray(rows) ? rows : []) {
    const date = String(row?.date || '').trim()
    const type = String(row?.type || row?.origin_name || '').trim()
    const value = toFiniteNumber(row?.value)
    if (!date || !type || value == null) continue

    if (!byDate.has(date)) byDate.set(date, { date })
    byDate.get(date)[type] = value
  }

  return sortByDateDesc(Array.from(byDate.values()))
}

export function selectMonthlyPerHistory(rows = []) {
  const monthly = new Map()
  const sorted = sortByDateDesc(rows)

  for (const row of sorted) {
    const date = String(row?.date || '').trim()
    const per = toFiniteNumber(row?.PER ?? row?.per)
    if (!date || per == null) continue

    const monthKey = date.slice(0, 7)
    if (monthly.has(monthKey)) continue

    monthly.set(monthKey, {
      date,
      per,
    })
  }

  return Array.from(monthly.values())
}

export function computeEpsTTM(financialRows = []) {
  const seenQuarters = new Set()
  const epsValues = []

  for (const row of Array.isArray(financialRows) ? financialRows : []) {
    const quarter = String(row?.quarter || quarterFromDate(row?.date)).trim()
    const eps = toFiniteNumber(row?.EPS)
    if (!quarter || eps == null || seenQuarters.has(quarter)) continue

    seenQuarters.add(quarter)
    epsValues.push(eps)
    if (epsValues.length === 4) break
  }

  if (epsValues.length < 4) return null
  return Number(epsValues.reduce((sum, value) => sum + value, 0).toFixed(6))
}

export function extractLatestClosePrice(priceRows = []) {
  for (const row of sortByDateDesc(priceRows)) {
    const close = toFiniteNumber(row?.close ?? row?.close_price)
    if (close != null && close > 0) return close
  }

  return null
}

function isTimeoutError(error) {
  return error?.name === 'TimeoutError' || /timeout/i.test(String(error?.message || ''))
}

async function runFinMindRequest(task, { retries = DEFAULT_TIMEOUT_RETRIES } = {}) {
  let attempt = 0

  while (true) {
    try {
      return await task()
    } catch (error) {
      if (!isTimeoutError(error) || attempt >= retries) {
        throw error
      }

      attempt += 1
      await sleep(DEFAULT_RETRY_DELAY_MS)
    }
  }
}

export async function fetchFinMindValuationInputs(
  code,
  {
    now = new Date(),
    forceFresh = false,
    perFetcher = fetchCustomFinMindRawDataset,
    rawDatasetFetcher = fetchFinMindRawDataset,
  } = {}
) {
  const perStartDate = yearsAgo(DEFAULT_PER_YEARS, now)
  const financialStartDate = daysAgo(DEFAULT_FINANCIAL_DAYS, now)
  const priceStartDate = daysAgo(DEFAULT_PRICE_DAYS, now)

  const [perRows, financialStatementRows, revenueRows, priceRows] = await Promise.all([
    runFinMindRequest(() =>
      perFetcher(
        'TaiwanStockPER',
        {
          code,
          startDate: perStartDate,
        },
        { forceFresh, timeoutMs: DEFAULT_FINMIND_TIMEOUT_MS }
      )
    ),
    runFinMindRequest(() =>
      rawDatasetFetcher(
        'financials',
        code,
        { startDate: financialStartDate },
        { forceFresh, timeoutMs: DEFAULT_FINMIND_TIMEOUT_MS }
      )
    ),
    runFinMindRequest(() =>
      rawDatasetFetcher(
        'revenue',
        code,
        { startDate: financialStartDate },
        { forceFresh, timeoutMs: DEFAULT_FINMIND_TIMEOUT_MS }
      )
    ),
    runFinMindRequest(() =>
      perFetcher(
        'TaiwanStockPrice',
        {
          code,
          startDate: priceStartDate,
        },
        { forceFresh, timeoutMs: DEFAULT_FINMIND_TIMEOUT_MS }
      )
    ),
  ])

  const perHistory = selectMonthlyPerHistory(perRows)
  const normalizedFinancialRows = normalizeFinancialStatementRows(
    pivotStatementRows(financialStatementRows),
    revenueRows
  )
  const epsTTM = computeEpsTTM(normalizedFinancialRows)
  const currentPrice = extractLatestClosePrice(priceRows)

  return {
    perHistory,
    epsTTM,
    currentPrice,
    financialRows: normalizedFinancialRows,
  }
}

export async function fetchHistoricalPerBandValuation(
  code,
  {
    now = new Date(),
    forceFresh = false,
    perFetcher = fetchCustomFinMindRawDataset,
    rawDatasetFetcher = fetchFinMindRawDataset,
  } = {}
) {
  const inputs = await fetchFinMindValuationInputs(code, {
    now,
    forceFresh,
    perFetcher,
    rawDatasetFetcher,
  })

  const valuation = computeHistoricalPerBand(code, {
    perHistory: inputs.perHistory,
    epsTTM: inputs.epsTTM,
  })

  return {
    code: String(code || '').trim(),
    computedAt: now.toISOString(),
    ...valuation,
    epsTTM: inputs.epsTTM,
    currentPrice: inputs.currentPrice,
    positionInBand: resolveValuationBandPosition(inputs.currentPrice, valuation),
  }
}
