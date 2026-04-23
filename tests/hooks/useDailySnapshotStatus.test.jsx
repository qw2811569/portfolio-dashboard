import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDailySnapshotStatus } from '../../src/hooks/useDailySnapshotStatus.js'

describe('hooks/useDailySnapshotStatus.js', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the remote daily snapshot health payload', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        stale: true,
        badgeStatus: 'stale',
        lastSuccessAt: '2026-04-22T19:00:00.000Z',
      }),
    }))

    const { result } = renderHook(() => useDailySnapshotStatus({ fetchImpl }))

    await waitFor(() => expect(result.current?.badgeStatus).toBe('stale'))
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/daily-snapshot-status',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    )
  })

  it('falls back to null when the status request fails', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    }))

    const { result } = renderHook(() => useDailySnapshotStatus({ fetchImpl }))

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled())
    await waitFor(() => expect(result.current).toBeNull())
  })
})
