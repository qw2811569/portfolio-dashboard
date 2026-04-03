import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()
const mockReadRuntimePortfolios = vi.fn()
const mockReadRouteMarketState = vi.fn()
const mockBuildOverviewRuntimeData = vi.fn()
const mockReadStorageValue = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('../../src/lib/routeRuntime.js', () => ({
  buildOverviewRuntimeData: (args) => mockBuildOverviewRuntimeData(args),
  readRouteMarketState: () => mockReadRouteMarketState(),
  readRuntimePortfolios: () => mockReadRuntimePortfolios(),
}))

vi.mock('../../src/lib/portfolioUtils.js', () => ({
  readStorageValue: (key) => mockReadStorageValue(key),
}))

vi.mock('../../src/constants.js', () => ({
  ACTIVE_PORTFOLIO_KEY: 'pf-active-portfolio-v1',
  OWNER_PORTFOLIO_ID: 'me',
  buildPortfolioRoute: (portfolioId) => `/portfolio/${portfolioId}`,
}))

import { useRouteOverviewPage } from '../../src/hooks/useRouteOverviewPage.js'

describe('hooks/useRouteOverviewPage.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing and returns correct props structure', () => {
    const fakePortfolios = [{ id: 'me', name: '主帳戶' }]
    mockReadRuntimePortfolios.mockReturnValue(fakePortfolios)
    mockReadRouteMarketState.mockReturnValue({ marketPriceCache: {} })
    mockBuildOverviewRuntimeData.mockReturnValue({
      overviewPortfolios: [{ id: 'me', name: '主帳戶', totalValue: 100000 }],
      overviewTotalValue: 100000,
      overviewTotalPnl: 5000,
      overviewDuplicateHoldings: [],
      overviewPendingItems: [],
    })
    mockReadStorageValue.mockReturnValue('me')

    const { result } = renderHook(() => useRouteOverviewPage())

    expect(mockBuildOverviewRuntimeData).toHaveBeenCalledWith({
      portfolios: fakePortfolios,
      marketPriceCache: {},
    })

    expect(result.current).toEqual(
      expect.objectContaining({
        portfolioCount: 1,
        totalValue: 100000,
        totalPnl: 5000,
        portfolios: [expect.objectContaining({ id: 'me' })],
        activePortfolioId: 'me',
        duplicateHoldings: [],
        pendingItems: [],
      })
    )

    expect(typeof result.current.onExit).toBe('function')
    expect(typeof result.current.onSwitch).toBe('function')
  })

  it('onExit navigates to active portfolio route', () => {
    mockReadRuntimePortfolios.mockReturnValue([])
    mockReadRouteMarketState.mockReturnValue({ marketPriceCache: {} })
    mockBuildOverviewRuntimeData.mockReturnValue({
      overviewPortfolios: [],
      overviewTotalValue: 0,
      overviewTotalPnl: 0,
      overviewDuplicateHoldings: [],
      overviewPendingItems: [],
    })
    mockReadStorageValue.mockReturnValue('me')

    const { result } = renderHook(() => useRouteOverviewPage())

    result.current.onExit()

    expect(mockNavigate).toHaveBeenCalledWith('/portfolio/me')
  })

  it('onSwitch navigates to specified portfolio route', () => {
    mockReadRuntimePortfolios.mockReturnValue([])
    mockReadRouteMarketState.mockReturnValue({ marketPriceCache: {} })
    mockBuildOverviewRuntimeData.mockReturnValue({
      overviewPortfolios: [],
      overviewTotalValue: 0,
      overviewTotalPnl: 0,
      overviewDuplicateHoldings: [],
      overviewPendingItems: [],
    })
    mockReadStorageValue.mockReturnValue('me')

    const { result } = renderHook(() => useRouteOverviewPage())

    result.current.onSwitch('family')

    expect(mockNavigate).toHaveBeenCalledWith('/portfolio/family')
  })

  it('defaults activePortfolioId to OWNER_PORTFOLIO_ID when storage is empty', () => {
    mockReadRuntimePortfolios.mockReturnValue([])
    mockReadRouteMarketState.mockReturnValue({ marketPriceCache: {} })
    mockBuildOverviewRuntimeData.mockReturnValue({
      overviewPortfolios: [],
      overviewTotalValue: 0,
      overviewTotalPnl: 0,
      overviewDuplicateHoldings: [],
      overviewPendingItems: [],
    })
    mockReadStorageValue.mockReturnValue(undefined)

    const { result } = renderHook(() => useRouteOverviewPage())

    expect(result.current.activePortfolioId).toBe('me')
  })
})
