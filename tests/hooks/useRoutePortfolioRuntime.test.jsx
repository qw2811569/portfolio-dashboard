import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.hoisted(() => vi.fn())
const routeState = vi.hoisted(() => ({
  portfolioId: 'me',
  pathname: '/portfolio/me/holdings',
}))

// Mock all external dependencies before importing the hook
vi.mock('react-router-dom', () => ({
  useParams: () => ({ portfolioId: routeState.portfolioId }),
  useLocation: () => ({ pathname: routeState.pathname }),
  useNavigate: () => navigateMock,
}))

vi.mock('../../src/hooks/useSavedToast.js', () => ({
  useSavedToast: () => ({
    saved: '',
    setSaved: vi.fn(),
    flashSaved: vi.fn(),
    notifySaved: vi.fn(),
  }),
}))

vi.mock('../../src/hooks/useTransientUiActions.js', () => ({
  useTransientUiActions: () => ({
    showPortfolioManager: false,
    setShowPortfolioManager: vi.fn(),
    portfolioEditorState: null,
    openCreatePortfolio: vi.fn(),
    openRenamePortfolio: vi.fn(),
    closePortfolioEditor: vi.fn(),
    submitPortfolioEditor: vi.fn(),
    portfolioDeleteState: null,
    openDeletePortfolio: vi.fn(),
    closePortfolioDeleteDialog: vi.fn(),
    submitPortfolioDelete: vi.fn(),
  }),
}))

vi.mock('../../src/hooks/useWatchlistActions.js', () => ({
  useWatchlistActions: () => ({
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(),
    isInWatchlist: vi.fn(() => false),
  }),
}))

import { ACTIVE_PORTFOLIO_KEY, PORTFOLIOS_KEY, VIEW_MODE_KEY } from '../../src/constants.js'
import { useRoutePortfolioRuntime } from '../../src/hooks/useRoutePortfolioRuntime.js'
import { renderHook } from '@testing-library/react'

describe('hooks/useRoutePortfolioRuntime.js', () => {
  beforeEach(() => {
    routeState.portfolioId = 'me'
    routeState.pathname = '/portfolio/me/holdings'
    window.localStorage.clear()
    window.localStorage.setItem(
      PORTFOLIOS_KEY,
      JSON.stringify([
        { id: 'me', name: '主組合', isOwner: true, createdAt: '2026-01-01' },
        { id: 'p-test', name: '測試', isOwner: false, createdAt: '2026-01-02' },
      ])
    )
    navigateMock.mockClear()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders without crashing and returns headerProps + outletContext', () => {
    const { result } = renderHook(() => useRoutePortfolioRuntime())

    expect(result.current).toHaveProperty('headerProps')
    expect(result.current).toHaveProperty('outletContext')
  })

  it('headerProps contains expected portfolio UI fields', () => {
    const { result } = renderHook(() => useRoutePortfolioRuntime())
    const { headerProps } = result.current

    expect(headerProps).toHaveProperty('activePortfolioId')
    expect(headerProps).toHaveProperty('saved')
    expect(headerProps).toHaveProperty('displayedTotalPnl')
    expect(headerProps).toHaveProperty('displayedRetPct')
    expect(headerProps).toHaveProperty('ready', true)
  })

  it('outletContext provides state and setters for child pages', () => {
    const { result } = renderHook(() => useRoutePortfolioRuntime())
    const ctx = result.current.outletContext

    expect(ctx).toHaveProperty('holdings')
    expect(ctx).toHaveProperty('setHoldings')
    expect(ctx).toHaveProperty('targets')
    expect(ctx).toHaveProperty('newsEvents')
    expect(ctx).toHaveProperty('strategyBrain')
    expect(ctx).toHaveProperty('analysisHistory')
    expect(ctx).toHaveProperty('holdingDossiers')
    expect(ctx).toHaveProperty('flashSaved')
  })

  describe('Wave 3 Step 4: header-level mutators are write-blocked', () => {
    function installWriteSpies() {
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
      const removeItemSpy = vi.spyOn(window.localStorage, 'removeItem')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      return { setItemSpy, removeItemSpy, warnSpy }
    }

    function snapshotPortfoliosRegistry() {
      return window.localStorage.getItem(PORTFOLIOS_KEY)
    }

    it('createPortfolio is a no-op: no storage write, no navigation, dev warning, returns false', async () => {
      const before = snapshotPortfoliosRegistry()
      const { result } = renderHook(() => useRoutePortfolioRuntime())
      const { setItemSpy, warnSpy } = installWriteSpies()
      navigateMock.mockClear()
      setItemSpy.mockClear()

      let returned
      await act(async () => {
        returned = await result.current.headerProps.createPortfolio('新組合')
      })

      expect(returned).toBe(false)
      expect(setItemSpy).not.toHaveBeenCalled()
      expect(navigateMock).not.toHaveBeenCalled()
      expect(snapshotPortfoliosRegistry()).toBe(before)
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: createPortfolio. Use the canonical AppShell to mutate data.'
      )
    })

    it('renamePortfolio is a no-op: PORTFOLIOS_KEY unchanged, dev warning, returns false', async () => {
      const before = snapshotPortfoliosRegistry()
      const { result } = renderHook(() => useRoutePortfolioRuntime())
      const { setItemSpy, warnSpy } = installWriteSpies()
      navigateMock.mockClear()
      setItemSpy.mockClear()

      let returned
      await act(async () => {
        returned = await result.current.outletContext.renamePortfolio('p-test', '改名後')
      })

      expect(returned).toBe(false)
      expect(setItemSpy).not.toHaveBeenCalled()
      expect(navigateMock).not.toHaveBeenCalled()
      expect(snapshotPortfoliosRegistry()).toBe(before)
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: renamePortfolio. Use the canonical AppShell to mutate data.'
      )
    })

    it('deletePortfolio is a no-op: no setItem, no removeItem, no navigate, dev warning, returns false', async () => {
      const before = snapshotPortfoliosRegistry()
      const { result } = renderHook(() => useRoutePortfolioRuntime())
      const { setItemSpy, removeItemSpy, warnSpy } = installWriteSpies()
      navigateMock.mockClear()
      setItemSpy.mockClear()
      removeItemSpy.mockClear()

      let returned
      await act(async () => {
        returned = await result.current.outletContext.deletePortfolio('p-test')
      })

      expect(returned).toBe(false)
      expect(setItemSpy).not.toHaveBeenCalled()
      expect(removeItemSpy).not.toHaveBeenCalled()
      expect(navigateMock).not.toHaveBeenCalled()
      expect(snapshotPortfoliosRegistry()).toBe(before)
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: deletePortfolio. Use the canonical AppShell to mutate data.'
      )
    })

    it('submitPortfolioEditor degrades cleanly when underlying create is blocked', async () => {
      const { result } = renderHook(() => useRoutePortfolioRuntime())
      installWriteSpies()
      navigateMock.mockClear()

      await act(async () => {
        result.current.headerProps.portfolioEditor.openCreate()
      })
      await act(async () => {
        result.current.headerProps.portfolioEditor.setName('新組合')
      })

      let returned
      await act(async () => {
        returned = await result.current.headerProps.portfolioEditor.submit()
      })

      expect(returned).toBe(false)
      expect(result.current.headerProps.portfolioEditor.isOpen).toBe(true)
      expect(result.current.headerProps.portfolioEditor.submitting).toBe(false)
      expect(navigateMock).not.toHaveBeenCalled()
    })
  })

  describe('Wave 3 Step 4 follow-up: navigation mutators are save-blocked, navigate kept', () => {
    function installWriteSpies() {
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      return { setItemSpy, warnSpy }
    }

    it('switchPortfolio does not write ACTIVE_PORTFOLIO_KEY/VIEW_MODE_KEY but still navigates', () => {
      const { result } = renderHook(() => useRoutePortfolioRuntime())
      const { setItemSpy, warnSpy } = installWriteSpies()
      navigateMock.mockClear()
      setItemSpy.mockClear()

      act(() => {
        result.current.headerProps.switchPortfolio('p-test')
      })

      const blockedKeys = setItemSpy.mock.calls
        .map(([key]) => key)
        .filter((key) => key === ACTIVE_PORTFOLIO_KEY || key === VIEW_MODE_KEY)
      expect(blockedKeys).toEqual([])
      expect(navigateMock).toHaveBeenCalledTimes(1)
      expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining('p-test'))
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[route-shell\] write blocked: switchPortfolio/)
      )
    })

    it('switchPortfolio with empty portfolio id is a safe no-op', () => {
      const { result } = renderHook(() => useRoutePortfolioRuntime())
      const { setItemSpy, warnSpy } = installWriteSpies()
      navigateMock.mockClear()
      setItemSpy.mockClear()
      warnSpy.mockClear()

      act(() => {
        result.current.headerProps.switchPortfolio('')
      })

      expect(setItemSpy).not.toHaveBeenCalled()
      expect(navigateMock).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('keeps portfolioSwitching true until the latest requested portfolio wins', () => {
      const { result, rerender } = renderHook(() => useRoutePortfolioRuntime())
      const { warnSpy } = installWriteSpies()
      navigateMock.mockClear()

      act(() => {
        result.current.headerProps.switchPortfolio('p-test')
      })

      expect(result.current.headerProps.portfolioSwitching).toBe(true)
      expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining('p-test'))

      act(() => {
        result.current.headerProps.switchPortfolio('me')
      })

      expect(result.current.headerProps.portfolioSwitching).toBe(true)
      expect(navigateMock).toHaveBeenCalledTimes(1)

      routeState.portfolioId = 'p-test'
      routeState.pathname = '/portfolio/p-test/holdings'
      rerender()

      expect(navigateMock).toHaveBeenCalledTimes(2)
      expect(navigateMock).toHaveBeenLastCalledWith(expect.stringContaining('/portfolio/me'), {
        replace: true,
      })
      expect(result.current.headerProps.portfolioSwitching).toBe(true)

      routeState.portfolioId = 'me'
      routeState.pathname = '/portfolio/me/holdings'
      rerender()

      expect(result.current.headerProps.portfolioSwitching).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[route-shell\] write blocked: switchPortfolio/)
      )
    })

    it('openOverview does not write VIEW_MODE_KEY but still navigates to /overview', () => {
      const { result } = renderHook(() => useRoutePortfolioRuntime())
      const { setItemSpy, warnSpy } = installWriteSpies()
      navigateMock.mockClear()
      setItemSpy.mockClear()

      act(() => {
        result.current.headerProps.openOverview()
      })

      const blockedKeys = setItemSpy.mock.calls
        .map(([key]) => key)
        .filter((key) => key === VIEW_MODE_KEY)
      expect(blockedKeys).toEqual([])
      expect(navigateMock).toHaveBeenCalledWith('/overview')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[route-shell\] write blocked: openOverview/)
      )
    })

    it('exitOverview does not write VIEW_MODE_KEY but still navigates back to the portfolio route', () => {
      const { result } = renderHook(() => useRoutePortfolioRuntime())
      const { setItemSpy, warnSpy } = installWriteSpies()
      navigateMock.mockClear()
      setItemSpy.mockClear()

      act(() => {
        result.current.headerProps.exitOverview()
      })

      const blockedKeys = setItemSpy.mock.calls
        .map(([key]) => key)
        .filter((key) => key === VIEW_MODE_KEY)
      expect(blockedKeys).toEqual([])
      expect(navigateMock).toHaveBeenCalledTimes(1)
      expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining('me'))
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[route-shell\] write blocked: exitOverview/)
      )
    })
  })
})
