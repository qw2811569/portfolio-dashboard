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

  it('applies a gated proposal into the formal strategy brain', async () => {
    const setResearchResults = vi.fn()
    const setResearchHistory = vi.fn()
    const setStrategyBrain = vi.fn()
    const notifySaved = vi.fn()
    const saveBrainRequest = vi.fn(async () => ({ ok: true }))

    const report = {
      timestamp: 11,
      brainProposal: {
        status: 'candidate',
        proposedBrain: {
          rules: [
            {
              id: 'user-rule-1',
              text: '法說前先觀察量價',
              source: 'user',
              status: 'active',
            },
            {
              text: '事件後量價背離先減碼',
              when: '事件後量價背離',
              action: '先減碼 1/3',
              evidenceRefs: [{ type: 'analysis', label: '收盤分析' }],
              status: 'active',
            },
          ],
          candidateRules: [],
        },
      },
    }

    const { result } = renderHook(() =>
      useResearchWorkflow({
        researching: false,
        setResearching: vi.fn(),
        setResearchTarget: vi.fn(),
        holdings: [],
        portfolioHoldings: [],
        dossierByCode: new Map(),
        stockMeta: {},
        strategyBrain: {
          rules: [{ id: 'user-rule-1', text: '法說前先觀察量價', source: 'user', status: 'active' }],
        },
        portfolioNotes: {},
        canUseCloud: true,
        newsEvents: [],
        analysisHistory: [],
        resolveHoldingPrice: vi.fn(),
        getHoldingUnrealizedPnl: vi.fn(),
        getHoldingReturnPct: vi.fn(),
        setResearchResults,
        setResearchHistory,
        setStrategyBrain,
        notifySaved,
        enrichResearchToDossier: vi.fn(async () => false),
        saveBrainRequest,
      })
    )

    await act(async () => {
      await result.current.applyBrainProposal(report)
    })

    expect(setStrategyBrain).toHaveBeenCalledWith(
      expect.objectContaining({
        rules: expect.arrayContaining([
          expect.objectContaining({ text: '事件後量價背離先減碼' }),
        ]),
      })
    )
    expect(saveBrainRequest).toHaveBeenCalledTimes(1)
    expect(notifySaved).toHaveBeenCalledWith(
      '✅ 候選提案已套用到正式策略大腦',
      expect.any(Number)
    )
  })

  it('blocks applying proposals that fail gate evaluation', async () => {
    const setResearchResults = vi.fn()
    const setResearchHistory = vi.fn()
    const setStrategyBrain = vi.fn()
    const notifySaved = vi.fn()

    const { result } = renderHook(() =>
      useResearchWorkflow({
        researching: false,
        setResearching: vi.fn(),
        setResearchTarget: vi.fn(),
        holdings: [],
        portfolioHoldings: [],
        dossierByCode: new Map(),
        stockMeta: {},
        strategyBrain: {
          rules: [{ id: 'user-rule-1', text: '法說前先觀察量價', source: 'user', status: 'active' }],
        },
        portfolioNotes: {},
        canUseCloud: false,
        newsEvents: [],
        analysisHistory: [],
        resolveHoldingPrice: vi.fn(),
        getHoldingUnrealizedPnl: vi.fn(),
        getHoldingReturnPct: vi.fn(),
        setResearchResults,
        setResearchHistory,
        setStrategyBrain,
        notifySaved,
        enrichResearchToDossier: vi.fn(async () => false),
      })
    )

    await act(async () => {
      await result.current.applyBrainProposal({
        timestamp: 12,
        brainProposal: {
          status: 'candidate',
          proposedBrain: {
            rules: [
              {
                text: '新的規則但沒有保留 user rule',
                when: '條件',
                action: '動作',
                evidenceRefs: [{ type: 'analysis', label: 'A' }],
              },
            ],
          },
        },
      })
    })

    expect(setStrategyBrain).not.toHaveBeenCalled()
    expect(notifySaved).toHaveBeenCalledWith(
      '⚠️ 提案未通過 gate，暫不能套用',
      expect.any(Number)
    )
  })
})
