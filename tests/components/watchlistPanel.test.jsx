// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WatchlistPanel } from '../../src/components/watchlist/WatchlistPanel.jsx'

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
})
