const FINMIND_DATASETS = [
  'institutional',
  'margin',
  'valuation',
  'financials',
  'balanceSheet',
  'cashFlow',
  'dividend',
  'dividendResult',
  'revenue',
  'shareholding',
  'news',
]

function toFiniteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function readAvailabilityFlag(value, requirement = null) {
  if (value == null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') {
    const periodType = String(requirement?.periodType || '').trim()
    if (periodType && typeof value.periodTypes?.[periodType] === 'boolean') {
      return value.periodTypes[periodType]
    }
    if (typeof value.available === 'boolean') return value.available
    if (Array.isArray(value.rows)) return value.rows.length > 0
  }
  return false
}

function normalizeRevenueYearMonth(row) {
  const year = toFiniteNumber(row?.revenueYear ?? row?.revenue_year)
  const month = toFiniteNumber(row?.revenueMonth ?? row?.revenue_month)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function hasQuarterlyRevenueFromMonthly(rows = []) {
  const quarterMonthMap = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const normalized = normalizeRevenueYearMonth(row)
    if (!normalized) continue
    const quarter = Math.ceil(normalized.month / 3)
    const key = `${normalized.year}Q${quarter}`
    const months = quarterMonthMap.get(key) || new Set()
    months.add(normalized.month)
    quarterMonthMap.set(key, months)
  }
  return [...quarterMonthMap.values()].some((months) => months.size >= 3)
}

export function hasStandaloneFinancialRows(rows = []) {
  const VALID_PERIOD_MODES = new Set([
    'standalone-monthly-verified',
    'ytd-cumulative-derived',
    'h2-cumulative-derived',
  ])
  return (Array.isArray(rows) ? rows : []).some((row) =>
    VALID_PERIOD_MODES.has(String(row?.statementPeriodMode || '').trim())
  )
}

function buildDatasetAvailability(available, periodTypes = {}) {
  return {
    available,
    periodTypes,
  }
}

export function buildKnowledgeDataAvailability({ finmind = {}, dossier = null } = {}) {
  const availability = {}

  for (const dataset of FINMIND_DATASETS) {
    const rows = Array.isArray(finmind?.[dataset]) ? finmind[dataset] : []
    const available = rows.length > 0
    const periodTypes = {}

    if (dataset === 'institutional') {
      periodTypes['daily-5d-trend'] = available
    }
    if (dataset === 'revenue') {
      periodTypes['monthly-announcement'] = available
      periodTypes['quarterly-sum-from-monthly'] = hasQuarterlyRevenueFromMonthly(rows)
    }
    if (dataset === 'financials') {
      periodTypes['quarterly-standalone'] = hasStandaloneFinancialRows(rows)
    }

    availability[dataset] = buildDatasetAvailability(available, periodTypes)
  }

  const pendingEvents = Array.isArray(dossier?.events?.pending) ? dossier.events.pending : []
  const trackingEvents = Array.isArray(dossier?.events?.tracking) ? dossier.events.tracking : []
  availability.events = buildDatasetAvailability(
    pendingEvents.length > 0 || trackingEvents.length > 0
  )

  const reports = Array.isArray(dossier?.targets?.reports)
    ? dossier.targets.reports
    : Array.isArray(dossier?.targets)
      ? dossier.targets
      : []
  const aggregate =
    dossier?.targetAggregate && typeof dossier.targetAggregate === 'object'
      ? dossier.targetAggregate
      : dossier?.targets?.aggregate && typeof dossier.targets.aggregate === 'object'
        ? dossier.targets.aggregate
        : null
  availability.targets = buildDatasetAvailability(reports.length > 0 || aggregate !== null)

  return availability
}

export function getMissingRuleRequirements(rule, dataAvailability = {}) {
  const requirements = Array.isArray(rule?.requiresData) ? rule.requiresData : []
  return requirements.filter((requirement) => {
    const dataset = String(requirement?.dataset || '').trim()
    if (!dataset) return false
    return !readAvailabilityFlag(dataAvailability?.[dataset], requirement)
  })
}

export function isRuleDataAvailable(rule, dataAvailability = {}) {
  return getMissingRuleRequirements(rule, dataAvailability).length === 0
}
