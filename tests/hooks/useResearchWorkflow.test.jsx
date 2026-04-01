import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useResearchWorkflow } from '../../src/hooks/useResearchWorkflow.js'

describe('hooks/useResearchWorkflow.js', () => {
  it('treats evolve research output as a candidate proposal instead of auto-applying brain', async () => {
    const setResearching = vi.fn()
    const setResearchTarget = vi.fn()
    const setResearchResults = vi.fn()
    const setResearchHistory = vi.fn()
    const notifySaved = vi.fn()

    const runResearchRequest = vi.fn(async () => ({
      results: [
        {
          code: 'EVOLVE',
          mode: 'evolve',
          name: '全組合研究 + 系統進化',
          timestamp: 1,
          brainProposal: {
            id: 'brain-proposal-1',
            status: 'candidate',
            proposedBrain: { rules: [] },
          },
        },
      ],
    }))

    const { result } = renderHook(() =>
      useResearchWorkflow({
        researching: false,
        setResearching,
        setResearchTarget,
        holdings: [],
        portfolioHoldings: [],
        dossierByCode: new Map(),
        stockMeta: {},
        strategyBrain: {},
        portfolioNotes: {},
        canUseCloud: false,
        newsEvents: [],
        analysisHistory: [],
        resolveHoldingPrice: vi.fn(),
        getHoldingUnrealizedPnl: vi.fn(),
        getHoldingReturnPct: vi.fn(),
        setResearchResults,
        setResearchHistory,
        notifySaved,
        enrichResearchToDossier: vi.fn(async () => false),
        runResearchRequest,
      })
    )

    await act(async () => {
      await result.current.runResearch('evolve')
    })

    expect(runResearchRequest).toHaveBeenCalledTimes(1)
    expect(setResearchResults).toHaveBeenCalledWith(
      expect.objectContaining({
        brainProposal: expect.objectContaining({
          status: 'candidate',
        }),
      })
    )
    expect(setResearchHistory).toHaveBeenCalledTimes(1)
    expect(notifySaved).toHaveBeenCalledWith(
      '✅ 系統進化提案已生成 · 尚未套用正式策略大腦',
      expect.any(Number)
    )
  })
})
