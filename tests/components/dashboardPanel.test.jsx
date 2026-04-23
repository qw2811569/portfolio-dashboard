// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPanel } from '../../src/components/overview/DashboardPanel.jsx'

function buildProps(overrides = {}) {
  return {
    holdings: [],
    morningNote: null,
    todayTotalPnl: 0,
    totalVal: 0,
    totalCost: 0,
    winners: [],
    losers: [],
    latestInsight: null,
    newsEvents: [],
    urgentCount: 0,
    todayAlertSummary: '',
    ...overrides,
  }
}

describe('components/DashboardPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders without crashing when given empty data', () => {
    const { container } = render(<DashboardPanel {...buildProps()} />)
    expect(container.firstChild).toBeTruthy()
    expect(container.querySelector('[data-empty-state="holdings"]')).toBeTruthy()
  })

  it('shows the today pnl hero value when todayTotalPnl is provided', () => {
    const { container } = render(<DashboardPanel {...buildProps({ todayTotalPnl: 1234 })} />)
    // TodayPnlHero formats with thousands separators — check for '1,234'
    expect(container.textContent).toContain('1,234')
  })

  it('renders a soft-language headline and demoted reminder bell from dossier state', () => {
    render(
      <DashboardPanel
        {...buildProps({
          holdings: [
            { code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 },
            { code: '2454', name: '聯發科', qty: 1, cost: 1400, price: 1460 },
          ],
          holdingDossiers: [
            {
              code: '2330',
              name: '台積電',
              thesis: { pillars: [{ status: 'stable' }] },
              freshness: { fundamentals: 'fresh' },
              position: { price: 950 },
              targetAggregate: { lowerBound: 800, upperBound: 1000 },
            },
            {
              code: '2454',
              name: '聯發科',
              thesis: { pillars: [{ status: 'stable' }] },
              freshness: { fundamentals: 'fresh' },
              position: { price: 1460 },
              targetAggregate: { lowerBound: 1200, upperBound: 1500 },
            },
          ],
          dataRefreshRows: [
            {
              code: '2454',
              name: '聯發科',
              targetLabel: '最新目標價仍在補齊中',
            },
          ],
        })}
      />
    )

    expect(screen.getByTestId('dashboard-headline')).toHaveTextContent('接近估值上緣')
    expect(screen.getByTestId('dashboard-reminder-toggle')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dashboard-reminder-toggle'))

    expect(screen.getByTestId('dashboard-reminder-drawer')).toBeInTheDocument()
    expect(screen.getByText('聯發科 (2454)')).toBeInTheDocument()
  })

  it('renders the overview compare strip below the hero and jumps to overview on click', () => {
    const onNavigate = vi.fn()

    render(
      <DashboardPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          onNavigate,
          compareStrip: {
            primary: { label: '小奎主要投資' },
            secondary: { label: '金聯成組合' },
            summaryText: '小奎主要投資 +0.7% · 金聯成組合 +0.6% · 今日差距 +0.1pp',
            insightText: '小奎主要投資 今天比 金聯成組合 快 +0.1pp · 主要拉動是 台積電 (2330)',
            tone: 'calm',
            staleStatus: 'stale',
          },
        })}
      />
    )

    expect(screen.getByTestId('dashboard-compare-strip')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-compare-summary')).toHaveTextContent('今日差距 +0.1pp')
    expect(screen.getByText('stale')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dashboard-compare-summary'))

    expect(onNavigate).toHaveBeenCalledWith('overview')
  })

  it('surfaces the urgent alert summary when urgentCount is non-zero', () => {
    const { container } = render(
      <DashboardPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          urgentCount: 3,
          todayAlertSummary: '今日有 3 檔需要關注',
          newsEvents: [{ id: 1, title: 'test', status: 'tracking' }],
        })}
      />
    )
    expect(container.textContent).toContain('今日有 3 檔需要關注')
  })

  it('renders Today in Markets items from macro and calendar feeds', () => {
    render(
      <DashboardPanel
        {...buildProps({
          newsEvents: [
            {
              id: 'market-1',
              source: 'market-cache',
              type: 'market-summary',
              date: '2026-04-18',
              title: '台股加權指數收 21,245 點，上漲 0.8%',
              detail: '外資買超，電子權值股撐盤。',
              link: 'https://example.com/market',
            },
            {
              id: 'macro-1',
              source: 'auto-calendar',
              type: 'macro',
              date: '2026-04-18',
              title: '台灣央行理監事會議',
              detail: '決定利率與選擇性信用管制',
            },
            {
              id: 'calendar-1',
              source: 'auto-calendar',
              type: 'revenue',
              date: '2026-04-20',
              title: '2026/03 月營收公布截止',
              detail: '關注持股最新營收',
            },
          ],
        })}
      />
    )

    expect(screen.getByText('Today in Markets')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '大盤｜台股加權指數收 21,245 點，上漲 0.8%' })
    ).toHaveAttribute('href', 'https://example.com/market')
    expect(screen.getByText('總經｜台灣央行理監事會議')).toBeInTheDocument()
    expect(screen.getByText('行事曆｜2026/03 月營收公布截止')).toBeInTheDocument()
  })

  it('shows a truthful empty state when no market items exist', () => {
    render(<DashboardPanel {...buildProps()} />)
    expect(screen.getByText('市場資訊暫無更新')).toBeInTheDocument()
  })

  it('surfaces Morning Note with deep-links for events holdings and daily follow-up', () => {
    const onNavigate = vi.fn()

    render(
      <DashboardPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          onNavigate,
          morningNote: {
            date: '2026/04/18',
            sections: {
              todayEvents: [
                {
                  title: '台積電法說',
                  impactLabel: 'HIGH',
                  relatedPillars: [{ stockId: '2330', pillar: { id: 'p1' } }],
                },
              ],
              holdingStatus: [
                {
                  code: '2330',
                  name: '台積電',
                  pillarSummary: '2/3 on_track',
                },
              ],
              watchlistAlerts: [{ code: '2454', name: '聯發科' }],
              announcements: [],
            },
          },
        })}
      />
    )

    expect(screen.getByText('Morning Note')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('台積電法說')).toBeInTheDocument()

    fireEvent.click(screen.getByText('前往事件'))
    fireEvent.click(screen.getByText('查看持倉'))
    fireEvent.click(screen.getByText('盤後接續'))

    expect(onNavigate.mock.calls).toEqual([['events'], ['holdings'], ['daily']])
  })
})
