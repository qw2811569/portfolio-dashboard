import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppDailyAnalysisRuntime } from '../../src/hooks/useAppDailyAnalysisRuntime.js'
import { useAppPanelsRuntime } from '../../src/hooks/useAppPanelsRuntime.js'
import { useAppWeeklyReportRuntime } from '../../src/hooks/useAppWeeklyReportRuntime.js'
import { useAppLocalBackupRuntime } from '../../src/hooks/useAppLocalBackupRuntime.js'
import { useAppStressTestRuntime } from '../../src/hooks/useAppStressTestRuntime.js'
import { useAppTradeRuntime } from '../../src/hooks/useAppTradeRuntime.js'

describe('hooks/app workflow runtimes', () => {
  it('wraps the daily-analysis workflow behind a dedicated runtime slice', () => {
    const refreshAnalystReportsRef = { current: vi.fn() }

    const { result } = renderHook(() =>
      useAppDailyAnalysisRuntime(
        {
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
          todayRefreshKey: '2026-03-31',
          dossierByCode: new Map(),
          activePortfolioId: 'me',
          canUseCloud: false,
          getMarketQuotesForCodes: vi.fn(),
          resolveHoldingPrice: vi.fn(),
          getHoldingUnrealizedPnl: vi.fn(),
          getHoldingReturnPct: vi.fn(),
          buildDailyHoldingDossierContext: vi.fn(),
          formatPortfolioNotesContext: vi.fn(),
          formatBrainChecklistsForPrompt: vi.fn(),
          formatBrainRulesForValidationPrompt: vi.fn(),
          normalizeStrategyBrain: vi.fn((value) => value),
          createEmptyBrainAudit: vi.fn(() => ({})),
          ensureBrainAuditCoverage: vi.fn((value) => value),
          enforceTaiwanHardGatesOnBrainAudit: vi.fn((value) => value),
          mergeBrainWithAuditLifecycle: vi.fn((_raw, current) => current),
          appendBrainValidationCases: vi.fn((prev) => prev),
          normalizeHoldings: vi.fn((rows) => rows),
          isClosedEvent: vi.fn(() => false),
          toSlashDate: vi.fn(() => '2026/03/31'),
          setDailyReport: vi.fn(),
          setAnalysisHistory: vi.fn(),
          setStrategyBrain: vi.fn(),
          setBrainValidation: vi.fn(),
          setHoldings: vi.fn(),
          setLastUpdate: vi.fn(),
          flashSaved: vi.fn(),
        },
        refreshAnalystReportsRef
      )
    )

    expect(typeof result.current.runDailyAnalysis).toBe('function')
  })

  it('exposes local stress-test runtime state alongside the workflow action', () => {
    const { result } = renderHook(() =>
      useAppStressTestRuntime({
        analyzing: false,
        setAnalyzeStep: vi.fn(),
        workflowArgs: {
          holdings: [{ code: '2330' }],
          dossierByCode: new Map(),
          getMarketQuotesForCodes: vi.fn(),
          resolveHoldingPrice: vi.fn(),
          getHoldingUnrealizedPnl: vi.fn(),
          getHoldingReturnPct: vi.fn(),
          buildDailyHoldingDossierContext: vi.fn(),
          toSlashDate: vi.fn(),
        },
      })
    )

    expect(result.current.stressTesting).toBe(false)
    expect(result.current.stressResult).toBeNull()
    expect(typeof result.current.runStressTest).toBe('function')

    act(() => {
      result.current.setStressResult({ totalValue: 123 })
    })

    expect(result.current.stressResult).toEqual({ totalValue: 123 })
  })

  it('wraps weekly-report clipboard workflow behind its own runtime slice', () => {
    const { result } = renderHook(() =>
      useAppWeeklyReportRuntime({
        holdings: [],
        watchlist: [],
        analysisHistory: [],
        newsEvents: [],
        strategyBrain: null,
        totalCost: 0,
        totalVal: 0,
        totalPnl: 0,
        retPct: 0,
        isClosedEvent: vi.fn(() => false),
        resolveHoldingPrice: vi.fn(),
        getHoldingUnrealizedPnl: vi.fn(),
        getHoldingReturnPct: vi.fn(),
        brainRuleSummary: vi.fn(() => ''),
        flashSaved: vi.fn(),
      })
    )

    expect(typeof result.current.generateWeeklyReport).toBe('function')
    expect(typeof result.current.copyWeeklyReport).toBe('function')
  })

  it('wraps local-backup workflow behind its own runtime slice', () => {
    const { result } = renderHook(() =>
      useAppLocalBackupRuntime({
        workflowArgs: {
          portfolios: [],
          activePortfolioId: 'me',
          viewMode: 'portfolio',
          marketQuotes: null,
          requestAppConfirmation: vi.fn(async () => true),
          applyPortfolioSnapshot: vi.fn(),
          setPortfolios: vi.fn(),
          setActivePortfolioId: vi.fn(),
          setViewMode: vi.fn(),
          setCloudSync: vi.fn(),
          flashSaved: vi.fn(),
        },
        portfolioTransitionRef: { current: { isHydrating: false } },
        cloudSyncStateRef: { current: { enabled: false, syncedAt: 0 } },
        livePortfolioSnapshot: {},
      })
    )

    expect(result.current).toHaveProperty('backupFileInputRef')
    expect(typeof result.current.exportLocalBackup).toBe('function')
    expect(typeof result.current.importLocalBackup).toBe('function')
  })

  it('wraps panel context assembly behind its own runtime slice', () => {
    const { result } = renderHook(() =>
      useAppPanelsRuntime({
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
          morningNote: null,
          dailyReport: null,
          newsEvents: [],
          strategyBrain: null,
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
          watchlistFocus: null,
          watchlistRows: [],
          showRelayPlan: false,
          relayPlanExpanded: false,
          filterType: 'all',
          catalystFilter: '全部',
          dailyExpanded: false,
          researchTarget: null,
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
        },
        resources: {
          researchResults: null,
          stockMeta: {},
          indColor: {},
          tradeCapture: {},
          createDefaultReviewForm: vi.fn(() => ({})),
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
          formatEventStockOutcomeLine: vi.fn(() => ''),
          runDailyAnalysis: vi.fn(),
          runStressTest: vi.fn(),
          refreshAnalystReports: vi.fn(),
          runResearch: vi.fn(),
          enrichResearchToDossier: vi.fn(),
          submitReview: vi.fn(),
          cancelReview: vi.fn(),
        },
      })
    )

    expect(result.current).toHaveProperty('portfolioPanelsData')
    expect(result.current).toHaveProperty('portfolioPanelsActions')
  })

  it('derives dashboard compare strip and overview headline from overview portfolios', () => {
    const { result } = renderHook(() =>
      useAppPanelsRuntime({
        data: {
          ready: true,
          activePortfolioId: '7865',
          overviewPortfolios: [
            {
              id: 'me',
              name: '我',
              pendingEvents: [{ id: 'evt-1' }],
              todayRetPct: 0.7,
              todayTopContributor: { code: '2330', name: '台積電', pnl: 80 },
            },
            {
              id: '7865',
              name: '金聯成',
              pendingEventsCount: 2,
              todayRetPct: 0.6,
              todayTopDrag: { code: '2489', pnl: -20 },
            },
          ],
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
          morningNote: null,
          dailyReport: null,
          newsEvents: [],
          strategyBrain: null,
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
          watchlistFocus: null,
          watchlistRows: [],
          showRelayPlan: false,
          relayPlanExpanded: false,
          filterType: 'all',
          catalystFilter: '全部',
          dailyExpanded: false,
          researchTarget: null,
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
        },
        resources: {
          researchResults: null,
          stockMeta: {},
          indColor: {},
          tradeCapture: {},
          createDefaultReviewForm: vi.fn(() => ({})),
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
          formatEventStockOutcomeLine: vi.fn(() => ''),
          runDailyAnalysis: vi.fn(),
          runStressTest: vi.fn(),
          refreshAnalystReports: vi.fn(),
          runResearch: vi.fn(),
          enrichResearchToDossier: vi.fn(),
          submitReview: vi.fn(),
          cancelReview: vi.fn(),
        },
      })
    )

    expect(result.current.portfolioPanelsData.dashboard.compareStrip.summaryText).toContain(
      '今日差距 +0.1pp'
    )
    expect(result.current.portfolioPanelsData.overview.dashboardHeadline.headline).toContain(
      '主要拉動是 台積電 (2330)'
    )
    expect(result.current.portfolioPanelsData.overview.portfolios[0].pendingEventsCount).toBe(1)
  })

  it('keeps trade runtime behavior while syncing late-bound callback refs', () => {
    const refreshAnalystReportsRef = { current: null }
    const resetTradeCaptureRef = { current: null }
    const refreshAnalystReports = vi.fn()

    const { result } = renderHook(() =>
      useAppTradeRuntime({
        workflowArgs: {
          holdings: [],
          tradeLog: [],
          marketQuotes: null,
          setHoldings: vi.fn(),
          setTradeLog: vi.fn(),
          upsertTargetReport: vi.fn(),
          upsertFundamentalsEntry: vi.fn(),
          applyTradeEntryToHoldings: vi.fn((rows) => rows),
          createDefaultFundamentalDraft: vi.fn(() => ({})),
          toSlashDate: vi.fn(() => '2026/03/31'),
          flashSaved: vi.fn(),
          setTab: vi.fn(),
        },
        refreshAnalystReportsRef,
        refreshAnalystReports,
        resetTradeCaptureRef,
      })
    )

    expect(result.current).toHaveProperty('resetTradeCapture')
    expect(refreshAnalystReportsRef.current).toBe(refreshAnalystReports)
    expect(typeof resetTradeCaptureRef.current).toBe('function')
  })
})
