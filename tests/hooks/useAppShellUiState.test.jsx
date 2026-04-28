import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTIVE_PORTFOLIO_KEY } from '../../src/constants.js'
import { useAppShellUiState } from '../../src/hooks/useAppShellUiState.js'
import { buildLastActiveTabStorageKey } from '../../src/lib/tabPersistence.js'

function createStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed))

  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value))
    }),
    removeItem: vi.fn((key) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
  }
}

function installStorage(seed = {}) {
  const mock = createStorageMock(seed)
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  })
  return mock
}

describe('hooks/useAppShellUiState.js', () => {
  beforeEach(() => {
    installStorage({
      [ACTIVE_PORTFOLIO_KEY]: JSON.stringify('me'),
    })
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to dashboard, persists explicit tab changes, and skips storage writes on internal resets', () => {
    const resetTradeCapture = vi.fn()
    const resetTradeCaptureRef = { current: resetTradeCapture }
    const { result } = renderHook(() => useAppShellUiState({ resetTradeCaptureRef }))

    expect(result.current.tab).toBe('dashboard')

    act(() => {
      result.current.setTab('research')
      result.current.setDailyExpanded(true)
      result.current.setExpandedStock('2330')
      result.current.setExpandedNews(new Set(['event-1']))
      result.current.setReviewingEvent({ id: 'event-1' })
      result.current.setReviewForm({ summary: 'draft' })
      result.current.setResearchTarget('2330')
      result.current.setResearchResults({ code: '2330' })
      result.current.setRelayPlanExpanded(true)
    })

    expect(localStorage.setItem).toHaveBeenCalledWith(
      buildLastActiveTabStorageKey('me'),
      'research'
    )
    localStorage.setItem.mockClear()

    act(() => {
      result.current.resetTransientUiState({ resetTab: true })
    })

    expect(resetTradeCapture).toHaveBeenCalledTimes(1)
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(result.current.tab).toBe('dashboard')
    expect(result.current.dailyExpanded).toBe(false)
    expect(result.current.expandedStock).toBe(null)
    expect(Array.from(result.current.expandedNews)).toEqual([])
    expect(result.current.reviewingEvent).toBe(null)
    expect(result.current.reviewForm).toMatchObject({
      actual: 'up',
      actualNote: '',
      lessons: '',
      exitDate: null,
      priceAtExit: null,
    })
    expect(result.current.researchTarget).toBe(null)
    expect(result.current.researchResults).toBe(null)
    expect(result.current.relayPlanExpanded).toBe(false)
  })

  it('hydrates the active portfolio tab from localStorage and restores per-portfolio memory independently', () => {
    installStorage({
      [ACTIVE_PORTFOLIO_KEY]: JSON.stringify('7865'),
      [buildLastActiveTabStorageKey('7865')]: 'holdings',
      [buildLastActiveTabStorageKey('me')]: 'news',
    })

    const { result } = renderHook(() => useAppShellUiState())

    expect(result.current.tab).toBe('holdings')

    act(() => {
      result.current.restoreTabForPortfolio('me')
    })

    expect(result.current.tab).toBe('news')

    act(() => {
      result.current.setTab('daily')
    })

    expect(localStorage.setItem).toHaveBeenLastCalledWith(
      buildLastActiveTabStorageKey('me'),
      'daily'
    )
  })

  it('falls back to dashboard when persisted storage contains an invalid tab key', () => {
    installStorage({
      [ACTIVE_PORTFOLIO_KEY]: JSON.stringify('7865'),
      [buildLastActiveTabStorageKey('7865')]: 'overview',
    })

    const { result } = renderHook(() => useAppShellUiState())

    expect(result.current.tab).toBe('dashboard')
  })

  it('hydrates holdings detail state from pathname and query, then syncs browser history on open / close', () => {
    window.history.replaceState({}, '', '/portfolio/me/holdings?stock=2330')

    const { result } = renderHook(() => useAppShellUiState())

    expect(result.current.tab).toBe('holdings')
    expect(result.current.detailStockCode).toBe('2330')

    act(() => {
      result.current.setDetailStockCode('2454')
    })

    expect(window.location.pathname).toBe('/portfolio/me/holdings')
    expect(window.location.search).toBe('?stock=2454')
    expect(result.current.detailStockCode).toBe('2454')

    act(() => {
      result.current.setDetailStockCode(null)
    })

    expect(window.location.search).toBe('')
    expect(result.current.detailStockCode).toBe(null)

    act(() => {
      window.history.pushState({}, '', '/portfolio/me/holdings?stock=2330')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(result.current.tab).toBe('holdings')
    expect(result.current.detailStockCode).toBe('2330')
  })

  it('syncs window pathname when setTab is called from a portfolio path', () => {
    window.history.replaceState({}, '', '/portfolio/me/dashboard')

    const { result } = renderHook(() => useAppShellUiState())

    expect(result.current.tab).toBe('dashboard')

    act(() => {
      result.current.setTab('daily')
    })

    expect(window.location.pathname).toBe('/portfolio/me/daily')
    expect(result.current.tab).toBe('daily')
  })

  it('syncs window pathname when setTab is called from root', () => {
    window.history.replaceState({}, '', '/')

    const { result } = renderHook(() => useAppShellUiState())

    act(() => {
      result.current.setTab('events')
    })

    expect(window.location.pathname).toBe('/portfolio/me/events')
  })

  it('does not rewrite pathname when current location is outside the active portfolio path', () => {
    window.history.replaceState({}, '', '/overview')

    const { result } = renderHook(() => useAppShellUiState())

    act(() => {
      result.current.setTab('daily')
    })

    expect(window.location.pathname).toBe('/overview')
  })

  it('writes URL when restoreTabForPortfolio falls back to persisted tab (per Codex R31-R4 critique)', () => {
    installStorage({
      [ACTIVE_PORTFOLIO_KEY]: JSON.stringify('me'),
      [buildLastActiveTabStorageKey('me')]: 'daily',
      [buildLastActiveTabStorageKey('7865')]: 'events',
    })
    // Simulate the portfolio-switch flow where the URL is not yet path-driven (e.g. came from
    // root or overview) — restoreTabForPortfolio should honor the per-portfolio persisted tab
    // AND write that to URL so deep-link/refresh works.
    window.history.replaceState({}, '', '/')

    const { result } = renderHook(() => useAppShellUiState())

    act(() => {
      result.current.restoreTabForPortfolio('7865')
    })

    expect(result.current.tab).toBe('events')
    expect(window.location.pathname).toBe('/portfolio/7865/events')
  })

  it('writes URL when setDetailStockCode forces a tab change to holdings', () => {
    window.history.replaceState({}, '', '/portfolio/me/daily')

    const { result } = renderHook(() => useAppShellUiState())

    act(() => {
      result.current.setDetailStockCode('2330')
    })

    expect(result.current.tab).toBe('holdings')
    expect(window.location.pathname).toBe('/portfolio/me/holdings')
    expect(window.location.search).toBe('?stock=2330')
  })

  it('preserves search and hash when syncing pathname', () => {
    window.history.replaceState({}, '', '/portfolio/me/dashboard?source=ad#hero')

    const { result } = renderHook(() => useAppShellUiState())

    act(() => {
      result.current.setTab('news')
    })

    expect(window.location.pathname).toBe('/portfolio/me/news')
    expect(window.location.search).toBe('?source=ad')
    expect(window.location.hash).toBe('#hero')
  })
})
