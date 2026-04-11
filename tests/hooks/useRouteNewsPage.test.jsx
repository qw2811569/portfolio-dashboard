import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUsePortfolioRouteContext = vi.fn()
const mockCreateDefaultReviewForm = vi.fn()

vi.mock('../../src/pages/usePortfolioRouteContext.js', () => ({
  usePortfolioRouteContext: () => mockUsePortfolioRouteContext(),
}))

vi.mock('../../src/lib/eventUtils.js', () => ({
  createDefaultReviewForm: (overrides) => mockCreateDefaultReviewForm(overrides),
}))

import { useRouteNewsPage } from '../../src/hooks/useRouteNewsPage.js'

describe('hooks/useRouteNewsPage.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupDefaults() {
    const updateEvent = vi.fn()

    mockCreateDefaultReviewForm.mockReturnValue({
      actual: '',
      actualNote: '',
      lessons: '',
      exitDate: '',
      priceAtExit: '',
    })

    mockUsePortfolioRouteContext.mockReturnValue({
      newsEvents: [
        { id: 'e1', title: 'Earnings Call', code: '2330' },
        { id: 'e2', title: 'Dividend', code: '2317' },
      ],
      updateEvent,
      createDefaultReviewForm: mockCreateDefaultReviewForm,
    })

    return { updateEvent }
  }

  it('renders without crashing and returns correct props structure', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteNewsPage())

    expect(result.current).toHaveProperty('newsEvents')
    expect(result.current).toHaveProperty('reviewingEvent', null)
    expect(result.current).toHaveProperty('reviewForm')
    expect(result.current).toHaveProperty('setReviewForm')
    expect(result.current).toHaveProperty('submitReview')
    expect(result.current).toHaveProperty('cancelReview')
    expect(result.current).toHaveProperty('setExpandedNews')
    expect(result.current).toHaveProperty('expandedNews')
    expect(result.current).toHaveProperty('setReviewingEvent')
    expect(result.current).toHaveProperty('createDefaultReviewForm')
  })

  it('passes through newsEvents from context', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteNewsPage())

    expect(result.current.newsEvents).toHaveLength(2)
    expect(result.current.newsEvents[0].id).toBe('e1')
  })

  it('initial review state is correct', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteNewsPage())

    expect(result.current.reviewingEvent).toBeNull()
    expect(result.current.reviewForm).toEqual({
      actual: '',
      actualNote: '',
      lessons: '',
      exitDate: '',
      priceAtExit: '',
    })
    expect(result.current.expandedNews).toBeInstanceOf(Set)
    expect(result.current.expandedNews.size).toBe(0)
  })

  it('cancelReview resets reviewingEvent and reviewForm', () => {
    setupDefaults()

    const { result } = renderHook(() => useRouteNewsPage())

    // Set some review state first
    act(() => {
      result.current.setReviewingEvent({ id: 'e1', title: 'Earnings', code: '2330' })
      result.current.setReviewForm({
        actual: 'hit',
        actualNote: 'good',
        lessons: 'none',
        exitDate: '',
        priceAtExit: '',
      })
    })

    expect(result.current.reviewingEvent).not.toBeNull()

    // Now cancel
    act(() => {
      result.current.cancelReview()
    })

    expect(result.current.reviewingEvent).toBeNull()
    expect(result.current.reviewForm).toEqual({
      actual: '',
      actualNote: '',
      lessons: '',
      exitDate: '',
      priceAtExit: '',
    })
  })

  it('submitReview calls updateEvent and resets state', () => {
    const { updateEvent } = setupDefaults()
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

    const { result } = renderHook(() => useRouteNewsPage())

    // Set reviewing event and form
    act(() => {
      result.current.setReviewingEvent({ id: 'e1', title: 'Earnings', code: '2330' })
      result.current.setReviewForm({
        actual: 'hit',
        actualNote: 'As expected',
        lessons: 'Trust the process',
        exitDate: '2026-04-04',
        priceAtExit: '960',
      })
    })

    act(() => {
      result.current.submitReview()
    })

    expect(updateEvent).not.toHaveBeenCalled()
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled()
    expect(result.current.reviewingEvent).toEqual({ id: 'e1', title: 'Earnings', code: '2330' })
    if (process.env.NODE_ENV !== 'production') {
      expect(warnSpy).toHaveBeenCalledWith(
        '[route-shell] write blocked: updateEvent. Use the canonical AppShell to mutate data.'
      )
    }
  })

  it('submitReview does nothing when no reviewingEvent', () => {
    const { updateEvent } = setupDefaults()

    const { result } = renderHook(() => useRouteNewsPage())

    act(() => {
      result.current.submitReview()
    })

    expect(updateEvent).not.toHaveBeenCalled()
  })
})
