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
})
