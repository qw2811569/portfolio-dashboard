import { renderHook } from '@testing-library/react'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUsePortfolioRouteContext = vi.fn()
const mockUseBrainStore = vi.fn()
const mockNavigate = vi.fn()
const mockMutateAsyncDaily = vi.fn()
const mockMutateAsyncStress = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('../../src/pages/usePortfolioRouteContext.js', () => ({
  usePortfolioRouteContext: () => mockUsePortfolioRouteContext(),
}))

vi.mock('../../src/stores/brainStore.js', () => ({
  useBrainStore: (selector) => mockUseBrainStore(selector),
}))

vi.mock('../../src/hooks/api/useAnalysis.js', () => ({
  useRunDailyAnalysis: () => ({ mutateAsync: mockMutateAsyncDaily }),
  useRunStressTest: () => ({ mutateAsync: mockMutateAsyncStress }),
}))

import { useRouteDailyPage } from '../../src/hooks/useRouteDailyPage.js'

describe('hooks/useRouteDailyPage.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupDefaults() {
    const maybeAutoConfirmDailyReport = vi.fn()
    mockUsePortfolioRouteContext.mockReturnValue({
      portfolioId: 'test-portfolio',
      dailyReport: { summary: 'test report' },
      setDailyReport: vi.fn(),
      analysisHistory: [],
      setAnalysisHistory: vi.fn(),
      newsEvents: [{ id: 'e1', title: 'Event 1' }],
      strategyBrain: { rules: [] },
      staleStatus: 'aging',
      operatingContext: { marketPhase: 'post-close' },
      maybeAutoConfirmDailyReport,
    })

    mockUseBrainStore.mockImplementation((selector) => {
      return selector({ expandedStock: null, setExpandedStock: vi.fn() })
    })
  }

  it('renders without crashing and returns correct props structure', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteDailyPage())

    expect(result.current).toHaveProperty('dailyReport')
    expect(result.current).toHaveProperty('analysisHistory')
    expect(result.current).toHaveProperty('analyzing', false)
    expect(result.current).toHaveProperty('analyzeStep', '')
    expect(result.current).toHaveProperty('stressResult', null)
    expect(result.current).toHaveProperty('stressTesting', false)
    expect(result.current).toHaveProperty('dailyExpanded', false)
    expect(result.current).toHaveProperty('setDailyExpanded')
    expect(result.current).toHaveProperty('runDailyAnalysis')
    expect(result.current).toHaveProperty('runStressTest')
    expect(result.current).toHaveProperty('closeStressResult')
    expect(result.current).toHaveProperty('newsEvents')
    expect(result.current).toHaveProperty('setTab')
    expect(result.current).toHaveProperty('setExpandedNews')
    expect(result.current).toHaveProperty('expandedNews')
    expect(result.current).toHaveProperty('expandedStock')
    expect(result.current).toHaveProperty('setExpandedStock')
    expect(result.current).toHaveProperty('strategyBrain')
    expect(result.current).toHaveProperty('staleStatus', 'aging')
    expect(result.current).toHaveProperty('operatingContext')
    expect(result.current).toHaveProperty('maybeAutoConfirmDailyReport')
  })

  it('passes through dailyReport and newsEvents from context', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteDailyPage())

    expect(result.current.dailyReport).toEqual({ summary: 'test report' })
    expect(result.current.newsEvents).toHaveLength(1)
    expect(result.current.newsEvents[0].id).toBe('e1')
    expect(result.current.strategyBrain).toEqual({ rules: [] })
  })

  it('setTab navigates to the correct route', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteDailyPage())

    result.current.setTab('research')
    expect(mockNavigate).toHaveBeenCalledWith('/portfolio/test-portfolio/research')
  })

  it('initial state values are correct', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteDailyPage())

    expect(result.current.analyzing).toBe(false)
    expect(result.current.analyzeStep).toBe('')
    expect(result.current.stressResult).toBeNull()
    expect(result.current.stressTesting).toBe(false)
    expect(result.current.dailyExpanded).toBe(false)
    expect(result.current.expandedNews).toBeInstanceOf(Set)
    expect(result.current.expandedNews.size).toBe(0)
  })

  it('passes through route-shell parity props for daily stage UI', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteDailyPage())

    expect(result.current.analysisHistory).toEqual([])
    expect(result.current.staleStatus).toBe('aging')
    expect(result.current.operatingContext).toEqual({ marketPhase: 'post-close' })
    expect(typeof result.current.maybeAutoConfirmDailyReport).toBe('function')
  })

  it('blocks runDailyAnalysis from mutating route-local state', async () => {
    const setDailyReport = vi.fn()
    const setAnalysisHistory = vi.fn()
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
      portfolioId: 'test-portfolio',
      dailyReport: null,
      setDailyReport,
      analysisHistory: [],
      setAnalysisHistory,
      newsEvents: [],
      strategyBrain: null,
    })
    mockUseBrainStore.mockImplementation((selector) =>
      selector({ expandedStock: null, setExpandedStock: vi.fn() })
    )

    const { result } = renderHook(() => useRouteDailyPage())

    await act(async () => {
      await result.current.runDailyAnalysis()
    })

    expect(mockMutateAsyncDaily).not.toHaveBeenCalled()
    expect(setDailyReport).not.toHaveBeenCalled()
    expect(setAnalysisHistory).not.toHaveBeenCalled()
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled()
    if (process.env.NODE_ENV !== 'production') {
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: runDailyAnalysis. Use the canonical AppShell to mutate data.'
      )
    }
  })
})
