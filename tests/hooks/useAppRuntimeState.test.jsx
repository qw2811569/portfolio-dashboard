import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OWNER_PORTFOLIO_ID, PORTFOLIO_VIEW_MODE } from '../../src/constants.js'
import { createEmptyBrainValidationStore } from '../../src/lib/brainRuntime.js'
import { clonePortfolioNotes } from '../../src/lib/portfolioUtils.js'
import { useAppRuntimeState } from '../../src/hooks/useAppRuntimeState.js'

describe('hooks/useAppRuntimeState.js', () => {
  it('initializes grouped runtime state, setters, and refs with stable defaults', () => {
    const { result } = renderHook(() => useAppRuntimeState())

    expect(result.current.ready).toBe(false)
    expect(result.current.cloudSync).toBe(false)
    expect(result.current.analyzing).toBe(false)
    expect(result.current.researching).toBe(false)
    expect(result.current.brainValidation).toEqual(createEmptyBrainValidationStore())
    expect(result.current.portfolioNotes).toEqual(clonePortfolioNotes())
    expect(result.current.runtimeState.portfolioNotes).toEqual(clonePortfolioNotes())
    expect(result.current.refs.activePortfolioIdRef.current).toBe(OWNER_PORTFOLIO_ID)
    expect(result.current.refs.viewModeRef.current).toBe(PORTFOLIO_VIEW_MODE)
    expect(typeof result.current.runtimeSetters.setHoldings).toBe('function')
    expect(typeof result.current.refs.refreshAnalystReportsRef.current).toBe('function')
  })

  it('keeps grouped runtimeState in sync after setter updates', () => {
    const { result } = renderHook(() => useAppRuntimeState())

    act(() => {
      result.current.runtimeSetters.setReady(true)
      result.current.runtimeSetters.setPortfolioNotes({ customNotes: 'next step' })
      result.current.runtimeSetters.setDailyReport({ summary: 'done' })
    })

    expect(result.current.ready).toBe(true)
    expect(result.current.runtimeState.ready).toBe(true)
    expect(result.current.portfolioNotes).toEqual({ customNotes: 'next step' })
    expect(result.current.runtimeState.portfolioNotes).toEqual({ customNotes: 'next step' })
    expect(result.current.runtimeState.dailyReport).toEqual({ summary: 'done' })
  })
})
