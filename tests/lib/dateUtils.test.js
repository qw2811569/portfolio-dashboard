import { describe, expect, it } from 'vitest'
import { parseFlexibleDate, daysBetween, computeFreshnessGrade } from '../../src/lib/dateUtils.js'

describe('lib/dateUtils', () => {
  describe('parseFlexibleDate', () => {
    it('parses YYYY/MM/DD', () => {
      const d = parseFlexibleDate('2026/02/27')
      expect(d).toBeInstanceOf(Date)
      expect(d.getUTCFullYear()).toBe(2026)
      expect(d.getUTCMonth()).toBe(1) // Feb = index 1
      expect(d.getUTCDate()).toBe(27)
    })

    it('parses YYYY/MM (defaults to first day of month)', () => {
      const d = parseFlexibleDate('2026/03')
      expect(d).toBeInstanceOf(Date)
      expect(d.getUTCFullYear()).toBe(2026)
      expect(d.getUTCMonth()).toBe(2) // Mar = index 2
      expect(d.getUTCDate()).toBe(1)
    })

    it('parses YYYY/M/D (single-digit month/day)', () => {
      const d = parseFlexibleDate('2026/3/5')
      expect(d.getUTCFullYear()).toBe(2026)
      expect(d.getUTCMonth()).toBe(2)
      expect(d.getUTCDate()).toBe(5)
    })

    it('parses YYYY-MM-DD ISO date', () => {
      const d = parseFlexibleDate('2026-02-27')
      expect(d.getUTCFullYear()).toBe(2026)
      expect(d.getUTCMonth()).toBe(1)
      expect(d.getUTCDate()).toBe(27)
    })

    it('parses full ISO string', () => {
      const d = parseFlexibleDate('2026-02-27T10:00:00.000Z')
      expect(d.getUTCFullYear()).toBe(2026)
      expect(d.getUTCMonth()).toBe(1)
      expect(d.getUTCDate()).toBe(27)
    })

    it('parses full ISO string with timezone offset', () => {
      const d = parseFlexibleDate('2026-04-23T16:00:00.000+08:00')
      expect(d).toBeInstanceOf(Date)
      expect(d.toISOString()).toBe('2026-04-23T08:00:00.000Z')
    })

    it('returns null for empty string', () => {
      expect(parseFlexibleDate('')).toBeNull()
    })

    it('returns null for null / undefined', () => {
      expect(parseFlexibleDate(null)).toBeNull()
      expect(parseFlexibleDate(undefined)).toBeNull()
    })

    it('returns null for non-string', () => {
      expect(parseFlexibleDate(12345)).toBeNull()
      expect(parseFlexibleDate({})).toBeNull()
    })

    it('returns null for malformed date (month 13)', () => {
      expect(parseFlexibleDate('2026/13/01')).toBeNull()
    })

    it('returns null for malformed date (month 0)', () => {
      expect(parseFlexibleDate('2026/00/01')).toBeNull()
    })

    it('returns null for garbage string', () => {
      expect(parseFlexibleDate('not-a-date')).toBeNull()
      expect(parseFlexibleDate('2026')).toBeNull()
    })

    it('accepts a Date object and returns a fresh clone', () => {
      const source = new Date('2026-02-27T00:00:00.000Z')
      const result = parseFlexibleDate(source)
      expect(result).toBeInstanceOf(Date)
      expect(result).not.toBe(source)
      expect(result.getTime()).toBe(source.getTime())
    })
  })

  describe('daysBetween', () => {
    it('computes whole-day difference from two ISO strings', () => {
      const a = new Date('2026-04-12T00:00:00.000Z')
      const b = new Date('2026-04-10T00:00:00.000Z')
      expect(daysBetween(a, b)).toBe(2)
    })

    it('order-independent — absolute value', () => {
      const a = new Date('2026-04-10T00:00:00.000Z')
      const b = new Date('2026-04-12T00:00:00.000Z')
      expect(daysBetween(a, b)).toBe(2)
    })

    it('returns 0 for same-day', () => {
      const a = new Date('2026-04-12T10:00:00.000Z')
      const b = new Date('2026-04-12T20:00:00.000Z')
      expect(daysBetween(a, b)).toBe(0)
    })

    it('returns null when either argument is null', () => {
      expect(daysBetween(null, new Date())).toBeNull()
      expect(daysBetween(new Date(), null)).toBeNull()
      expect(daysBetween(null, null)).toBeNull()
    })
  })

  describe('computeFreshnessGrade', () => {
    const NOW = new Date('2026-04-12T00:00:00.000Z')

    it('returns "missing" when no dates provided', () => {
      expect(computeFreshnessGrade([], { now: NOW })).toBe('missing')
    })

    it('returns "missing" when all dates fail to parse', () => {
      expect(computeFreshnessGrade(['not-a-date', null, '2026/13/01'], { now: NOW })).toBe(
        'missing'
      )
    })

    it('returns "fresh" when the most recent parsed date is ≤30 days old', () => {
      expect(computeFreshnessGrade(['2026/03/20'], { now: NOW })).toBe('fresh')
    })

    it('treats timezone-offset ISO timestamps as valid freshness inputs', () => {
      expect(
        computeFreshnessGrade(['2026-04-10T16:00:00.000+08:00'], {
          now: NOW,
        })
      ).toBe('fresh')
    })

    it('returns "aging" when the most recent parsed date is 31-90 days old', () => {
      expect(computeFreshnessGrade(['2026/02/01'], { now: NOW })).toBe('aging')
    })

    it('returns "stale" when the most recent parsed date is 91-120 days old', () => {
      // 100 days before 2026-04-12 ≈ 2026-01-02
      expect(computeFreshnessGrade(['2026/01/02'], { now: NOW })).toBe('stale')
    })

    it('returns "stale" (not "missing") when the most recent date is >120 days old (Codex tiebreaker: old but present stays stale)', () => {
      // 200 days before 2026-04-12 ≈ 2025-09-24
      expect(computeFreshnessGrade(['2025/09/24'], { now: NOW })).toBe('stale')
    })

    it('uses the most recent date when multiple are provided', () => {
      expect(
        computeFreshnessGrade(['2025/01/01', '2026/03/20', '2025/12/01'], {
          now: NOW,
        })
      ).toBe('fresh')
    })

    it('ignores null/invalid entries when mixed with valid ones', () => {
      expect(computeFreshnessGrade([null, '2026/03/20', 'garbage', undefined], { now: NOW })).toBe(
        'fresh'
      )
    })

    it('uses custom thresholds for targets: 7-day fresh, 30-day aging', () => {
      const targetThresholds = { fresh: 7, aging: 30 }
      // 5 days old → fresh
      expect(
        computeFreshnessGrade(['2026/04/07'], { now: NOW, thresholds: targetThresholds })
      ).toBe('fresh')
      // 10 days old → aging (>7, <=30)
      expect(
        computeFreshnessGrade(['2026/04/02'], { now: NOW, thresholds: targetThresholds })
      ).toBe('aging')
      // 35 days old → stale (>30)
      expect(
        computeFreshnessGrade(['2026/03/08'], { now: NOW, thresholds: targetThresholds })
      ).toBe('stale')
    })

    it('default thresholds unchanged when thresholds not provided', () => {
      // 25 days → fresh (default 30)
      expect(computeFreshnessGrade(['2026/03/18'], { now: NOW })).toBe('fresh')
      // 60 days → aging (default 30-90)
      expect(computeFreshnessGrade(['2026/02/11'], { now: NOW })).toBe('aging')
    })
  })
})
