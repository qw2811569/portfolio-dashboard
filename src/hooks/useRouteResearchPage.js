import { useCallback, useMemo, useState } from 'react'
import {
  getHoldingMarketValue,
  getHoldingReturnPct,
  getHoldingUnrealizedPnl,
  resolveHoldingPrice,
} from '../lib/holdings.js'
import { buildResearchRefreshRows } from '../lib/routeRuntime.js'
import { getTaipeiClock } from '../lib/utils.js'
import { getEventStockCodes, isClosedEvent } from '../lib/eventUtils.js'
import { buildReportRefreshCandidates } from '../lib/reportRefreshRuntime.js'
import { IND_COLOR, STOCK_META } from '../seedData.js'
import { usePortfolioRouteContext } from '../pages/usePortfolioRouteContext.js'
import { useReportRefreshWorkflow } from './useReportRefreshWorkflow.js'
import { useResearchWorkflow } from './useResearchWorkflow.js'

function warnBlockedRouteWrite(actionName) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[route-shell] write blocked: ${actionName}. Use the canonical AppShell to mutate data.`
    )
  }
}

export function useRouteResearchPage() {
  const {
    holdings = [],
    targets = {},
    fundamentals = {},
    holdingDossiers = [],
    analystReports = {},
    newsEvents = [],
    analysisHistory = [],
    strategyBrain = null,
    portfolioNotes = {},
    researchHistory = [],
    setResearchHistory = () => {},
    setStrategyBrain = () => {},
    setAnalystReports = () => {},
    upsertTargetReport = () => false,
    upsertFundamentalsEntry = () => false,
    flashSaved = () => {},
    researching: ctxResearching,
    setResearching: ctxSetResearching,
    researchTarget: ctxResearchTarget,
    setResearchTarget: ctxSetResearchTarget,
  } = usePortfolioRouteContext()

  const [fallbackResearching, setFallbackResearching] = useState(false)
  const [fallbackResearchTarget, setFallbackResearchTarget] = useState(null)

  const researching = ctxResearching ?? fallbackResearching
  const setResearching = ctxSetResearching ?? setFallbackResearching
  const researchTarget = ctxResearchTarget ?? fallbackResearchTarget
  const setResearchTarget = ctxSetResearchTarget ?? setFallbackResearchTarget
  const [researchResults, setResearchResults] = useState(null)
  const [reportRefreshMeta, setReportRefreshMeta] = useState({})

  const dataRefreshRows = useMemo(
    () => buildResearchRefreshRows({ holdings, targets, fundamentals }),
    [fundamentals, holdings, targets]
  )

  const dossierByCode = useMemo(
    () =>
      new Map(
        (Array.isArray(holdingDossiers) ? holdingDossiers : []).map((dossier) => [
          dossier.code,
          dossier,
        ])
      ),
    [holdingDossiers]
  )

  const todayRefreshKey = useMemo(() => getTaipeiClock(new Date()).marketDate, [])
  const reportRefreshCandidates = useMemo(
    () =>
      buildReportRefreshCandidates({
        holdings,
        dossierByCode,
        reportRefreshMeta,
        newsEvents,
        todayRefreshKey,
        getEventStockCodes,
        isClosedEvent,
        getHoldingMarketValue,
      }),
    [dossierByCode, holdings, newsEvents, reportRefreshMeta, todayRefreshKey]
  )

  const { reportRefreshing, reportRefreshStatus, enrichingResearchCode, enrichResearchToDossier } =
    useReportRefreshWorkflow({
      holdings,
      dossierByCode,
      analystReports,
      reportRefreshMeta,
      reportRefreshCandidates,
      todayRefreshKey,
      upsertTargetReport,
      upsertFundamentalsEntry,
      setAnalystReports,
      setReportRefreshMeta,
      flashSaved,
    })

  const { proposalActionId, proposalActionType } = useResearchWorkflow({
    researching,
    setResearching,
    setResearchTarget,
    holdings,
    portfolioHoldings: holdings,
    dossierByCode,
    stockMeta: STOCK_META,
    strategyBrain,
    portfolioNotes,
    canUseCloud: false,
    newsEvents,
    analysisHistory,
    resolveHoldingPrice,
    getHoldingUnrealizedPnl,
    getHoldingReturnPct,
    setResearchResults,
    setResearchHistory,
    setStrategyBrain,
    notifySaved: flashSaved,
    enrichResearchToDossier,
  })

  const blockRunResearch = useCallback(async (..._args) => {
    warnBlockedRouteWrite('runResearch')
    return null
  }, [])
  const blockRefreshAnalystReports = useCallback(async (..._args) => {
    warnBlockedRouteWrite('refreshAnalystReports')
    return false
  }, [])
  const blockEnrichResearchToDossier = useCallback(async (..._args) => {
    warnBlockedRouteWrite('enrichResearchToDossier')
    return false
  }, [])
  const blockApplyBrainProposal = useCallback(async (..._args) => {
    warnBlockedRouteWrite('applyBrainProposal')
    return false
  }, [])
  const blockDiscardBrainProposal = useCallback(async (..._args) => {
    warnBlockedRouteWrite('discardBrainProposal')
    return false
  }, [])

  return useMemo(
    () => ({
      holdings,
      researching,
      researchTarget,
      reportRefreshing,
      reportRefreshStatus,
      dataRefreshRows,
      researchResults,
      researchHistory,
      analystReports,
      enrichingResearchCode,
      proposalActionId,
      proposalActionType,
      STOCK_META,
      IND_COLOR,
      onEvolve: () => blockRunResearch('evolve'),
      onRefresh: blockRefreshAnalystReports,
      onResearch: blockRunResearch,
      onEnrich: blockEnrichResearchToDossier,
      onApplyProposal: blockApplyBrainProposal,
      onDiscardProposal: blockDiscardBrainProposal,
      onSelectHistory: setResearchResults,
    }),
    [
      blockApplyBrainProposal,
      blockDiscardBrainProposal,
      blockEnrichResearchToDossier,
      blockRefreshAnalystReports,
      blockRunResearch,
      dataRefreshRows,
      analystReports,
      enrichingResearchCode,
      holdings,
      reportRefreshing,
      reportRefreshStatus,
      researchHistory,
      researchResults,
      researchTarget,
      researching,
      proposalActionId,
      proposalActionType,
      setResearchResults,
    ]
  )
}
