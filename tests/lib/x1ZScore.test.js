import { describe, expect, it } from 'vitest'
import {
  buildReturnSeriesFromValueSnapshots,
  calculateX1ZScore,
  deriveX1Interpretation,
} from '../../src/lib/x1ZScore.js'

function buildDate(index) {
  return `2026-04-${String(index).padStart(2, '0')}`
}

describe('lib/x1ZScore', () => {
  it('builds daily return series from value snapshots', () => {
    const result = buildReturnSeriesFromValueSnapshots([
      { date: '2026-04-01', totalValue: 100 },
      { date: '2026-04-02', totalValue: 103 },
      { date: '2026-04-03', totalValue: 101.97 },
    ])

    expect(result).toEqual([
      expect.objectContaining({ date: '2026-04-02', returnPct: 3 }),
      expect.objectContaining({ date: '2026-04-03', returnPct: -1 }),
    ])
  })

  it('computes a positive anomaly when the latest relative move is much larger than recent history', () => {
    const portfolioDailyReturns = []
    const benchmarkDailyReturns = []
    const diffs = [
      0.2, -0.2, 0.1, -0.1, 0.15, -0.15, 0.2, -0.2, 0.1, -0.1, 0.15, -0.15, 0.2, -0.2, 0.1, -0.1,
      0.15, -0.15, 0.2, 1.8,
    ]

    diffs.forEach((diff, index) => {
      const date = buildDate(index + 1)
      portfolioDailyReturns.push({ date, returnPct: 1 + diff })
      benchmarkDailyReturns.push({ date, returnPct: 1 })
    })

    const result = calculateX1ZScore({
      portfolioDailyReturns,
      benchmarkDailyReturns,
      trailingWindow: 20,
      recentWindow: 7,
    })

    expect(result.zScore).toBeGreaterThan(2)
    expect(result.interpretation).toBe('anomaly')
    expect(result.latestDate).toBe('2026-04-20')
    expect(result.sampleSize).toBe(20)
    expect(result.recentSeries).toHaveLength(7)
  })

  it('returns an unavailable result when aligned history is too short', () => {
    const result = calculateX1ZScore({
      portfolioDailyReturns: [{ date: '2026-04-01', returnPct: 1.2 }],
      benchmarkDailyReturns: [{ date: '2026-04-01', returnPct: 0.8 }],
      trailingWindow: 20,
    })

    expect(result.zScore).toBeNull()
    expect(result.reason).toBe('insufficient_history')
  })

  it('maps interpretation thresholds predictably', () => {
    expect(deriveX1Interpretation(0.4)).toBe('normal')
    expect(deriveX1Interpretation(1.1)).toBe('outperform')
    expect(deriveX1Interpretation(-1.1)).toBe('underperform')
    expect(deriveX1Interpretation(2.1)).toBe('anomaly')
  })
})
