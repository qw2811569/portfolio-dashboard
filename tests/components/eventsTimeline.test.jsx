// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EventsTimeline,
  buildTimelineEvents,
  buildTimelineGroups,
} from '../../src/components/events/EventsTimeline.jsx'

vi.mock('../../src/pages/usePortfolioRouteContext.js', () => ({
  usePortfolioRouteContext: () => ({
    holdings: [{ code: '2330', name: '台積電' }],
  }),
}))

describe('components/events/EventsTimeline', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('aggregates events that share the same horizontal timeline position', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-26T09:00:00+08:00'))

    const events = buildTimelineEvents(
      [
        { title: '台積電法說會', date: '2026-04-25', eventType: 'earnings', stocks: ['2330'] },
        { title: '台積電除息', date: '2026-04-25', eventType: 'ex-dividend', stocks: ['2330'] },
        { title: '聯發科法說會', date: '2026-04-28', eventType: 'earnings', stocks: ['2454'] },
      ],
      new Set(['2330'])
    )

    const groups = buildTimelineGroups(events)

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      isGroup: true,
      formattedLabel: '2 events',
      dateLabel: '04/25',
      matchesHolding: true,
    })
    expect(groups[0].groupedEvents).toHaveLength(2)
  })

  it('adds truncation class, title tooltip, and expands grouped events on click', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-26T09:00:00+08:00'))

    render(
      <EventsTimeline
        events={[
          {
            title: '台積電法說會與長標題測試',
            date: '2026-04-25',
            eventType: 'earnings',
            stocks: ['2330'],
          },
          {
            title: '台積電除息與股利更新',
            date: '2026-04-25',
            eventType: 'ex-dividend',
            stocks: ['2330'],
          },
        ]}
      />
    )

    const marker = screen.getByRole('button', { name: '2 events · 04/25' })
    expect(marker).toHaveAttribute('title', expect.stringContaining('台積電法說會'))
    expect(marker.querySelector('.events-timeline__label--truncate')).toBeTruthy()

    fireEvent.click(marker)

    expect(screen.getByTestId('events-timeline-expanded-list')).toBeInTheDocument()
    expect(screen.getByText('台積電除息與股利更新')).toBeInTheDocument()
  })
})
