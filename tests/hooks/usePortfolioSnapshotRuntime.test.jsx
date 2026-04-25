import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePortfolioSnapshotRuntime } from '../../src/hooks/usePortfolioSnapshotRuntime.js'

describe('hooks/usePortfolioSnapshotRuntime.js', () => {
  it('applies a loaded portfolio snapshot and falls back daily report to history head', () => {
    const setHoldings = vi.fn()
    const setTradeLog = vi.fn()
    const setTargets = vi.fn()
    const setFundamentals = vi.fn()
    const setWatchlist = vi.fn()
    const setAnalystReports = vi.fn()
    const setReportRefreshMeta = vi.fn()
    const setHoldingDossiers = vi.fn()
    const setNewsEvents = vi.fn()
    const setAnalysisHistory = vi.fn()
    const setAnalysisHistoryStatus = vi.fn()
    const setReversalConditions = vi.fn()
    const setStrategyBrain = vi.fn()
    const setBrainValidation = vi.fn()
    const setResearchHistory = vi.fn()
    const setResearchHistoryStatus = vi.fn()
    const setPortfolioNotes = vi.fn()
    const setDailyReport = vi.fn()

    const { result } = renderHook(() =>
      usePortfolioSnapshotRuntime({
        ready: true,
        marketPriceCache: { prices: { 2330: { price: 980 } } },
        cloudSyncStateRef: { current: { enabled: false, syncedAt: 0 } },
        portfolioSetterRef: { current: { setActivePortfolioId: vi.fn(), setViewMode: vi.fn() } },
        setCloudSync: vi.fn(),
        holdings: null,
        tradeLog: null,
        targets: null,
        fundamentals: null,
        watchlist: null,
        analystReports: null,
        reportRefreshMeta: null,
        holdingDossiers: null,
        newsEvents: null,
        analysisHistory: null,
        dailyReport: null,
        reversalConditions: null,
        strategyBrain: null,
        brainValidation: null,
        researchHistory: null,
        portfolioNotes: null,
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
        normalizeAnalysisHistoryEntries: (items) => items || [],
        applyMarketQuotesToHoldings: (rows, quotes) =>
          (rows || []).map((item) => ({ ...item, lastPrice: quotes?.[item.code]?.price || null })),
        normalizeFundamentalsStore: (value) => value,
        normalizeWatchlist: (value) => value,
        normalizeAnalystReportsStore: (value) => value,
        normalizeReportRefreshMeta: (value) => value,
        normalizeHoldingDossiers: (value) => value,
        normalizeNewsEvents: (value) => value,
        normalizeStrategyBrain: (value) => value,
        normalizeBrainValidationStore: (value) => value,
        normalizeDailyReportEntry: (value) => value,
        clonePortfolioNotes: () => ({ summary: '' }),
        loadPortfolioSnapshot: vi.fn(),
        readSyncAt: vi.fn(() => 0),
        save: vi.fn(),
        savePortfolioData: vi.fn(),
      })
    )

    const historyHead = { id: 'report-1', summary: 'latest' }

    act(() => {
      result.current.applyPortfolioSnapshot({
        holdings: [{ code: '2330', qty: 1 }],
        tradeLog: [{ id: 'trade-1' }],
        targets: { 2330: { targetPrice: 1000 } },
        fundamentals: { 2330: { thesis: 'ok' } },
        watchlist: [{ code: '2317' }],
        analystReports: { 2330: [{ id: 'ar-1' }] },
        reportRefreshMeta: { __daily: { date: '2026-03-29' } },
        holdingDossiers: { 2330: { code: '2330' } },
        newsEvents: [{ id: 'event-1' }],
        analysisHistory: [historyHead],
        dailyReport: null,
        reversalConditions: { 2330: { note: 'watch' } },
        strategyBrain: { rules: [] },
        brainValidation: { cases: [] },
        researchHistory: [{ code: '2330' }],
        portfolioNotes: null,
      })
    })

    expect(setHoldings).toHaveBeenCalledWith([{ code: '2330', qty: 1, lastPrice: 980 }])
    expect(setAnalysisHistory).toHaveBeenCalledWith([historyHead])
    expect(setDailyReport).toHaveBeenCalledWith(historyHead)
    expect(setPortfolioNotes).toHaveBeenCalledWith({ summary: '' })
  })

  it('flushes the live snapshot and saves active runtime selection', async () => {
    const savePortfolioData = vi.fn().mockResolvedValue(undefined)
    const save = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      usePortfolioSnapshotRuntime({
        ready: true,
        marketPriceCache: null,
        cloudSyncStateRef: { current: { enabled: false, syncedAt: 0 } },
        portfolioSetterRef: { current: { setActivePortfolioId: vi.fn(), setViewMode: vi.fn() } },
        setCloudSync: vi.fn(),
        holdings: [{ code: '2330', qty: 1 }],
        tradeLog: [{ id: 'trade-1' }],
        targets: { 2330: { targetPrice: 1000 } },
        fundamentals: null,
        watchlist: null,
        analystReports: null,
        reportRefreshMeta: null,
        holdingDossiers: null,
        newsEvents: null,
        analysisHistory: null,
        dailyReport: null,
        reversalConditions: null,
        strategyBrain: null,
        brainValidation: null,
        researchHistory: null,
        portfolioNotes: { summary: 'memo' },
        setHoldings: vi.fn(),
        setTradeLog: vi.fn(),
        setTargets: vi.fn(),
        setFundamentals: vi.fn(),
        setWatchlist: vi.fn(),
        setAnalystReports: vi.fn(),
        setReportRefreshMeta: vi.fn(),
        setHoldingDossiers: vi.fn(),
        setNewsEvents: vi.fn(),
        setAnalysisHistory: vi.fn(),
        setAnalysisHistoryStatus: vi.fn(),
        setReversalConditions: vi.fn(),
        setStrategyBrain: vi.fn(),
        setBrainValidation: vi.fn(),
        setResearchHistory: vi.fn(),
        setResearchHistoryStatus: vi.fn(),
        setPortfolioNotes: vi.fn(),
        setDailyReport: vi.fn(),
        normalizeAnalysisHistoryEntries: (items) => items || [],
        applyMarketQuotesToHoldings: (rows) => rows || [],
        normalizeFundamentalsStore: (value) => value,
        normalizeWatchlist: (value) => value,
        normalizeAnalystReportsStore: (value) => value,
        normalizeReportRefreshMeta: (value) => value,
        normalizeHoldingDossiers: (value) => value,
        normalizeNewsEvents: (value) => value,
        normalizeStrategyBrain: (value) => value,
        normalizeBrainValidationStore: (value) => value,
        normalizeDailyReportEntry: (value) => value,
        clonePortfolioNotes: () => ({ summary: '' }),
        loadPortfolioSnapshot: vi.fn(),
        readSyncAt: vi.fn(() => 0),
        save,
        savePortfolioData,
      })
    )

    await act(async () => {
      await result.current.flushCurrentPortfolio('me')
    })

    expect(savePortfolioData).toHaveBeenCalledWith('me', 'holdings-v2', [{ code: '2330', qty: 1 }])
    expect(savePortfolioData).toHaveBeenCalledWith('me', 'log-v2', [{ id: 'trade-1' }])
    expect(save).toHaveBeenCalledWith('pf-active-portfolio-v1', 'me')
    expect(save).toHaveBeenCalledWith('pf-view-mode-v1', 'portfolio')
  })

  it('absorbs schema-drifted snapshot payloads through the provided normalizers', () => {
    const setFundamentals = vi.fn()
    const setWatchlist = vi.fn()
    const setAnalysisHistory = vi.fn()
    const setDailyReport = vi.fn()

    const { result } = renderHook(() =>
      usePortfolioSnapshotRuntime({
        ready: true,
        marketPriceCache: { prices: {} },
        cloudSyncStateRef: { current: { enabled: false, syncedAt: 0 } },
        portfolioSetterRef: { current: { setActivePortfolioId: vi.fn(), setViewMode: vi.fn() } },
        setCloudSync: vi.fn(),
        holdings: null,
        tradeLog: null,
        targets: null,
        fundamentals: null,
        watchlist: null,
        analystReports: null,
        reportRefreshMeta: null,
        holdingDossiers: null,
        newsEvents: null,
        analysisHistory: null,
        dailyReport: null,
        reversalConditions: null,
        strategyBrain: null,
        brainValidation: null,
        researchHistory: null,
        portfolioNotes: null,
        setHoldings: vi.fn(),
        setTradeLog: vi.fn(),
        setTargets: vi.fn(),
        setFundamentals,
        setWatchlist,
        setAnalystReports: vi.fn(),
        setReportRefreshMeta: vi.fn(),
        setHoldingDossiers: vi.fn(),
        setNewsEvents: vi.fn(),
        setAnalysisHistory,
        setAnalysisHistoryStatus: vi.fn(),
        setReversalConditions: vi.fn(),
        setStrategyBrain: vi.fn(),
        setBrainValidation: vi.fn(),
        setResearchHistory: vi.fn(),
        setResearchHistoryStatus: vi.fn(),
        setPortfolioNotes: vi.fn(),
        setDailyReport,
        normalizeAnalysisHistoryEntries: () => [],
        applyMarketQuotesToHoldings: (rows) => rows || [],
        normalizeFundamentalsStore: () => ({ repaired: true }),
        normalizeWatchlist: () => [],
        normalizeAnalystReportsStore: (value) => value,
        normalizeReportRefreshMeta: (value) => value,
        normalizeHoldingDossiers: (value) => value,
        normalizeNewsEvents: (value) => value,
        normalizeStrategyBrain: (value) => value,
        normalizeBrainValidationStore: (value) => value,
        normalizeDailyReportEntry: () => null,
        clonePortfolioNotes: () => ({ summary: '' }),
        loadPortfolioSnapshot: vi.fn(),
        readSyncAt: vi.fn(() => 0),
        save: vi.fn(),
        savePortfolioData: vi.fn(),
      })
    )

    act(() => {
      result.current.applyPortfolioSnapshot({
        holdings: [],
        tradeLog: [],
        targets: {},
        fundamentals: 'schema-drift',
        watchlist: 'schema-drift',
        analystReports: {},
        reportRefreshMeta: {},
        holdingDossiers: {},
        newsEvents: [],
        analysisHistory: 'schema-drift',
        dailyReport: { broken: true },
        reversalConditions: {},
        strategyBrain: {},
        brainValidation: {},
        researchHistory: [],
        portfolioNotes: {},
      })
    })

    expect(setFundamentals).toHaveBeenCalledWith({ repaired: true })
    expect(setWatchlist).toHaveBeenCalledWith([])
    expect(setAnalysisHistory).toHaveBeenCalledWith([])
    expect(setDailyReport).toHaveBeenCalledWith(null)
  })
})
