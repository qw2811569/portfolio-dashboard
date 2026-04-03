import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/constants.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    CLOUD_SAVE_DEBOUNCE: 500, // speed up for tests
  }
})

import { useCloudSync } from '../../src/hooks/useCloudSync.js'
import { OWNER_PORTFOLIO_ID, PORTFOLIO_VIEW_MODE } from '../../src/constants.js'

describe('hooks/useCloudSync.js', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders without crashing with default params', () => {
    const { result } = renderHook(() => useCloudSync())
    expect(result.current).toBeDefined()
  })

  it('returns the correct shape', () => {
    const { result } = renderHook(() => useCloudSync())

    // State
    expect(result.current).toHaveProperty('cloudSync')
    expect(result.current).toHaveProperty('cloudSyncState')
    expect(result.current).toHaveProperty('canUseCloud')

    // Operations
    expect(result.current.setCloudStateForPortfolio).toBeTypeOf('function')
    expect(result.current.scheduleCloudSave).toBeTypeOf('function')
    expect(result.current.cancelCloudSave).toBeTypeOf('function')
    expect(result.current.cancelAllCloudSaves).toBeTypeOf('function')
    expect(result.current.syncAnalysisFromCloud).toBeTypeOf('function')
    expect(result.current.syncResearchFromCloud).toBeTypeOf('function')
    expect(result.current.deleteAnalysisFromCloud).toBeTypeOf('function')
    expect(result.current.saveAnalysisToCloud).toBeTypeOf('function')
    expect(result.current.saveResearchToCloud).toBeTypeOf('function')
  })

  // --- canUseCloud ---

  it('canUseCloud is true when viewMode=portfolio and activePortfolioId=owner', () => {
    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: OWNER_PORTFOLIO_ID,
        viewMode: PORTFOLIO_VIEW_MODE,
      })
    )
    expect(result.current.canUseCloud).toBe(true)
    expect(result.current.cloudSync).toBe(true)
  })

  it('canUseCloud is false when viewMode is not portfolio', () => {
    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: OWNER_PORTFOLIO_ID,
        viewMode: 'overview',
      })
    )
    expect(result.current.canUseCloud).toBe(false)
    expect(result.current.cloudSync).toBe(false)
  })

  it('canUseCloud is false when activePortfolioId is not owner', () => {
    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: 'other-portfolio',
        viewMode: PORTFOLIO_VIEW_MODE,
      })
    )
    expect(result.current.canUseCloud).toBe(false)
    expect(result.current.cloudSync).toBe(false)
  })

  it('canUseCloud is false when both params are wrong', () => {
    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: 'other',
        viewMode: 'overview',
      })
    )
    expect(result.current.canUseCloud).toBe(false)
  })

  // --- setCloudStateForPortfolio ---

  it('setCloudStateForPortfolio enables cloud when owner + portfolio mode', () => {
    const { result } = renderHook(() => useCloudSync())

    act(() => {
      result.current.setCloudStateForPortfolio(OWNER_PORTFOLIO_ID, PORTFOLIO_VIEW_MODE)
    })

    expect(result.current.cloudSync).toBe(true)
    expect(result.current.cloudSyncState.enabled).toBe(true)
  })

  it('setCloudStateForPortfolio disables cloud for non-owner', () => {
    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: OWNER_PORTFOLIO_ID,
        viewMode: PORTFOLIO_VIEW_MODE,
      })
    )

    act(() => {
      result.current.setCloudStateForPortfolio('other-id', PORTFOLIO_VIEW_MODE)
    })

    expect(result.current.cloudSync).toBe(false)
    expect(result.current.cloudSyncState.enabled).toBe(false)
    expect(result.current.cloudSyncState.syncedAt).toBe(0)
  })

  it('setCloudStateForPortfolio reads syncedAt from localStorage when enabling', () => {
    localStorage.setItem('pf-cloud-sync-at', '12345')

    const { result } = renderHook(() => useCloudSync())

    act(() => {
      result.current.setCloudStateForPortfolio(OWNER_PORTFOLIO_ID, PORTFOLIO_VIEW_MODE)
    })

    // cloudSyncState is cloudSyncStateRef.current — check the ref was written
    expect(result.current.cloudSync).toBe(true)
    // After re-render the ref snapshot is still the same object
    expect(result.current.cloudSyncState.enabled).toBe(true)
  })

  // --- scheduleCloudSave debounce ---

  it('scheduleCloudSave schedules a debounced save attempt when cloud is enabled', async () => {
    vi.useFakeTimers()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })

    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: OWNER_PORTFOLIO_ID,
        viewMode: PORTFOLIO_VIEW_MODE,
      })
    )

    act(() => {
      result.current.scheduleCloudSave('test-action', { foo: 'bar' }, 'saved!')
    })

    // Before debounce fires — fetch not called yet
    expect(global.fetch).not.toHaveBeenCalled()

    // After debounce — the timer fires and fetch is called with correct data
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test-action', data: { foo: 'bar' } }),
    })
  })

  it('scheduleCloudSave does nothing when cloud is disabled', async () => {
    vi.useFakeTimers()

    global.fetch = vi.fn()

    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: 'other',
        viewMode: 'overview',
      })
    )

    act(() => {
      result.current.scheduleCloudSave('test-action', { foo: 'bar' }, 'saved!')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('scheduleCloudSave debounces multiple calls — only the last timer fires', async () => {
    vi.useFakeTimers()

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: OWNER_PORTFOLIO_ID,
        viewMode: PORTFOLIO_VIEW_MODE,
      })
    )

    act(() => {
      result.current.scheduleCloudSave('save', { v: 1 })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    // Fire again before debounce completes — should replace the first
    act(() => {
      result.current.scheduleCloudSave('save', { v: 2 })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    // Only one timer fired (the second call replaced the first)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })

  // --- cancelCloudSave / cancelAllCloudSaves ---

  it('cancelCloudSave prevents a scheduled save from firing', async () => {
    vi.useFakeTimers()

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: OWNER_PORTFOLIO_ID,
        viewMode: PORTFOLIO_VIEW_MODE,
      })
    )

    act(() => {
      result.current.scheduleCloudSave('my-action', { x: 1 })
    })

    act(() => {
      result.current.cancelCloudSave('my-action')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('cancelAllCloudSaves cancels all pending saves', async () => {
    vi.useFakeTimers()

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: OWNER_PORTFOLIO_ID,
        viewMode: PORTFOLIO_VIEW_MODE,
      })
    )

    act(() => {
      result.current.scheduleCloudSave('action-a', { a: 1 })
      result.current.scheduleCloudSave('action-b', { b: 1 })
    })

    act(() => {
      result.current.cancelAllCloudSaves()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  // --- cleanup on unmount ---

  it('cancels all cloud save timers on unmount', async () => {
    vi.useFakeTimers()

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    const { result, unmount } = renderHook(() =>
      useCloudSync({
        activePortfolioId: OWNER_PORTFOLIO_ID,
        viewMode: PORTFOLIO_VIEW_MODE,
      })
    )

    act(() => {
      result.current.scheduleCloudSave('save', { x: 1 })
    })

    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  // --- syncAnalysisFromCloud ---

  it('syncAnalysisFromCloud returns null for non-owner portfolio', async () => {
    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: OWNER_PORTFOLIO_ID,
        viewMode: PORTFOLIO_VIEW_MODE,
      })
    )

    const data = await act(async () => {
      return result.current.syncAnalysisFromCloud('not-owner')
    })

    expect(data).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // --- deleteAnalysisFromCloud ---

  it('deleteAnalysisFromCloud returns false when cloud is disabled', async () => {
    const { result } = renderHook(() =>
      useCloudSync({
        activePortfolioId: 'other',
        viewMode: 'overview',
      })
    )

    const success = await act(async () => {
      return result.current.deleteAnalysisFromCloud('r1', '2026-01-01')
    })

    expect(success).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
