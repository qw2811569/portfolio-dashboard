import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AppPanels from '../../src/components/AppPanels.jsx'
import { PortfolioPanelsProvider } from '../../src/contexts/PortfolioPanelsContext.jsx'
import { APP_ERROR_BOUNDARY_COPY } from '../../src/lib/appMessages.js'

function renderWithPanelContexts(ui, { data = {}, actions = {} } = {}) {
  return render(
    <PortfolioPanelsProvider data={data} actions={actions}>
      {ui}
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
})
