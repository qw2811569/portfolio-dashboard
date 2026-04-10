import { C } from '../theme.js'
import { IND_COLOR, STOCK_META } from '../seedData.js'
import { NEWS_EVENTS, RELAY_PLAN_CODES } from '../seedDataEvents.js'
import { useAppConfirmationDialog } from './useAppConfirmationDialog.js'
import { useSavedToast } from './useSavedToast.js'
import { useAppShellUiState } from './useAppShellUiState.js'
import { useCanonicalLocalhostRedirect } from './useCanonicalLocalhostRedirect.js'
import {
  pickPnlTone,
  composeAppShellFrameRuntime,
  composeAppRuntimeWorkflowInput,
  composeAppRuntimeHeaderInput,
} from './useAppRuntimeComposer.js'
import { useThesisTracking } from './useThesisTracking.js'
import { useAppRuntimeWorkflows } from './useAppRuntimeWorkflows.js'
import { usePostCloseSilentSync } from './usePostCloseSilentSync.js'
import { useMorningNoteRuntime } from './useMorningNoteRuntime.js'
import { useAppRuntimeCoreLifecycle } from './useAppRuntimeCoreLifecycle.js'
import { useAppRuntimeCoreArgs, useAppRuntimeWorkflowArgs } from './useAppRuntimeArgs.js'
import { useAppRuntimePortfolioDerivedData } from './useAppRuntimePortfolioDerivedData.js'
import { useAppRuntimeHeaderProps } from './useAppRuntimeHeaderProps.js'
import { useAppRuntimeState } from './useAppRuntimeState.js'
import {
  APP_RUNTIME_CORE_LIFECYCLE_HELPERS,
  APP_RUNTIME_WORKFLOW_HELPERS,
} from './useAppRuntimeHelperCatalog.js'
import {
  OWNER_PORTFOLIO_ID,
  PORTFOLIO_VIEW_MODE,
  OVERVIEW_VIEW_MODE,
  POST_CLOSE_SYNC_MINUTES,
} from '../constants.js'
import { normalizeHoldingDossiers } from '../lib/brainRuntime.js'
import {
  getHoldingCostBasis,
  getHoldingMarketValue,
  getHoldingUnrealizedPnl,
  getHoldingReturnPct,
  applyMarketQuotesToHoldings,
} from '../lib/holdings.js'
import {
  formatDateToStorageDate,
  getTaipeiClock,
  parseStoredDate,
  todayStorageDate,
} from '../lib/datetime.js'
import { buildHoldingDossiers } from '../lib/dossierUtils.js'
import {
  getEventStockCodes,
  isClosedEvent,
  normalizeNewsEvents,
  parseFlexibleDate,
} from '../lib/eventUtils.js'
import {
  clonePortfolioNotes,
  getPortfolioFallback,
  pfKey,
  readStorageValue,
} from '../lib/portfolioUtils.js'
import { APP_ERROR_BOUNDARY_COPY, APP_LOADING_MESSAGE } from '../lib/appMessages.js'

const PORTFOLIO_DERIVED_HELPERS = {
  normalizeHoldingDossiers,
  buildHoldingDossiers,
  getHoldingMarketValue,
  getHoldingCostBasis,
  getHoldingUnrealizedPnl,
  getHoldingReturnPct,
  applyMarketQuotesToHoldings,
  clonePortfolioNotes,
  normalizeNewsEvents,
  getEventStockCodes,
  isClosedEvent,
  parseFlexibleDate,
  todayStorageDate,
  formatDateToStorageDate,
  getTaipeiClock,
  parseStoredDate,
  readStorageValue,
  pfKey,
  getPortfolioFallback,
}

const PORTFOLIO_DERIVED_CONSTANTS = {
  OWNER_PORTFOLIO_ID,
  PORTFOLIO_VIEW_MODE,
  OVERVIEW_VIEW_MODE,
  POST_CLOSE_SYNC_MINUTES,
  RELAY_PLAN_CODES,
  STOCK_META,
  C,
}

const pickHeaderPnlTone = (value) => pickPnlTone(value, C)

function buildHeaderWorkflowCue(context) {
  if (!context || typeof context !== 'object') return null

  const label = typeof context.nextActionLabel === 'string' ? context.nextActionLabel.trim() : ''
  if (!label) return null

  const reason =
    typeof context.nextActionReason === 'string' ? context.nextActionReason.trim() : ''

  if ((context.refreshBacklogCount ?? 0) > 0) {
    return {
      label,
      reason,
      targetTab: 'research',
      actionLabel: '前往補資料',
    }
  }

  if ((context.pendingCount ?? 0) > 0 || (context.activeEventCount ?? 0) > 0) {
    return {
      label,
      reason,
      targetTab: 'events',
      actionLabel: '前往事件',
    }
  }

  if (context.focus) {
    return {
      label,
      reason,
      targetTab: 'watchlist',
      actionLabel: '前往焦點標的',
    }
  }

  if (context.latestInsightSummary) {
    return {
      label,
      reason,
      targetTab: 'daily',
      actionLabel: '前往收盤分析',
    }
  }

  return {
    label,
    reason,
    targetTab: 'holdings',
    actionLabel: '回到持倉',
  }
}

export function useAppRuntime() {
  const {
    ready,
    bootstrapState,
    holdings,
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
    newsEvents,
    strategyBrain,
    portfolioNotes,
    cloudSync,
    researching,
    setResearching,
    researchHistory,
    runtimeState,
    runtimeSetters,
    refs: {
      cloudSaveTimersRef,
      cloudSyncStateRef,
      portfolioSetterRef,
      portfoliosRef,
      activePortfolioIdRef,
      viewModeRef,
      bootRuntimeRef,
      refreshAnalystReportsRef,
      resetTradeCaptureRef,
    },
  } = useAppRuntimeState()
  const { saved, flashSaved } = useSavedToast()

  useCanonicalLocalhostRedirect()

  const appUiState = useAppShellUiState({
    resetTradeCaptureRef,
  })

  const { tab, setTab, sortBy, setReviewingEvent, setReviewForm, resetTransientUiState } =
    appUiState

  const { appConfirmDialog, requestAppConfirmation, closeAppConfirmDialog } =
    useAppConfirmationDialog()

  const coreLifecycleArgs = useAppRuntimeCoreArgs({
    state: runtimeState,
    setters: runtimeSetters,
    ui: {
      tab,
      resetTransientUiState,
      setReviewingEvent,
      setReviewForm,
    },
    runtime: {
      flashSaved,
      requestAppConfirmation,
    },
    refs: {
      activePortfolioIdRef,
      viewModeRef,
      portfoliosRef,
      portfolioSetterRef,
      bootRuntimeRef,
      cloudSyncStateRef,
      cloudSaveTimersRef,
    },
    helpers: APP_RUNTIME_CORE_LIFECYCLE_HELPERS,
  })

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
    applyPortfolioSnapshot,
    livePortfolioSnapshot,
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
    canUseCloud,
    updateTargetPrice,
    updateAlert,
    upsertTargetReport,
    upsertFundamentalsEntry,
    handleWatchlistUpsert,
    handleWatchlistDelete,
    updateReversal,
    cancelReview,
  } = useAppRuntimeCoreLifecycle(coreLifecycleArgs)

  const { theses } = useThesisTracking(activePortfolioId)
  const morningNote = useMorningNoteRuntime({ holdings, theses, newsEvents, watchlist })

  usePostCloseSilentSync({
    ready,
    viewMode,
    portfolioViewMode: PORTFOLIO_VIEW_MODE,
    activePortfolioId,
    syncPostClosePrices,
  })

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
  } = useAppRuntimePortfolioDerivedData({
    data: {
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
    },
    helperFns: PORTFOLIO_DERIVED_HELPERS,
    constants: PORTFOLIO_DERIVED_CONSTANTS,
  })

  const workflowArgs = useAppRuntimeWorkflowArgs(
    composeAppRuntimeWorkflowInput({
      runtimeState,
      runtimeSetters,
      coreLifecycle: {
        viewMode,
        activePortfolioId,
        canUseCloud,
        marketPriceCache,
        portfolios,
        setLastUpdate,
        setPortfolios,
        setActivePortfolioId,
        setViewMode,
        upsertTargetReport,
        upsertFundamentalsEntry,
        updateReversal,
        updateTargetPrice,
        updateAlert,
        handleWatchlistUpsert,
        handleWatchlistDelete,
        cancelReview,
        switchPortfolio,
        exitOverview,
        getMarketQuotesForCodes,
      },
      portfolioDerived: {
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
        overviewDuplicateHoldings,
        overviewPendingItems,
        winners,
        losers,
        top5,
        attentionCount,
        pendingCount,
        targetUpdateCount,
        dataRefreshRows,
        todayRefreshKey,
        reportRefreshCandidates,
        watchlistRows,
        watchlistFocus,
        showRelayPlan,
      },
      uiState: appUiState,
      asyncState: {
        analyzing,
        setAnalyzing,
        analyzeStep,
        setAnalyzeStep,
        researching,
        setResearching,
      },
      runtime: {
        flashSaved,
        requestAppConfirmation,
      },
      refs: {
        priceSelfHealRef,
        syncPostClosePrices,
        refreshAnalystReportsRef,
        resetTradeCaptureRef,
        applyPortfolioSnapshot,
        portfolioTransitionRef,
        cloudSyncStateRef,
        livePortfolioSnapshot,
      },
      helpers: APP_RUNTIME_WORKFLOW_HELPERS,
      resources: {
        defaultNewsEvents: NEWS_EVENTS,
        stockMeta: STOCK_META,
        indColor: IND_COLOR,
        morningNote,
      },
      portfolioViewMode: PORTFOLIO_VIEW_MODE,
    })
  )

  const {
    copyWeeklyReport,
    backupFileInputRef,
    exportLocalBackup,
    importLocalBackup,
    portfolioPanelsData,
    portfolioPanelsActions,
  } = useAppRuntimeWorkflows(workflowArgs)

  const workflowCue = buildHeaderWorkflowCue(portfolioPanelsData?.holdings?.operatingContext)

  const headerProps = useAppRuntimeHeaderProps(
    composeAppRuntimeHeaderInput({
      theme: {
        C,
        pc: pickHeaderPnlTone,
      },
      sync: {
        cloudSync,
        saved,
        copyWeeklyReport,
        exportLocalBackup,
        backupFileInputRef,
        importLocalBackup,
      },
      coreLifecycle: {
        refreshPrices,
        refreshing,
        priceSyncStatusTone,
        priceSyncStatusLabel,
        activePriceSyncAt,
        lastUpdate,
        activePortfolioId,
        switchPortfolio,
        portfolioSwitching,
        portfolioSummaries,
        createPortfolio,
        viewMode,
        exitOverview,
        openOverview,
        showPortfolioManager,
        setShowPortfolioManager,
        renamePortfolio,
        deletePortfolio,
        portfolioEditor,
        portfolioDeleteDialog,
      },
      portfolioDerived: {
        displayedTotalPnl,
        displayedRetPct,
        overviewTotalValue,
        urgentCount,
        todayAlertSummary,
      },
      notes: {
        portfolioNotes,
        setPortfolioNotes: runtimeSetters.setPortfolioNotes,
      },
      asyncState: {
        analyzing,
        researching,
      },
      tabs: {
        tab,
        setTab,
        workflowCue,
      },
      constants: {
        OWNER_PORTFOLIO_ID,
        PORTFOLIO_VIEW_MODE,
        OVERVIEW_VIEW_MODE,
      },
      ready,
    })
  )

  return composeAppShellFrameRuntime({
    ready,
    loadingMessage: APP_LOADING_MESSAGE,
    loadingState: bootstrapState,
    headerBoundaryCopy: APP_ERROR_BOUNDARY_COPY.header,
    headerProps,
    panelsData: portfolioPanelsData,
    panelsActions: portfolioPanelsActions,
    panels: {
      viewMode,
      overviewViewMode: OVERVIEW_VIEW_MODE,
      tab,
      errorBoundaryCopy: APP_ERROR_BOUNDARY_COPY,
    },
    confirmDialog: appConfirmDialog,
    closeAppConfirmDialog,
  })
}
