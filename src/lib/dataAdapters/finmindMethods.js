import {
  FINMIND_DOSSIER_DATASET_PLAN,
  FINMIND_DATASET_REGISTRY,
  createFinMindMethodRegistry,
} from './finmindDatasetRegistry.js'
import { fetchFinMindDataset, fetchFinMindRawDataset } from './finmindClient.js'

export const finmindMethodRegistry = createFinMindMethodRegistry(fetchFinMindDataset)
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
  const settled = await Promise.allSettled(
    FINMIND_DOSSIER_DATASET_PLAN.map(({ datasetKey, request }) =>
      finmindMethodRegistry[datasetKey](code, request, options)
    )
  )

  return Object.fromEntries(
    FINMIND_DOSSIER_DATASET_PLAN.map(({ datasetKey }, index) => [
      datasetKey,
      settled[index]?.status === 'fulfilled' ? settled[index].value : [],
    ])
  )
}
