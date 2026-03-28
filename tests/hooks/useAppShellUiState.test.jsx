import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppShellUiState } from '../../src/hooks/useAppShellUiState.js'

describe('hooks/useAppShellUiState.js', () => {
  it('resets transient app UI state and clears pending trade capture state', () => {
    const resetTradeCapture = vi.fn()
    const resetTradeCaptureRef = { current: resetTradeCapture }
    const { result } = renderHook(() => useAppShellUiState({ resetTradeCaptureRef }))

    act(() => {
      result.current.setDailyExpanded(true)
      result.current.setExpandedStock('2330')
      result.current.setExpandedNews(new Set(['event-1']))
      result.current.setReviewingEvent({ id: 'event-1' })
      result.current.setReviewForm({ summary: 'draft' })
      result.current.setResearchTarget('2330')
      result.current.setResearchResults({ code: '2330' })
      result.current.setRelayPlanExpanded(true)
    })

    act(() => {
      result.current.resetTransientUiState()
    })

    expect(resetTradeCapture).toHaveBeenCalledTimes(1)
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
})
