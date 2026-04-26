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

  it('keeps the expanded Western-only quote schema complete without Chinese-name leaks', () => {
    const forbiddenNames = [
      '段永平',
      '李嘉誠',
      '孫子',
      '老子',
      '論語',
      '王陽明',
      '孔子',
      '巴菲特',
      '查理蒙格',
    ]

    expect(DAILY_PRINCIPLES.length).toBeGreaterThanOrEqual(350)

    for (const entry of DAILY_PRINCIPLES) {
      expect(entry.quote).toBeTruthy()
      expect(entry.quoteEn).toBeTruthy()
      expect(entry.author).toBeTruthy()
      expect(entry.year).toBeTruthy()
      expect(entry.authorBrief).toBeTruthy()
      expect(Array.isArray(entry.tags)).toBe(true)
      expect(entry.tags.length).toBeGreaterThan(0)

      const serialized = [
        entry.quote,
        entry.quoteEn,
        entry.author,
        entry.authorBrief,
        ...(Array.isArray(entry.tags) ? entry.tags : []),
      ].join(' ')
      for (const name of forbiddenNames) {
        expect(serialized).not.toContain(name)
      }
    }
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
