import { getHoldingCostBasis, getHoldingMarketValue } from './holdings.js'

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_ANNUALIZED_HOLDING_DAYS = 30

function parseMetricDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  if (typeof value !== 'string') return null

  const normalized = value.trim().replace(/\//g, '-')
  if (!normalized) return null

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return null

  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getHoldingTotalCost(holding) {
  const explicitTotalCost = Number(holding?.totalCost)
  if (Number.isFinite(explicitTotalCost)) return explicitTotalCost
  return getHoldingCostBasis(holding)
}

function getHoldingTotalValue(holding) {
  const explicitValue = Number(holding?.value)
  if (Number.isFinite(explicitValue)) return explicitValue
  return getHoldingMarketValue(holding)
}

export function calculateAnnualizedReturn({
  cost = 0,
  value = 0,
  firstPurchaseDate = null,
  now = new Date(),
  minHoldingDays = MIN_ANNUALIZED_HOLDING_DAYS,
} = {}) {
  const safeCost = Number(cost)
  const safeValue = Number(value)
  const purchaseDate = parseMetricDate(firstPurchaseDate)
  const currentDate = parseMetricDate(now) || (now instanceof Date ? now : new Date(now))

  if (!Number.isFinite(safeCost) || safeCost <= 0) {
    return {
      status: 'invalid_cost',
      annualizedReturn: null,
      holdingDays: 0,
      firstPurchaseDate: null,
    }
  }

  if (!purchaseDate || Number.isNaN(currentDate.getTime())) {
    return {
      status: 'missing_purchase_date',
      annualizedReturn: null,
      holdingDays: 0,
      firstPurchaseDate: null,
    }
  }

  const holdingDays = Math.max((currentDate.getTime() - purchaseDate.getTime()) / DAY_MS, 0)
  if (holdingDays < minHoldingDays) {
    return {
      status: 'insufficient_period',
      annualizedReturn: null,
      holdingDays,
      firstPurchaseDate: purchaseDate,
    }
  }

  const annualizedReturn = Math.pow(Math.max(safeValue, 0) / safeCost, 365 / holdingDays) - 1
  return {
    status: Number.isFinite(annualizedReturn) ? 'ok' : 'invalid_value',
    annualizedReturn: Number.isFinite(annualizedReturn) ? annualizedReturn : null,
    holdingDays,
    firstPurchaseDate: purchaseDate,
  }
}

export function calculateAnnualizedReturnFromHoldings(holdings = [], options = {}) {
  const rows = Array.isArray(holdings) ? holdings : []
  const eligibleRows = rows.filter((holding) => getHoldingTotalCost(holding) > 0)

  if (eligibleRows.length === 0) {
    return {
      status: 'invalid_cost',
      annualizedReturn: null,
      holdingDays: 0,
      firstPurchaseDate: null,
    }
  }

  const cost = eligibleRows.reduce((sum, holding) => sum + getHoldingTotalCost(holding), 0)
  const value = eligibleRows.reduce((sum, holding) => sum + getHoldingTotalValue(holding), 0)

  const earliestPurchaseDate = eligibleRows.reduce((earliest, holding) => {
    const candidate = parseMetricDate(holding?.firstPurchaseDate)
    if (!candidate) return earliest
    if (!earliest || candidate.getTime() < earliest.getTime()) return candidate
    return earliest
  }, null)

  return calculateAnnualizedReturn({
    ...options,
    cost,
    value,
    firstPurchaseDate: earliestPurchaseDate,
  })
}

export function calculateMaxDrawdown(series = []) {
  if (!Array.isArray(series) || series.length === 0) {
    return { status: 'needs_history', maxDrawdown: null, peakValue: null, troughValue: null }
  }

  let peakValue = null
  let troughValue = null
  let maxDrawdown = 0

  for (const point of series) {
    const value = Number(typeof point === 'number' ? point : point?.value)
    if (!Number.isFinite(value) || value < 0) continue

    if (peakValue == null || value > peakValue) {
      peakValue = value
      troughValue = value
      continue
    }

    troughValue = troughValue == null ? value : Math.min(troughValue, value)

    if (peakValue > 0) {
      const drawdown = (peakValue - value) / peakValue
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    }
  }

  if (peakValue == null) {
    return { status: 'needs_history', maxDrawdown: null, peakValue: null, troughValue: null }
  }

  return {
    status: 'ok',
    maxDrawdown,
    peakValue,
    troughValue,
  }
}

export const portfolioMetricsConstants = {
  DAY_MS,
  MIN_ANNUALIZED_HOLDING_DAYS,
}
