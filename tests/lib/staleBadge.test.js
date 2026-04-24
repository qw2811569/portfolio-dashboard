import { describe, expect, it } from 'vitest'
import {
  formatStaleBadgeExactTimestamp,
  normalizeStaleBadgeResource,
  resolveStaleBadgeResourceState,
} from '../../src/lib/staleBadge.js'

describe('lib/staleBadge', () => {
  it('normalizes macro/calendar into the shared contract key', () => {
    expect(normalizeStaleBadgeResource('macro/calendar')).toBe('macro-calendar')
  })

  it('marks targets as stale once they are older than 7 days', () => {
    const state = resolveStaleBadgeResourceState({
      resource: 'targets',
      updatedAt: '2026-04-15T00:00:00.000Z',
      now: new Date('2026-04-24T12:00:00.000Z'),
    })

    expect(state.status).toBe('stale')
    expect(state.text).toBe('9 天前')
  })

  it('marks macro data as stale once it is older than 24 hours', () => {
    const state = resolveStaleBadgeResourceState({
      resource: 'macro',
      updatedAt: '2026-04-23T11:00:00.000Z',
      now: new Date('2026-04-24T12:30:00.000Z'),
    })

    expect(state.status).toBe('stale')
  })

  it('formats timezone-offset timestamps into relative age text', () => {
    const state = resolveStaleBadgeResourceState({
      resource: 'fundamentals',
      updatedAt: '2026-04-23T16:00:00.000+08:00',
      now: new Date('2026-04-24T12:30:00.000Z'),
    })

    expect(state.status).toBe('fresh')
    expect(state.text).toBeTruthy()
  })

  it('formats restore timestamps as exact Taipei time instead of relative ago text', () => {
    const text = formatStaleBadgeExactTimestamp('2026-04-24T10:30:00.000Z')

    expect(text).toContain('4/24')
    expect(text).toContain('18:30')
    expect(text).not.toContain('前')
  })
})
