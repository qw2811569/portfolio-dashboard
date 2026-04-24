// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPanel } from '../../src/components/overview/DashboardPanel.jsx'
import { getDailyPrinciple } from '../../src/lib/dailyPrinciples.js'

const originalMatchMedia = window.matchMedia

function mockMatchMedia(matches) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

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
    vi.restoreAllMocks()
    if (typeof originalMatchMedia === 'function') {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
      return
    }

    delete window.matchMedia
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

  it('renders the daily principle copy near the dashboard hero', () => {
    render(<DashboardPanel {...buildProps({ holdings: [{ code: '2330', name: '台積電' }] })} />)

    expect(screen.getByTestId('daily-principle-card')).toBeInTheDocument()
    expect(screen.getByTestId('daily-principle-copy')).toHaveTextContent(getDailyPrinciple())
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

  it('renders Today in Markets items from central-bank, macro, and calendar feeds', () => {
    render(
      <DashboardPanel
        {...buildProps({
          newsEvents: [
            {
              id: 'cbc-1',
              source: 'cbc-calendar',
              type: 'macro',
              date: '2026-04-18',
              time: '16:00',
              title: '台灣央行理監事會議',
              detail: '決定利率與選擇性信用管制',
              sourceUpdatedAt: '2026-04-18T01:20:00.000Z',
              link: 'https://example.com/cbc',
            },
            {
              id: 'macro-1',
              source: 'dgbas-calendar',
              type: 'macro',
              date: '2026-04-30',
              time: '16:00',
              title: '2026 Q1 GDP 概估',
              detail: '主計總處更新第一季經濟成長輪廓',
              sourceUpdatedAt: '2026-04-18T01:20:00.000Z',
            },
            {
              id: 'calendar-1',
              source: 'finmind-dividend',
              type: 'dividend',
              eventType: 'ex-dividend',
              date: '2026-05-03',
              title: '台積電(2330) 除息交易日',
              detail: '現金股利 4.50 元',
              sourceUpdatedAt: '2026-04-18T01:20:00.000Z',
            },
          ],
        })}
      />
    )

    const card = screen.getByTestId('today-in-markets-card')

    expect(card).toHaveTextContent('Today in Markets')
    expect(card).toHaveTextContent('央行')
    expect(card).toHaveTextContent('總經')
    expect(card).toHaveTextContent('行事曆')
    expect(screen.getByRole('link', { name: '台灣央行理監事會議' })).toHaveAttribute(
      'href',
      'https://example.com/cbc'
    )
    expect(card).toHaveTextContent('2026 Q1 GDP 概估')
    expect(card).toHaveTextContent('台積電(2330) 除息交易日')
    expect(screen.getByTestId('today-in-markets-list')).toHaveAttribute(
      'data-layout',
      'desktop-stack'
    )
  })

  it('shows a stale badge when today in markets data is older than one day', () => {
    const staleTimestamp = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

    render(
      <DashboardPanel
        {...buildProps({
          newsEvents: [
            {
              id: 'stale-1',
              source: 'cbc-calendar',
              type: 'macro',
              date: '2026-04-18',
              title: '台灣央行理監事會議',
              sourceUpdatedAt: staleTimestamp,
            },
          ],
        })}
      />
    )

    expect(screen.getByTitle('today in markets freshness')).toHaveTextContent('2 天前')
  })

  it('switches Today in Markets into the mobile single-column branch', () => {
    mockMatchMedia(true)

    render(
      <DashboardPanel
        {...buildProps({
          newsEvents: [
            {
              id: 'mobile-1',
              source: 'dgbas-calendar',
              type: 'macro',
              date: '2026-04-18',
              title: '2026 Q1 GDP 概估',
              sourceUpdatedAt: '2026-04-18T01:20:00.000Z',
            },
          ],
        })}
      />
    )

    expect(screen.getByTestId('today-in-markets-list')).toHaveAttribute(
      'data-layout',
      'mobile-single-column'
    )
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
            headline: '今天先把節奏排好',
            summary: '先看法說，再看主部位。',
            lead: '盤前先把今天最容易影響情緒的兩三件事放在前面。',
            focusPoints: [
              {
                id: 'event-1',
                tone: 'watch',
                title: '台積電法說直接牽動 2330',
                body: '今天的盤前節奏先被這一題定義。',
              },
            ],
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
    expect(screen.getByTestId('morning-note-headline')).toHaveTextContent('今天先把節奏排好')
    expect(screen.getByTestId('morning-note-lead')).toHaveTextContent('先看法說，再看主部位。')
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('台積電法說')).toBeInTheDocument()

    fireEvent.click(screen.getByText('前往事件'))
    fireEvent.click(screen.getByText('查看持倉'))
    fireEvent.click(screen.getByText('盤後接續'))

    expect(onNavigate.mock.calls).toEqual([['events'], ['holdings'], ['daily']])
  })

  it('renders fallback copy and stale badge when pre-open note is missing', () => {
    render(
      <DashboardPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          morningNote: {
            date: '2026/04/20',
            staleStatus: 'missing',
            fallbackMessage: '今日無 pre-open 更新 · 請等開盤 T1',
            sections: {
              todayEvents: [],
              holdingStatus: [],
              watchlistAlerts: [],
              announcements: [],
            },
          },
        })}
      />
    )

    expect(screen.getByTitle('morning note freshness')).toHaveTextContent('missing')
    expect(screen.getByTestId('morning-note-fallback')).toHaveTextContent(
      '今日無 pre-open 更新 · 請等開盤 T1'
    )
  })

  it('renders explicit accuracy gate block reason for failed morning notes', () => {
    render(
      <DashboardPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          morningNote: {
            date: '2026/04/20',
            staleStatus: 'failed',
            blockedReason: 'AI confidence 0.42 below 0.70',
            sections: {
              todayEvents: [],
              holdingStatus: [],
              watchlistAlerts: [],
              announcements: [],
            },
          },
        })}
      />
    )

    expect(screen.getByTitle('morning note freshness')).toHaveTextContent('failed')
    expect(screen.getByTestId('morning-note-blocked-reason')).toHaveTextContent(
      'AI confidence 0.42 below 0.70'
    )
  })

  it('shows a soft stale snapshot reminder when the daily snapshot is stale', () => {
    render(
      <DashboardPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          dailySnapshotStatus: {
            stale: true,
            badgeStatus: 'stale',
            lastSuccessAt: '2026-04-22T19:00:00.000Z',
          },
        })}
      />
    )

    expect(screen.getByTestId('daily-snapshot-status-card')).toBeInTheDocument()
    expect(screen.getByTestId('daily-snapshot-status-copy')).toHaveTextContent('已超過 36 小時')
    expect(screen.getByTitle('daily snapshot freshness')).toHaveTextContent('stale')
  })

  it('keeps the daily snapshot reminder hidden when the marker is fresh', () => {
    render(
      <DashboardPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          dailySnapshotStatus: {
            stale: false,
            badgeStatus: 'fresh',
            lastSuccessAt: '2026-04-24T02:59:00.000Z',
          },
        })}
      />
    )

    expect(screen.queryByTestId('daily-snapshot-status-card')).not.toBeInTheDocument()
  })

  it('degrades the hero headline into an accuracy gate block when all dossiers lack fresh fundamentals', () => {
    render(
      <DashboardPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          dataRefreshRows: [
            {
              code: '2330',
              name: '台積電',
              targetLabel: '最新財報仍在補齊中',
            },
          ],
          holdingDossiers: [
            {
              code: '2330',
              name: '台積電',
              thesis: { pillars: [{ status: 'stable' }] },
              freshness: { fundamentals: 'missing' },
              position: { price: 950 },
            },
          ],
          newsEvents: [
            {
              id: 'market-1',
              source: 'market-cache',
              type: 'market-summary',
              date: '2026-04-24',
              title: '台股收高',
              detail: '電子權值股撐盤。',
            },
          ],
        })}
      />
    )

    expect(screen.getByTestId('accuracy-gate-block')).toHaveAttribute('data-resource', 'dashboard')
    expect(screen.queryByTestId('dashboard-headline')).toBeNull()
    expect(screen.getByText('Today in Markets')).toBeInTheDocument()
  })

  it('uses FinMind degraded reason for the dashboard headline gate when fallback data is active', () => {
    render(
      <DashboardPanel
        {...buildProps({
          holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
          dataRefreshRows: [
            {
              code: '2330',
              name: '台積電',
              degradedReason: 'quota-exceeded',
              fallbackAgeLabel: '昨天',
            },
          ],
          holdingDossiers: [
            {
              code: '2330',
              name: '台積電',
              freshness: { fundamentals: 'stale' },
              position: { price: 950 },
            },
          ],
        })}
      />
    )

    expect(screen.getByTestId('accuracy-gate-block')).toHaveAttribute(
      'data-reason',
      'quota-exceeded'
    )
    expect(screen.getByText(/FinMind/i)).toBeInTheDocument()
  })
})
