import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/pages/usePortfolioRouteContext.js', () => ({
  usePortfolioRouteContext: vi.fn(),
}))

vi.mock('../../src/stores/brainStore.js', () => ({
  useBrainStore: vi.fn(),
}))

vi.mock('../../src/lib/routeRuntime.js', () => ({
  buildWatchlistRows: vi.fn(),
}))

vi.mock('../../src/lib/eventUtils.js', () => ({
  formatEventStockOutcomeLine: vi.fn(),
}))

import { useRouteWatchlistPage } from '../../src/hooks/useRouteWatchlistPage.js'
import { usePortfolioRouteContext } from '../../src/pages/usePortfolioRouteContext.js'
import { useBrainStore } from '../../src/stores/brainStore.js'
import { buildWatchlistRows } from '../../src/lib/routeRuntime.js'
import { formatEventStockOutcomeLine } from '../../src/lib/eventUtils.js'

describe('hooks/useRouteWatchlistPage.js', () => {
  const expandedStock = '2330'
  const setExpandedStock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    useBrainStore.mockImplementation((selector) => {
      const state = { expandedStock, setExpandedStock }
      return selector(state)
    })
  })

  it('renders without crashing and returns correct props structure', () => {
    const upsertWatchlist = vi.fn()
    const removeWatchlist = vi.fn()

    usePortfolioRouteContext.mockReturnValue({
      watchlist: [{ code: '2330', name: '台積電', price: 950, target: 1000 }],
      newsEvents: [{ id: 'e1', status: 'tracking', stocks: ['台積電 2330'] }],
      upsertWatchlist,
      removeWatchlist,
    })

    const fakeRows = [{ code: '2330', name: '台積電', trackingCount: 1, pendingCount: 0 }]
    buildWatchlistRows.mockReturnValue(fakeRows)

    const { result } = renderHook(() => useRouteWatchlistPage())

    expect(buildWatchlistRows).toHaveBeenCalledWith({
      watchlist: [expect.objectContaining({ code: '2330' })],
      newsEvents: [expect.objectContaining({ id: 'e1' })],
    })

    expect(result.current).toEqual(
      expect.objectContaining({
        watchlistRows: fakeRows,
        watchlistFocus: fakeRows[0],
        expandedStock: '2330',
        setExpandedStock,
        onUpsertItem: upsertWatchlist,
        handleWatchlistDelete: removeWatchlist,
        formatEventStockOutcomeLine,
      })
    )
  })

  it('sets watchlistFocus to null when watchlistRows is empty', () => {
    usePortfolioRouteContext.mockReturnValue({
      watchlist: [],
      newsEvents: [],
    })

    buildWatchlistRows.mockReturnValue([])

    const { result } = renderHook(() => useRouteWatchlistPage())

    expect(result.current.watchlistFocus).toBeNull()
    expect(result.current.watchlistRows).toEqual([])
  })

  it('picks highest trackingCount+pendingCount row as watchlistFocus', () => {
    usePortfolioRouteContext.mockReturnValue({
      watchlist: [],
      newsEvents: [],
    })

    const rows = [
      { code: '2330', trackingCount: 1, pendingCount: 0 },
      { code: '2454', trackingCount: 2, pendingCount: 3 },
      { code: '3008', trackingCount: 0, pendingCount: 1 },
    ]
    buildWatchlistRows.mockReturnValue(rows)

    const { result } = renderHook(() => useRouteWatchlistPage())

    expect(result.current.watchlistFocus).toEqual(
      expect.objectContaining({ code: '2454', trackingCount: 2, pendingCount: 3 })
    )
  })

  it('uses default values when context provides nothing', () => {
    usePortfolioRouteContext.mockReturnValue({})
    buildWatchlistRows.mockReturnValue([])

    const { result } = renderHook(() => useRouteWatchlistPage())

    expect(buildWatchlistRows).toHaveBeenCalledWith({
      watchlist: [],
      newsEvents: [],
    })
    expect(typeof result.current.onUpsertItem).toBe('function')
    expect(typeof result.current.handleWatchlistDelete).toBe('function')
  })
})
