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

  it('renders dashboard panel from portfolio panel context and reuses canonical navigation actions', async () => {
    const onNavigate = vi.fn()

    renderWithPanelContexts(
      <AppPanels
        viewMode="portfolio"
        overviewViewMode="overview"
        tab="dashboard"
        errorBoundaryCopy={APP_ERROR_BOUNDARY_COPY}
      />,
      {
        data: {
          dashboard: {
            holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950, value: 950 }],
            watchlist: [{ code: '2454', name: '聯發科' }],
            holdingDossiers: [
              {
                code: '2330',
                name: '台積電',
                thesis: { pillars: [{ status: 'stable' }] },
                freshness: { fundamentals: 'fresh' },
                position: { price: 950 },
                targetAggregate: { lowerBound: 800, upperBound: 1000 },
              },
            ],
            dataRefreshRows: [],
            morningNote: {
              date: '2026/04/24',
              sections: {
                todayEvents: [{ title: '台積電法說', impactLabel: 'HIGH', relatedPillars: [] }],
                holdingStatus: [{ code: '2330', name: '台積電', pillarSummary: '1/1 on_track' }],
                watchlistAlerts: [],
                announcements: [],
              },
            },
            todayTotalPnl: 10,
            totalVal: 950,
            totalCost: 900,
            winners: [],
            losers: [],
            latestInsight: '先延續最近一次收盤分析結論。',
            newsEvents: [],
            urgentCount: 0,
            todayAlertSummary: '',
            portfolioId: 'me',
            portfolioName: '我',
            viewMode: 'retail',
          },
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
        actions: {
          dashboard: {
            onNavigate,
            onRefreshReminder: vi.fn(),
          },
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

    expect(await screen.findByText('Morning Note')).toBeInTheDocument()
    fireEvent.click(screen.getByText('前往事件'))
    expect(onNavigate).toHaveBeenCalledWith('events')
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
            latestInsight: '資料補齊中，研究結論會跟著更新。',
            operatingContext: {
              portfolioLabel: '主組合',
              holdingsCount: 0,
              pendingCount: 2,
              attentionCount: 1,
              activeEventCount: 3,
              refreshBacklogCount: 4,
              refreshBacklogItems: [{ code: '6274', name: '台燿' }],
              headline: '資料補齊中 · 研究結論會跟著更新',
              headlineTone: 'watch',
              nextActionLabel: '資料補齊中 · 研究結論會跟著更新',
              nextActionReason: '研究、事件與持倉都應共用同一份資料基線。',
              latestInsightSummary: '資料補齊中，研究結論會跟著更新。',
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

    expect(await screen.findByText('今日狀態')).toBeInTheDocument()
    expect(await screen.findByText('資料補齊中 · 研究結論會跟著更新')).toBeInTheDocument()
    expect(await screen.findByText('台燿 (6274)')).toBeInTheDocument()
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

  it('labels preliminary daily analysis as a fast close version and exposes a confirm rerun CTA', async () => {
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
              id: 'daily-3',
              date: '2026/04/11',
              time: '14:20',
              totalTodayPnl: 18,
              changes: [],
              anomalies: [],
              eventCorrelations: [],
              eventAssessments: [],
              needsReview: [],
              analysisStage: 't0-preliminary',
              analysisStageLabel: '收盤快版',
              analysisVersion: 1,
              finmindConfirmation: {
                expectedMarketDate: '2026-04-11',
                status: 'preliminary',
                pendingCodes: ['2330'],
              },
            },
            analysisHistory: [],
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
            runStressTest: vi.fn(),
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

    expect(await screen.findAllByText('收盤快版')).toHaveLength(2)
    expect(screen.getByText('仍有 1 檔還在等 FinMind 收盤後資料')).toBeInTheDocument()

    fireEvent.click(screen.getByText('跑資料確認版'))
    expect(runDailyAnalysis).toHaveBeenCalledTimes(1)
  })

  it('renders same-day diff details only when both staged versions exist', async () => {
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
              id: 'daily-confirmed',
              date: '2026/04/11',
              time: '18:40',
              totalTodayPnl: 28,
              changes: [],
              anomalies: [],
              eventCorrelations: [],
              eventAssessments: [{ id: 'event-1' }],
              needsReview: [],
              aiInsight: '事件已確認，今晚重點轉向明日延續性。',
              analysisStage: 't1-confirmed',
              analysisStageLabel: '資料確認版',
              analysisVersion: 2,
              finmindDataCount: 12,
              finmindConfirmation: {
                expectedMarketDate: '2026-04-11',
                status: 'confirmed',
                pendingCodes: [],
              },
            },
            analysisHistory: [
              {
                id: 'daily-confirmed',
                date: '2026/04/11',
                time: '18:40',
                totalTodayPnl: 28,
                changes: [],
                anomalies: [],
                eventCorrelations: [],
                eventAssessments: [{ id: 'event-1' }],
                needsReview: [],
                aiInsight: '事件已確認，今晚重點轉向明日延續性。',
                analysisStage: 't1-confirmed',
                analysisStageLabel: '資料確認版',
                analysisVersion: 2,
                finmindDataCount: 12,
                finmindConfirmation: {
                  expectedMarketDate: '2026-04-11',
                  status: 'confirmed',
                  pendingCodes: [],
                },
              },
              {
                id: 'daily-preliminary',
                date: '2026/04/11',
                time: '14:02',
                totalTodayPnl: 18,
                changes: [],
                anomalies: [{ id: 'warn-1' }],
                eventCorrelations: [],
                eventAssessments: [],
                needsReview: [],
                aiInsight: '先看今天事件是否已經落地。',
                analysisStage: 't0-preliminary',
                analysisStageLabel: '收盤快版',
                analysisVersion: 1,
                finmindDataCount: 4,
                finmindConfirmation: {
                  expectedMarketDate: '2026-04-11',
                  status: 'preliminary',
                  pendingCodes: ['2330'],
                },
              },
            ],
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
            runDailyAnalysis: vi.fn(),
            runStressTest: vi.fn(),
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

    expect(await screen.findByText('同日版本差異')).toBeInTheDocument()
    expect(screen.getByTestId('daily-diff-toggle')).toHaveTextContent('展開差異')
    fireEvent.click(screen.getByTestId('daily-diff-toggle'))
    expect(screen.getByTestId('daily-diff-pane')).toBeInTheDocument()
    expect(screen.getByText('AI 總結')).toBeInTheDocument()
    expect(screen.getAllByText('t0 快版').length).toBeGreaterThan(0)
    expect(screen.getAllByText('t1 確認版').length).toBeGreaterThan(0)
    expect(screen.getByText('收起差異')).toBeInTheDocument()
  })

  it('surfaces post-close ritual mode and the tomorrow-action card on the daily panel', () => {
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
              id: 'daily-ritual',
              date: '2026/04/11',
              time: '18:40',
              totalTodayPnl: 28,
              changes: [],
              anomalies: [],
              eventCorrelations: [],
              eventAssessments: [],
              needsReview: [],
              aiInsight: '今晚重點先收斂成明日動作卡。',
              analysisStage: 't1-confirmed',
              analysisStageLabel: '資料確認版',
              analysisVersion: 2,
              finmindDataCount: 12,
              ritualMode: {
                mode: 'post-close',
                label: '收盤後儀式模式',
                triggerSource: 'manual',
              },
              tomorrowActionCard: {
                title: '明日動作卡',
                immediateActions: ['2330 站回 5 日線再補回 1/3。'],
                watchlist: ['3443 等法說後再決定是否加碼。'],
                notes: [],
              },
            },
            analysisHistory: [],
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
            runDailyAnalysis: vi.fn(),
            runStressTest: vi.fn(),
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

    expect(screen.getByText('收盤後儀式模式')).toBeInTheDocument()
    expect(screen.getByText('明日立即執行')).toBeInTheDocument()
    expect(screen.getByText(/2330 站回 5 日線再補回 1\/3/)).toBeInTheDocument()
    expect(screen.getByText('週報匯出內容')).toBeInTheDocument()
    expect(screen.getByText(/Weekly Narrative/i)).toBeInTheDocument()
    expect(screen.getByText(/insider compliance notes/i)).toBeInTheDocument()
  })

  it('hides the same-day diff card when only one report version exists', () => {
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
              id: 'daily-only',
              date: '2026/04/11',
              time: '18:40',
              totalTodayPnl: 28,
              changes: [],
              anomalies: [],
              eventCorrelations: [],
              eventAssessments: [],
              needsReview: [],
              aiInsight: '單一版本。',
              analysisStage: 't1-confirmed',
              analysisStageLabel: '資料確認版',
              analysisVersion: 1,
            },
            analysisHistory: [],
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
            runDailyAnalysis: vi.fn(),
            runStressTest: vi.fn(),
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

    expect(screen.queryByText('同日版本差異')).not.toBeInTheDocument()
  })

  it('auto-probes a same-day preliminary report when the daily panel mounts', async () => {
    const maybeAutoConfirmDailyReport = vi.fn(async () => ({ status: 'waiting' }))

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
              id: 'daily-preliminary',
              date: '2026/04/11',
              time: '14:20',
              totalTodayPnl: 18,
              changes: [{ code: '2330', name: '台積電' }],
              anomalies: [],
              eventCorrelations: [],
              eventAssessments: [],
              needsReview: [],
              analysisStage: 't0-preliminary',
              analysisStageLabel: '收盤快版',
              analysisVersion: 1,
              finmindConfirmation: {
                expectedMarketDate: '2026-04-11',
                status: 'preliminary',
                pendingCodes: ['2330'],
              },
            },
            analysisHistory: [],
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
            runDailyAnalysis: vi.fn(),
            maybeAutoConfirmDailyReport,
            runStressTest: vi.fn(),
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

    await waitFor(() => expect(maybeAutoConfirmDailyReport).toHaveBeenCalledTimes(1))
    expect(screen.getByText('自動資料確認')).toBeInTheDocument()
  })

  it('renders the quiet-window events empty state without auto-routing into daily analysis', async () => {
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

    expect(await screen.findByText('未來 30 天無重大事件')).toBeInTheDocument()
    expect(document.querySelector('[data-empty-state="events"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /前往收盤分析/i })).not.toBeInTheDocument()
    expect(setTab).not.toHaveBeenCalled()
  })

  it('propagates daily analysis insight into holdings and research operating context through shared runtime data', async () => {
    render(<CrossPanelDailyPropagationHarness />)

    const holdingsPanel = screen.getByLabelText('holdings-runtime-panel')
    const researchPanel = screen.getByLabelText('research-runtime-panel')
    const sharedSummary = '今天先延續收盤分析結論，再檢查研究假設是否一致。'

    expect(within(holdingsPanel).queryAllByText(sharedSummary)).toHaveLength(0)
    expect(within(researchPanel).queryAllByText(sharedSummary)).toHaveLength(0)

    fireEvent.click(await screen.findByText('開始今日收盤分析'))

    await waitFor(() => {
      expect(within(holdingsPanel).getByText('今日狀態')).toBeInTheDocument()
      expect(within(holdingsPanel).getAllByText(sharedSummary).length).toBeGreaterThan(0)
      expect(within(researchPanel).getByText('先延續最近一次收盤分析的結論')).toBeInTheDocument()
      expect(within(researchPanel).getAllByText(sharedSummary).length).toBeGreaterThan(0)
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
              nextActionLabel: '資料補齊中 · 研究結論會跟著更新',
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
      screen.getByText('先按上方「補最新報告」，資料齊一點再開始研究會比較準。')
    ).toBeInTheDocument()

    fireEvent.click(await screen.findByText('補最新報告'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(onResearch).not.toHaveBeenCalled()
  })
})
