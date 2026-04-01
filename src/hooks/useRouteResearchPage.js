import { useMemo, useState } from 'react'
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
  } = usePortfolioRouteContext()

  const [researching, setResearching] = useState(false)
  const [researchTarget, setResearchTarget] = useState(null)
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

  const {
    reportRefreshing,
    reportRefreshStatus,
    enrichingResearchCode,
    refreshAnalystReports,
    enrichResearchToDossier,
  } = useReportRefreshWorkflow({
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

  const {
    runResearch,
    applyBrainProposal,
    discardBrainProposal,
    proposalActionId,
    proposalActionType,
  } = useResearchWorkflow({
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
      enrichingResearchCode,
      proposalActionId,
      proposalActionType,
      STOCK_META,
      IND_COLOR,
      onEvolve: () => runResearch('evolve'),
      onRefresh: refreshAnalystReports,
      onResearch: runResearch,
      onEnrich: enrichResearchToDossier,
      onApplyProposal: applyBrainProposal,
      onDiscardProposal: discardBrainProposal,
      onSelectHistory: setResearchResults,
    }),
    [
      applyBrainProposal,
      dataRefreshRows,
      discardBrainProposal,
      enrichResearchToDossier,
      enrichingResearchCode,
      holdings,
      refreshAnalystReports,
      reportRefreshing,
      reportRefreshStatus,
      researchHistory,
      researchResults,
      researchTarget,
      researching,
      proposalActionId,
      proposalActionType,
      runResearch,
      setResearchResults,
    ]
  )
}
