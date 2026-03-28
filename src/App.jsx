import { useState, useEffect, useRef, useCallback } from 'react'
import { C } from './theme.js'
import { IND_COLOR, NEWS_EVENTS, RELAY_PLAN_CODES, STOCK_META } from './seedData.js'
import AppPanels from './components/AppPanels.jsx'
import { ConfirmDialog } from './components/common/index.js'
import Header from './components/Header.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { usePortfolioManagement } from './hooks/usePortfolioManagement.js'
import { usePortfolioDerivedData } from './hooks/usePortfolioDerivedData.js'
import { usePortfolioBootstrap } from './hooks/usePortfolioBootstrap.js'
import { usePortfolioPersistence } from './hooks/usePortfolioPersistence.js'
import { useAppConfirmationDialog } from './hooks/useAppConfirmationDialog.js'
import { useTradeCaptureRuntime } from './hooks/useTradeCaptureRuntime.js'
import { useWeeklyReportClipboard } from './hooks/useWeeklyReportClipboard.js'
import { usePortfolioDossierActions } from './hooks/usePortfolioDossierActions.js'
import { useWatchlistActions } from './hooks/useWatchlistActions.js'
import { useTransientUiActions } from './hooks/useTransientUiActions.js'
import { useSavedToast } from './hooks/useSavedToast.js'
import { useAppShellUiState } from './hooks/useAppShellUiState.js'
import { useCanonicalLocalhostRedirect } from './hooks/useCanonicalLocalhostRedirect.js'
import { useAppRuntimeSyncRefs } from './hooks/useAppRuntimeSyncRefs.js'
import { useDailyAnalysisWorkflow } from './hooks/useDailyAnalysisWorkflow.js'
import { useResearchWorkflow } from './hooks/useResearchWorkflow.js'
import { useStressTestWorkflow } from './hooks/useStressTestWorkflow.js'
import { useEventReviewWorkflow } from './hooks/useEventReviewWorkflow.js'
import { useEventLifecycleSync } from './hooks/useEventLifecycleSync.js'
import { useMarketData } from './hooks/useMarketData.js'
import { useReportRefreshWorkflow } from './hooks/useReportRefreshWorkflow.js'
import { useLocalBackupWorkflow } from './hooks/useLocalBackupWorkflow.js'
import {
  API_ENDPOINTS,
  OWNER_PORTFOLIO_ID,
  PORTFOLIO_VIEW_MODE,
  OVERVIEW_VIEW_MODE,
  POST_CLOSE_SYNC_MINUTES,
  ACTIVE_PORTFOLIO_KEY,
  VIEW_MODE_KEY,
  DEFAULT_FUNDAMENTAL_DRAFT,
  TRADE_BACKFILL_PATCHES,
  PORTFOLIO_ALIAS_TO_SUFFIX,
} from './constants.js'
import {
  brainRuleSummary,
  createEmptyBrainAudit,
  createEmptyBrainValidationStore,
  ensureBrainAuditCoverage,
  formatBrainChecklistsForPrompt,
  formatBrainRulesForValidationPrompt,
  mergeBrainPreservingCoachLessons,
  mergeBrainWithAuditLifecycle,
  normalizeBrainValidationStore,
  normalizeHoldingDossiers,
  normalizeStrategyBrain, // normalizeStrategyBrain 移至 brainRuntime
  enforceTaiwanHardGatesOnBrainAudit,
  appendBrainValidationCases,
} from './lib/brainRuntime.js'
import {
  buildHoldingPriceHints,
  getHoldingCostBasis,
  getHoldingMarketValue,
  resolveHoldingPrice,
  getHoldingUnrealizedPnl,
  getHoldingReturnPct,
  normalizeHoldings,
  applyMarketQuotesToHoldings,
  applyTradeEntryToHoldings,
  shouldAdoptCloudHoldings,
} from './lib/holdings.js'
import { getPersistedMarketQuotes } from './lib/market.js'
import {
  formatDateToStorageDate,
  getTaipeiClock,
  parseStoredDate,
  todayStorageDate,
} from './lib/datetime.js'
import {
  normalizeAnalysisHistoryEntries,
  normalizeAnalystReportsStore,
  normalizeDailyReportEntry,
  normalizeReportRefreshMeta,
} from './lib/reportUtils.js'
import {
  buildDailyHoldingDossierContext,
  buildHoldingDossiers,
  normalizeFundamentalsStore,
} from './lib/dossierUtils.js'
import { buildPortfolioTabs } from './lib/navigationTabs.js'
import {
  createDefaultReviewForm,
  formatEventStockOutcomeLine,
  getEventStockCodes,
  isClosedEvent,
  normalizeNewsEvents,
  parseFlexibleDate,
  parseSlashDate,
  toSlashDate,
  appendPriceHistory,
} from './lib/eventUtils.js'
import {
  clonePortfolioNotes,
  formatPortfolioNotesContext,
  getPortfolioFallback,
  loadAppliedTradePatches,
  loadPortfolioData,
  migrateLegacyPortfolioStorageIfNeeded,
  pfKey,
  readStorageValue,
  readSyncAt,
  save,
  saveAppliedTradePatches,
  savePortfolioData,
  seedJinlianchengIfNeeded,
  ensurePortfolioRegistry,
  loadPortfolioSnapshot,
  writeSyncAt,
} from './lib/portfolioUtils.js'
import { APP_ERROR_BOUNDARY_COPY, APP_LABELS, APP_LOADING_MESSAGE } from './lib/appMessages.js'
import {
  buildLivePortfolioSnapshot,
  filterEventsByType,
  resolveRuntimeNewsEvents,
} from './lib/appShellRuntime.js'
import { normalizeWatchlist } from './lib/watchlistUtils.js'

// ── 種子資料改由 seedData.js 提供，讓 App.jsx 只保留邏輯 ───────────

// ── helpers ─────────────────────────────────────────────────────
// 台股慣例：紅=漲/獲利，綠=跌/虧損（莫蘭迪版）
const pc = (p) => (p == null ? C.textMute : p >= 0 ? C.up : C.down)

function createDefaultFundamentalDraft(overrides = {}) {
  return { ...DEFAULT_FUNDAMENTAL_DRAFT, ...overrides }
}

async function applyTradeBackfillPatchesIfNeeded() {
  const applied = new Set(await loadAppliedTradePatches())
  let changed = 0

  for (const patch of TRADE_BACKFILL_PATCHES) {
    if (applied.has(patch.id)) continue

    const tradeLog = await loadPortfolioData(
      patch.portfolioId,
      PORTFOLIO_ALIAS_TO_SUFFIX.tradeLog,
      []
    )
    if ((tradeLog || []).some((item) => item?.patchId === patch.id)) {
      applied.add(patch.id)
      continue
    }

    const holdings = await loadPortfolioData(
      patch.portfolioId,
      PORTFOLIO_ALIAS_TO_SUFFIX.holdings,
      getPortfolioFallback(patch.portfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.holdings)
    )
    const existing = (holdings || []).find((item) => item.code === patch.entry.code)
    const currentQty = Number(existing?.qty) || 0
    const shouldAdjustHoldings =
      patch.expectedQtyAfter == null || currentQty > patch.expectedQtyAfter

    const nextHoldings = shouldAdjustHoldings
      ? applyTradeEntryToHoldings(holdings, patch.entry, getPersistedMarketQuotes())
      : holdings
    const nextTradeLog = [patch.entry, ...(tradeLog || [])]

    await savePortfolioData(patch.portfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.tradeLog, nextTradeLog)
    await savePortfolioData(patch.portfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.holdings, nextHoldings)

    if (patch.portfolioId === OWNER_PORTFOLIO_ID) {
      try {
        await fetch(API_ENDPOINTS.BRAIN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save-holdings', data: nextHoldings }),
        })
      } catch {
        // local copy is still enough; cloud can catch up later
      }
    }

    applied.add(patch.id)
    changed += 1
  }

  if (applied.size > 0) {
    await saveAppliedTradePatches(Array.from(applied))
  }

  return changed
}

// ── Main ─────────────────────────────────────────────────────────
export default function App() {
  const [ready, setReady] = useState(false)

  // persistent state
  const [holdings, setHoldings] = useState(null)
  const [tradeLog, setTradeLog] = useState(null)
  const [targets, setTargets] = useState(null)
  const [fundamentals, setFundamentals] = useState(null)
  const [watchlist, setWatchlist] = useState(null)
  const [analystReports, setAnalystReports] = useState(null)
  const [reportRefreshMeta, setReportRefreshMeta] = useState(null)
  const [holdingDossiers, setHoldingDossiers] = useState(null)

  const { saved, flashSaved } = useSavedToast()

  // daily analysis
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState('')
  const [dailyReport, setDailyReport] = useState(null)
  const [analysisHistory, setAnalysisHistory] = useState(null)
  const [newsEvents, setNewsEvents] = useState(null)
  const [reversalConditions, setReversalConditions] = useState(null)
  const [strategyBrain, setStrategyBrain] = useState(null)
  const [brainValidation, setBrainValidation] = useState(() => createEmptyBrainValidationStore())
  const [portfolioNotes, setPortfolioNotes] = useState(() => clonePortfolioNotes())
  const [cloudSync, setCloudSync] = useState(false)
  // AutoResearch state（必須在 useEffect 之前宣告）
  const [researching, setResearching] = useState(false)
  const [researchHistory, setResearchHistory] = useState(null)
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
  useCanonicalLocalhostRedirect()
  const {
    tab,
    setTab,
    sortBy,
    setSortBy,
    scanQuery,
    setScanQuery,
    scanFilter,
    setScanFilter,
    filterType,
    setFilterType,
    showReversal,
    setShowReversal,
    dailyExpanded,
    setDailyExpanded,
    expandedStock,
    setExpandedStock,
    expandedNews,
    setExpandedNews,
    reviewingEvent,
    setReviewingEvent,
    reviewForm,
    setReviewForm,
    relayPlanExpanded,
    setRelayPlanExpanded,
    researchTarget,
    setResearchTarget,
    researchResults,
    setResearchResults,
    resetTransientUiState,
  } = useAppShellUiState({
    resetTradeCaptureRef,
  })
  const { appConfirmDialog, requestAppConfirmation, closeAppConfirmDialog } =
    useAppConfirmationDialog()
  const {
    marketPriceCache,
    marketPriceSync,
    lastUpdate,
    setLastUpdate,
    refreshing,
    priceSyncStatusLabel,
    priceSyncStatusTone,
    activePriceSyncAt,
    refreshPrices,
    syncPostClosePrices,
    getMarketQuotesForCodes,
    priceSelfHealRef,
  } = useMarketData({
    holdings,
    watchlist,
    newsEvents,
    portfoliosRef,
    activePortfolioIdRef,
    viewModeRef,
    setHoldings,
    notifySaved: flashSaved,
    requestConfirmation: requestAppConfirmation,
  })
  const applyPortfolioSnapshot = useCallback(
    (snapshot) => {
      const normalizedAnalysisHistory = normalizeAnalysisHistoryEntries(snapshot.analysisHistory)
      setHoldings(applyMarketQuotesToHoldings(snapshot.holdings, marketPriceCache?.prices))
      setTradeLog(snapshot.tradeLog)
      setTargets(snapshot.targets)
      setFundamentals(normalizeFundamentalsStore(snapshot.fundamentals))
      setWatchlist(normalizeWatchlist(snapshot.watchlist))
      setAnalystReports(normalizeAnalystReportsStore(snapshot.analystReports))
      setReportRefreshMeta(normalizeReportRefreshMeta(snapshot.reportRefreshMeta))
      setHoldingDossiers(normalizeHoldingDossiers(snapshot.holdingDossiers))
      setNewsEvents(normalizeNewsEvents(snapshot.newsEvents))
      setAnalysisHistory(normalizedAnalysisHistory)
      setReversalConditions(snapshot.reversalConditions)
      setStrategyBrain(normalizeStrategyBrain(snapshot.strategyBrain))
      setBrainValidation(normalizeBrainValidationStore(snapshot.brainValidation))
      setResearchHistory(snapshot.researchHistory)
      setPortfolioNotes(snapshot.portfolioNotes || clonePortfolioNotes())
      setDailyReport(
        normalizeDailyReportEntry(snapshot.dailyReport) ||
          (normalizedAnalysisHistory.length > 0 ? normalizedAnalysisHistory[0] : null)
      )
    },
    [marketPriceCache]
  )
  const setCloudStateForPortfolio = useCallback((pid, nextViewMode = PORTFOLIO_VIEW_MODE) => {
    const enabled = nextViewMode === PORTFOLIO_VIEW_MODE && pid === OWNER_PORTFOLIO_ID
    cloudSyncStateRef.current = {
      enabled,
      syncedAt: enabled ? readSyncAt('pf-cloud-sync-at') : 0, // readSyncAt 移至 portfolioUtils
    }
    setCloudSync(enabled)
  }, [])
  const flushCurrentPortfolio = useCallback(
    async (pid) => {
      if (!ready || !pid) return
      const liveSnapshot = buildLivePortfolioSnapshot({
        holdings,
        tradeLog,
        targets,
        fundamentals,
        watchlist,
        analystReports,
        reportRefreshMeta,
        holdingDossiers,
        newsEvents,
        analysisHistory,
        dailyReport,
        reversalConditions,
        strategyBrain,
        researchHistory,
        portfolioNotes,
      })
      await Promise.all(
        Object.entries(liveSnapshot)
          .map(([alias, value]) => {
            const suffix = PORTFOLIO_ALIAS_TO_SUFFIX[alias]
            return suffix ? savePortfolioData(pid, suffix, value) : null
          }) // savePortfolioData 移至 portfolioUtils
          .filter(Boolean)
      )
      await save(ACTIVE_PORTFOLIO_KEY, pid)
      await save(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE)
    },
    [
      ready,
      holdings,
      tradeLog,
      targets,
      fundamentals,
      watchlist,
      analystReports,
      reportRefreshMeta,
      holdingDossiers,
      newsEvents,
      analysisHistory,
      dailyReport,
      reversalConditions,
      strategyBrain,
      researchHistory,
      portfolioNotes,
    ]
  )
  const loadPortfolio = useCallback(
    async (pid, nextViewMode = PORTFOLIO_VIEW_MODE) => {
      const snapshot = await loadPortfolioSnapshot(pid)
      portfolioSetterRef.current.setActivePortfolioId(pid)
      portfolioSetterRef.current.setViewMode(nextViewMode)
      applyPortfolioSnapshot(snapshot) // applyPortfolioSnapshot 移至 portfolioUtils
      setCloudStateForPortfolio(pid, nextViewMode) // setCloudStateForPortfolio 移至 portfolioUtils
      return snapshot
    },
    [applyPortfolioSnapshot, setCloudStateForPortfolio]
  )

  const {
    portfolios,
    setPortfolios,
    activePortfolioId,
    setActivePortfolioId,
    viewMode,
    setViewMode,
    portfolioSwitching,
    showPortfolioManager,
    setShowPortfolioManager,
    portfolioTransitionRef,
    portfolioSummaries,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    portfolioEditor,
    portfolioDeleteDialog,
    switchPortfolio,
    openOverview,
    exitOverview,
  } = usePortfolioManagement({
    ready,
    initialPortfolios: [],
    initialActivePortfolioId: OWNER_PORTFOLIO_ID,
    initialViewMode: PORTFOLIO_VIEW_MODE,
    activeHoldings: holdings,
    activeNewsEvents: newsEvents,
    activePortfolioNotes: portfolioNotes,
    marketPriceCache,
    flushCurrentPortfolio,
    resetTransientUiState,
    loadPortfolio,
    notifySaved: flashSaved,
  })

  const canPersistPortfolioData = ready && viewMode === PORTFOLIO_VIEW_MODE && !portfolioSwitching
  const canUseCloud = viewMode === PORTFOLIO_VIEW_MODE && activePortfolioId === OWNER_PORTFOLIO_ID
  useAppRuntimeSyncRefs({
    activePortfolioIdRef,
    activePortfolioId,
    viewModeRef,
    viewMode,
    portfoliosRef,
    portfolios,
    portfolioSetterRef,
    setActivePortfolioId,
    setViewMode,
    bootRuntimeRef,
    marketPriceCache,
    applyPortfolioSnapshot,
    setPortfolios,
    portfolioTransitionRef,
  })

  usePortfolioBootstrap({
    bootRuntimeRef,
    setReady,
    setCloudSync,
    cloudSyncStateRef,
    setHoldings,
    setStrategyBrain, // setStrategyBrain 移至 brainRuntime
    setNewsEvents,
    setAnalysisHistory,
    setDailyReport,
    setResearchHistory,
    migrateLegacyPortfolioStorageIfNeeded,
    seedJinlianchengIfNeeded,
    ensurePortfolioRegistry,
    applyTradeBackfillPatchesIfNeeded, // applyTradeBackfillPatchesIfNeeded 移至 portfolioUtils
    loadPortfolioSnapshot,
    readSyncAt,
    writeSyncAt,
    shouldAdoptCloudHoldings,
    normalizeHoldings,
    buildHoldingPriceHints, // buildHoldingPriceHints 移至 holdings
    getPortfolioFallback,
    savePortfolioData,
    normalizeStrategyBrain,
    normalizeNewsEvents,
    normalizeAnalysisHistoryEntries,
    normalizeDailyReportEntry,
  })
  // persistMarketPriceState 移至 marketDataUtils
  usePortfolioPersistence({
    activePortfolioId,
    canPersistPortfolioData,
    canUseCloud,
    tab,
    holdings,
    tradeLog,
    targets,
    fundamentals,
    watchlist,
    analystReports,
    reportRefreshMeta,
    holdingDossiers,
    newsEvents,
    analysisHistory,
    dailyReport,
    reversalConditions,
    strategyBrain,
    brainValidation,
    researchHistory,
    portfolioNotes,
    marketPriceCache,
    marketPriceSync,
    setHoldingDossiers,
    setAnalysisHistory,
    setResearchHistory,
    notifySaved: flashSaved,
    cloudSyncStateRef,
    cloudSaveTimersRef,
    normalizeHoldings,
    savePortfolioData,
    buildHoldingDossiers, // buildHoldingDossiers 移至 dossierUtils
    applyMarketQuotesToHoldings,
    normalizeHoldingDossiers,
    normalizeAnalysisHistoryEntries,
    readSyncAt,
    writeSyncAt,
  })

  const { updateTargetPrice, updateAlert, upsertTargetReport, upsertFundamentalsEntry } =
    usePortfolioDossierActions({
      marketQuotes: marketPriceCache?.prices || null,
      setHoldings,
      setTargets,
      setFundamentals,
      flashSaved,
      toSlashDate,
    })
  const { upsertWatchlist: handleWatchlistUpsert, removeWatchlist: handleWatchlistDelete } =
    useWatchlistActions({
      setWatchlist,
    })
  const { updateReversal, cancelReview } = useTransientUiActions({
    setReversalConditions,
    flashSaved,
    toSlashDate,
    setReviewingEvent,
    setReviewForm,
    createDefaultReviewForm,
  })
  useEventLifecycleSync({
    activePortfolioId,
    ready,
    viewMode,
    tab,
    newsEvents,
    setNewsEvents,
    portfolioTransitionRef,
    getMarketQuotesForCodes,
    normalizeNewsEvents,
    getEventStockCodes,
    parseSlashDate,
    toSlashDate,
    appendPriceHistory,
  })

  useEffect(() => {
    if (!ready || viewMode !== PORTFOLIO_VIEW_MODE) return
    syncPostClosePrices({ silent: true }).catch((err) => {
      console.warn('收盤價靜默同步失敗:', err)
    })
  }, [ready, viewMode, activePortfolioId, syncPostClosePrices])

  // derived
  const {
    H,
    W,
    dossierByCode,
    totalVal,
    totalCost,
    totalPnl,
    retPct,
    todayMarketClock,
    holdingsIntegrityIssues,
    shouldTriggerPostCloseSelfHeal,
    overviewPortfolios,
    overviewTotalValue,
    overviewTotalPnl,
    displayedTotalPnl,
    displayedRetPct,
    overviewDuplicateHoldings,
    overviewPendingItems,
    urgentCount,
    todayAlertSummary,
    watchlistRows,
    watchlistFocus,
    showRelayPlan,
    top5,
    winners,
    losers,
    attentionCount,
    pendingCount,
    targetUpdateCount,
    dataRefreshRows,
    todayRefreshKey,
    reportRefreshCandidates,
  } = usePortfolioDerivedData({
    holdings,
    watchlist,
    sortBy,
    holdingDossiers,
    targets,
    fundamentals,
    analystReports,
    newsEvents,
    researchHistory,
    strategyBrain,
    marketPriceCache,
    marketPriceSync,
    activePortfolioId,
    portfolioSummaries,
    viewMode,
    portfolioNotes,
    reportRefreshMeta,
    helpers: {
      normalizeHoldingDossiers: (dossiers) => normalizeHoldingDossiers(dossiers),
      buildHoldingDossiers: (data) => buildHoldingDossiers(data),
      getHoldingMarketValue: (item) => getHoldingMarketValue(item),
      getHoldingCostBasis: (item) => getHoldingCostBasis(item),
      getHoldingUnrealizedPnl: (item) => getHoldingUnrealizedPnl(item),
      getHoldingReturnPct: (item) => getHoldingReturnPct(item),
      applyMarketQuotesToHoldings: (rows, quotes) => applyMarketQuotesToHoldings(rows, quotes),
      clonePortfolioNotes: () => clonePortfolioNotes(),
      normalizeNewsEvents: (items) => normalizeNewsEvents(items),
      getEventStockCodes: (event) => getEventStockCodes(event),
      isClosedEvent: (event) => isClosedEvent(event),
      parseFlexibleDate: (value) => parseFlexibleDate(value),
      todayStorageDate: () => todayStorageDate(),
      formatDateToStorageDate,
      getTaipeiClock, // getTaipeiClock 移至 marketDataUtils
      parseStoredDate,
      readStorageValue,
      pfKey,
      getPortfolioFallback,
    },
    constants: {
      OWNER_PORTFOLIO_ID,
      PORTFOLIO_VIEW_MODE,
      OVERVIEW_VIEW_MODE,
      POST_CLOSE_SYNC_MINUTES,
      RELAY_PLAN_CODES,
      STOCK_META,
      C,
    },
  })

  const {
    reportRefreshing,
    reportRefreshStatus,
    enrichingResearchCode,
    refreshAnalystReports,
    enrichResearchToDossier,
  } = useReportRefreshWorkflow({
    holdings: H,
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
    toSlashDate,
  })
  useEffect(() => {
    refreshAnalystReportsRef.current = refreshAnalystReports
  }, [refreshAnalystReports])

  useEffect(() => {
    if (!ready || viewMode !== PORTFOLIO_VIEW_MODE) return
    if (!shouldTriggerPostCloseSelfHeal) return

    const healKey = `${activePortfolioId}:${todayMarketClock.marketDate}`
    if (priceSelfHealRef.current[healKey]) return
    priceSelfHealRef.current[healKey] = true

    syncPostClosePrices({ silent: true, force: true }).catch((err) => {
      console.warn('收盤價自我修復同步失敗:', err)
    })
  }, [
    activePortfolioId,
    ready,
    shouldTriggerPostCloseSelfHeal,
    todayMarketClock.isWeekend,
    todayMarketClock.marketDate,
    todayMarketClock.minutes,
    viewMode,
    priceSelfHealRef,
    syncPostClosePrices,
  ])
  useEffect(() => {
    // REPORT_REFRESH_DAILY_LIMIT 移至 constants
    let mounted = true
    const runRefresh = async () => {
      if (!ready || viewMode !== PORTFOLIO_VIEW_MODE || tab !== 'research' || reportRefreshing)
        return
      if (reportRefreshMeta?.__daily?.date === todayRefreshKey) return
      if (reportRefreshCandidates.length === 0) return
      try {
        await refreshAnalystReportsRef.current({ silent: true })
      } catch (err) {
        if (mounted) console.error('自動刷新公開報告失敗:', err)
      }
    }
    runRefresh()
    return () => {
      mounted = false
    }
  }, [
    ready,
    viewMode,
    tab, // REPORT_REFRESH_DAILY_LIMIT 移至 constants
    reportRefreshing,
    reportRefreshMeta,
    todayRefreshKey,
    reportRefreshCandidates.length,
  ])

  const resolvedNewsEvents = resolveRuntimeNewsEvents(newsEvents, NEWS_EVENTS)
  const filteredEvents = filterEventsByType({
    newsEvents,
    fallbackEvents: NEWS_EVENTS,
    filterType,
    allFilterLabel: APP_LABELS.allFilter,
  })

  // ── 每日收盤分析 ─────────────────────────────────────────────────
  const { runDailyAnalysis } = useDailyAnalysisWorkflow({
    analyzing,
    setAnalyzing,
    setAnalyzeStep,
    holdings: H,
    losers,
    newsEvents,
    defaultNewsEvents: NEWS_EVENTS,
    analysisHistory,
    strategyBrain,
    portfolioNotes,
    reversalConditions,
    reportRefreshMeta,
    todayRefreshKey,
    dossierByCode,
    activePortfolioId,
    canUseCloud,
    getMarketQuotesForCodes,
    resolveHoldingPrice,
    getHoldingUnrealizedPnl,
    getHoldingReturnPct,
    buildDailyHoldingDossierContext,
    formatPortfolioNotesContext,
    formatBrainChecklistsForPrompt,
    formatBrainRulesForValidationPrompt,
    normalizeStrategyBrain,
    createEmptyBrainAudit,
    ensureBrainAuditCoverage,
    enforceTaiwanHardGatesOnBrainAudit,
    mergeBrainWithAuditLifecycle,
    appendBrainValidationCases,
    normalizeHoldings,
    isClosedEvent,
    toSlashDate,
    setDailyReport,
    setAnalysisHistory,
    setStrategyBrain,
    setBrainValidation,
    setHoldings,
    setLastUpdate,
    notifySaved: flashSaved,
    refreshAnalystReportsRef,
  })

  // ── 風險壓力測試 ─────────────────────────────────────────────────
  const [stressTesting, setStressTesting] = useState(false)
  const [stressResult, setStressResult] = useState(null)
  const { runStressTest } = useStressTestWorkflow({
    stressTesting,
    analyzing,
    setStressTesting,
    setAnalyzeStep,
    holdings: H,
    dossierByCode,
    getMarketQuotesForCodes,
    resolveHoldingPrice,
    getHoldingUnrealizedPnl,
    getHoldingReturnPct,
    buildDailyHoldingDossierContext,
    toSlashDate,
    setStressResult,
  })

  // ── 事件復盤 ─────────────────────────────────────────────────────
  const { submitReview } = useEventReviewWorkflow({
    newsEvents,
    defaultNewsEvents: NEWS_EVENTS,
    reviewForm,
    setNewsEvents,
    setReviewingEvent,
    setReviewForm,
    flashSaved,
    activePortfolioId,
    portfolios,
    strategyBrain,
    portfolioNotes,
    dossierByCode,
    setStrategyBrain,
    setBrainValidation,
    toSlashDate,
  })

  const { copyWeeklyReport } = useWeeklyReportClipboard({
    holdings: H,
    watchlist: W,
    analysisHistory,
    newsEvents: resolvedNewsEvents,
    strategyBrain,
    totalCost,
    totalVal,
    totalPnl,
    retPct,
    isClosedEvent,
    resolveHoldingPrice,
    getHoldingUnrealizedPnl,
    getHoldingReturnPct,
    brainRuleSummary,
    flashSaved,
  })

  // 收盤分析完全手動觸發，不自動執行

  const tradeCapture = useTradeCaptureRuntime({
    holdings: holdings || [],
    tradeLog: tradeLog || [],
    marketQuotes: marketPriceCache?.prices || null,
    setHoldings,
    setTradeLog,
    upsertTargetReport,
    upsertFundamentalsEntry,
    applyTradeEntryToHoldings,
    createDefaultFundamentalDraft,
    toSlashDate,
    flashSaved,
    afterSubmit: ({ remainingUploads }) => {
      if (remainingUploads === 0) {
        setTab('holdings')
      }
    },
  })
  useEffect(() => {
    resetTradeCaptureRef.current = tradeCapture.resetTradeCapture
  }, [tradeCapture.resetTradeCapture])

  const { runResearch } = useResearchWorkflow({
    researching,
    setResearching,
    setResearchTarget,
    holdings: H,
    portfolioHoldings: H,
    dossierByCode,
    stockMeta: STOCK_META,
    strategyBrain,
    portfolioNotes,
    canUseCloud,
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
    mergeBrainPreservingCoachLessons,
  })

  const livePortfolioSnapshot = buildLivePortfolioSnapshot({
    holdings,
    tradeLog,
    targets,
    fundamentals,
    watchlist,
    analystReports,
    reportRefreshMeta,
    holdingDossiers,
    newsEvents,
    analysisHistory,
    dailyReport,
    reversalConditions,
    strategyBrain,
    researchHistory,
    portfolioNotes,
  })
  const { backupFileInputRef, exportLocalBackup, importLocalBackup } = useLocalBackupWorkflow({
    portfolios,
    activePortfolioId,
    viewMode,
    marketQuotes: marketPriceCache?.prices || null,
    requestConfirmation: requestAppConfirmation,
    applyPortfolioSnapshot,
    portfolioTransitionRef,
    cloudSyncStateRef,
    setPortfolios,
    setActivePortfolioId,
    setViewMode,
    setCloudSync,
    flashSaved,
    liveSnapshot: livePortfolioSnapshot,
  })

  if (!ready)
    return (
      <div
        style={{
          background: C.bg,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.textMute,
          fontFamily: 'sans-serif',
          fontSize: 13,
        }}
      >
        {APP_LOADING_MESSAGE}
      </div>
    )

  const portfolioTabs = buildPortfolioTabs({ urgentCount, analyzing, researching })

  return (
    <div
      style={{
        background: C.bg,
        minHeight: '100vh',
        color: C.text,
        fontFamily: "'Inter','Noto Sans TC',system-ui,sans-serif",
        paddingBottom: 40,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        /* Global styles moved to a separate CSS file or a dedicated style component if needed */
      `}</style>

      <ErrorBoundary
        scope="header"
        title={APP_ERROR_BOUNDARY_COPY.header.title}
        description={APP_ERROR_BOUNDARY_COPY.header.description}
      >
        <Header
          C={C}
          cloudSync={cloudSync}
          saved={saved}
          refreshPrices={refreshPrices}
          refreshing={refreshing}
          copyWeeklyReport={copyWeeklyReport}
          exportLocalBackup={exportLocalBackup}
          backupFileInputRef={backupFileInputRef}
          importLocalBackup={importLocalBackup}
          priceSyncStatusTone={priceSyncStatusTone}
          priceSyncStatusLabel={priceSyncStatusLabel}
          activePriceSyncAt={activePriceSyncAt}
          lastUpdate={lastUpdate}
          pc={pc}
          displayedTotalPnl={displayedTotalPnl}
          displayedRetPct={displayedRetPct}
          activePortfolioId={activePortfolioId}
          switchPortfolio={switchPortfolio}
          ready={ready}
          portfolioSwitching={portfolioSwitching}
          portfolioSummaries={portfolioSummaries}
          createPortfolio={createPortfolio}
          viewMode={viewMode}
          exitOverview={exitOverview}
          openOverview={openOverview}
          showPortfolioManager={showPortfolioManager}
          setShowPortfolioManager={setShowPortfolioManager}
          renamePortfolio={renamePortfolio}
          deletePortfolio={deletePortfolio}
          OWNER_PORTFOLIO_ID={OWNER_PORTFOLIO_ID}
          overviewTotalValue={overviewTotalValue}
          portfolioNotes={portfolioNotes}
          setPortfolioNotes={setPortfolioNotes}
          PORTFOLIO_VIEW_MODE={PORTFOLIO_VIEW_MODE}
          OVERVIEW_VIEW_MODE={OVERVIEW_VIEW_MODE}
          urgentCount={urgentCount}
          todayAlertSummary={todayAlertSummary}
          TABS={portfolioTabs}
          tab={tab}
          setTab={setTab}
          portfolioEditor={portfolioEditor}
          portfolioDeleteDialog={portfolioDeleteDialog}
        />
      </ErrorBoundary>

      <div className="app-shell" style={{ padding: '10px 14px' }}>
        <AppPanels
          viewMode={viewMode}
          overviewViewMode={OVERVIEW_VIEW_MODE}
          tab={tab}
          errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
          overviewProps={{
            portfolioCount: overviewPortfolios.length,
            totalValue: overviewTotalValue,
            totalPnl: overviewTotalPnl,
            portfolios: overviewPortfolios,
            activePortfolioId,
            duplicateHoldings: overviewDuplicateHoldings,
            pendingItems: overviewPendingItems,
            onExit: exitOverview,
            onSwitch: switchPortfolio,
          }}
          holdingsProps={{
            holdings,
            totalVal,
            totalCost,
            winners,
            losers,
            top5,
            holdingsIntegrityIssues,
            showReversal,
            setShowReversal,
            reversalConditions,
            reviewingEvent,
            setReviewingEvent,
            updateReversal,
            attentionCount,
            pendingCount,
            targetUpdateCount,
            scanQuery,
            setScanQuery,
            scanFilter,
            setScanFilter,
            sortBy,
            setSortBy,
            expandedStock,
            setExpandedStock,
          }}
          holdingsTableProps={{
            holdings,
            expandedStock,
            setExpandedStock,
            onUpdateTarget: updateTargetPrice,
            onUpdateAlert: updateAlert,
          }}
          watchlistProps={{
            watchlistFocus,
            watchlistRows,
            expandedStock,
            setExpandedStock,
            onUpsertItem: handleWatchlistUpsert,
            handleWatchlistDelete,
            formatEventStockOutcomeLine,
          }}
          eventsProps={{
            showRelayPlan,
            relayPlanExpanded,
            setRelayPlanExpanded,
            filterType,
            setFilterType,
            filteredEvents,
          }}
          dailyProps={{
            dailyReport,
            analyzing,
            analyzeStep,
            stressResult,
            stressTesting,
            dailyExpanded,
            setDailyExpanded,
            runDailyAnalysis,
            runStressTest,
            closeStressResult: () => setStressResult(null),
            newsEvents,
            setTab,
            setExpandedNews,
            expandedStock,
            setExpandedStock,
            strategyBrain,
          }}
          researchProps={{
            holdings,
            researching,
            researchTarget,
            reportRefreshing,
            reportRefreshStatus,
            dataRefreshRows,
            researchResults,
            researchHistory,
            enrichingResearchCode,
            STOCK_META,
            IND_COLOR,
            onEvolve: () => runResearch('evolve'),
            onRefresh: () => refreshAnalystReports({ force: true }),
            onResearch: runResearch,
            onEnrich: enrichResearchToDossier,
            onSelectHistory: setResearchResults,
          }}
          tradeProps={tradeCapture}
          logProps={{ tradeLog }}
          newsProps={{
            newsEvents,
            reviewingEvent,
            reviewForm,
            setReviewForm,
            submitReview,
            cancelReview,
            setExpandedNews,
            expandedNews,
            setTab,
            setReviewingEvent,
            createDefaultReviewForm,
          }}
        />
      </div>
      <ConfirmDialog
        open={appConfirmDialog.open}
        title={appConfirmDialog.title}
        message={appConfirmDialog.message}
        confirmLabel={appConfirmDialog.confirmLabel}
        cancelLabel={appConfirmDialog.cancelLabel}
        tone={appConfirmDialog.tone}
        onConfirm={() => closeAppConfirmDialog(true)}
        onCancel={() => closeAppConfirmDialog(false)}
      />
    </div>
  )
}
