// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DashboardPanel } from '../../src/components/overview/DashboardPanel.jsx'

function buildProps(overrides = {}) {
  return {
    holdings: [],
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
  })

  it('shows the today pnl hero value when todayTotalPnl is provided', () => {
    const { container } = render(<DashboardPanel {...buildProps({ todayTotalPnl: 1234 })} />)
    // TodayPnlHero formats with thousands separators — check for '1,234'
    expect(container.textContent).toContain('1,234')
  })

  it('surfaces the urgent alert summary when urgentCount is non-zero', () => {
    const { container } = render(
      <DashboardPanel
        {...buildProps({
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
    expect(screen.getByText('總經｜台灣央行理監事會議')).toBeInTheDocument()
    expect(screen.getByText('行事曆｜2026/03 月營收公布截止')).toBeInTheDocument()
  })

  it('shows a truthful empty state when no market items exist', () => {
    render(<DashboardPanel {...buildProps()} />)
    expect(screen.getByText('市場資訊暫無更新')).toBeInTheDocument()
  })
})
