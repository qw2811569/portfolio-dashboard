import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppRuntimeSyncRefs } from '../../src/hooks/useAppRuntimeSyncRefs.js'

describe('hooks/useAppRuntimeSyncRefs.js', () => {
  it('syncs app runtime refs and boot runtime payload together', () => {
    const activePortfolioIdRef = { current: 'old' }
    const viewModeRef = { current: 'overview' }
    const portfoliosRef = { current: [] }
    const portfolioSetterRef = { current: { setActivePortfolioId: null, setViewMode: null } }
    const bootRuntimeRef = { current: null }
    const setActivePortfolioId = vi.fn()
    const setViewMode = vi.fn()
    const setPortfolios = vi.fn()
    const applyPortfolioSnapshot = vi.fn()
    const portfolioTransitionRef = { current: { isHydrating: false, fromPid: 'me', toPid: 'me' } }
    const marketPriceCache = { prices: { 2330: { price: 980 } } }
    const portfolios = [{ id: 'me', name: '主組合' }]

    renderHook(() =>
      useAppRuntimeSyncRefs({
        activePortfolioIdRef,
        activePortfolioId: 'me',
        viewModeRef,
        viewMode: 'portfolio',
        portfoliosRef,
        portfolios,
        portfolioSetterRef,
        setActivePortfolioId,
        setViewMode,
        bootRuntimeRef,
        marketPriceCache,
        applyPortfolioSnapshot,
        setPortfolios,
        portfolioTransitionRef,
      })
    )

    expect(activePortfolioIdRef.current).toBe('me')
    expect(viewModeRef.current).toBe('portfolio')
    expect(portfoliosRef.current).toEqual(portfolios)
    expect(portfolioSetterRef.current).toEqual({
      setActivePortfolioId,
      setViewMode,
    })
    expect(bootRuntimeRef.current).toEqual({
      activePortfolioId: 'me',
      marketPriceQuotes: { 2330: { price: 980 } },
      applyPortfolioSnapshot,
      setPortfolios,
      setActivePortfolioId,
      setViewMode,
      portfolioTransitionRef,
    })
  })
})
