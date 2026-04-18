import { describe, expect, it } from 'vitest'
import { computeSeasonality } from '../../src/lib/seasonalityMetrics.js'

function buildSeries({ startYear = 2021, years = 5, revenueForMonth = (month) => month * 10 }) {
  return Array.from({ length: years }, (_, yearOffset) =>
    Array.from({ length: 12 }, (_, monthOffset) => {
      const month = monthOffset + 1
      const year = startYear + yearOffset
      return {
        year,
        month,
        revenue: revenueForMonth(month, year),
      }
    })
  ).flat()
}

describe('lib/seasonalityMetrics', () => {
  it('computes a 60-month matrix and ranks best/worst months', () => {
    const rows = buildSeries({
      revenueForMonth: (month, year) => year * 100 + month * 10,
    })

    const result = computeSeasonality(rows)

    expect(result.matrix).toHaveLength(60)
    expect(result.bestMonths).toEqual([12, 11, 10])
    expect(result.worstMonths).toEqual([1, 2, 3])
    expect(result.monthAvgs[12]).toBeGreaterThan(result.monthAvgs[1])
  })

  it('handles fewer than 60 months without requiring a full 5-year panel', () => {
    const rows = buildSeries({
      years: 1,
      revenueForMonth: (month) => month * 20,
    }).slice(0, 8)

    const result = computeSeasonality(rows)

    expect(result.matrix).toHaveLength(8)
    expect(Object.keys(result.monthAvgs)).toHaveLength(8)
    expect(result.bestMonths[0]).toBe(8)
    expect(result.worstMonths[0]).toBe(1)
  })

  it('returns zero seasonality when every month is identical', () => {
    const rows = buildSeries({
      revenueForMonth: () => 100,
    })

    const result = computeSeasonality(rows)

    expect(result.seasonalityIndex).toBe(0)
    expect(result.monthAvgs[1]).toBe(100)
    expect(result.monthAvgs[12]).toBe(100)
    expect(result.matrix.every((entry) => entry[4] === 1)).toBe(true)
  })

  it('detects strong seasonality from repeated Q4 peaks and Q1 troughs', () => {
    const rows = buildSeries({
      revenueForMonth: (month) => {
        if (month >= 10) return 220
        if (month <= 3) return 55
        return 100
      },
    })

    const result = computeSeasonality(rows)

    expect(result.bestMonths).toEqual([10, 11, 12])
    expect(result.worstMonths).toEqual([1, 2, 3])
    expect(result.seasonalityIndex).toBeGreaterThan(0.65)
  })

  it('survives missing months and only averages available samples', () => {
    const rows = buildSeries({
      years: 3,
      revenueForMonth: (month) => month * 30,
    }).filter((row) => !(row.year === 2022 && row.month === 2) && row.month !== 4)

    const result = computeSeasonality(rows)

    expect(result.matrix).toHaveLength(32)
    expect(result.monthAvgs[4]).toBeUndefined()
    expect(result.monthAvgs[2]).toBeGreaterThan(0)
    expect(result.bestMonths[0]).toBe(12)
  })

  it('handles zero-revenue histories without NaN inflation', () => {
    const rows = buildSeries({
      years: 2,
      revenueForMonth: () => 0,
    })

    const result = computeSeasonality(rows)

    expect(result.seasonalityIndex).toBe(0)
    expect(result.monthAvgs[1]).toBe(0)
    expect(result.matrix.every((entry) => entry[4] === 0)).toBe(true)
  })
})
