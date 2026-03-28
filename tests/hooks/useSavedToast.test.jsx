import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSavedToast } from '../../src/hooks/useSavedToast.js'

describe('hooks/useSavedToast.js', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clears the previous timer before showing the next saved message', async () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useSavedToast())

    act(() => {
      result.current.flashSaved('first', 3000)
    })
    expect(result.current.saved).toBe('first')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    act(() => {
      result.current.flashSaved('second', 1000)
    })
    expect(result.current.saved).toBe('second')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999)
    })
    expect(result.current.saved).toBe('second')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(result.current.saved).toBe('')
  })
})
