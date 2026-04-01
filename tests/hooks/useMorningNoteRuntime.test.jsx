import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMorningNoteRuntime } from '../../src/hooks/useMorningNoteRuntime.js'

describe('hooks/useMorningNoteRuntime.js', () => {
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
})
