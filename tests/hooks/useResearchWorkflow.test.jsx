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
    const readKnowledgeLogs = vi.fn(() => ({
      usageLog: [{ timestamp: 1, itemIds: ['fa-001'] }],
      feedbackLog: [
        {
          analysisId: 'daily-1',
          signal: 'helpful',
          injectedKnowledgeIds: ['fa-001'],
          timestamp: 2,
        },
      ],
    }))

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
        readKnowledgeLogs,
      })
    )

    await act(async () => {
      await result.current.runResearch('evolve')
    })

    expect(runResearchRequest).toHaveBeenCalledTimes(1)
    expect(runResearchRequest.mock.calls[0][0]).toMatchObject({
      knowledgeUsageLog: [{ timestamp: 1, itemIds: ['fa-001'] }],
      knowledgeFeedbackLog: [
        expect.objectContaining({
          analysisId: 'daily-1',
          signal: 'helpful',
          injectedKnowledgeIds: ['fa-001'],
        }),
      ],
    })
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

  it('times out deep research requests before the UI spins forever', async () => {
    const originalFetch = global.fetch
    const fetchMock = vi.fn(async () => {
      throw Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      })
    })
    global.fetch = fetchMock

    const setResearching = vi.fn()
    const setResearchTarget = vi.fn()
    const notifySaved = vi.fn()

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
        setResearchResults: vi.fn(),
        setResearchHistory: vi.fn(),
        notifySaved,
        enrichResearchToDossier: vi.fn(async () => false),
      })
    )

    try {
      await act(async () => {
        await result.current.runResearch('evolve')
      })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/research(\?stream=1)?$/),
        expect.objectContaining({
          method: 'POST',
          signal: expect.any(AbortSignal),
        })
      )
      expect(notifySaved).toHaveBeenCalledWith('❌ 研究逾時 · 請稍後再試', expect.any(Number))
    } finally {
      global.fetch = originalFetch
    }
  })

  it('hydrates missing FinMind dossier data before building the research request body', async () => {
    const runResearchRequest = vi.fn(async () => ({
      results: [
        {
          code: '2308',
          mode: 'single',
          name: '台達電',
          timestamp: 1,
        },
      ],
    }))
    const fetchStockDossierData = vi.fn(async () => ({
      institutional: [{ foreign: 100, investment: 20 }],
      valuation: [{ per: 18.2, pbr: 3.1 }],
      margin: [{ marginBalance: 1200 }, { marginBalance: 1180 }],
      revenue: [{ revenueMonth: '2026/03', revenueYoY: 12, revenueMoM: 3 }],
      balanceSheet: [{ totalAssets: 120000, totalLiabilities: 52000 }],
      cashFlow: [{ operatingCF: 18000, investingCF: -3200, financingCF: -1400 }],
      shareholding: [{ foreignShareRatio: 61.5 }, { foreignShareRatio: 61.1 }],
    }))

    const targetStock = {
      code: '2308',
      name: '台達電',
      price: 380,
      cost: 350,
      qty: 10,
      pnl: 300,
      pct: 8.5,
    }

    const { result } = renderHook(() =>
      useResearchWorkflow({
        researching: false,
        setResearching: vi.fn(),
        setResearchTarget: vi.fn(),
        holdings: [targetStock],
        portfolioHoldings: [targetStock],
        dossierByCode: new Map([
          [
            '2308',
            {
              code: '2308',
              name: '台達電',
              position: { qty: 10, cost: 350, price: 380, pnl: 300, pct: 8.5, type: 'stock' },
              finmind: null,
            },
          ],
        ]),
        stockMeta: {},
        strategyBrain: {},
        portfolioNotes: {},
        canUseCloud: false,
        newsEvents: [],
        analysisHistory: [],
        resolveHoldingPrice: () => 380,
        getHoldingUnrealizedPnl: () => 300,
        getHoldingReturnPct: () => 8.5,
        setResearchResults: vi.fn(),
        setResearchHistory: vi.fn(),
        notifySaved: vi.fn(),
        enrichResearchToDossier: vi.fn(async () => false),
        runResearchRequest,
        fetchStockDossierData,
        readKnowledgeLogs: vi.fn(() => ({ usageLog: [], feedbackLog: [] })),
      })
    )

    await act(async () => {
      await result.current.runResearch('single', targetStock)
    })

    expect(fetchStockDossierData).toHaveBeenCalledWith('2308')
    expect(runResearchRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        holdingDossiers: [
          expect.objectContaining({
            code: '2308',
            finmind: expect.objectContaining({
              revenue: [expect.objectContaining({ revenueMonth: '2026/03' })],
              balanceSheet: [expect.objectContaining({ totalAssets: 120000 })],
            }),
          }),
        ],
      }),
      expect.anything()
    )
  })
})
