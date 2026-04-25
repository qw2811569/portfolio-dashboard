import { describe, expect, it } from 'vitest'
import {
  DAILY_PRINCIPLES,
  getDailyPrinciple,
  getDailyPrincipleDayKey,
} from '../../src/lib/dailyPrinciples.js'

describe('lib/dailyPrinciples', () => {
  it('derives the day key in Asia/Taipei market time', () => {
    expect(getDailyPrincipleDayKey(new Date('2026-04-23T17:30:00.000Z'))).toBe('2026-04-24')
  })

  it('rotates principles deterministically by Taipei day key', () => {
    const dayKey = '2026-04-24'
    const expected = DAILY_PRINCIPLES[Number(dayKey.replace(/-/g, '')) % DAILY_PRINCIPLES.length]

    expect(getDailyPrinciple(new Date('2026-04-24T00:00:00.000Z'))).toBe(expected)
  })

  it('returns entries with quote, author, and tag metadata', () => {
    const entry = getDailyPrinciple(new Date('2026-04-24T00:00:00.000Z'))
    expect(typeof entry.quote).toBe('string')
    expect(typeof entry.author).toBe('string')
    expect(Array.isArray(entry.tags)).toBe(true)
  })

  it('narrows the pool when portfolio context implies caution', () => {
    const calmEntry = getDailyPrinciple(new Date('2026-04-24T00:00:00.000Z'), null)
    const cautionEntry = getDailyPrinciple(new Date('2026-04-24T00:00:00.000Z'), {
      todayRetPct: 2.5,
      headlineTone: 'alert',
    })
    expect(cautionEntry.tags.some((tag) => ['caution', 'risk', 'humility'].includes(tag))).toBe(
      true
    )
    expect(calmEntry).toBeTruthy()
  })
})
