export function getResearchTargetKey(mode, targetStock = null) {
  if (mode === 'single') return String(targetStock?.code || '').trim() || null
  return (
    String(mode || '')
      .trim()
      .toUpperCase() || null
  )
}

export function buildResearchStocks({
  mode = 'single',
  targetStock = null,
  holdings = [],
  resolveHoldingPrice = () => 0,
  getHoldingUnrealizedPnl = () => 0,
  getHoldingReturnPct = () => 0,
}) {
  if (mode === 'single' && targetStock) return [targetStock]

  return (Array.isArray(holdings) ? holdings : []).map((holding) => ({
    code: holding.code,
    name: holding.name,
    price: resolveHoldingPrice(holding),
    cost: holding.cost,
    qty: holding.qty,
    value: Number(resolveHoldingPrice(holding)) * Number(holding.qty || 0),
    pnl: getHoldingUnrealizedPnl(holding),
    pct: getHoldingReturnPct(holding),
    type: holding.type,
  }))
}

export function buildResearchDossiers({ stocks = [], dossierByCode = new Map() }) {
  return (Array.isArray(stocks) ? stocks : [])
    .map((stock) => {
      const dossier = dossierByCode.get(stock.code)
      if (!dossier) return null
      return {
        ...dossier,
        position: {
          ...(dossier.position || {}),
          price: stock.price,
          pnl: stock.pnl,
          pct: stock.pct,
          cost: stock.cost,
          qty: stock.qty ?? dossier.position?.qty ?? 0,
          value:
            stock.value ??
            Number(stock.price || dossier.position?.price || 0) *
              Number(stock.qty ?? dossier.position?.qty ?? 0),
          type: stock.type || dossier.position?.type || '股票',
        },
      }
    })
    .filter(Boolean)
}

export function buildResearchRequestBody({
  portfolioId = '',
  mode = 'single',
  stocks = [],
  holdings = [],
  researchDossiers = [],
  stockMeta = {},
  strategyBrain = null,
  portfolioNotes = {},
  canUseCloud = false,
  newsEvents = [],
  analysisHistory = [],
  knowledgeUsageLog = [],
  knowledgeFeedbackLog = [],
}) {
  const body = {
    portfolioId,
    stocks,
    holdings,
    holdingDossiers: researchDossiers,
    meta: stockMeta,
    brain: strategyBrain,
    portfolioNotes,
    mode,
    persist: canUseCloud,
  }

  if (mode === 'evolve' || mode === 'portfolio') {
    body.events = (Array.isArray(newsEvents) ? newsEvents : []).slice(0, 20)
    body.analysisHistory = (Array.isArray(analysisHistory) ? analysisHistory : []).slice(0, 10)
    body.knowledgeUsageLog = (Array.isArray(knowledgeUsageLog) ? knowledgeUsageLog : []).slice(-500)
    body.knowledgeFeedbackLog = (
      Array.isArray(knowledgeFeedbackLog) ? knowledgeFeedbackLog : []
    ).slice(-200)
  }

  return body
}

export function getPrimaryResearchResult(data) {
  return Array.isArray(data?.results) && data.results.length > 0 ? data.results[0] : null
}

export function patchResearchProposalState(report, patch = {}) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return report
  const nextProposal = report?.brainProposal
    ? {
        ...report.brainProposal,
        ...(patch.brainProposal || {}),
      }
    : report.brainProposal

  return {
    ...report,
    ...(patch.report || {}),
    brainProposal: nextProposal,
    proposalStatus: patch.proposalStatus ?? nextProposal?.status ?? report.proposalStatus,
  }
}

export function updateResearchReportsProposalState(rows, targetTimestamp, patch = {}) {
  return (Array.isArray(rows) ? rows : []).map((report) =>
    Number(report?.timestamp) === Number(targetTimestamp)
      ? patchResearchProposalState(report, patch)
      : report
  )
}

export function mergeResearchHistoryEntries(existingReports, incomingReports, limit = 30) {
  return [
    ...(Array.isArray(existingReports) ? existingReports : []),
    ...(Array.isArray(incomingReports) ? incomingReports : []),
  ]
    .filter(
      (report, index, rows) =>
        rows.findIndex((item) => item?.timestamp === report?.timestamp) === index
    )
    .sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0))
    .slice(0, limit)
}
