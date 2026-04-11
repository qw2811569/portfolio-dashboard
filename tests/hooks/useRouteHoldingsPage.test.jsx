import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUsePortfolioRouteContext = vi.fn()
const mockUseBrainStore = vi.fn()

vi.mock('../../src/pages/usePortfolioRouteContext.js', () => ({
  usePortfolioRouteContext: () => mockUsePortfolioRouteContext(),
}))

vi.mock('../../src/stores/brainStore.js', () => ({
  useBrainStore: (selector) => mockUseBrainStore(selector),
}))

import { useRouteHoldingsPage } from '../../src/hooks/useRouteHoldingsPage.js'

describe('hooks/useRouteHoldingsPage.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing and returns correct props structure', () => {
    const updateTargetPrice = vi.fn()
    const updateAlert = vi.fn()
    const updateReversal = vi.fn()

    mockUsePortfolioRouteContext.mockReturnValue({
      holdings: [
        {
          code: '2330',
          name: '台積電',
          qty: 1000,
          price: 950,
          cost: 900,
          value: 950000,
          pct: 5.56,
        },
        { code: '2317', name: '鴻海', qty: 500, price: 150, cost: 160, value: 75000, pct: -6.25 },
      ],
      reversalConditions: { 2330: { condition: 'test' } },
      updateTargetPrice,
      updateAlert,
      updateReversal,
    })

    const expandedStock = '2330'
    const setExpandedStock = vi.fn()

    mockUseBrainStore.mockImplementation((selector) => {
      const state = { expandedStock, setExpandedStock }
      return selector(state)
    })

    const { result } = renderHook(() => useRouteHoldingsPage())

    // panelProps structure
    expect(result.current).toHaveProperty('panelProps')
    expect(result.current).toHaveProperty('tableProps')

    const { panelProps, tableProps } = result.current

    // panelProps fields
    expect(panelProps.holdings).toHaveLength(2)
    expect(panelProps.totalVal).toBe(950000 + 75000)
    expect(panelProps.totalCost).toBe(900 * 1000 + 160 * 500)
    expect(panelProps.winners).toHaveLength(1)
    expect(panelProps.winners[0].code).toBe('2330')
    expect(panelProps.losers).toHaveLength(1)
    expect(panelProps.losers[0].code).toBe('2317')
    expect(panelProps.holdingsIntegrityIssues).toHaveLength(0)
    expect(panelProps).toHaveProperty('showReversal', false)
    expect(panelProps).toHaveProperty('reversalConditions')
    expect(typeof panelProps.updateReversal).toBe('function')
    expect(panelProps.updateReversal).not.toBe(updateReversal)

    // tableProps fields
    expect(tableProps.holdings).toHaveLength(2)
    expect(tableProps.expandedStock).toBe('2330')
    expect(tableProps.setExpandedStock).toBe(setExpandedStock)
    expect(typeof tableProps.onUpdateTarget).toBe('function')
    expect(typeof tableProps.onUpdateAlert).toBe('function')
    expect(tableProps.onUpdateTarget).not.toBe(updateTargetPrice)
    expect(tableProps.onUpdateAlert).not.toBe(updateAlert)
  })

  it('handles empty holdings gracefully', () => {
    mockUsePortfolioRouteContext.mockReturnValue({
      holdings: [],
      reversalConditions: {},
      updateTargetPrice: vi.fn(),
      updateAlert: vi.fn(),
      updateReversal: vi.fn(),
    })

    mockUseBrainStore.mockImplementation((selector) => {
      return selector({ expandedStock: null, setExpandedStock: vi.fn() })
    })

    const { result } = renderHook(() => useRouteHoldingsPage())

    expect(result.current.panelProps.totalVal).toBe(0)
    expect(result.current.panelProps.totalCost).toBe(0)
    expect(result.current.panelProps.winners).toHaveLength(0)
    expect(result.current.panelProps.losers).toHaveLength(0)
  })

  it('identifies holdings with integrity issues', () => {
    mockUsePortfolioRouteContext.mockReturnValue({
      holdings: [
        { code: '2330', qty: 100, cost: 900, value: 0, pct: 0, integrityIssue: 'missing-price' },
      ],
      reversalConditions: {},
      updateTargetPrice: vi.fn(),
      updateAlert: vi.fn(),
      updateReversal: vi.fn(),
    })

    mockUseBrainStore.mockImplementation((selector) => {
      return selector({ expandedStock: null, setExpandedStock: vi.fn() })
    })

    const { result } = renderHook(() => useRouteHoldingsPage())

    expect(result.current.panelProps.holdingsIntegrityIssues).toHaveLength(1)
    expect(result.current.panelProps.holdingsIntegrityIssues[0].code).toBe('2330')
  })

  it('blocks holdings data writes while keeping the table readable', () => {
    const updateTargetPrice = vi.fn()
    const updateAlert = vi.fn()
    const updateReversal = vi.fn()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      configurable: true,
      writable: true,
    })

    mockUsePortfolioRouteContext.mockReturnValue({
      holdings: [{ code: '2330', qty: 100, cost: 900, value: 95000, pct: 5 }],
      reversalConditions: {},
      updateTargetPrice,
      updateAlert,
      updateReversal,
    })

    mockUseBrainStore.mockImplementation((selector) =>
      selector({ expandedStock: null, setExpandedStock: vi.fn() })
    )

    const { result } = renderHook(() => useRouteHoldingsPage())

    expect(result.current.tableProps.onUpdateTarget('2330', 1000)).toBe(false)
    expect(result.current.tableProps.onUpdateAlert('2330', '跌破月線')).toBe(false)
    expect(result.current.panelProps.updateReversal('2330', { armed: true })).toBe(false)

    expect(updateTargetPrice).not.toHaveBeenCalled()
    expect(updateAlert).not.toHaveBeenCalled()
    expect(updateReversal).not.toHaveBeenCalled()
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled()
    if (process.env.NODE_ENV !== 'production') {
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: updateTargetPrice. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: updateAlert. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: updateReversal. Use the canonical AppShell to mutate data.'
      )
    }
  })
})
