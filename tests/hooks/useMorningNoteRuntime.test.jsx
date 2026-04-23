import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMorningNoteRuntime } from '../../src/hooks/useMorningNoteRuntime.js'

describe('hooks/useMorningNoteRuntime.js', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds morning note from runtime inputs', () => {
    const { result } = renderHook(() =>
      useMorningNoteRuntime({
        holdings: [{ code: '2330', name: '台積電', qty: 1 }],
        theses: [],
        newsEvents: [{ id: 'evt-1', title: '法說會', date: '2026/03/30' }],
        watchlist: [{ code: '2454', name: '聯發科' }],
      })
    )

    expect(result.current).toHaveProperty('date')
    expect(result.current).toHaveProperty('sections')
    expect(Array.isArray(result.current.sections.holdingStatus)).toBe(true)
  })

  it('prefers remote morning note snapshots when the API returns one', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        note: {
          date: '2026/04/24',
          headline: '08:30 盤前 note',
          summary: '今天先看兩件事。',
          sections: {
            todayEvents: [],
            holdingStatus: [],
            watchlistAlerts: [],
            announcements: [],
          },
        },
      }),
    }))

    const { result } = renderHook(() =>
      useMorningNoteRuntime({
        portfolioId: 'me',
        holdings: [{ code: '2330', name: '台積電', qty: 1 }],
        theses: [],
        newsEvents: [],
        watchlist: [],
        fetchImpl,
      })
    )

    await waitFor(() => expect(result.current?.headline).toBe('08:30 盤前 note'))
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/morning-note?portfolioId=me',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    )
  })
})
