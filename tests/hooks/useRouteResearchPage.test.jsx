import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUsePortfolioRouteContext = vi.fn()
const mockUseReportRefreshWorkflow = vi.fn()
const mockUseResearchWorkflow = vi.fn()

vi.mock('../../src/pages/usePortfolioRouteContext.js', () => ({
  usePortfolioRouteContext: () => mockUsePortfolioRouteContext(),
}))

vi.mock('../../src/hooks/useReportRefreshWorkflow.js', () => ({
  useReportRefreshWorkflow: (args) => mockUseReportRefreshWorkflow(args),
}))

vi.mock('../../src/hooks/useResearchWorkflow.js', () => ({
  useResearchWorkflow: (args) => mockUseResearchWorkflow(args),
}))

import { useRouteResearchPage } from '../../src/hooks/useRouteResearchPage.js'

describe('hooks/useRouteResearchPage.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wires route research enrich/refresh actions through the shared report refresh workflow', () => {
    const upsertTargetReport = vi.fn()
    const upsertFundamentalsEntry = vi.fn()
    const setAnalystReports = vi.fn()
    const setResearchHistory = vi.fn()
    const setStrategyBrain = vi.fn()
    const flashSaved = vi.fn()

    mockUsePortfolioRouteContext.mockReturnValue({
      holdings: [{ code: '2330', name: '台積電', qty: 1000, price: 950, cost: 900 }],
      targets: {},
      fundamentals: {},
      analystReports: {},
      holdingDossiers: [
        {
          code: '2330',
          name: '台積電',
          freshness: { targets: 'missing', analyst: 'missing' },
        },
      ],
      newsEvents: [{ id: 'e1', title: '法說', stocks: ['台積電 2330'], status: 'tracking' }],
      analysisHistory: [],
      strategyBrain: { rules: [] },
      portfolioNotes: {},
      researchHistory: [],
      setResearchHistory,
      setStrategyBrain,
      setAnalystReports,
      upsertTargetReport,
      upsertFundamentalsEntry,
      flashSaved,
    })

    const enrichResearchToDossier = vi.fn()
    const refreshAnalystReports = vi.fn()
    const runResearch = vi.fn()
    const applyBrainProposal = vi.fn()
    const discardBrainProposal = vi.fn()

    mockUseReportRefreshWorkflow.mockReturnValue({
      reportRefreshing: false,
      reportRefreshStatus: '',
      enrichingResearchCode: null,
      refreshAnalystReports,
      enrichResearchToDossier,
    })

    mockUseResearchWorkflow.mockReturnValue({
      runResearch,
      applyBrainProposal,
      discardBrainProposal,
      proposalActionId: null,
      proposalActionType: null,
    })

    const { result } = renderHook(() => useRouteResearchPage())

    expect(mockUseReportRefreshWorkflow).toHaveBeenCalledTimes(1)
    expect(mockUseReportRefreshWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        holdings: [expect.objectContaining({ code: '2330' })],
        analystReports: {},
        upsertTargetReport,
        upsertFundamentalsEntry,
        setAnalystReports,
        flashSaved,
        reportRefreshCandidates: [
          expect.objectContaining({
            holding: expect.objectContaining({ code: '2330' }),
            score: 11,
          }),
        ],
      })
    )

    expect(mockUseResearchWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        enrichResearchToDossier,
        setResearchHistory,
        setStrategyBrain,
        notifySaved: flashSaved,
      })
    )

    expect(result.current.onEnrich).not.toBe(enrichResearchToDossier)
    expect(result.current.onRefresh).not.toBe(refreshAnalystReports)
    expect(result.current.onResearch).not.toBe(runResearch)
  })

  it('blocks route research write actions from mutating local or shared state', async () => {
    const setAnalystReports = vi.fn()
    const setResearchHistory = vi.fn()
    const setStrategyBrain = vi.fn()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      configurable: true,
      writable: true,
    })

    mockUsePortfolioRouteContext.mockReturnValue({
      holdings: [{ code: '2330', name: '台積電', qty: 1000, price: 950, cost: 900 }],
      targets: {},
      fundamentals: {},
      analystReports: {},
      holdingDossiers: [],
      newsEvents: [],
      analysisHistory: [],
      strategyBrain: { rules: [] },
      portfolioNotes: {},
      researchHistory: [],
      setResearchHistory,
      setStrategyBrain,
      setAnalystReports,
      upsertTargetReport: vi.fn(),
      upsertFundamentalsEntry: vi.fn(),
      flashSaved: vi.fn(),
    })

    const enrichResearchToDossier = vi.fn()
    const refreshAnalystReports = vi.fn()
    const runResearch = vi.fn()
    const applyBrainProposal = vi.fn()
    const discardBrainProposal = vi.fn()

    mockUseReportRefreshWorkflow.mockReturnValue({
      reportRefreshing: false,
      reportRefreshStatus: '',
      enrichingResearchCode: null,
      refreshAnalystReports,
      enrichResearchToDossier,
    })

    mockUseResearchWorkflow.mockReturnValue({
      runResearch,
      applyBrainProposal,
      discardBrainProposal,
      proposalActionId: null,
      proposalActionType: null,
    })

    const { result } = renderHook(() => useRouteResearchPage())

    await act(async () => {
      await result.current.onRefresh()
      await result.current.onResearch('single', { code: '2330' })
      await result.current.onEnrich({ code: '2330', mode: 'single' })
      await result.current.onApplyProposal({ timestamp: 1 })
      await result.current.onDiscardProposal({ timestamp: 1 })
    })

    expect(refreshAnalystReports).not.toHaveBeenCalled()
    expect(runResearch).not.toHaveBeenCalled()
    expect(enrichResearchToDossier).not.toHaveBeenCalled()
    expect(applyBrainProposal).not.toHaveBeenCalled()
    expect(discardBrainProposal).not.toHaveBeenCalled()
    expect(setAnalystReports).not.toHaveBeenCalled()
    expect(setResearchHistory).not.toHaveBeenCalled()
    expect(setStrategyBrain).not.toHaveBeenCalled()
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled()
    if (process.env.NODE_ENV !== 'production') {
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: refreshAnalystReports. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: runResearch. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: enrichResearchToDossier. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: applyBrainProposal. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: discardBrainProposal. Use the canonical AppShell to mutate data.'
      )
    }
  })
})
