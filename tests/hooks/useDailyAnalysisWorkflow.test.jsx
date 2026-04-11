import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDailyAnalysisWorkflow } from '../../src/hooks/useDailyAnalysisWorkflow.js'

describe('hooks/useDailyAnalysisWorkflow.js', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hydrates FinMind data before prompt assembly and applies inline brain updates without rules', async () => {
    vi.stubGlobal('location', { hostname: 'localhost' })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          content: [{ text: '[]' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              text: `## 今日總結
今天先看事件消化節奏。

## 🧬 BRAIN_UPDATE
\`\`\`json
{"candidateRules":[{"text":"事件後量縮先減碼","when":"事件後量縮","action":"減碼1/3","confidence":7,"evidenceRefs":[{"type":"analysis","label":"今日收盤"}],"status":"candidate"}],"lessons":[{"date":"2026/04/02","text":"事件後別追價"}]}
\`\`\``,
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const fetchStockDossierData = vi.fn(async () => ({
      institutional: [{ foreign: 120, investment: 10 }],
      valuation: [{ per: 18.2, pbr: 3.1 }],
      margin: [{ marginBalance: 1200 }, { marginBalance: 1180 }],
      revenue: [{ revenueMonth: '2026/03', revenueYoY: 12, revenueMoM: 3 }],
      balanceSheet: [{ totalAssets: 120000, totalLiabilities: 52000 }],
      cashFlow: [{ operatingCF: 18000, investingCF: -3200, financingCF: -1400 }],
      shareholding: [{ foreignShareRatio: 61.5 }, { foreignShareRatio: 61.1 }],
    }))

    const buildDailyHoldingDossierContext = vi.fn((dossier) =>
      dossier?.finmind?.revenue?.length ? 'finmind=ready' : 'finmind=missing'
    )
    const setStrategyBrain = vi.fn()
    const mergeBrainWithAuditLifecycle = vi.fn((rawBrain) => ({
      rules: rawBrain.rules || [],
      candidateRules: rawBrain.candidateRules || [],
      lessons: rawBrain.lessons || [],
      commonMistakes: [],
      stats: {},
    }))

    const { result } = renderHook(() =>
      useDailyAnalysisWorkflow({
        analyzing: false,
        setAnalyzing: vi.fn(),
        setAnalyzeStep: vi.fn(),
        holdings: [
          {
            code: '2330',
            name: '台積電',
            cost: 900,
            qty: 1,
            price: 905,
            pnl: 5,
            pct: 0.56,
            value: 905,
          },
        ],
        losers: [],
        newsEvents: [],
        defaultNewsEvents: [],
        analysisHistory: [],
        strategyBrain: { rules: [], candidateRules: [], lessons: [], commonMistakes: [], stats: {} },
        portfolioNotes: {},
        reversalConditions: {},
        reportRefreshMeta: {},
        todayRefreshKey: '2026-04-02',
        dossierByCode: new Map([
          [
            '2330',
            {
              code: '2330',
              name: '台積電',
              position: {
                qty: 1,
                cost: 900,
                price: 905,
                pnl: 5,
                pct: 0.56,
                value: 905,
                type: 'stock',
              },
              finmind: null,
            },
          ],
        ]),
        fetchStockDossierData,
        getMarketQuotesForCodes: async () => ({
          '2330': { price: 950, yesterday: 940, change: 10, changePct: 1.06 },
        }),
        resolveHoldingPrice: (holding) => holding.price,
        getHoldingUnrealizedPnl: (holding) => holding.pnl,
        getHoldingReturnPct: (holding) => holding.pct,
        buildDailyHoldingDossierContext,
        formatPortfolioNotesContext: () => '筆記',
        formatBrainChecklistsForPrompt: () => '無',
        formatBrainRulesForValidationPrompt: () => '無',
        normalizeStrategyBrain: (value) =>
          value || { rules: [], candidateRules: [], lessons: [], commonMistakes: [], stats: {} },
        createEmptyBrainAudit: () => ({ validatedRules: [], staleRules: [], invalidatedRules: [] }),
        ensureBrainAuditCoverage: (brainAudit) => brainAudit,
        enforceTaiwanHardGatesOnBrainAudit: (brainAudit) => brainAudit,
        mergeBrainWithAuditLifecycle,
        appendBrainValidationCases: (prev) => prev,
        normalizeHoldings: (rows) => rows,
        isClosedEvent: () => false,
        toSlashDate: () => '2026/04/02',
        setDailyReport: vi.fn(),
        setAnalysisHistory: vi.fn(),
        setStrategyBrain,
        setBrainValidation: vi.fn(),
        setHoldings: vi.fn(),
        setLastUpdate: vi.fn(),
        setSaved: vi.fn(),
        refreshAnalystReportsRef: { current: vi.fn(async () => false) },
      })
    )

    await act(async () => {
      await result.current.runDailyAnalysis()
    })

    expect(fetchStockDossierData).toHaveBeenCalledWith('2330', {})
    expect(buildDailyHoldingDossierContext).toHaveBeenCalledWith(
      expect.objectContaining({
        code: '2330',
        finmind: expect.objectContaining({
          revenue: [expect.objectContaining({ revenueMonth: '2026/03' })],
          balanceSheet: [expect.objectContaining({ totalAssets: 120000 })],
        }),
      }),
      expect.any(Object),
      expect.any(Object)
    )
    expect(mergeBrainWithAuditLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateRules: [expect.objectContaining({ text: '事件後量縮先減碼' })],
      }),
      expect.anything(),
      expect.anything()
    )
    expect(setStrategyBrain).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateRules: [expect.objectContaining({ text: '事件後量縮先減碼' })],
      })
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('upgrades a same-day preliminary report into a confirmed rerun and bypasses FinMind cache', async () => {
    vi.stubGlobal('location', { hostname: 'localhost' })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          content: [{ text: '[]' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              text: `## 今日總結
已用日終資料確認。`,
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const fetchStockDossierData = vi.fn(async () => ({
      institutional: [{ date: '2026-04-11', foreign: 120, investment: 10 }],
      valuation: [{ date: '2026-04-11', per: 18.2, pbr: 3.1 }],
      margin: [{ date: '2026-04-11', marginBalance: 1200 }, { date: '2026-04-10', marginBalance: 1180 }],
      revenue: [{ revenueMonth: '2026/03', revenueYoY: 12, revenueMoM: 3 }],
      balanceSheet: [{ date: '2025-12-31', totalAssets: 120000, totalLiabilities: 52000 }],
      cashFlow: [{ date: '2025-12-31', operatingCF: 18000, investingCF: -3200, financingCF: -1400 }],
      shareholding: [
        { date: '2026-04-11', foreignShareRatio: 61.5 },
        { date: '2026-04-10', foreignShareRatio: 61.1 },
      ],
    }))

    const existingTodayReport = {
      id: 101,
      date: '2026/04/11',
      time: '14:02',
      analysisStage: 't0-preliminary',
      analysisStageLabel: '收盤快版',
      analysisVersion: 1,
      finmindConfirmation: {
        expectedMarketDate: '2026-04-11',
        status: 'preliminary',
        pendingCodes: ['2330'],
      },
    }

    const setDailyReport = vi.fn()
    const setAnalysisHistory = vi.fn()

    const { result } = renderHook(() =>
      useDailyAnalysisWorkflow({
        analyzing: false,
        setAnalyzing: vi.fn(),
        setAnalyzeStep: vi.fn(),
        holdings: [
          {
            code: '2330',
            name: '台積電',
            cost: 900,
            qty: 1,
            price: 905,
            pnl: 5,
            pct: 0.56,
            value: 905,
          },
        ],
        losers: [],
        newsEvents: [],
        defaultNewsEvents: [],
        analysisHistory: [existingTodayReport],
        strategyBrain: { rules: [], candidateRules: [], lessons: [], commonMistakes: [], stats: {} },
        portfolioNotes: {},
        reversalConditions: {},
        reportRefreshMeta: {},
        todayRefreshKey: '2026-04-11',
        dossierByCode: new Map([
          [
            '2330',
            {
              code: '2330',
              name: '台積電',
              position: {
                qty: 1,
                cost: 900,
                price: 905,
                pnl: 5,
                pct: 0.56,
                value: 905,
                type: 'stock',
              },
              finmind: null,
            },
          ],
        ]),
        fetchStockDossierData,
        getMarketQuotesForCodes: async () => ({
          '2330': { price: 950, yesterday: 940, change: 10, changePct: 1.06 },
        }),
        resolveHoldingPrice: (holding) => holding.price,
        getHoldingUnrealizedPnl: (holding) => holding.pnl,
        getHoldingReturnPct: (holding) => holding.pct,
        buildDailyHoldingDossierContext: () => 'finmind=ready',
        formatPortfolioNotesContext: () => '筆記',
        formatBrainChecklistsForPrompt: () => '無',
        formatBrainRulesForValidationPrompt: () => '無',
        normalizeStrategyBrain: (value) =>
          value || { rules: [], candidateRules: [], lessons: [], commonMistakes: [], stats: {} },
        createEmptyBrainAudit: () => ({ validatedRules: [], staleRules: [], invalidatedRules: [] }),
        ensureBrainAuditCoverage: (brainAudit) => brainAudit,
        enforceTaiwanHardGatesOnBrainAudit: (brainAudit) => brainAudit,
        mergeBrainWithAuditLifecycle: (rawBrain) => rawBrain,
        appendBrainValidationCases: (prev) => prev,
        normalizeHoldings: (rows) => rows,
        isClosedEvent: () => false,
        toSlashDate: () => '2026/04/11',
        setDailyReport,
        setAnalysisHistory,
        setStrategyBrain: vi.fn(),
        setBrainValidation: vi.fn(),
        setHoldings: vi.fn(),
        setLastUpdate: vi.fn(),
        setSaved: vi.fn(),
        refreshAnalystReportsRef: { current: vi.fn(async () => false) },
      })
    )

    await act(async () => {
      await result.current.runDailyAnalysis()
    })

    expect(fetchStockDossierData).toHaveBeenCalledWith('2330', { forceFresh: true })

    const finalReport = setDailyReport.mock.calls.at(-1)[0]
    expect(finalReport).toMatchObject({
      analysisStage: 't1-confirmed',
      analysisStageLabel: '資料確認版',
      analysisVersion: 2,
      rerunReason: 'finmind-confirmed',
      finmindConfirmation: expect.objectContaining({
        expectedMarketDate: '2026-04-11',
        status: 'confirmed',
        pendingCodes: [],
      }),
    })

    const historyUpdater = setAnalysisHistory.mock.calls[0][0]
    const nextHistory = historyUpdater([existingTodayReport])
    expect(nextHistory[0]).toMatchObject({
      analysisStage: 't1-confirmed',
      analysisVersion: 2,
    })
    expect(nextHistory[1]).toMatchObject({
      id: 101,
      analysisStage: 't0-preliminary',
    })
  })

  it('auto-confirms a same-day preliminary report after a successful probe and marks the rerun source', async () => {
    vi.stubGlobal('location', { hostname: 'localhost' })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          content: [{ text: '[]' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              text: `## 今日總結
已自動補跑資料確認版。`,
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const fetchStockDossierData = vi.fn().mockResolvedValue({
      institutional: [{ date: '2026-04-11', foreign: 120, investment: 10 }],
      valuation: [{ date: '2026-04-11', per: 18.2, pbr: 3.1 }],
      margin: [{ date: '2026-04-11', marginBalance: 1200 }],
      shareholding: [{ date: '2026-04-11', foreignShareRatio: 61.5 }],
      revenue: [{ revenueMonth: '2026/03', revenueYoY: 12, revenueMoM: 3 }],
      balanceSheet: [{ date: '2025-12-31', totalAssets: 120000 }],
      cashFlow: [{ date: '2025-12-31', operatingCF: 18000 }],
    })

    const existingTodayReport = {
      id: 101,
      date: '2026/04/11',
      time: '14:02',
      totalTodayPnl: 18,
      changes: [{ code: '2330', name: '台積電', price: 950, totalPnl: 50, totalPct: 5 }],
      analysisStage: 't0-preliminary',
      analysisStageLabel: '收盤快版',
      analysisVersion: 1,
      finmindConfirmation: {
        expectedMarketDate: '2026-04-11',
        status: 'preliminary',
        pendingCodes: ['2330'],
      },
    }

    const setDailyReport = vi.fn()

    const { result } = renderHook(() =>
      useDailyAnalysisWorkflow({
        analyzing: false,
        setAnalyzing: vi.fn(),
        setAnalyzeStep: vi.fn(),
        holdings: [
          {
            code: '2330',
            name: '台積電',
            cost: 900,
            qty: 1,
            price: 905,
            pnl: 5,
            pct: 0.56,
            value: 905,
          },
        ],
        losers: [],
        newsEvents: [],
        defaultNewsEvents: [],
        analysisHistory: [existingTodayReport],
        strategyBrain: { rules: [], candidateRules: [], lessons: [], commonMistakes: [], stats: {} },
        portfolioNotes: {},
        reversalConditions: {},
        reportRefreshMeta: {},
        todayRefreshKey: '2026-04-11',
        dossierByCode: new Map([
          [
            '2330',
            {
              code: '2330',
              name: '台積電',
              position: {
                qty: 1,
                cost: 900,
                price: 905,
                pnl: 5,
                pct: 0.56,
                value: 905,
                type: 'stock',
              },
              finmind: null,
            },
          ],
        ]),
        fetchStockDossierData,
        getMarketQuotesForCodes: async () => ({
          '2330': { price: 950, yesterday: 940, change: 10, changePct: 1.06 },
        }),
        resolveHoldingPrice: (holding) => holding.price,
        getHoldingUnrealizedPnl: (holding) => holding.pnl,
        getHoldingReturnPct: (holding) => holding.pct,
        buildDailyHoldingDossierContext: () => 'finmind=ready',
        formatPortfolioNotesContext: () => '筆記',
        formatBrainChecklistsForPrompt: () => '無',
        formatBrainRulesForValidationPrompt: () => '無',
        normalizeStrategyBrain: (value) =>
          value || { rules: [], candidateRules: [], lessons: [], commonMistakes: [], stats: {} },
        createEmptyBrainAudit: () => ({ validatedRules: [], staleRules: [], invalidatedRules: [] }),
        ensureBrainAuditCoverage: (brainAudit) => brainAudit,
        enforceTaiwanHardGatesOnBrainAudit: (brainAudit) => brainAudit,
        mergeBrainWithAuditLifecycle: (rawBrain) => rawBrain,
        appendBrainValidationCases: (prev) => prev,
        normalizeHoldings: (rows) => rows,
        isClosedEvent: () => false,
        toSlashDate: () => '2026/04/11',
        setDailyReport,
        setAnalysisHistory: vi.fn(),
        setStrategyBrain: vi.fn(),
        setBrainValidation: vi.fn(),
        setHoldings: vi.fn(),
        setLastUpdate: vi.fn(),
        setSaved: vi.fn(),
        refreshAnalystReportsRef: { current: vi.fn(async () => false) },
      })
    )

    let autoResult
    await act(async () => {
      autoResult = await result.current.maybeAutoConfirmDailyReport(existingTodayReport)
    })

    expect(autoResult).toMatchObject({
      status: 'triggered',
      reason: 'confirmed-and-reran',
    })
    expect(fetchStockDossierData).toHaveBeenCalledWith('2330', { forceFresh: true })
    const finalReport = setDailyReport.mock.calls.at(-1)[0]
    expect(finalReport).toMatchObject({
      analysisStage: 't1-confirmed',
      analysisVersion: 2,
      rerunReason: 'finmind-auto-confirmed',
    })
  })

  it('respects the auto-confirm cooldown when pending datasets are still not ready', async () => {
    const fetchStockDossierData = vi.fn(async () => ({
      institutional: [{ date: '2026-04-10', foreign: 120 }],
      valuation: [{ date: '2026-04-10', per: 18.2 }],
      margin: [{ date: '2026-04-10', marginBalance: 1200 }],
      shareholding: [{ date: '2026-04-10', foreignShareRatio: 61.5 }],
    }))

    const existingTodayReport = {
      id: 101,
      date: '2026/04/11',
      time: '14:02',
      changes: [{ code: '2330', name: '台積電' }],
      analysisStage: 't0-preliminary',
      analysisStageLabel: '收盤快版',
      analysisVersion: 1,
      finmindConfirmation: {
        expectedMarketDate: '2026-04-11',
        status: 'preliminary',
        pendingCodes: ['2330'],
      },
    }

    const { result } = renderHook(() =>
      useDailyAnalysisWorkflow({
        analyzing: false,
        setAnalyzing: vi.fn(),
        setAnalyzeStep: vi.fn(),
        holdings: [{ code: '2330', name: '台積電' }],
        losers: [],
        newsEvents: [],
        defaultNewsEvents: [],
        analysisHistory: [existingTodayReport],
        strategyBrain: { rules: [], candidateRules: [], lessons: [], commonMistakes: [], stats: {} },
        portfolioNotes: {},
        reversalConditions: {},
        reportRefreshMeta: {},
        todayRefreshKey: '2026-04-11',
        dossierByCode: new Map([['2330', { code: '2330', name: '台積電', finmind: null }]]),
        fetchStockDossierData,
        getMarketQuotesForCodes: async () => ({}),
        resolveHoldingPrice: () => 0,
        getHoldingUnrealizedPnl: () => 0,
        getHoldingReturnPct: () => 0,
        buildDailyHoldingDossierContext: () => '',
        formatPortfolioNotesContext: () => '',
        formatBrainChecklistsForPrompt: () => '',
        formatBrainRulesForValidationPrompt: () => '',
        normalizeStrategyBrain: (value) =>
          value || { rules: [], candidateRules: [], lessons: [], commonMistakes: [], stats: {} },
        createEmptyBrainAudit: () => ({ validatedRules: [], staleRules: [], invalidatedRules: [] }),
        ensureBrainAuditCoverage: (brainAudit) => brainAudit,
        enforceTaiwanHardGatesOnBrainAudit: (brainAudit) => brainAudit,
        mergeBrainWithAuditLifecycle: (_rawBrain, currentBrain) => currentBrain || {},
        appendBrainValidationCases: (prev) => prev,
        normalizeHoldings: (rows) => rows,
        isClosedEvent: () => false,
        toSlashDate: () => '2026/04/11',
        setDailyReport: vi.fn(),
        setAnalysisHistory: vi.fn(),
        setStrategyBrain: vi.fn(),
        setBrainValidation: vi.fn(),
        setHoldings: vi.fn(),
        setLastUpdate: vi.fn(),
        setSaved: vi.fn(),
        refreshAnalystReportsRef: { current: vi.fn(async () => false) },
      })
    )

    let firstResult
    let secondResult
    await act(async () => {
      firstResult = await result.current.maybeAutoConfirmDailyReport(existingTodayReport)
      secondResult = await result.current.maybeAutoConfirmDailyReport(existingTodayReport)
    })

    expect(firstResult).toMatchObject({
      status: 'waiting',
      reason: 'datasets-not-ready',
    })
    expect(secondResult).toMatchObject({
      status: 'cooldown',
      reason: 'probe-cooldown',
    })
    expect(fetchStockDossierData).toHaveBeenCalledTimes(1)
  })
})
