import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUsePortfolioRouteContext = vi.fn()

vi.mock('../../src/pages/usePortfolioRouteContext.js', () => ({
  usePortfolioRouteContext: () => mockUsePortfolioRouteContext(),
}))

import { useRouteLogPage } from '../../src/hooks/useRouteLogPage.js'

describe('hooks/useRouteLogPage.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing and returns tradeLog from route context', () => {
    const tradeLog = [
      { id: 't1', code: '2330', action: '買進', qty: 500 },
      { id: 't2', code: '2454', action: '賣出', qty: 200 },
    ]

    mockUsePortfolioRouteContext.mockReturnValue({ tradeLog })

    const { result } = renderHook(() => useRouteLogPage())

    expect(result.current).toEqual({ tradeLog })
    expect(result.current.tradeLog).toBe(tradeLog)
  })

  it('returns correct props structure with only tradeLog key', () => {
    mockUsePortfolioRouteContext.mockReturnValue({
      tradeLog: [],
      holdings: [{ code: '2330' }],
      targets: {},
    })

    const { result } = renderHook(() => useRouteLogPage())

    expect(Object.keys(result.current)).toEqual(['tradeLog'])
  })

  it('defaults tradeLog to empty array when context provides nothing', () => {
    mockUsePortfolioRouteContext.mockReturnValue({})

    const { result } = renderHook(() => useRouteLogPage())

    expect(result.current).toEqual({ tradeLog: [] })
  })
})
