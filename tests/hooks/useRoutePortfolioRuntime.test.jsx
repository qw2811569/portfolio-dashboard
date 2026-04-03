import { describe, expect, it, vi } from 'vitest'

// Mock all external dependencies before importing the hook
vi.mock('react-router-dom', () => ({
  useParams: () => ({ portfolioId: 'me' }),
  useLocation: () => ({ pathname: '/portfolio/me/holdings' }),
  useNavigate: () => vi.fn(),
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

import { useRoutePortfolioRuntime } from '../../src/hooks/useRoutePortfolioRuntime.js'
import { renderHook } from '@testing-library/react'

describe('hooks/useRoutePortfolioRuntime.js', () => {
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
})
