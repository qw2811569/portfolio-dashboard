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
})
