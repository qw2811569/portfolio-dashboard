import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  useAppBootRuntimeComposer,
  useAppLifecycleRuntimeComposer,
  usePortfolioManagementComposer,
  composeAppRuntimeCoreLifecycleArgs,
  composeAppRuntimeWorkflowsArgs,
  composeAppRuntimeWorkflowInput,
  composeAppRuntimeHeaderInput,
  pickPnlTone,
  buildFundamentalDraft,
  composePortfolioDerivedDataInput,
  composeAppHeaderProps,
  composeAppShellFrameRuntime,
  composeReportRefreshWorkflowArgs,
  composeDailyAnalysisWorkflowArgs,
  composeStressTestWorkflowArgs,
  composeEventReviewWorkflowArgs,
  composeWeeklyReportClipboardArgs,
  composeTradeCaptureRuntimeArgs,
  composeResearchWorkflowArgs,
  composeLocalBackupWorkflowArgs,
  composePortfolioPanelsContextInput,
} from '../../src/hooks/useAppRuntimeComposer.js'

describe('hooks/useAppRuntimeComposer.js', () => {
  it('composes boot runtime args with shared refs and persistence setters', () => {
    const result = renderHook(() =>
      useAppBootRuntimeComposer({
        holdings: [{ code: '2330' }],
        watchlist: [{ code: '2454' }],
        newsEvents: [{ id: 'evt-1' }],
        portfoliosRef: { current: [] },
        activePortfolioIdRef: { current: 'me' },
        viewModeRef: { current: 'portfolio' },
        setHoldings: vi.fn(),
        flashSaved: vi.fn(),
        requestAppConfirmation: vi.fn(),
        ready: true,
        marketPriceCache: { prices: { 2330: { price: 980 } } },
        cloudSyncStateRef: { current: { enabled: false, syncedAt: 0 } },
        portfolioSetterRef: { current: { setActivePortfolioId: vi.fn(), setViewMode: vi.fn() } },
        setCloudSync: vi.fn(),
        tradeLog: [],
        targets: {},
        fundamentals: {},
        analystReports: {},
        reportRefreshMeta: {},
        holdingDossiers: {},
        analysisHistory: [],
        dailyReport: null,
        reversalConditions: {},
        strategyBrain: {},
        researchHistory: [],
        portfolioNotes: {},
        setTradeLog: vi.fn(),
        setTargets: vi.fn(),
        setFundamentals: vi.fn(),
        setWatchlist: vi.fn(),
        setAnalystReports: vi.fn(),
        setReportRefreshMeta: vi.fn(),
        setHoldingDossiers: vi.fn(),
        setNewsEvents: vi.fn(),
        setAnalysisHistory: vi.fn(),
        setReversalConditions: vi.fn(),
        setStrategyBrain: vi.fn(),
        setBrainValidation: vi.fn(),
        setResearchHistory: vi.fn(),
        setPortfolioNotes: vi.fn(),
        setDailyReport: vi.fn(),
        normalizeAnalysisHistoryEntries: vi.fn(),
        applyMarketQuotesToHoldings: vi.fn(),
        normalizeFundamentalsStore: vi.fn(),
        normalizeWatchlist: vi.fn(),
        normalizeAnalystReportsStore: vi.fn(),
        normalizeReportRefreshMeta: vi.fn(),
        normalizeHoldingDossiers: vi.fn(),
        normalizeNewsEvents: vi.fn(),
        normalizeStrategyBrain: vi.fn(),
        normalizeBrainValidationStore: vi.fn(),
        normalizeDailyReportEntry: vi.fn(),
        clonePortfolioNotes: vi.fn(),
        loadPortfolioSnapshot: vi.fn(),
        readSyncAt: vi.fn(),
        save: vi.fn(),
        savePortfolioData: vi.fn(),
      })
    )

    expect(result.result.current.marketDataArgs.holdings).toEqual([{ code: '2330' }])
    expect(result.result.current.portfolioSnapshotArgs.watchlist).toEqual([{ code: '2454' }])
  })

  it('composes portfolio management and lifecycle args with cloud flag', () => {
    const management = renderHook(() =>
      usePortfolioManagementComposer({
        ready: true,
        holdings: [{ code: '2330' }],
        newsEvents: [{ id: 'evt-1' }],
        portfolioNotes: { customNotes: 'memo' },
        marketPriceCache: { prices: {} },
        flushCurrentPortfolio: vi.fn(),
        resetTransientUiState: vi.fn(),
        loadPortfolio: vi.fn(),
        flashSaved: vi.fn(),
      })
    )

    expect(management.result.current.initialActivePortfolioId).toBe('me')
    expect(management.result.current.initialViewMode).toBe('portfolio')

    const lifecycle = renderHook(() =>
      useAppLifecycleRuntimeComposer({
        ready: true,
        activePortfolioId: 'me',
        viewMode: 'portfolio',
        portfolioSwitching: false,
        portfolios: [{ id: 'me' }],
        setPortfolios: vi.fn(),
        setActivePortfolioId: vi.fn(),
        setViewMode: vi.fn(),
        activePortfolioIdRef: { current: 'me' },
        viewModeRef: { current: 'portfolio' },
        portfoliosRef: { current: [{ id: 'me' }] },
        portfolioSetterRef: { current: {} },
        bootRuntimeRef: { current: null },
        marketPriceCache: { prices: {} },
        marketPriceSync: {},
        holdings: [],
        tradeLog: [],
        targets: {},
        fundamentals: {},
        watchlist: [],
        analystReports: {},
        reportRefreshMeta: {},
        holdingDossiers: {},
        newsEvents: [],
        analysisHistory: [],
        dailyReport: null,
        reversalConditions: {},
        strategyBrain: {},
        brainValidation: {},
        researchHistory: [],
        portfolioNotes: {},
        tab: 'holdings',
        cloudSyncStateRef: { current: { enabled: false, syncedAt: 0 } },
        cloudSaveTimersRef: { current: {} },
        applyPortfolioSnapshot: vi.fn(),
        portfolioTransitionRef: { current: { isHydrating: false } },
        setReady: vi.fn(),
        setCloudSync: vi.fn(),
        setHoldings: vi.fn(),
        setTargets: vi.fn(),
        setFundamentals: vi.fn(),
        setWatchlist: vi.fn(),
        setHoldingDossiers: vi.fn(),
        setAnalysisHistory: vi.fn(),
        setReversalConditions: vi.fn(),
        setStrategyBrain: vi.fn(),
        setNewsEvents: vi.fn(),
        setDailyReport: vi.fn(),
        setResearchHistory: vi.fn(),
        setReviewingEvent: vi.fn(),
        setReviewForm: vi.fn(),
        flashSaved: vi.fn(),
        createDefaultReviewForm: vi.fn(),
        migrateLegacyPortfolioStorageIfNeeded: vi.fn(),
        seedJinlianchengIfNeeded: vi.fn(),
        ensurePortfolioRegistry: vi.fn(),
        applyTradeBackfillPatchesIfNeeded: vi.fn(),
        loadPortfolioSnapshot: vi.fn(),
        readSyncAt: vi.fn(),
        writeSyncAt: vi.fn(),
        shouldAdoptCloudHoldings: vi.fn(),
        normalizeHoldings: vi.fn(),
        buildHoldingPriceHints: vi.fn(),
        getPortfolioFallback: vi.fn(),
        savePortfolioData: vi.fn(),
        buildHoldingDossiers: vi.fn(),
        applyMarketQuotesToHoldings: vi.fn(),
        normalizeHoldingDossiers: vi.fn(),
        normalizeAnalysisHistoryEntries: vi.fn(),
        normalizeStrategyBrain: vi.fn(),
        normalizeNewsEvents: vi.fn(),
        normalizeDailyReportEntry: vi.fn(),
        toSlashDate: vi.fn(),
        getMarketQuotesForCodes: vi.fn(),
        getEventStockCodes: vi.fn(),
        parseSlashDate: vi.fn(),
        appendPriceHistory: vi.fn(),
      })
    )

    expect(lifecycle.result.current.canUseCloud).toBe(true)
    expect(lifecycle.result.current.portfolioPersistenceArgs.activePortfolioId).toBe('me')
    expect(lifecycle.result.current.eventLifecycleArgs.tab).toBe('holdings')
  })

  it('builds helper/runtime view composers for app shell wiring', () => {
    expect(pickPnlTone(null, { textMute: '#999', up: '#0f0', down: '#f00' })).toBe('#999')
    expect(pickPnlTone(1, { textMute: '#999', up: '#0f0', down: '#f00' })).toBe('#0f0')
    expect(buildFundamentalDraft({ conviction: 'mid' }, { conviction: 'high' })).toEqual({
      conviction: 'high',
    })

    const derivedInput = composePortfolioDerivedDataInput({
      data: {
        holdings: [],
        watchlist: [],
        sortBy: 'pnl',
        holdingDossiers: [],
        targets: {},
        fundamentals: {},
        analystReports: {},
        newsEvents: [],
        researchHistory: [],
        strategyBrain: {},
        marketPriceCache: null,
        marketPriceSync: null,
        activePortfolioId: 'me',
        portfolioSummaries: [],
        viewMode: 'portfolio',
        portfolioNotes: {},
        reportRefreshMeta: {},
      },
      helperFns: {
        normalizeHoldingDossiers: vi.fn(),
        buildHoldingDossiers: vi.fn(),
        getHoldingMarketValue: vi.fn(),
        getHoldingCostBasis: vi.fn(),
        getHoldingUnrealizedPnl: vi.fn(),
        getHoldingReturnPct: vi.fn(),
        applyMarketQuotesToHoldings: vi.fn(),
        clonePortfolioNotes: vi.fn(),
        normalizeNewsEvents: vi.fn(),
        getEventStockCodes: vi.fn(),
        isClosedEvent: vi.fn(),
        parseFlexibleDate: vi.fn(),
        todayStorageDate: vi.fn(),
        formatDateToStorageDate: vi.fn(),
        getTaipeiClock: vi.fn(),
        parseStoredDate: vi.fn(),
        readStorageValue: vi.fn(),
        pfKey: vi.fn(),
        getPortfolioFallback: vi.fn(),
      },
      constants: {
        OWNER_PORTFOLIO_ID: 'me',
        PORTFOLIO_VIEW_MODE: 'portfolio',
        OVERVIEW_VIEW_MODE: 'overview',
        POST_CLOSE_SYNC_MINUTES: 10,
        RELAY_PLAN_CODES: [],
        STOCK_META: {},
        C: {},
      },
    })

    expect(derivedInput.constants.PORTFOLIO_VIEW_MODE).toBe('portfolio')
    expect(typeof derivedInput.helpers.todayStorageDate).toBe('function')

    const headerProps = composeAppHeaderProps({
      theme: { C: { bg: '#fff' }, pc: vi.fn() },
      sync: {
        cloudSync: true,
        saved: '',
        refreshPrices: vi.fn(),
        refreshing: false,
        copyWeeklyReport: vi.fn(),
        exportLocalBackup: vi.fn(),
        backupFileInputRef: { current: null },
        importLocalBackup: vi.fn(),
        priceSyncStatusTone: 'ok',
        priceSyncStatusLabel: '同步中',
        activePriceSyncAt: null,
        lastUpdate: null,
      },
      pnl: { displayedTotalPnl: 10, displayedRetPct: 2.5 },
      portfolio: {
        activePortfolioId: 'me',
        switchPortfolio: vi.fn(),
        ready: true,
        portfolioSwitching: false,
        portfolioSummaries: [],
        createPortfolio: vi.fn(),
        viewMode: 'portfolio',
        exitOverview: vi.fn(),
        openOverview: vi.fn(),
        showPortfolioManager: false,
        setShowPortfolioManager: vi.fn(),
        renamePortfolio: vi.fn(),
        deletePortfolio: vi.fn(),
      },
      overview: { overviewTotalValue: 123 },
      notes: { portfolioNotes: {}, setPortfolioNotes: vi.fn() },
      tabs: {
        urgentCount: 0,
        todayAlertSummary: '',
        portfolioTabs: [],
        tab: 'holdings',
        setTab: vi.fn(),
      },
      dialogs: { portfolioEditor: null, portfolioDeleteDialog: null },
      constants: {
        OWNER_PORTFOLIO_ID: 'me',
        PORTFOLIO_VIEW_MODE: 'portfolio',
        OVERVIEW_VIEW_MODE: 'overview',
      },
    })

    const runtime = composeAppShellFrameRuntime({
      ready: true,
      loadingMessage: '載入中',
      headerBoundaryCopy: { title: 't', description: 'd' },
      headerProps,
      panelsData: { a: 1 },
      panelsActions: { b: 2 },
      panels: {
        viewMode: 'portfolio',
        overviewViewMode: 'overview',
        tab: 'holdings',
        errorBoundaryCopy: {},
      },
      confirmDialog: {
        open: true,
        title: 'x',
        message: 'y',
        confirmLabel: 'ok',
        cancelLabel: 'cancel',
        tone: 'normal',
      },
      closeAppConfirmDialog: vi.fn(),
    })

    expect(runtime.headerProps).toBe(headerProps)
    expect(runtime.panelsProps.tab).toBe('holdings')
    expect(runtime.confirmDialogProps.open).toBe(true)
  })

  it('flattens grouped args for app runtime core/workflow invocation', () => {
    const coreArgs = composeAppRuntimeCoreLifecycleArgs({
      data: { ready: true, tab: 'holdings' },
      refs: { activePortfolioIdRef: { current: 'me' } },
      setters: { setReady: vi.fn() },
      ui: { setReviewForm: vi.fn() },
      runtime: { flashSaved: vi.fn() },
      helpers: { normalizeHoldings: vi.fn() },
    })

    expect(coreArgs.ready).toBe(true)
    expect(coreArgs.tab).toBe('holdings')
    expect(coreArgs.activePortfolioIdRef.current).toBe('me')
    expect(typeof coreArgs.helpers.normalizeHoldings).toBe('function')

    const workflowArgs = composeAppRuntimeWorkflowsArgs({
      data: { ready: true, tab: 'news' },
      ui: { filterType: '全部' },
      asyncState: { analyzing: false, setAnalyzing: vi.fn() },
      actions: { updateAlert: vi.fn() },
      setters: { setTab: vi.fn() },
      resources: { stockMeta: { 2330: {} } },
      refs: { priceSelfHealRef: { current: null } },
      runtime: { flashSaved: vi.fn() },
      helpers: { resolveHoldingPrice: vi.fn() },
    })

    expect(workflowArgs.tab).toBe('news')
    expect(workflowArgs.filterType).toBe('全部')
    expect(workflowArgs.stockMeta['2330']).toBeDefined()
    expect(typeof workflowArgs.helpers.resolveHoldingPrice).toBe('function')
  })

  it('composes workflow input payload from runtime buckets', () => {
    const workflowInput = composeAppRuntimeWorkflowInput({
      runtimeState: {
        ready: true,
        holdings: [],
        watchlist: [],
      },
      runtimeSetters: {
        setHoldings: vi.fn(),
        setWatchlist: vi.fn(),
      },
      coreLifecycle: {
        viewMode: 'portfolio',
        activePortfolioId: 'me',
        canUseCloud: true,
        marketPriceCache: { prices: {} },
        portfolios: [],
        setLastUpdate: vi.fn(),
        setPortfolios: vi.fn(),
        setActivePortfolioId: vi.fn(),
        setViewMode: vi.fn(),
        upsertTargetReport: vi.fn(),
        upsertFundamentalsEntry: vi.fn(),
        updateReversal: vi.fn(),
        updateTargetPrice: vi.fn(),
        updateAlert: vi.fn(),
        handleWatchlistUpsert: vi.fn(),
        handleWatchlistDelete: vi.fn(),
        cancelReview: vi.fn(),
        switchPortfolio: vi.fn(),
        exitOverview: vi.fn(),
        priceSelfHealRef: { current: null },
        syncPostClosePrices: vi.fn(),
        applyPortfolioSnapshot: vi.fn(),
        portfolioTransitionRef: { current: { isHydrating: false } },
        livePortfolioSnapshot: vi.fn(),
        getMarketQuotesForCodes: vi.fn(),
      },
      portfolioDerived: {
        totalVal: 100,
        todayMarketClock: { date: '2026-03-31' },
      },
      uiState: {
        tab: 'holdings',
        filterType: 'all',
        catalystFilter: '全部',
        scanQuery: '',
        scanFilter: '',
        sortBy: 'value',
        showReversal: false,
        expandedStock: null,
        relayPlanExpanded: false,
        dailyExpanded: false,
        researchTarget: null,
        reviewForm: {},
        reviewingEvent: null,
        expandedNews: new Set(),
        setShowReversal: vi.fn(),
        setScanQuery: vi.fn(),
        setScanFilter: vi.fn(),
        setSortBy: vi.fn(),
        setExpandedStock: vi.fn(),
        setRelayPlanExpanded: vi.fn(),
        setFilterType: vi.fn(),
        setCatalystFilter: vi.fn(),
        setDailyExpanded: vi.fn(),
        setTab: vi.fn(),
        setExpandedNews: vi.fn(),
        setResearchTarget: vi.fn(),
        setResearchResults: vi.fn(),
        setReviewForm: vi.fn(),
        setReviewingEvent: vi.fn(),
        researchResults: null,
      },
      asyncState: {
        analyzing: false,
        setAnalyzing: vi.fn(),
        analyzeStep: '',
        setAnalyzeStep: vi.fn(),
        researching: false,
        setResearching: vi.fn(),
      },
      runtime: {
        flashSaved: vi.fn(),
        requestAppConfirmation: vi.fn(),
      },
      refs: {
        priceSelfHealRef: { current: null },
        syncPostClosePrices: vi.fn(),
        refreshAnalystReportsRef: { current: vi.fn() },
        resetTradeCaptureRef: { current: vi.fn() },
        applyPortfolioSnapshot: vi.fn(),
        portfolioTransitionRef: { current: { isHydrating: false } },
        cloudSyncStateRef: { current: { enabled: false } },
        livePortfolioSnapshot: vi.fn(),
      },
      helpers: {
        resolveHoldingPrice: vi.fn(),
      },
      resources: {
        defaultNewsEvents: [],
        stockMeta: { 2330: {} },
        indColor: {},
        morningNote: { text: 'good morning' },
      },
    })

    expect(workflowInput.state.activePortfolioId).toBe('me')
    expect(workflowInput.state.portfolioViewMode).toBe('portfolio')
    expect(workflowInput.state.morningNote.text).toBe('good morning')
    expect(workflowInput.resources.stockMeta['2330']).toBeDefined()
    expect(workflowInput.refs.priceSelfHealRef.current).toBeNull()
    expect(typeof workflowInput.helpers.getMarketQuotesForCodes).toBe('function')
  })

  it('composes header input payload from runtime buckets', () => {
    const headerInput = composeAppRuntimeHeaderInput({
      theme: { C: { bg: '#fff' }, pc: vi.fn() },
      sync: {
        cloudSync: true,
        saved: 'ok',
        copyWeeklyReport: vi.fn(),
        exportLocalBackup: vi.fn(),
        backupFileInputRef: { current: null },
        importLocalBackup: vi.fn(),
      },
      coreLifecycle: {
        refreshPrices: vi.fn(),
        refreshing: false,
        priceSyncStatusTone: 'ok',
        priceSyncStatusLabel: '同步',
        activePriceSyncAt: null,
        lastUpdate: null,
        activePortfolioId: 'me',
        switchPortfolio: vi.fn(),
        portfolioSwitching: false,
        portfolioSummaries: [],
        createPortfolio: vi.fn(),
        viewMode: 'portfolio',
        exitOverview: vi.fn(),
        openOverview: vi.fn(),
        showPortfolioManager: false,
        setShowPortfolioManager: vi.fn(),
        renamePortfolio: vi.fn(),
        deletePortfolio: vi.fn(),
        portfolioEditor: null,
        portfolioDeleteDialog: null,
      },
      portfolioDerived: {
        displayedTotalPnl: 200,
        displayedRetPct: 5.5,
        overviewTotalValue: 1000,
        urgentCount: 2,
        todayAlertSummary: '2 則提醒',
      },
      notes: {
        portfolioNotes: {},
        setPortfolioNotes: vi.fn(),
      },
      asyncState: {
        analyzing: false,
        researching: true,
      },
      tabs: {
        tab: 'daily',
        setTab: vi.fn(),
      },
      constants: {
        OWNER_PORTFOLIO_ID: 'me',
        PORTFOLIO_VIEW_MODE: 'portfolio',
        OVERVIEW_VIEW_MODE: 'overview',
      },
      ready: true,
    })

    expect(headerInput.portfolio.ready).toBe(true)
    expect(headerInput.tabs.researching).toBe(true)
    expect(headerInput.pnl.displayedRetPct).toBe(5.5)
  })

  it('composes workflow args and panel context input payloads', () => {
    const flashSaved = vi.fn()
    const setTab = vi.fn()

    const refreshArgs = composeReportRefreshWorkflowArgs({
      holdings: [],
      dossierByCode: new Map(),
      analystReports: {},
      reportRefreshMeta: {},
      reportRefreshCandidates: [],
      todayRefreshKey: '2026-03-30',
      upsertTargetReport: vi.fn(),
      upsertFundamentalsEntry: vi.fn(),
      setAnalystReports: vi.fn(),
      setReportRefreshMeta: vi.fn(),
      flashSaved,
      toSlashDate: vi.fn(),
    })

    const dailyArgs = composeDailyAnalysisWorkflowArgs({
      analyzing: false,
      setAnalyzing: vi.fn(),
      setAnalyzeStep: vi.fn(),
      holdings: [],
      losers: [],
      newsEvents: [],
      defaultNewsEvents: [],
      analysisHistory: [],
      strategyBrain: {},
      portfolioNotes: {},
      reversalConditions: {},
      reportRefreshMeta: {},
      todayRefreshKey: '2026-03-30',
      dossierByCode: new Map(),
      activePortfolioId: 'me',
      canUseCloud: true,
      getMarketQuotesForCodes: vi.fn(),
      resolveHoldingPrice: vi.fn(),
      getHoldingUnrealizedPnl: vi.fn(),
      getHoldingReturnPct: vi.fn(),
      buildDailyHoldingDossierContext: vi.fn(),
      formatPortfolioNotesContext: vi.fn(),
      formatBrainChecklistsForPrompt: vi.fn(),
      formatBrainRulesForValidationPrompt: vi.fn(),
      normalizeStrategyBrain: vi.fn(),
      createEmptyBrainAudit: vi.fn(),
      ensureBrainAuditCoverage: vi.fn(),
      enforceTaiwanHardGatesOnBrainAudit: vi.fn(),
      mergeBrainWithAuditLifecycle: vi.fn(),
      appendBrainValidationCases: vi.fn(),
      normalizeHoldings: vi.fn(),
      isClosedEvent: vi.fn(),
      toSlashDate: vi.fn(),
      setDailyReport: vi.fn(),
      setAnalysisHistory: vi.fn(),
      setStrategyBrain: vi.fn(),
      setBrainValidation: vi.fn(),
      setHoldings: vi.fn(),
      setLastUpdate: vi.fn(),
      flashSaved,
    })

    const stressArgs = composeStressTestWorkflowArgs({
      stressTesting: false,
      analyzing: false,
      setStressTesting: vi.fn(),
      setAnalyzeStep: vi.fn(),
      holdings: [],
      dossierByCode: new Map(),
      getMarketQuotesForCodes: vi.fn(),
      resolveHoldingPrice: vi.fn(),
      getHoldingUnrealizedPnl: vi.fn(),
      getHoldingReturnPct: vi.fn(),
      buildDailyHoldingDossierContext: vi.fn(),
      toSlashDate: vi.fn(),
      setStressResult: vi.fn(),
    })

    const reviewArgs = composeEventReviewWorkflowArgs({
      newsEvents: [],
      defaultNewsEvents: [],
      reviewForm: {},
      setNewsEvents: vi.fn(),
      setReviewingEvent: vi.fn(),
      setReviewForm: vi.fn(),
      flashSaved,
      activePortfolioId: 'me',
      portfolios: [],
      strategyBrain: {},
      portfolioNotes: {},
      dossierByCode: new Map(),
      setStrategyBrain: vi.fn(),
      setBrainValidation: vi.fn(),
      toSlashDate: vi.fn(),
    })

    const weeklyArgs = composeWeeklyReportClipboardArgs({
      holdings: [],
      watchlist: [],
      analysisHistory: [],
      newsEvents: [],
      strategyBrain: {},
      totalCost: 0,
      totalVal: 0,
      totalPnl: 0,
      retPct: 0,
      isClosedEvent: vi.fn(),
      resolveHoldingPrice: vi.fn(),
      getHoldingUnrealizedPnl: vi.fn(),
      getHoldingReturnPct: vi.fn(),
      brainRuleSummary: vi.fn(),
      flashSaved,
    })

    const tradeArgs = composeTradeCaptureRuntimeArgs({
      holdings: null,
      tradeLog: null,
      marketQuotes: null,
      setHoldings: vi.fn(),
      setTradeLog: vi.fn(),
      upsertTargetReport: vi.fn(),
      upsertFundamentalsEntry: vi.fn(),
      applyTradeEntryToHoldings: vi.fn(),
      createDefaultFundamentalDraft: vi.fn(),
      toSlashDate: vi.fn(),
      flashSaved,
      setTab,
    })

    const researchArgs = composeResearchWorkflowArgs({
      researching: false,
      setResearching: vi.fn(),
      setResearchTarget: vi.fn(),
      holdings: [],
      dossierByCode: new Map(),
      stockMeta: {},
      strategyBrain: {},
      portfolioNotes: {},
      canUseCloud: true,
      newsEvents: [],
      analysisHistory: [],
      resolveHoldingPrice: vi.fn(),
      getHoldingUnrealizedPnl: vi.fn(),
      getHoldingReturnPct: vi.fn(),
      setResearchResults: vi.fn(),
      setResearchHistory: vi.fn(),
      setStrategyBrain: vi.fn(),
      flashSaved,
      enrichResearchToDossier: vi.fn(),
      mergeBrainPreservingCoachLessons: vi.fn(),
    })

    const backupArgs = composeLocalBackupWorkflowArgs({
      portfolios: [],
      activePortfolioId: 'me',
      viewMode: 'portfolio',
      marketQuotes: null,
      requestAppConfirmation: vi.fn(),
      applyPortfolioSnapshot: vi.fn(),
      setPortfolios: vi.fn(),
      setActivePortfolioId: vi.fn(),
      setViewMode: vi.fn(),
      setCloudSync: vi.fn(),
      flashSaved,
    })

    const panelsInput = composePortfolioPanelsContextInput({
      data: {
        activePortfolioId: 'me',
        overviewPortfolios: [],
        overviewTotalValue: 0,
        overviewTotalPnl: 0,
        overviewDuplicateHoldings: [],
        overviewPendingItems: [],
        holdings: [],
        totalVal: 0,
        totalCost: 0,
        winners: [],
        losers: [],
        top5: [],
        holdingsIntegrityIssues: [],
        filteredEvents: [],
        morningNote: '',
        dailyReport: null,
        newsEvents: [],
        strategyBrain: {},
        dataRefreshRows: [],
        researchHistory: [],
        tradeLog: [],
      },
      ui: {
        showReversal: false,
        reversalConditions: {},
        reviewingEvent: null,
        attentionCount: 0,
        pendingCount: 0,
        targetUpdateCount: 0,
        scanQuery: '',
        scanFilter: '',
        sortBy: 'pnl',
        expandedStock: null,
        watchlistFocus: '',
        watchlistRows: [],
        showRelayPlan: false,
        relayPlanExpanded: false,
        filterType: 'all',
        catalystFilter: '全部',
        dailyExpanded: false,
        researchTarget: '',
        reviewForm: {},
        expandedNews: null,
      },
      asyncState: {
        analyzing: false,
        analyzeStep: '',
        stressResult: null,
        stressTesting: false,
        researching: false,
        reportRefreshing: false,
        reportRefreshStatus: '',
        enrichingResearchCode: null,
        proposalActionId: null,
        proposalActionType: null,
      },
      resources: {
        researchResults: null,
        stockMeta: {},
        indColor: {},
        tradeCapture: {},
        createDefaultReviewForm: vi.fn(),
      },
      controls: {
        exitOverview: vi.fn(),
        switchPortfolio: vi.fn(),
        setShowReversal: vi.fn(),
        setReviewingEvent: vi.fn(),
        updateReversal: vi.fn(),
        setScanQuery: vi.fn(),
        setScanFilter: vi.fn(),
        setSortBy: vi.fn(),
        setExpandedStock: vi.fn(),
        setRelayPlanExpanded: vi.fn(),
        setFilterType: vi.fn(),
        setCatalystFilter: vi.fn(),
        setDailyExpanded: vi.fn(),
        setStressResult: vi.fn(),
        setTab: vi.fn(),
        setExpandedNews: vi.fn(),
        setResearchResults: vi.fn(),
        setReviewForm: vi.fn(),
      },
      actions: {
        updateTargetPrice: vi.fn(),
        updateAlert: vi.fn(),
        handleWatchlistUpsert: vi.fn(),
        handleWatchlistDelete: vi.fn(),
        formatEventStockOutcomeLine: vi.fn(),
        runDailyAnalysis: vi.fn(),
        runStressTest: vi.fn(),
        refreshAnalystReports: vi.fn(),
        runResearch: vi.fn(),
        enrichResearchToDossier: vi.fn(),
        applyBrainProposal: vi.fn(),
        discardBrainProposal: vi.fn(),
        submitReview: vi.fn(),
        cancelReview: vi.fn(),
      },
    })

    expect(refreshArgs.flashSaved).toBe(flashSaved)
    expect(dailyArgs.notifySaved).toBe(flashSaved)
    expect(stressArgs.setStressResult).toBeTypeOf('function')
    expect(reviewArgs.activePortfolioId).toBe('me')
    expect(weeklyArgs.brainRuleSummary).toBeTypeOf('function')
    expect(tradeArgs.holdings).toEqual([])
    expect(researchArgs.notifySaved).toBe(flashSaved)
    expect(backupArgs.requestConfirmation).toBeTypeOf('function')
    expect(panelsInput.activePortfolioId).toBe('me')

    tradeArgs.afterSubmit({ remainingUploads: 0 })
    expect(setTab).toHaveBeenCalledWith('holdings')
  })
})
