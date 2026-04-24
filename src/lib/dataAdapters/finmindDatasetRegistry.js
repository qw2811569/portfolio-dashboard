export const FINMIND_DATASET_REGISTRY = Object.freeze({
  institutional: Object.freeze({
    key: 'institutional',
    finmindDataset: 'TaiwanStockInstitutionalInvestorsBuySell',
    requestKind: 'days',
    defaultWindowDays: 90,
    defaultRequest: Object.freeze({ days: 30 }),
    dossierRequest: Object.freeze({ days: 20 }),
  }),
  margin: Object.freeze({
    key: 'margin',
    finmindDataset: 'TaiwanStockMarginPurchaseShortSale',
    requestKind: 'days',
    defaultWindowDays: 90,
    defaultRequest: Object.freeze({ days: 30 }),
    dossierRequest: Object.freeze({ days: 20 }),
  }),
  valuation: Object.freeze({
    key: 'valuation',
    finmindDataset: 'TaiwanStockPER',
    requestKind: 'days',
    defaultWindowDays: 365,
    defaultRequest: Object.freeze({ days: 365 }),
    dossierRequest: Object.freeze({ days: 90 }),
  }),
  financials: Object.freeze({
    key: 'financials',
    finmindDataset: 'TaiwanStockFinancialStatements',
    requestKind: 'startDate',
    defaultWindowDays: 730,
    defaultRequest: Object.freeze({}),
    dossierRequest: Object.freeze({}),
  }),
  balanceSheet: Object.freeze({
    key: 'balanceSheet',
    finmindDataset: 'TaiwanStockBalanceSheet',
    requestKind: 'startDate',
    defaultWindowDays: 730,
    defaultRequest: Object.freeze({}),
    dossierRequest: Object.freeze({}),
  }),
  cashFlow: Object.freeze({
    key: 'cashFlow',
    finmindDataset: 'TaiwanStockCashFlowsStatement',
    requestKind: 'startDate',
    defaultWindowDays: 730,
    defaultRequest: Object.freeze({}),
    dossierRequest: Object.freeze({}),
  }),
  dividend: Object.freeze({
    key: 'dividend',
    finmindDataset: 'TaiwanStockDividend',
    requestKind: 'days',
    defaultWindowDays: 1825,
    defaultRequest: Object.freeze({ days: 1825 }),
    dossierRequest: Object.freeze({ days: 1825 }),
  }),
  dividendResult: Object.freeze({
    key: 'dividendResult',
    finmindDataset: 'TaiwanStockDividendResult',
    requestKind: 'days',
    defaultWindowDays: 1825,
    defaultRequest: Object.freeze({ days: 1825 }),
    dossierRequest: Object.freeze({ days: 1825 }),
  }),
  capitalReductionReferencePrice: Object.freeze({
    key: 'capitalReductionReferencePrice',
    finmindDataset: 'TaiwanStockCapitalReductionReferencePrice',
    requestKind: 'days',
    defaultWindowDays: 1825,
    defaultRequest: Object.freeze({ days: 1825 }),
    dossierRequest: Object.freeze({ days: 1825 }),
    includeInDossier: false,
  }),
  revenue: Object.freeze({
    key: 'revenue',
    finmindDataset: 'TaiwanStockMonthRevenue',
    requestKind: 'months',
    defaultWindowDays: 365,
    defaultRequest: Object.freeze({ months: 12 }),
    dossierRequest: Object.freeze({ months: 6 }),
  }),
  shareholding: Object.freeze({
    key: 'shareholding',
    finmindDataset: 'TaiwanStockShareholding',
    requestKind: 'days',
    defaultWindowDays: 120,
    defaultRequest: Object.freeze({ days: 120 }),
    dossierRequest: Object.freeze({ days: 90 }),
  }),
  news: Object.freeze({
    key: 'news',
    finmindDataset: 'TaiwanStockNews',
    requestKind: 'days',
    defaultWindowDays: 21,
    defaultRequest: Object.freeze({ days: 21 }),
    dossierRequest: Object.freeze({ days: 14 }),
  }),
})

export const FINMIND_DATASET_KEYS = Object.freeze(Object.keys(FINMIND_DATASET_REGISTRY))

export const FINMIND_DOSSIER_DATASET_PLAN = Object.freeze(
  FINMIND_DATASET_KEYS.filter(
    (datasetKey) => FINMIND_DATASET_REGISTRY[datasetKey]?.includeInDossier !== false
  ).map((datasetKey) =>
    Object.freeze({
      datasetKey,
      request: Object.freeze({
        ...(FINMIND_DATASET_REGISTRY[datasetKey]?.dossierRequest || {}),
      }),
    })
  )
)

function cloneDate(input = new Date()) {
  return new Date(input.getTime())
}

export function daysAgo(days, now = new Date()) {
  const date = cloneDate(now)
  date.setDate(date.getDate() - Number(days || 0))
  return date.toISOString().slice(0, 10)
}

function normalizeOptionalText(value = '') {
  const text = String(value || '').trim()
  return text || ''
}

export function getFinMindDatasetConfig(datasetKey) {
  return FINMIND_DATASET_REGISTRY[String(datasetKey || '').trim()] || null
}

export function resolveFinMindDatasetRequest(datasetKey, request = {}, now = new Date()) {
  const config = getFinMindDatasetConfig(datasetKey)
  if (!config) {
    throw new Error(`Unsupported FinMind dataset: ${datasetKey}`)
  }

  const mergedRequest = {
    ...(config.defaultRequest || {}),
    ...(request && typeof request === 'object' ? request : {}),
  }

  const endDate = normalizeOptionalText(mergedRequest.endDate)
  const explicitStartDate = normalizeOptionalText(mergedRequest.startDate)
  const windowDays = Number(mergedRequest.days ?? mergedRequest.windowDays)
  const windowMonths = Number(mergedRequest.months ?? mergedRequest.windowMonths)

  let startDate = explicitStartDate
  if (!startDate) {
    if (config.requestKind === 'months' && Number.isFinite(windowMonths) && windowMonths > 0) {
      startDate = daysAgo(windowMonths * 31, now)
    } else if (Number.isFinite(windowDays) && windowDays > 0) {
      startDate = daysAgo(windowDays, now)
    } else {
      startDate = daysAgo(config.defaultWindowDays, now)
    }
  }

  return {
    datasetKey: config.key,
    finmindDataset: config.finmindDataset,
    startDate,
    endDate,
  }
}

export function createFinMindMethodRegistry(fetchDataset) {
  const registry = {}

  for (const datasetKey of FINMIND_DATASET_KEYS) {
    registry[datasetKey] = async (code, request = {}, options = {}) =>
      fetchDataset(datasetKey, code, request, options)
  }

  return Object.freeze(registry)
}
