import {
  FINMIND_DOSSIER_DATASET_PLAN,
  FINMIND_DATASET_REGISTRY,
  createFinMindMethodRegistry,
} from './finmindDatasetRegistry.js'
import {
  fetchFinMindDataset,
  fetchFinMindDatasetState,
  fetchFinMindRawDataset,
} from './finmindClient.js'

export const finmindMethodRegistry = createFinMindMethodRegistry(fetchFinMindDataset)
export const finmindStateMethodRegistry = createFinMindMethodRegistry(fetchFinMindDatasetState)
export const finmindRawMethodRegistry = createFinMindMethodRegistry(fetchFinMindRawDataset)

function getDefaultRequestValue(datasetKey, field, fallback = 0) {
  const value = Number(FINMIND_DATASET_REGISTRY?.[datasetKey]?.defaultRequest?.[field])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export async function fetchInstitutionalChip(
  code,
  days = getDefaultRequestValue('institutional', 'days', 30),
  options = {}
) {
  return finmindMethodRegistry.institutional(code, { days }, options)
}

export async function fetchMarginTrading(
  code,
  days = getDefaultRequestValue('margin', 'days', 30),
  options = {}
) {
  return finmindMethodRegistry.margin(code, { days }, options)
}

export async function fetchValuationHistory(
  code,
  days = getDefaultRequestValue('valuation', 'days', 365),
  options = {}
) {
  return finmindMethodRegistry.valuation(code, { days }, options)
}

export async function fetchFinancialStatements(code, startDate, options = {}) {
  return finmindMethodRegistry.financials(code, { startDate }, options)
}

export async function fetchBalanceSheet(code, startDate, options = {}) {
  return finmindMethodRegistry.balanceSheet(code, { startDate }, options)
}

export async function fetchCashFlowStatements(code, startDate, options = {}) {
  return finmindMethodRegistry.cashFlow(code, { startDate }, options)
}

export async function fetchDividendHistory(code, options = {}) {
  return finmindMethodRegistry.dividend(code, {}, options)
}

export async function fetchDividendResults(
  code,
  days = getDefaultRequestValue('dividendResult', 'days', 1825),
  options = {}
) {
  return finmindMethodRegistry.dividendResult(code, { days }, options)
}

export async function fetchCapitalReductionReferencePrices(
  code,
  days = getDefaultRequestValue('capitalReductionReferencePrice', 'days', 1825),
  options = {}
) {
  return finmindMethodRegistry.capitalReductionReferencePrice(code, { days }, options)
}

export async function fetchRevenueHistory(
  code,
  months = getDefaultRequestValue('revenue', 'months', 12),
  options = {}
) {
  return finmindMethodRegistry.revenue(code, { months }, options)
}

export async function fetchShareholdingHistory(
  code,
  days = getDefaultRequestValue('shareholding', 'days', 120),
  options = {}
) {
  return finmindMethodRegistry.shareholding(code, { days }, options)
}

export async function fetchStockNews(
  code,
  days = getDefaultRequestValue('news', 'days', 21),
  options = {}
) {
  return finmindMethodRegistry.news(code, { days }, options)
}

export async function fetchStockDossierData(code, options = {}) {
  const state = await fetchStockDossierDataState(code, options)
  return state.data
}

export async function fetchStockDossierDataState(code, options = {}) {
  const settled = await Promise.allSettled(
    FINMIND_DOSSIER_DATASET_PLAN.map(({ datasetKey, request }) =>
      finmindStateMethodRegistry[datasetKey](code, request, options)
    )
  )

  const datasets = Object.fromEntries(
    FINMIND_DOSSIER_DATASET_PLAN.map(({ datasetKey }, index) => {
      const result = settled[index]
      if (result?.status === 'fulfilled') {
        return [datasetKey, result.value]
      }

      const message = String(result?.reason?.message || '').trim()
      return [
        datasetKey,
        {
          data: [],
          isStale: false,
          error: message
            ? {
                reason: /unauthorized|forbidden|401|auth/i.test(message)
                  ? 'auth-required'
                  : /quota|upper limit|rate limit|429|402/i.test(message)
                    ? 'quota-exceeded'
                    : /timeout|timed out|503|504|502/i.test(message)
                      ? 'api-timeout'
                      : 'analysis-unavailable',
                message,
              }
            : null,
          degraded: false,
          fetchedAt: null,
          source: 'finmind',
          fallbackSnapshot: null,
        },
      ]
    })
  )

  const degradedStates = Object.values(datasets).filter((state) => state?.error?.reason)
  const fallbackSnapshot =
    degradedStates.find((state) => state?.fallbackSnapshot)?.fallbackSnapshot || null

  return {
    data: Object.fromEntries(
      FINMIND_DOSSIER_DATASET_PLAN.map(({ datasetKey }) => [
        datasetKey,
        Array.isArray(datasets[datasetKey]?.data) ? datasets[datasetKey].data : [],
      ])
    ),
    datasets,
    isStale: degradedStates.some((state) => state?.isStale),
    error: degradedStates[0]?.error || null,
    degraded: degradedStates.some((state) => state?.degraded),
    fallbackSnapshot,
  }
}
