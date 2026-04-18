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

function readAvailabilityFlag(value) {
  if (value == null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') {
    if (typeof value.available === 'boolean') return value.available
    if (Array.isArray(value.rows)) return value.rows.length > 0
  }
  return false
}

export function buildKnowledgeDataAvailability({ finmind = {}, dossier = null } = {}) {
  const availability = {}

  for (const dataset of FINMIND_DATASETS) {
    availability[dataset] = Array.isArray(finmind?.[dataset]) && finmind[dataset].length > 0
  }

  const pendingEvents = Array.isArray(dossier?.events?.pending) ? dossier.events.pending : []
  const trackingEvents = Array.isArray(dossier?.events?.tracking) ? dossier.events.tracking : []
  availability.events = pendingEvents.length > 0 || trackingEvents.length > 0

  const reports = Array.isArray(dossier?.targets?.reports) ? dossier.targets.reports : []
  availability.targets = reports.length > 0

  return availability
}

export function getMissingRuleRequirements(rule, dataAvailability = {}) {
  const requirements = Array.isArray(rule?.requiresData) ? rule.requiresData : []
  return requirements.filter((requirement) => {
    const dataset = String(requirement?.dataset || '').trim()
    if (!dataset) return false
    return !readAvailabilityFlag(dataAvailability?.[dataset])
  })
}

export function isRuleDataAvailable(rule, dataAvailability = {}) {
  return getMissingRuleRequirements(rule, dataAvailability).length === 0
}
