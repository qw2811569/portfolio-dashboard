export const FINMIND_PROMPT_DATASET_KEYS = [
  'institutional',
  'valuation',
  'margin',
  'revenue',
  'balanceSheet',
  'cashFlow',
  'shareholding',
]

export const FINMIND_DAILY_CONFIRMATION_DATASET_KEYS = [
  'institutional',
  'valuation',
  'margin',
  'shareholding',
]

function normalizeCodeList(codes = []) {
  return Array.from(
    new Set(
      (Array.isArray(codes) ? codes : [])
        .map((code) => String(code || '').trim())
        .filter(Boolean)
    )
  )
}

export function summarizeFinMindPromptDatasets(finmind = null) {
  const datasetCounts = Object.fromEntries(
    FINMIND_PROMPT_DATASET_KEYS.map((key) => [
      key,
      Array.isArray(finmind?.[key]) ? finmind[key].length : 0,
    ])
  )

  const availableCount = Object.values(datasetCounts).filter((count) => count > 0).length

  return {
    ...datasetCounts,
    availableCount,
    missingCount: FINMIND_PROMPT_DATASET_KEYS.length - availableCount,
  }
}

export function hasFinMindPromptData(finmind = null) {
  return summarizeFinMindPromptDatasets(finmind).availableCount > 0
}

function normalizeMarketDate(value = '') {
  return String(value || '')
    .trim()
    .replace(/\//g, '-')
    .slice(0, 10)
}

function extractLatestDatasetDate(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeMarketDate(row?.date))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] || null
}

export function summarizeFinMindDailyConfirmation(dossiers = [], marketDate = '') {
  const expectedMarketDate = normalizeMarketDate(marketDate)
  const coverage = (Array.isArray(dossiers) ? dossiers : []).map((dossier) => {
    const datasetStates = Object.fromEntries(
      FINMIND_DAILY_CONFIRMATION_DATASET_KEYS.map((key) => {
        const latestDate = extractLatestDatasetDate(dossier?.finmind?.[key])
        const status = !latestDate
          ? 'missing'
          : !expectedMarketDate || latestDate === expectedMarketDate
            ? 'confirmed'
            : 'stale'
        return [key, { latestDate, status }]
      })
    )

    const confirmedCount = Object.values(datasetStates).filter(
      (entry) => entry.status === 'confirmed'
    ).length

    return {
      code: String(dossier?.code || '').trim(),
      confirmedCount,
      totalDatasets: FINMIND_DAILY_CONFIRMATION_DATASET_KEYS.length,
      fullyConfirmed: confirmedCount === FINMIND_DAILY_CONFIRMATION_DATASET_KEYS.length,
      datasets: datasetStates,
    }
  })

  const confirmedDatasets = coverage.reduce((sum, item) => sum + item.confirmedCount, 0)
  const totalDatasets = coverage.length * FINMIND_DAILY_CONFIRMATION_DATASET_KEYS.length
  const pendingCodes = coverage.filter((item) => !item.fullyConfirmed).map((item) => item.code)

  return {
    expectedMarketDate,
    datasetKeys: [...FINMIND_DAILY_CONFIRMATION_DATASET_KEYS],
    totalHoldings: coverage.length,
    fullyConfirmedCount: coverage.filter((item) => item.fullyConfirmed).length,
    confirmedDatasets,
    totalDatasets,
    status:
      totalDatasets > 0 && confirmedDatasets === totalDatasets ? 'confirmed' : 'preliminary',
    pendingCodes,
    coverage,
  }
}

export function shouldDebugFinMindPromptCoverage() {
  if (typeof globalThis !== 'undefined' && globalThis.__DEBUG_FINMIND_PROMPT__ != null) {
    return Boolean(globalThis.__DEBUG_FINMIND_PROMPT__)
  }

  return false
}

export async function hydrateDossiersWithFinMind({
  codes = [],
  dossierByCode = new Map(),
  fetchStockDossierData = async () => null,
  fetchOptions = {},
  contextLabel = 'prompt',
  logger = console.warn,
} = {}) {
  const requestedCodes = normalizeCodeList(codes)
  const nextDossierByCode = new Map(dossierByCode)
  const missingCodes = requestedCodes.filter((code) => {
    const dossier = nextDossierByCode.get(code)
    return dossier && !hasFinMindPromptData(dossier.finmind)
  })

  if (missingCodes.length > 0) {
    const results = await Promise.allSettled(
      missingCodes.map(async (code) => ({
        code,
        finmind: await fetchStockDossierData(code, fetchOptions),
      }))
    )

    results.forEach((result) => {
      if (result.status !== 'fulfilled') return
      const { code, finmind } = result.value
      const dossier = nextDossierByCode.get(code)
      if (!dossier) return
      nextDossierByCode.set(code, {
        ...dossier,
        finmind: finmind || dossier.finmind,
      })
    })
  }

  const coverage = requestedCodes.map((code) => ({
    code,
    datasets: summarizeFinMindPromptDatasets(nextDossierByCode.get(code)?.finmind),
  }))

  if (shouldDebugFinMindPromptCoverage()) {
    logger('[finmind-prompt]', {
      context: contextLabel,
      requestedCodes,
      missingCodes,
      coverage,
    })
  }

  return {
    dossierByCode: nextDossierByCode,
    requestedCodes,
    missingCodes,
    coverage,
  }
}
