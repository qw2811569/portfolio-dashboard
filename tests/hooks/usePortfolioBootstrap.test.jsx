import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OWNER_PORTFOLIO_ID, PORTFOLIO_VIEW_MODE } from '../../src/constants.js'
import { usePortfolioBootstrap } from '../../src/hooks/usePortfolioBootstrap.js'

function createBootstrapProps(overrides = {}) {
  const portfolioTransitionRef = {
    current: {
      isHydrating: false,
      fromPid: OWNER_PORTFOLIO_ID,
      toPid: OWNER_PORTFOLIO_ID,
    },
  }

  const bootRuntimeRef = {
    current: {
      activePortfolioId: OWNER_PORTFOLIO_ID,
      marketPriceQuotes: { 2330: { price: 950 } },
      applyPortfolioSnapshot: vi.fn(),
      setPortfolios: vi.fn(),
      setActivePortfolioId: vi.fn(),
      setViewMode: vi.fn(),
      portfolioTransitionRef,
    },
  }

  return {
    bootRuntimeRef,
    portfolioTransitionRef,
    setReady: vi.fn(),
    setBootstrapState: vi.fn(),
    setCloudSync: vi.fn(),
    cloudSyncStateRef: { current: { enabled: false, syncedAt: 0 } },
    setHoldings: vi.fn(),
    setStrategyBrain: vi.fn(),
    setNewsEvents: vi.fn(),
    setAnalysisHistory: vi.fn(),
    setAnalysisHistoryStatus: vi.fn(),
    setDailyReport: vi.fn(),
    setResearchHistory: vi.fn(),
    setResearchHistoryStatus: vi.fn(),
    restoreTabForPortfolio: vi.fn(),
    migrateLegacyPortfolioStorageIfNeeded: vi.fn().mockResolvedValue(false),
    seedJinlianchengIfNeeded: vi.fn().mockResolvedValue(undefined),
    ensurePortfolioRegistry: vi.fn().mockResolvedValue({
      portfolios: [{ id: OWNER_PORTFOLIO_ID, name: '我' }],
      activePortfolioId: OWNER_PORTFOLIO_ID,
      viewMode: PORTFOLIO_VIEW_MODE,
    }),
    applyTradeBackfillPatchesIfNeeded: vi.fn().mockResolvedValue(0),
    loadPortfolioSnapshot: vi.fn().mockResolvedValue({
      holdings: [{ code: '2330', qty: 1 }],
      analysisHistory: [],
      researchHistory: [],
      newsEvents: [],
      strategyBrain: null,
      dailyReport: null,
    }),
    readSyncAt: vi.fn().mockReturnValue(0),
    writeSyncAt: vi.fn(),
    shouldAdoptCloudHoldings: vi.fn().mockReturnValue(false),
    normalizeHoldings: vi.fn((rows) => rows),
    buildHoldingPriceHints: vi.fn().mockReturnValue({}),
    getPortfolioFallback: vi.fn().mockReturnValue([]),
    savePortfolioData: vi.fn(),
    normalizeStrategyBrain: vi.fn((value) => ({ ...value, normalized: true })),
    normalizeNewsEvents: vi.fn((value) => value.map((item) => ({ ...item, normalized: true }))),
    normalizeAnalysisHistoryEntries: vi.fn((value) => value),
    normalizeDailyReportEntry: vi.fn((value) => ({ ...value, normalized: true })),
    ...overrides,
  }
}

describe('hooks/usePortfolioBootstrap.js', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hydrates non-owner portfolio without cloud sync', async () => {
    const props = createBootstrapProps({
      ensurePortfolioRegistry: vi.fn().mockResolvedValue({
        portfolios: [{ id: 'p-1', name: '測試組合' }],
        activePortfolioId: 'p-1',
        viewMode: PORTFOLIO_VIEW_MODE,
      }),
      bootRuntimeRef: {
        current: {
          activePortfolioId: 'p-1',
          marketPriceQuotes: null,
          applyPortfolioSnapshot: vi.fn(),
          setPortfolios: vi.fn(),
          setActivePortfolioId: vi.fn(),
          setViewMode: vi.fn(),
          portfolioTransitionRef: {
            current: { isHydrating: false, fromPid: 'p-1', toPid: 'p-1' },
          },
        },
      },
      loadPortfolioSnapshot: vi.fn().mockResolvedValue({
        holdings: [{ code: '1101', qty: 1 }],
        analysisHistory: [],
        researchHistory: [],
        newsEvents: [],
        strategyBrain: null,
        dailyReport: null,
      }),
    })

    renderHook(() => usePortfolioBootstrap(props))

    await waitFor(() => {
      expect(props.setReady).toHaveBeenCalledWith(true)
      expect(props.setCloudSync).toHaveBeenCalledWith(false)
    })

    const phases = props.setBootstrapState.mock.calls.map(([value]) => value.phase)
    expect(phases).toEqual(
      expect.arrayContaining([
        'starting',
        'migrate-legacy',
        'ensure-registry',
        'load-snapshot',
        'ready',
      ])
    )
    expect(global.fetch).not.toHaveBeenCalled()
    expect(props.bootRuntimeRef.current.applyPortfolioSnapshot).toHaveBeenCalled()
    expect(props.restoreTabForPortfolio).toHaveBeenCalledWith('p-1')
    expect(props.cloudSyncStateRef.current).toEqual({ enabled: false, syncedAt: 0 })
    expect(props.bootRuntimeRef.current.portfolioTransitionRef.current).toEqual({
      isHydrating: false,
      fromPid: 'p-1',
      toPid: 'p-1',
    })
    expect(props.setReady.mock.invocationCallOrder[0]).toBeLessThan(
      props.applyTradeBackfillPatchesIfNeeded.mock.invocationCallOrder[0]
    )
  })

  it('merges owner cloud payloads during full sync boot', async () => {
    const props = createBootstrapProps({
      loadPortfolioSnapshot: vi.fn().mockResolvedValue({
        holdings: [{ code: '2330', qty: 1 }],
        analysisHistory: [{ id: 1, date: '2026-03-26' }],
        researchHistory: [{ timestamp: 1, title: 'old' }],
        newsEvents: [],
        strategyBrain: null,
        dailyReport: null,
      }),
      shouldAdoptCloudHoldings: vi.fn().mockReturnValue(true),
      normalizeHoldings: vi.fn(() => [{ code: '2330', qty: 2, normalized: true }]),
      normalizeAnalysisHistoryEntries: vi.fn(() => [
        { id: 2, date: '2026-03-27', normalized: true },
      ]),
    })

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input)
      if (url === '/api/brain?action=brain') {
        return { json: async () => ({ brain: { rules: [{ text: 'rule' }] } }) }
      }
      if (url === '/api/brain?action=history') {
        return { json: async () => ({ history: [{ id: 2, date: '2026-03-27' }] }) }
      }
      if (url === '/api/research') {
        return { json: async () => ({ reports: [{ timestamp: 2, title: 'new' }] }) }
      }

      const payload = JSON.parse(init.body)
      if (payload.action === 'load-events') {
        return { json: async () => ({ events: [{ id: 'e1', title: '法說' }] }) }
      }
      if (payload.action === 'load-holdings') {
        return { json: async () => ({ holdings: [{ code: '2330', qty: 2 }] }) }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    renderHook(() => usePortfolioBootstrap(props))

    await waitFor(() => {
      expect(props.setCloudSync).toHaveBeenCalledWith(true)
    })

    expect(global.fetch).toHaveBeenCalledTimes(5)
    expect(props.restoreTabForPortfolio).toHaveBeenCalledWith(OWNER_PORTFOLIO_ID)
    expect(props.setStrategyBrain).toHaveBeenCalledWith({
      rules: [{ text: 'rule' }],
      normalized: true,
    })
    expect(props.setNewsEvents).toHaveBeenCalledWith([
      { id: 'e1', title: '法說', normalized: true },
    ])
    expect(props.setHoldings).toHaveBeenCalledWith([{ code: '2330', qty: 2, normalized: true }])
    expect(props.setAnalysisHistory).toHaveBeenCalledWith([
      { id: 2, date: '2026-03-27', normalized: true },
    ])
    expect(props.setDailyReport).toHaveBeenCalledWith({
      id: 2,
      date: '2026-03-27',
      normalized: true,
    })
    expect(props.setResearchHistory).toHaveBeenCalledWith([
      { timestamp: 2, title: 'new' },
      { timestamp: 1, title: 'old' },
    ])
    expect(props.writeSyncAt).toHaveBeenCalledWith('pf-analysis-cloud-sync-at', expect.any(Number))
    expect(props.writeSyncAt).toHaveBeenCalledWith('pf-research-cloud-sync-at', expect.any(Number))
    expect(props.writeSyncAt).toHaveBeenCalledWith('pf-cloud-sync-at', expect.any(Number))
    expect(props.savePortfolioData).toHaveBeenCalledWith(OWNER_PORTFOLIO_ID, 'brain-v1', {
      rules: [{ text: 'rule' }],
      normalized: true,
    })
    expect(props.savePortfolioData).toHaveBeenCalledWith(OWNER_PORTFOLIO_ID, 'news-events-v1', [
      { id: 'e1', title: '法說', normalized: true },
    ])
    expect(props.savePortfolioData).toHaveBeenCalledWith(OWNER_PORTFOLIO_ID, 'holdings-v2', [
      { code: '2330', qty: 2, normalized: true },
    ])
  })

  it('runs owner cooldown branch with holdings-only cloud check', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const props = createBootstrapProps({
      readSyncAt: vi.fn().mockReturnValue(1_000_000),
      loadPortfolioSnapshot: vi.fn().mockResolvedValue({
        holdings: [{ code: '2330', qty: 1 }],
        analysisHistory: [{ id: 1, date: '2026-03-26' }],
        researchHistory: [],
        newsEvents: [],
        strategyBrain: null,
        dailyReport: null,
      }),
      shouldAdoptCloudHoldings: vi.fn().mockReturnValue(true),
      normalizeHoldings: vi.fn(() => [{ code: '2330', qty: 3, normalized: true }]),
    })

    global.fetch = vi.fn(async (input, init) => {
      expect(String(input)).toBe('/api/brain')
      expect(JSON.parse(init.body)).toEqual({ action: 'load-holdings' })
      return { json: async () => ({ holdings: [{ code: '2330', qty: 3 }] }) }
    })

    renderHook(() => usePortfolioBootstrap(props))

    await waitFor(() => {
      expect(props.setCloudSync).toHaveBeenCalledWith(true)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(props.setHoldings).toHaveBeenCalledWith([{ code: '2330', qty: 3, normalized: true }])
    expect(props.savePortfolioData).toHaveBeenCalledWith(OWNER_PORTFOLIO_ID, 'holdings-v2', [
      { code: '2330', qty: 3, normalized: true },
    ])
    expect(props.setStrategyBrain).not.toHaveBeenCalled()
    expect(props.setNewsEvents).not.toHaveBeenCalled()
    expect(props.setAnalysisHistory).not.toHaveBeenCalled()
    expect(props.setResearchHistory).not.toHaveBeenCalled()
    expect(props.writeSyncAt).not.toHaveBeenCalled()
    expect(props.cloudSyncStateRef.current).toEqual({ enabled: true, syncedAt: 1_000_000 })
  })

  it('reloads snapshot after post-ready trade backfill before cloud holdings adoption', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const applyPortfolioSnapshot = vi.fn()
    const props = createBootstrapProps({
      bootRuntimeRef: {
        current: {
          activePortfolioId: OWNER_PORTFOLIO_ID,
          marketPriceQuotes: { 2330: { price: 950 } },
          applyPortfolioSnapshot,
          setPortfolios: vi.fn(),
          setActivePortfolioId: vi.fn(),
          setViewMode: vi.fn(),
          portfolioTransitionRef: {
            current: {
              isHydrating: false,
              fromPid: OWNER_PORTFOLIO_ID,
              toPid: OWNER_PORTFOLIO_ID,
            },
          },
        },
      },
      readSyncAt: vi.fn().mockReturnValue(1_000_000),
      applyTradeBackfillPatchesIfNeeded: vi.fn().mockResolvedValue(1),
      loadPortfolioSnapshot: vi
        .fn()
        .mockResolvedValueOnce({
          holdings: [{ code: '2330', qty: 1 }],
          tradeLog: [],
          analysisHistory: [],
          researchHistory: [],
          newsEvents: [],
          strategyBrain: null,
          dailyReport: null,
        })
        .mockResolvedValueOnce({
          holdings: [{ code: '2330', qty: 9 }],
          tradeLog: [{ id: 'patched-trade' }],
          analysisHistory: [],
          researchHistory: [],
          newsEvents: [],
          strategyBrain: null,
          dailyReport: null,
        }),
      shouldAdoptCloudHoldings: vi.fn().mockReturnValue(false),
    })

    global.fetch = vi.fn(async (input, init) => {
      expect(String(input)).toBe('/api/brain')
      expect(JSON.parse(init.body)).toEqual({ action: 'load-holdings' })
      return { json: async () => ({ holdings: [{ code: '2330', qty: 5 }] }) }
    })

    renderHook(() => usePortfolioBootstrap(props))

    await waitFor(() => {
      expect(props.setCloudSync).toHaveBeenCalledWith(true)
    })

    expect(props.loadPortfolioSnapshot).toHaveBeenCalledTimes(2)
    expect(applyPortfolioSnapshot).toHaveBeenCalledTimes(2)
    expect(props.shouldAdoptCloudHoldings).toHaveBeenCalledWith(
      [{ code: '2330', qty: 9 }],
      [{ code: '2330', qty: 5 }]
    )
    expect(props.setReady.mock.invocationCallOrder[0]).toBeLessThan(
      props.applyTradeBackfillPatchesIfNeeded.mock.invocationCallOrder[0]
    )
  })

  it('ignores malformed cloud payloads during full sync boot', async () => {
    const props = createBootstrapProps({
      loadPortfolioSnapshot: vi.fn().mockResolvedValue({
        holdings: [{ code: '2330', qty: 1 }],
        analysisHistory: [{ id: 1, date: '2026-03-26' }],
        researchHistory: [{ timestamp: 1, title: 'old' }],
        newsEvents: [],
        strategyBrain: null,
        dailyReport: null,
      }),
    })

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input)
      if (url === '/api/brain?action=brain') {
        return { json: async () => ({ brain: null }) }
      }
      if (url === '/api/brain?action=history') {
        return { json: async () => ({ history: 'bad-history' }) }
      }
      if (url === '/api/research') {
        return { json: async () => ({ reports: { bad: true } }) }
      }

      const payload = JSON.parse(init.body)
      if (payload.action === 'load-events') {
        return { json: async () => ({ events: 'bad-events' }) }
      }
      if (payload.action === 'load-holdings') {
        return { json: async () => ({ holdings: { bad: true } }) }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    renderHook(() => usePortfolioBootstrap(props))

    await waitFor(() => {
      expect(props.setCloudSync).toHaveBeenCalledWith(true)
    })

    expect(props.setStrategyBrain).not.toHaveBeenCalled()
    expect(props.setNewsEvents).not.toHaveBeenCalled()
    expect(props.setHoldings).not.toHaveBeenCalled()
    expect(props.setAnalysisHistory).not.toHaveBeenCalled()
    expect(props.setDailyReport).not.toHaveBeenCalled()
    expect(props.setResearchHistory).not.toHaveBeenCalled()
    expect(props.savePortfolioData).not.toHaveBeenCalledWith(
      OWNER_PORTFOLIO_ID,
      'news-events-v1',
      expect.anything()
    )
    expect(props.savePortfolioData).not.toHaveBeenCalledWith(
      OWNER_PORTFOLIO_ID,
      'analysis-history-v1',
      expect.anything()
    )
    expect(props.savePortfolioData).not.toHaveBeenCalledWith(
      OWNER_PORTFOLIO_ID,
      'research-history-v1',
      expect.anything()
    )
    expect(props.writeSyncAt).toHaveBeenCalledWith('pf-cloud-sync-at', expect.any(Number))
  })
})
