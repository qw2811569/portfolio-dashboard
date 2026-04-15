import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUsePortfolioRouteContext = vi.fn()
const mockUseTradeCaptureRuntime = vi.fn()

vi.mock('../../src/pages/usePortfolioRouteContext.js', () => ({
  usePortfolioRouteContext: () => mockUsePortfolioRouteContext(),
}))

vi.mock('../../src/hooks/useTradeCaptureRuntime.js', () => ({
  useTradeCaptureRuntime: (args) => mockUseTradeCaptureRuntime(args),
}))

import { useRouteTradePage } from '../../src/hooks/useRouteTradePage.js'

describe('hooks/useRouteTradePage.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing and returns trade runtime', () => {
    const setHoldings = vi.fn()
    const setTradeLog = vi.fn()
    const upsertTargetReport = vi.fn()
    const updateTargetPrice = vi.fn()
    const upsertFundamentalsEntry = vi.fn()
    const applyTradeEntryToHoldings = vi.fn()
    const createDefaultFundamentalDraft = vi.fn()
    const toSlashDate = vi.fn()
    const flashSaved = vi.fn()

    mockUsePortfolioRouteContext.mockReturnValue({
      holdings: [{ code: '2330', name: '台積電', qty: 1000, price: 950, cost: 900 }],
      tradeLog: [{ id: 't1', code: '2330', action: '買進', qty: 500 }],
      setHoldings,
      setTradeLog,
      upsertTargetReport,
      updateTargetPrice,
      upsertFundamentalsEntry,
      applyTradeEntryToHoldings,
      createDefaultFundamentalDraft,
      toSlashDate,
      flashSaved,
    })

    const fakeTradeRuntime = {
      img: null,
      uploads: [],
      activeUploadId: null,
      dragOver: false,
      parsing: false,
      parsed: null,
      tpCode: '',
      tpFirm: '',
      tpVal: '',
      processFile: vi.fn(),
      processFiles: vi.fn(),
      parseShot: vi.fn(),
      resetTradeCapture: vi.fn(),
    }

    mockUseTradeCaptureRuntime.mockReturnValue(fakeTradeRuntime)

    const { result } = renderHook(() => useRouteTradePage())

    expect(mockUseTradeCaptureRuntime).toHaveBeenCalledTimes(1)
    const callArgs = mockUseTradeCaptureRuntime.mock.calls[0][0]
    expect(callArgs).toEqual(
      expect.objectContaining({
        holdings: [expect.objectContaining({ code: '2330' })],
        tradeLog: [expect.objectContaining({ id: 't1' })],
        applyTradeEntryToHoldings,
        createDefaultFundamentalDraft,
        toSlashDate,
        flashSaved,
      })
    )
    expect(typeof callArgs.setHoldings).toBe('function')
    expect(typeof callArgs.setTradeLog).toBe('function')
    expect(typeof callArgs.upsertTargetReport).toBe('function')
    expect(typeof callArgs.updateTargetPrice).toBe('function')
    expect(typeof callArgs.upsertFundamentalsEntry).toBe('function')
    expect(callArgs.setHoldings).toBe(setHoldings)
    expect(callArgs.setTradeLog).toBe(setTradeLog)
    expect(callArgs.upsertTargetReport).toBe(upsertTargetReport)
    expect(callArgs.updateTargetPrice).toBe(updateTargetPrice)
    expect(callArgs.upsertFundamentalsEntry).toBe(upsertFundamentalsEntry)

    expect(result.current).toEqual(
      expect.objectContaining({
        ...fakeTradeRuntime,
      })
    )
  })

  it('uses default values when context provides empty data', () => {
    mockUsePortfolioRouteContext.mockReturnValue({})

    const fakeRuntime = { uploads: [], parsing: false }
    mockUseTradeCaptureRuntime.mockReturnValue(fakeRuntime)

    const { result } = renderHook(() => useRouteTradePage())

    expect(mockUseTradeCaptureRuntime).toHaveBeenCalledTimes(1)
    const callArgs = mockUseTradeCaptureRuntime.mock.calls[0][0]
    expect(callArgs.holdings).toEqual([])
    expect(callArgs.tradeLog).toEqual([])
    expect(typeof callArgs.setHoldings).toBe('function')
    expect(typeof callArgs.setTradeLog).toBe('function')
    expect(typeof callArgs.upsertTargetReport).toBe('function')
    expect(typeof callArgs.updateTargetPrice).toBe('function')
    expect(typeof callArgs.upsertFundamentalsEntry).toBe('function')
    expect(typeof callArgs.applyTradeEntryToHoldings).toBe('function')
    expect(typeof callArgs.createDefaultFundamentalDraft).toBe('function')
    expect(typeof callArgs.toSlashDate).toBe('function')
    expect(typeof callArgs.flashSaved).toBe('function')

    expect(result.current).toEqual(
      expect.objectContaining({
        uploads: [],
        parsing: false,
      })
    )
  })

  it('uses blocked fallbacks when route context does not expose trade mutators', () => {
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
      holdings: [{ code: '2330' }],
      tradeLog: [{ id: 't1' }],
      applyTradeEntryToHoldings: vi.fn(),
      createDefaultFundamentalDraft: vi.fn(),
      toSlashDate: vi.fn(),
      flashSaved: vi.fn(),
    })

    mockUseTradeCaptureRuntime.mockImplementation((args) => args)

    const { result } = renderHook(() => useRouteTradePage())

    const callArgs = mockUseTradeCaptureRuntime.mock.calls[0][0]

    callArgs.setHoldings([{ code: '2454' }])
    callArgs.setTradeLog([{ id: 't2' }])
    expect(callArgs.upsertTargetReport({ code: '2330', targetPrice: 1000 })).toBe(false)
    expect(callArgs.updateTargetPrice('2330', 1000)).toBe(false)
    expect(callArgs.upsertFundamentalsEntry('2330', { moat: 'strong' })).toBe(false)

    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled()
    if (process.env.NODE_ENV !== 'production') {
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: setHoldings. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: setTradeLog. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: upsertTargetReport. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: updateTargetPrice. Use the canonical AppShell to mutate data.'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: upsertFundamentalsEntry. Use the canonical AppShell to mutate data.'
      )
    }
  })
})
