// @vitest-environment jsdom

import { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AppPanels from '../../src/components/AppPanels.jsx'
import { PortfolioPanelsProvider } from '../../src/contexts/PortfolioPanelsContext.jsx'
import { useAppPanelsRuntime } from '../../src/hooks/useAppPanelsRuntime.js'
import { APP_ERROR_BOUNDARY_COPY } from '../../src/lib/appMessages.js'

function renderWithPanelContexts(ui, { data = {}, actions = {} } = {}) {
  return render(
    <PortfolioPanelsProvider data={data} actions={actions}>
      {ui}
    </PortfolioPanelsProvider>
  )
}

const noop = () => {}
const createDefaultReviewForm = () => ({ note: '' })

function CrossPanelDailyPropagationHarness() {
  const [dailyReport, setDailyReport] = useState(null)

  const runtime = useAppPanelsRuntime({
    data: {
      activePortfolioId: 'me',
      overviewPortfolios: [],
      overviewTotalValue: 0,
      overviewTotalPnl: 0,
      overviewDuplicateHoldings: [],
      overviewPendingItems: [],
      holdings: [
        {
          code: '2330',
          name: '台積電',
          qty: 1,
          cost: 950,
          price: 955,
          pnl: 5,
          pct: 0.53,
          value: 955,
          type: '股票',
        },
      ],
      totalVal: 955,
      totalCost: 950,
      todayTotalPnl: 5,
      winners: [],
      losers: [],
      top5: [],
      holdingsIntegrityIssues: [],
      filteredEvents: [],
      morningNote: null,
      dailyReport,
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
      watchlistFocus: null,
      watchlistRows: [],
      showRelayPlan: false,
      relayPlanExpanded: false,
      filterType: 'all',
      catalystFilter: '全部',
      dailyExpanded: false,
      researchTarget: '',
      reviewForm: createDefaultReviewForm(),
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
      createDefaultReviewForm,
    },
    controls: {
      exitOverview: noop,
      switchPortfolio: noop,
      setShowReversal: noop,
      setReviewingEvent: noop,
      updateReversal: noop,
      setScanQuery: noop,
      setScanFilter: noop,
      setSortBy: noop,
      setExpandedStock: noop,
      setRelayPlanExpanded: noop,
      setFilterType: noop,
      setCatalystFilter: noop,
      setDailyExpanded: noop,
      setStressResult: noop,
      setTab: noop,
      setExpandedNews: noop,
      setResearchResults: noop,
      setReviewForm: noop,
    },
    actions: {
      updateTargetPrice: noop,
      updateAlert: noop,
      handleWatchlistUpsert: noop,
      handleWatchlistDelete: noop,
      formatEventStockOutcomeLine: noop,
      runDailyAnalysis: async () => {
        setDailyReport({
          id: 'daily-2026-04-10',
          date: '2026/04/10',
          time: '14:05',
          insight: '今天先延續收盤分析結論，再檢查研究假設是否一致。',
          totalTodayPnl: 5,
          changes: [],
          anomalies: [],
          eventCorrelations: [],
          eventAssessments: [],
        })
      },
      runStressTest: noop,
      refreshAnalystReports: noop,
      runResearch: noop,
      enrichResearchToDossier: noop,
      applyBrainProposal: noop,
      discardBrainProposal: noop,
      submitReview: noop,
      cancelReview: noop,
    },
  })

  return (
    <PortfolioPanelsProvider
      data={runtime.portfolioPanelsData}
      actions={runtime.portfolioPanelsActions}
    >
      <section aria-label="daily-runtime-panel">
        <AppPanels
          viewMode="portfolio"
          overviewViewMode="overview"
          tab="daily"
          errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
        />
      </section>
      <section aria-label="holdings-runtime-panel">
        <AppPanels
          viewMode="portfolio"
          overviewViewMode="overview"
          tab="holdings"
          errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
        />
      </section>
      <section aria-label="research-runtime-panel">
        <AppPanels
          viewMode="portfolio"
          overviewViewMode="overview"
          tab="research"
          errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
        />
      </section>
    </PortfolioPanelsProvider>
  )
}

describe('components/AppPanels context wiring', () => {
  it('renders log panel from portfolio panel data context', async () => {
    renderWithPanelContexts(
      <AppPanels
        viewMode="portfolio"
        overviewViewMode="overview"
        tab="log"
        errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
      />,
      {
        data: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {},
          research: {},
          trade: {},
          log: {
            tradeLog: [
              {
                id: 1,
                action: '買進',
                name: '台積電',
                code: '2330',
                date: '2026/03/29',
                time: '09:30',
                qty: 1000,
                price: 950,
                qa: [{ q: '理由', a: '測試紀錄' }],
              },
            ],
          },
          news: {},
        },
        actions: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {},
          research: {},
          trade: {},
          log: {},
          news: {},
        },
      }
    )

    expect(await screen.findByText('台積電')).toBeInTheDocument()
    expect(await screen.findByText('測試紀錄')).toBeInTheDocument()
  })

  it('renders shared operating context in holdings panel from portfolio panel data context', async () => {
    renderWithPanelContexts(
      <AppPanels
        viewMode="portfolio"
        overviewViewMode="overview"
        tab="holdings"
        errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
      />,
      {
        data: {
          overview: {},
          holdings: {
            holdings: [],
            totalVal: 0,
            totalCost: 0,
            todayTotalPnl: 0,
            winners: [],
            losers: [],
            top5: [],
            holdingsIntegrityIssues: [],
            latestInsight: '今天先補齊資料，再做深度研究。',
            operatingContext: {
              portfolioLabel: '主組合',
              holdingsCount: 0,
              pendingCount: 2,
              attentionCount: 1,
              activeEventCount: 3,
              refreshBacklogCount: 4,
              nextActionLabel: '先補齊資料，再做深度研究',
              nextActionReason: '研究、事件與持倉都應共用同一份資料基線。',
              latestInsightSummary: '今天先補齊資料，再做深度研究。',
              focus: {
                code: '6274',
                name: '台燿',
                summary: '先看法說與毛利率驗證。',
                upsideLabel: '潛在 +40.6%',
              },
            },
          },
          holdingsTable: {
            holdings: [],
            expandedStock: null,
          },
          watchlist: {},
          events: {},
          daily: {},
          research: {},
          trade: {},
          log: {},
          news: {},
        },
        actions: {
          overview: {},
          holdings: {
            setShowReversal: vi.fn(),
            setReviewingEvent: vi.fn(),
            updateReversal: vi.fn(),
            setScanQuery: vi.fn(),
            setScanFilter: vi.fn(),
            setSortBy: vi.fn(),
            setExpandedStock: vi.fn(),
          },
          holdingsTable: {
            setExpandedStock: vi.fn(),
            onUpdateTarget: vi.fn(),
            onUpdateAlert: vi.fn(),
          },
          watchlist: {},
          events: {},
          daily: {},
          research: {},
          trade: {},
          log: {},
          news: {},
        },
      }
    )

    expect(await screen.findByText('本輪操作脈絡')).toBeInTheDocument()
    expect(await screen.findByText('先補齊資料，再做深度研究')).toBeInTheDocument()
    expect(await screen.findByText('焦點標的：台燿 (6274)')).toBeInTheDocument()
  })

  it('wires daily actions from portfolio panel actions context', async () => {
    const runDailyAnalysis = vi.fn()
    const runStressTest = vi.fn()

    renderWithPanelContexts(
      <AppPanels
        viewMode="portfolio"
        overviewViewMode="overview"
        tab="daily"
        errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
      />,
      {
        data: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {
            morningNote: null,
            dailyReport: null,
            analyzing: false,
            analyzeStep: '',
            stressResult: null,
            stressTesting: false,
            dailyExpanded: false,
            newsEvents: [],
            expandedStock: null,
            strategyBrain: {},
          },
          research: {},
          trade: {},
          log: {},
          news: {},
        },
        actions: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {
            setDailyExpanded: vi.fn(),
            runDailyAnalysis,
            runStressTest,
            closeStressResult: vi.fn(),
            setTab: vi.fn(),
            setExpandedNews: vi.fn(),
            setExpandedStock: vi.fn(),
          },
          research: {},
          trade: {},
          log: {},
          news: {},
        },
      }
    )

    fireEvent.click(await screen.findByText('開始今日收盤分析'))
    expect(runDailyAnalysis).toHaveBeenCalledTimes(1)
  })

  it('soft-routes pending review items into the news review flow before daily analysis', async () => {
    const setTab = vi.fn()
    const setExpandedNews = vi.fn()
    const runDailyAnalysis = vi.fn()

    renderWithPanelContexts(
      <AppPanels
        viewMode="portfolio"
        overviewViewMode="overview"
        tab="daily"
        errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
      />,
      {
        data: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {
            morningNote: null,
            dailyReport: null,
            analyzing: false,
            analyzeStep: '',
            stressResult: null,
            stressTesting: false,
            dailyExpanded: false,
            newsEvents: [
              {
                id: 'event-1',
                title: '法說會結果待復盤',
                date: '2026/04/10',
                stocks: ['台積電 2330'],
                status: 'tracking',
              },
            ],
            expandedStock: null,
            strategyBrain: {},
          },
          research: {},
          trade: {},
          log: {},
          news: {},
        },
        actions: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {
            setDailyExpanded: vi.fn(),
            runDailyAnalysis,
            runStressTest: vi.fn(),
            closeStressResult: vi.fn(),
            setTab,
            setExpandedNews,
            setExpandedStock: vi.fn(),
          },
          research: {},
          trade: {},
          log: {},
          news: {},
        },
      }
    )

    expect(await screen.findByText('待復盤事件 · 1件')).toBeInTheDocument()

    fireEvent.click(screen.getByText('先前往復盤'))
    expect(setTab).toHaveBeenCalledWith('news')
    expect(setExpandedNews).toHaveBeenCalledTimes(1)
    expect([...setExpandedNews.mock.calls[0][0]]).toEqual(['event-1'])
    expect(runDailyAnalysis).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('仍要分析'))
    expect(runDailyAnalysis).toHaveBeenCalledTimes(1)
  })

  it('routes daily report follow-up CTA into the research flow without triggering new API work', async () => {
    const setTab = vi.fn()
    const runDailyAnalysis = vi.fn()

    renderWithPanelContexts(
      <AppPanels
        viewMode="portfolio"
        overviewViewMode="overview"
        tab="daily"
        errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
      />,
      {
        data: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {
            morningNote: null,
            dailyReport: {
              id: 'daily-1',
              date: '2026/04/10',
              time: '14:05',
              totalTodayPnl: 12,
              changes: [],
              anomalies: [],
              eventCorrelations: [],
              eventAssessments: [],
            },
            analyzing: false,
            analyzeStep: '',
            stressResult: null,
            stressTesting: false,
            dailyExpanded: false,
            newsEvents: [],
            expandedStock: null,
            strategyBrain: {},
            operatingContext: {
              portfolioLabel: '主組合',
              holdingsCount: 1,
              nextActionLabel: '先延續最近一次收盤分析的結論',
              nextActionReason: '先把分析結論帶進研究頁確認假設。',
            },
          },
          research: {},
          trade: {},
          log: {},
          news: {},
        },
        actions: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {
            setDailyExpanded: vi.fn(),
            runDailyAnalysis,
            runStressTest: vi.fn(),
            closeStressResult: vi.fn(),
            setTab,
            setExpandedNews: vi.fn(),
            setExpandedStock: vi.fn(),
          },
          research: {},
          trade: {},
          log: {},
          news: {},
        },
      }
    )

    fireEvent.click(await screen.findByText('前往深度研究'))
    expect(setTab).toHaveBeenCalledWith('research')
    expect(runDailyAnalysis).not.toHaveBeenCalled()
  })

  it('keeps rerun analysis available but warns when review backlog is still open', async () => {
    const setTab = vi.fn()
    const setExpandedNews = vi.fn()
    const runDailyAnalysis = vi.fn()

    renderWithPanelContexts(
      <AppPanels
        viewMode="portfolio"
        overviewViewMode="overview"
        tab="daily"
        errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
      />,
      {
        data: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {
            morningNote: null,
            dailyReport: {
              id: 'daily-2',
              date: '2026/04/11',
              time: '14:05',
              totalTodayPnl: 6,
              changes: [],
              anomalies: [],
              eventCorrelations: [],
              eventAssessments: [],
              needsReview: [],
            },
            analyzing: false,
            analyzeStep: '',
            stressResult: null,
            stressTesting: false,
            dailyExpanded: false,
            newsEvents: [
              {
                id: 'event-2',
                title: '營收公告待復盤',
                date: '2026/04/11',
                stocks: ['聯發科 2454'],
                status: 'pending',
              },
            ],
            expandedStock: null,
            strategyBrain: {},
          },
          research: {},
          trade: {},
          log: {},
          news: {},
        },
        actions: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {
            setDailyExpanded: vi.fn(),
            runDailyAnalysis,
            runStressTest: vi.fn(),
            closeStressResult: vi.fn(),
            setTab,
            setExpandedNews,
            setExpandedStock: vi.fn(),
          },
          research: {},
          trade: {},
          log: {},
          news: {},
        },
      }
    )

    expect(await screen.findByText('待復盤事件 · 1件')).toBeInTheDocument()
    expect(screen.getByText('仍要重新分析')).toBeInTheDocument()

    fireEvent.click(screen.getByText('先前往復盤'))
    expect(setTab).toHaveBeenCalledWith('news')
    expect([...setExpandedNews.mock.calls[0][0]]).toEqual(['event-2'])

    fireEvent.click(screen.getByText('仍要重新分析'))
    expect(runDailyAnalysis).toHaveBeenCalledTimes(1)
  })

  it('routes events empty-state CTA into the daily analysis flow without auto-running API work', async () => {
    const setTab = vi.fn()

    renderWithPanelContexts(
      <AppPanels
        viewMode="portfolio"
        overviewViewMode="overview"
        tab="events"
        errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
      />,
      {
        data: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {
            showRelayPlan: false,
            relayPlanExpanded: false,
            filterType: 'all',
            filteredEvents: [],
            catalystFilter: '全部',
            operatingContext: {
              portfolioLabel: '主組合',
              holdingsCount: 20,
              pendingCount: 3,
              attentionCount: 2,
              activeEventCount: 3,
              refreshBacklogCount: 1,
              nextActionLabel: '先處理待驗證事件，再決定動作',
              nextActionReason: '先確認事件落地，再進入收盤分析。',
            },
          },
          daily: {},
          research: {},
          trade: {},
          log: {},
          news: {},
        },
        actions: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {
            setRelayPlanExpanded: vi.fn(),
            setFilterType: vi.fn(),
            setCatalystFilter: vi.fn(),
            onNavigateDaily: () => setTab('daily'),
          },
          daily: {},
          research: {},
          trade: {},
          log: {},
          news: {},
        },
      }
    )

    fireEvent.click(await screen.findByText('🔍 前往收盤分析'))
    expect(setTab).toHaveBeenCalledWith('daily')
  })

  it('propagates daily analysis insight into holdings and research operating context through shared runtime data', async () => {
    render(<CrossPanelDailyPropagationHarness />)

    const holdingsPanel = screen.getByLabelText('holdings-runtime-panel')
    const researchPanel = screen.getByLabelText('research-runtime-panel')

    expect(
      within(holdingsPanel).queryByText('先延續最近一次收盤分析的結論')
    ).not.toBeInTheDocument()
    expect(
      within(researchPanel).queryAllByText('今天先延續收盤分析結論，再檢查研究假設是否一致。')
    ).toHaveLength(0)

    fireEvent.click(await screen.findByText('開始今日收盤分析'))

    await waitFor(() => {
      expect(within(holdingsPanel).getByText('先延續最近一次收盤分析的結論')).toBeInTheDocument()
      expect(
        within(holdingsPanel).getAllByText('今天先延續收盤分析結論，再檢查研究假設是否一致。')
          .length
      ).toBeGreaterThan(0)
      expect(within(researchPanel).getByText('先延續最近一次收盤分析的結論')).toBeInTheDocument()
      expect(
        within(researchPanel).getAllByText('今天先延續收盤分析結論，再檢查研究假設是否一致。')
          .length
      ).toBeGreaterThan(0)
    })
  })

  it('keeps the research data refresh center aligned with report refresh instead of deep research', async () => {
    const onRefresh = vi.fn()
    const onResearch = vi.fn()

    renderWithPanelContexts(
      <AppPanels
        viewMode="portfolio"
        overviewViewMode="overview"
        tab="research"
        errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
      />,
      {
        data: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {},
          research: {
            holdings: [{ code: '2330', name: '台積電' }],
            researching: false,
            researchTarget: null,
            reportRefreshing: false,
            reportRefreshStatus: '',
            dataRefreshRows: [
              {
                code: '2330',
                name: '台積電',
                targetStatus: '缺少',
                fundamentalStatus: '過期',
              },
            ],
            researchResults: null,
            researchHistory: [],
            enrichingResearchCode: null,
            proposalActionId: null,
            proposalActionType: null,
            STOCK_META: {},
            IND_COLOR: {},
            operatingContext: {
              portfolioLabel: '主組合',
              holdingsCount: 1,
              refreshBacklogCount: 1,
              nextActionLabel: '先補齊資料，再做深度研究',
              nextActionReason: '公開報告與財報資料仍需刷新。',
            },
          },
          trade: {},
          log: {},
          news: {},
        },
        actions: {
          overview: {},
          holdings: {},
          holdingsTable: {},
          watchlist: {},
          events: {},
          daily: {},
          research: {
            onEvolve: vi.fn(),
            onRefresh,
            onResearch,
            onEnrich: vi.fn(),
            onApplyProposal: vi.fn(),
            onDiscardProposal: vi.fn(),
            onSelectHistory: vi.fn(),
          },
          trade: {},
          log: {},
          news: {},
        },
      }
    )

    expect(screen.queryByText('先研究這檔')).not.toBeInTheDocument()
    expect(
      screen.getByText('先用上方「刷新公開報告」補齊資料，再開始個股或全組合研究。')
    ).toBeInTheDocument()

    fireEvent.click(await screen.findByText('刷新公開報告'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(onResearch).not.toHaveBeenCalled()
  })
})
