import { renderHook } from '@testing-library/react'
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

    expect(result.current.onEnrich).toBe(enrichResearchToDossier)
    expect(result.current.onRefresh).toBe(refreshAnalystReports)
    expect(result.current.onResearch).toBe(runResearch)
  })
})
