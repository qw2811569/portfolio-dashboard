// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WatchlistPanel, WatchlistRow } from '../../src/components/watchlist/WatchlistPanel.jsx'
import { resolveTone } from '../../src/lib/toneResolver.js'

function toRgbTriplet(color) {
  const normalized = String(color || '')
    .trim()
    .toLowerCase()
  const match = normalized.match(/^#([0-9a-f]{6})$/)
  if (!match) return normalized
  return `${parseInt(match[1].slice(0, 2), 16)}, ${parseInt(match[1].slice(2, 4), 16)}, ${parseInt(match[1].slice(4, 6), 16)}`
}

function buildProps(overrides = {}) {
  return {
    watchlistFocus: null,
    watchlistRows: [],
    expandedStock: null,
    setExpandedStock: vi.fn(),
    onUpsertItem: vi.fn(),
    handleWatchlistDelete: vi.fn(),
    formatEventStockOutcomeLine: vi.fn(),
    operatingContext: null,
    ...overrides,
  }
}

describe('components/WatchlistPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows the empty-state card when watchlistRows is empty', () => {
    render(<WatchlistPanel {...buildProps()} />)

    expect(screen.getByText('這個組合目前沒有觀察股')).toBeInTheDocument()
    expect(screen.getByText('＋ 新增觀察股')).toBeInTheDocument()
  })

  it('hides the empty-state card once watchlistRows has entries', () => {
    // watchlistRows is an envelope, not a flat stock — each row has { item, index,
    // relatedEvents, hits, misses, pendingCount, trackingCount, upside }
    const rows = [
      {
        item: { code: '2330', name: '台積電' },
        index: 0,
        relatedEvents: [],
        hits: 0,
        misses: 0,
        pendingCount: 0,
        trackingCount: 0,
        upside: 0,
      },
    ]
    render(<WatchlistPanel {...buildProps({ watchlistRows: rows })} />)

    expect(screen.queryByText('這個組合目前沒有觀察股')).not.toBeInTheDocument()
  })

  it('searches and sorts watchlist rows without changing the row envelope', () => {
    const rows = [
      {
        item: {
          code: '2330',
          name: '台積電',
          price: 900,
          target: 990,
          catalyst: 'CoWoS 擴產',
          createdAt: '2026-04-20T00:00:00.000Z',
        },
        index: 0,
        relatedEvents: [],
        hits: 0,
        misses: 0,
        pendingCount: 0,
        trackingCount: 0,
        upside: 10,
      },
      {
        item: {
          code: '2454',
          name: '聯發科',
          price: 1000,
          target: 1400,
          catalyst: '手機復甦',
          createdAt: '2026-04-23T00:00:00.000Z',
        },
        index: 1,
        relatedEvents: [],
        hits: 0,
        misses: 0,
        pendingCount: 0,
        trackingCount: 0,
        upside: 40,
      },
    ]

    render(<WatchlistPanel {...buildProps({ watchlistRows: rows })} />)

    const panel = screen.getByTestId('watchlist-panel')
    expect(within(panel).getByText('台積電')).toBeInTheDocument()
    expect(within(panel).getByText('聯發科')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('watchlist-search'), { target: { value: 'CoWoS' } })
    expect(within(panel).getByText('台積電')).toBeInTheDocument()
    expect(within(panel).queryByText('聯發科')).not.toBeInTheDocument()

    fireEvent.change(screen.getByTestId('watchlist-search'), { target: { value: '' } })
    fireEvent.change(screen.getByTestId('watchlist-sort'), { target: { value: 'added-time' } })
    const rowTitles = within(panel)
      .getAllByText(/台積電|聯發科/u)
      .map((node) => node.textContent)
    expect(rowTitles[0]).toContain('聯發科')
  })

  it('renders the watchlist focus card when watchlistFocus is provided', () => {
    // WatchlistFocus reads focus.item.{name,code,status} and focus.summary
    const focus = {
      item: { code: '2330', name: '台積電', status: '追蹤中' },
      summary: '追蹤先進封裝材料龍頭',
      trackingCount: 1,
      pendingCount: 0,
      relatedEvents: [],
      upside: null,
    }
    const { container } = render(<WatchlistPanel {...buildProps({ watchlistFocus: focus })} />)

    expect(container.textContent).toContain('追蹤先進封裝材料龍頭')
  })

  it('uses the shared tone resolver for legacy scKey values', () => {
    const { container } = render(
      <WatchlistRow
        item={{
          code: '4588',
          name: '玖鼎電力',
          price: 69.1,
          target: 154,
          status: '持有中',
          catalyst: '台電電表訂單',
          scKey: 'olive',
          note: '測試',
        }}
        index={0}
        relatedEvents={[]}
        hits={0}
        misses={0}
        pendingCount={0}
        trackingCount={0}
        upside={122.9}
        expanded={false}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const progressBarFill = Array.from(container.querySelectorAll('div')).find((node) =>
      node.style.background.includes('linear-gradient')
    )

    expect(progressBarFill?.style.background).toContain(toRgbTriplet(resolveTone('olive')))
  })
})
