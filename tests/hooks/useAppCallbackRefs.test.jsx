import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppCallbackRefs } from '../../src/hooks/useAppCallbackRefs.js'

describe('hooks/useAppCallbackRefs.js', () => {
  it('syncs late-bound callback refs for analyst refresh and trade reset', () => {
    const refreshAnalystReportsRef = { current: null }
    const resetTradeCaptureRef = { current: null }
    const refreshAnalystReports = vi.fn()
    const resetTradeCapture = vi.fn()

    renderHook(() =>
      useAppCallbackRefs({
        refreshAnalystReportsRef,
        refreshAnalystReports,
        resetTradeCaptureRef,
        resetTradeCapture,
      })
    )

    expect(refreshAnalystReportsRef.current).toBe(refreshAnalystReports)
    expect(resetTradeCaptureRef.current).toBe(resetTradeCapture)
  })
})
