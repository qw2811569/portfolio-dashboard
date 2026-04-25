import { useRef, useState } from 'react'
import { OWNER_PORTFOLIO_ID, PORTFOLIO_VIEW_MODE } from '../constants.js'
import { createEmptyBrainValidationStore } from '../lib/brainRuntime.js'
import { clonePortfolioNotes } from '../lib/portfolioUtils.js'
import { APP_BOOTSTRAP_LOADING_STATE } from '../lib/appMessages.js'

const createHistorySyncStatus = () => ({
  status: 'idle',
  message: '',
})

export function useAppRuntimeState() {
  const [ready, setReady] = useState(false)
  const [bootstrapState, setBootstrapState] = useState(() => APP_BOOTSTRAP_LOADING_STATE)

  const [holdings, setHoldings] = useState(null)
  const [tradeLog, setTradeLog] = useState(null)
  const [targets, setTargets] = useState(null)
  const [fundamentals, setFundamentals] = useState(null)
  const [watchlist, setWatchlist] = useState(null)
  const [analystReports, setAnalystReports] = useState(null)
  const [reportRefreshMeta, setReportRefreshMeta] = useState(null)
  const [holdingDossiers, setHoldingDossiers] = useState(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState('')
  const [dailyReport, setDailyReport] = useState(null)
  const [analysisHistory, setAnalysisHistory] = useState(null)
  const [analysisHistoryStatus, setAnalysisHistoryStatus] = useState(createHistorySyncStatus)
  const [newsEvents, setNewsEvents] = useState(null)
  const [reversalConditions, setReversalConditions] = useState(null)
  const [strategyBrain, setStrategyBrain] = useState(null)
  const [brainValidation, setBrainValidation] = useState(() => createEmptyBrainValidationStore())
  const [portfolioNotes, setPortfolioNotes] = useState(() => clonePortfolioNotes())
  const [cloudSync, setCloudSync] = useState(false)
  const [researching, setResearching] = useState(false)
  const [researchHistory, setResearchHistory] = useState(null)
  const [researchHistoryStatus, setResearchHistoryStatus] = useState(createHistorySyncStatus)

  const cloudSaveTimersRef = useRef({})
  const cloudSyncStateRef = useRef({ enabled: false, syncedAt: 0 })
  const portfolioSetterRef = useRef({
    setActivePortfolioId: () => {},
    setViewMode: () => {},
  })
  const portfoliosRef = useRef([])
  const activePortfolioIdRef = useRef(OWNER_PORTFOLIO_ID)
  const viewModeRef = useRef(PORTFOLIO_VIEW_MODE)
  const bootRuntimeRef = useRef(null)
  const refreshAnalystReportsRef = useRef(async () => false)
  const resetTradeCaptureRef = useRef(() => {})

  const runtimeState = {
    ready,
    bootstrapState,
    holdings,
    watchlist,
    newsEvents,
    tradeLog,
    targets,
    fundamentals,
    analystReports,
    reportRefreshMeta,
    holdingDossiers,
    analysisHistory,
    analysisHistoryStatus,
    dailyReport,
    reversalConditions,
    strategyBrain,
    brainValidation,
    researchHistory,
    researchHistoryStatus,
    portfolioNotes,
  }

  const runtimeSetters = {
    setReady,
    setBootstrapState,
    setCloudSync,
    setHoldings,
    setTradeLog,
    setTargets,
    setFundamentals,
    setWatchlist,
    setAnalystReports,
    setReportRefreshMeta,
    setHoldingDossiers,
    setNewsEvents,
    setAnalysisHistory,
    setAnalysisHistoryStatus,
    setReversalConditions,
    setStrategyBrain,
    setBrainValidation,
    setResearchHistory,
    setResearchHistoryStatus,
    setPortfolioNotes,
    setDailyReport,
  }

  const refs = {
    cloudSaveTimersRef,
    cloudSyncStateRef,
    portfolioSetterRef,
    portfoliosRef,
    activePortfolioIdRef,
    viewModeRef,
    bootRuntimeRef,
    refreshAnalystReportsRef,
    resetTradeCaptureRef,
  }

  return {
    ready,
    bootstrapState,
    holdings,
    tradeLog,
    targets,
    fundamentals,
    watchlist,
    analystReports,
    reportRefreshMeta,
    holdingDossiers,
    analyzing,
    setAnalyzing,
    analyzeStep,
    setAnalyzeStep,
    dailyReport,
    analysisHistory,
    analysisHistoryStatus,
    newsEvents,
    reversalConditions,
    strategyBrain,
    brainValidation,
    portfolioNotes,
    cloudSync,
    researching,
    setResearching,
    researchHistory,
    researchHistoryStatus,
    runtimeState,
    runtimeSetters,
    refs,
  }
}
