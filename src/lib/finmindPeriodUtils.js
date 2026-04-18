function toFiniteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function padQuarter(quarter) {
  return Number.isFinite(quarter) ? String(quarter) : ''
}

export function quarterFromDate(dateStr) {
  const match = String(dateStr || '').match(/^(\d{4})-(\d{2})/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return ''
  return `${year}Q${Math.ceil(month / 3)}`
}

function parseQuarterId(quarterId) {
  const match = String(quarterId || '').match(/^(\d{4})Q([1-4])$/)
  if (!match) return null
  return {
    year: Number(match[1]),
    quarter: Number(match[2]),
  }
}

function revenueYear(row) {
  return toFiniteNumber(row?.revenueYear ?? row?.revenue_year)
}

function revenueMonth(row) {
  return toFiniteNumber(row?.revenueMonth ?? row?.revenue_month)
}

function approximatelyEqual(left, right, toleranceRatio = 0.03, minimumTolerance = 1_000) {
  const a = toFiniteNumber(left)
  const b = toFiniteNumber(right)
  if (a == null || b == null) return false
  const tolerance = Math.max(Math.abs(b) * toleranceRatio, minimumTolerance)
  return Math.abs(a - b) <= tolerance
}

function buildQuarterRevenueMaps(revenueRows = []) {
  const quarterSums = new Map()
  const rows = Array.isArray(revenueRows) ? revenueRows : []

  for (const row of rows) {
    const year = revenueYear(row)
    const month = revenueMonth(row)
    const revenue = toFiniteNumber(row?.revenue)
    if (!Number.isFinite(year) || !Number.isFinite(month) || revenue == null) continue

    const quarter = Math.ceil(month / 3)
    const quarterKey = `${year}Q${quarter}`
    quarterSums.set(quarterKey, (quarterSums.get(quarterKey) || 0) + revenue)
  }

  const ytdSums = new Map()
  const h2Sums = new Map()
  for (const [quarterKey, quarterRevenue] of quarterSums.entries()) {
    const parsed = parseQuarterId(quarterKey)
    if (!parsed) continue
    let ytd = 0
    for (let q = 1; q <= parsed.quarter; q += 1) {
      ytd += quarterSums.get(`${parsed.year}Q${q}`) || 0
    }
    ytdSums.set(quarterKey, ytd)

    if (parsed.quarter === 4) {
      h2Sums.set(quarterKey, (quarterSums.get(`${parsed.year}Q3`) || 0) + quarterRevenue)
    }
  }

  return { quarterSums, ytdSums, h2Sums }
}

function sumPriorStandaloneMetrics(standaloneRowsByQuarter, year, quarter, metric) {
  let sum = 0
  let hasValue = false
  for (let q = 1; q < quarter; q += 1) {
    const value = toFiniteNumber(standaloneRowsByQuarter.get(`${year}Q${q}`)?.[metric])
    if (value == null) continue
    sum += value
    hasValue = true
  }
  return hasValue ? sum : null
}

const INCOME_STATEMENT_METRICS = [
  'Revenue',
  'GrossProfit',
  'OperatingIncome',
  'IncomeAfterTaxes',
  'PreTaxIncome',
  'IncomeFromContinuingOperations',
  'TotalConsolidatedProfitForThePeriod',
  'EquityAttributableToOwnersOfParent',
  'EPS',
  'TAX',
  'CostOfGoodsSold',
  'OperatingExpenses',
]

function deriveStandaloneMetricValue({
  metric,
  rawValue,
  statementPeriodMode,
  parsedQuarter,
  standaloneRowsByQuarter,
  normalized,
}) {
  if (rawValue == null) return null

  if (statementPeriodMode === 'standalone-monthly-verified' || metric === 'Revenue') {
    if (metric === 'Revenue') {
      const normalizedRevenue = toFiniteNumber(normalized.monthlyRevenueQuarterSum)
      return normalizedRevenue != null ? normalizedRevenue : rawValue
    }
    return rawValue
  }

  if (statementPeriodMode === 'ytd-cumulative-derived' && parsedQuarter) {
    const priorStandalone = sumPriorStandaloneMetrics(
      standaloneRowsByQuarter,
      parsedQuarter.year,
      parsedQuarter.quarter,
      metric
    )
    if (priorStandalone == null) return rawValue

    // FinMind occasionally mixes cumulative revenue with standalone EPS in the
    // same row (observed on 2025Q4 cases). Avoid subtracting a prior quarter
    // when the reported EPS already looks like a standalone figure.
    if (
      metric === 'EPS' &&
      Math.abs(rawValue) <= Math.abs(priorStandalone) * 1.1 &&
      Math.sign(rawValue || 0) === Math.sign(priorStandalone || 0)
    ) {
      normalized.statementWarnings.push('eps-appears-standalone')
      return rawValue
    }

    return Number((rawValue - priorStandalone).toFixed(6))
  }

  if (statementPeriodMode === 'h2-cumulative-derived' && parsedQuarter?.quarter === 4) {
    const q3Standalone = toFiniteNumber(
      standaloneRowsByQuarter.get(`${parsedQuarter.year}Q3`)?.[metric]
    )
    if (q3Standalone == null) return rawValue

    if (
      metric === 'EPS' &&
      Math.abs(rawValue) <= Math.abs(q3Standalone) * 1.1 &&
      Math.sign(rawValue || 0) === Math.sign(q3Standalone || 0)
    ) {
      normalized.statementWarnings.push('eps-appears-standalone')
      return rawValue
    }

    return Number((rawValue - q3Standalone).toFixed(6))
  }

  return rawValue
}

export function normalizeFinancialStatementRows(statementRows = [], revenueRows = []) {
  const { quarterSums, ytdSums, h2Sums } = buildQuarterRevenueMaps(revenueRows)
  const rowsAsc = [...(Array.isArray(statementRows) ? statementRows : [])]
    .filter((row) => row?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const standaloneRowsByQuarter = new Map()
  const normalizedAsc = rowsAsc.map((row) => {
    const quarterId = quarterFromDate(row.date)
    const parsedQuarter = parseQuarterId(quarterId)
    const quarterRevenue = quarterSums.get(quarterId) ?? null
    const ytdRevenue = ytdSums.get(quarterId) ?? null
    const h2Revenue = h2Sums.get(quarterId) ?? null
    const reportedRevenue = toFiniteNumber(row?.Revenue)

    let statementPeriodMode = 'reported-unverified'
    if (reportedRevenue != null && quarterRevenue != null) {
      if (approximatelyEqual(reportedRevenue, quarterRevenue)) {
        statementPeriodMode = 'standalone-monthly-verified'
      } else if (
        parsedQuarter?.quarter === 2 &&
        ytdRevenue != null &&
        approximatelyEqual(reportedRevenue, ytdRevenue)
      ) {
        statementPeriodMode = 'ytd-cumulative-derived'
      } else if (
        parsedQuarter?.quarter === 4 &&
        h2Revenue != null &&
        approximatelyEqual(reportedRevenue, h2Revenue)
      ) {
        statementPeriodMode = 'h2-cumulative-derived'
      } else if (
        parsedQuarter?.quarter === 4 &&
        ytdRevenue != null &&
        approximatelyEqual(reportedRevenue, ytdRevenue)
      ) {
        statementPeriodMode = 'ytd-cumulative-derived'
      }
    }

    const normalized = {
      ...row,
      quarter: quarterId,
      statementPeriodMode,
      monthlyRevenueQuarterSum: quarterRevenue,
      statementWarnings: [],
    }

    for (const metric of INCOME_STATEMENT_METRICS) {
      const rawValue = toFiniteNumber(row?.[metric])
      if (rawValue == null) continue
      normalized[`reported${metric}`] = rawValue
      normalized[metric] = deriveStandaloneMetricValue({
        metric,
        rawValue,
        statementPeriodMode,
        parsedQuarter,
        standaloneRowsByQuarter,
        normalized,
      })
    }

    const normalizedRevenue = toFiniteNumber(normalized.Revenue)
    const operatingIncome = toFiniteNumber(normalized.OperatingIncome)
    const incomeAfterTaxes = toFiniteNumber(normalized.IncomeAfterTaxes)
    const eps = toFiniteNumber(normalized.EPS)

    if (
      normalizedRevenue != null &&
      normalizedRevenue > 1_000_000 &&
      operatingIncome != null &&
      operatingIncome > 0 &&
      incomeAfterTaxes != null &&
      Math.abs(incomeAfterTaxes) <= Math.max(1_000, normalizedRevenue * 0.0001)
    ) {
      normalized.statementWarnings.push('income-after-taxes-anomalous')
    }

    if (
      normalizedRevenue != null &&
      normalizedRevenue > 1_000_000 &&
      operatingIncome != null &&
      operatingIncome > 0 &&
      eps != null &&
      Math.abs(eps) < 0.0001
    ) {
      normalized.statementWarnings.push('eps-anomalous')
    }

    if (
      reportedRevenue != null &&
      quarterRevenue != null &&
      !approximatelyEqual(reportedRevenue, quarterRevenue) &&
      statementPeriodMode === 'reported-unverified'
    ) {
      normalized.statementWarnings.push(
        `revenue-period-mismatch:${reportedRevenue}:${quarterRevenue}:${padQuarter(parsedQuarter?.quarter)}`
      )
    }

    standaloneRowsByQuarter.set(quarterId, normalized)
    return normalized
  })

  return normalizedAsc.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}
