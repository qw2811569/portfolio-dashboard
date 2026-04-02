export const FINMIND_PROMPT_DATASET_KEYS = [
  'institutional',
  'valuation',
  'margin',
  'revenue',
  'balanceSheet',
  'cashFlow',
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
        finmind: await fetchStockDossierData(code),
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
