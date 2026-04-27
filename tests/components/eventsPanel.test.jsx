// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventsPanel } from '../../src/components/events/EventsPanel.jsx'

function buildProps(overrides = {}) {
  return {
    showRelayPlan: false,
    relayPlanExpanded: false,
    setRelayPlanExpanded: vi.fn(),
    filterType: '全部',
    setFilterType: vi.fn(),
    filteredEvents: [],
    catalystFilter: '全部',
    setCatalystFilter: vi.fn(),
    operatingContext: null,
    onNavigateDaily: vi.fn(),
    ...overrides,
  }
}

describe('components/EventsPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows the empty-state welcome card when no events are filtered in', () => {
    render(<EventsPanel {...buildProps()} />)

    expect(screen.getByText('未來 30 天無重大事件')).toBeInTheDocument()
    expect(document.querySelector('[data-empty-state="events"]')).toBeTruthy()
  })

  it('does not render a manual CTA in the quiet-window empty state', () => {
    render(<EventsPanel {...buildProps()} />)
    expect(screen.queryByRole('button', { name: /前往收盤分析/i })).not.toBeInTheDocument()
  })

  it('renders the relay plan card only when showRelayPlan is true', () => {
    const { rerender } = render(<EventsPanel {...buildProps({ showRelayPlan: false })} />)
    expect(screen.queryByText('接力計畫')).not.toBeInTheDocument()

    rerender(<EventsPanel {...buildProps({ showRelayPlan: true })} />)
    expect(screen.getByText('接力計畫')).toBeInTheDocument()
  })

  it('hides empty-state welcome and shows event cards when filteredEvents has items', () => {
    const events = [
      {
        title: '台積電法說會',
        date: '2026-04-15',
        eventType: 'earnings',
        impact: 'high',
        stock: { code: '2330', name: '台積電' },
      },
    ]

    render(<EventsPanel {...buildProps({ filteredEvents: events })} />)

    expect(screen.queryByText('未來 30 天無重大事件')).not.toBeInTheDocument()
    expect(screen.getByText('台積電法說會')).toBeInTheDocument()
  })

  it('filters out leaked news records so events tab does not render news cards', () => {
    const mixedRecords = [
      {
        id: 'event-1',
        title: '台積電法說會',
        date: '2026-04-15',
        eventType: 'earnings',
        impact: 'high',
        pred: 'up',
        recordType: 'event',
      },
      {
        id: 'news-1',
        title: 'Google News headline',
        date: '2026-04-15',
        recordType: 'news',
      },
    ]

    render(<EventsPanel {...buildProps({ filteredEvents: mixedRecords })} />)

    expect(screen.getByText('台積電法說會')).toBeInTheDocument()
    expect(screen.queryByText('Google News headline')).not.toBeInTheDocument()
  })

  it('shows countdown and review-ready badges on matured events', () => {
    // Freeze time so the countdown copy stays deterministic as real dates move.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00+08:00'))

    render(
      <EventsPanel
        {...buildProps({
          filteredEvents: [
            {
              id: 'event-1',
              title: '聯發科法說會',
              date: '2026-04-10',
              eventType: 'earnings',
              impact: 'high',
              pred: 'up',
              recordType: 'event',
            },
          ],
        })}
      />
    )

    expect(screen.getByText('已過 6 天 · 待復盤')).toBeInTheDocument()
    expect(screen.getByText('待復盤')).toBeInTheDocument()
  })

  it('renders TW-specific filter chips', () => {
    render(<EventsPanel {...buildProps()} />)

    expect(screen.getByRole('button', { name: '財報日' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '除權息' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '股東會' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '策略變動' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '資訊' })).toBeInTheDocument()
  })

  it('collapses informational events by default on the all-events view', () => {
    render(
      <EventsPanel
        {...buildProps({
          filterType: '全部',
          filteredEvents: [
            {
              id: 'evt-div',
              title: '台積電除息',
              date: '2026-05-15',
              eventType: 'ex-dividend',
              recordType: 'event',
              cashDividend: 4,
              stocks: ['台積電 2330'],
            },
            {
              id: 'evt-info',
              title: '台積電紀念品領取提醒',
              date: '2026-05-18',
              eventType: 'informational',
              recordType: 'event',
              stocks: ['台積電 2330'],
            },
          ],
        })}
      />
    )

    expect(screen.getByText('台積電除息')).toBeInTheDocument()
    expect(screen.queryByText('台積電紀念品領取提醒')).not.toBeInTheDocument()
    expect(screen.getByTestId('events-informational-collapse')).toBeInTheDocument()
  })

  it('expands the informational section on demand', () => {
    render(
      <EventsPanel
        {...buildProps({
          filterType: '全部',
          filteredEvents: [
            {
              id: 'evt-info',
              title: '台積電紀念品領取提醒',
              date: '2026-05-18',
              eventType: 'informational',
              recordType: 'event',
              stocks: ['台積電 2330'],
            },
          ],
        })}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '展開資訊型' }))
    expect(screen.getByText('台積電紀念品領取提醒')).toBeInTheDocument()
    expect(screen.getByText('資訊備查')).toBeInTheDocument()
  })
})
