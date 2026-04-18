import { describe, expect, it } from 'vitest'
import { calculateConcentration } from '../../src/lib/concentrationMetrics.js'

describe('lib/concentrationMetrics', () => {
  it('returns zero concentration for empty holdings', () => {
    expect(calculateConcentration([])).toEqual({
      hhi: 0,
      top1Weight: 0,
      top3Weight: 0,
      top5Weight: 0,
      industryBreakdown: [],
      maxIndustryWeight: 0,
      risk: 'low',
      warnings: [],
    })
  })

  it('returns critical for a single holding', () => {
    const result = calculateConcentration([{ code: '2330', value: 100 }])

    expect(result.hhi).toBe(10000)
    expect(result.top1Weight).toBe(1)
    expect(result.risk).toBe('critical')
  })

  it('treats evenly distributed 10-name portfolio as low concentration', () => {
    const holdings = Array.from({ length: 10 }, (_, index) => ({
      code: `${1000 + index}`,
      value: 100,
      industry: `產業-${index}`,
    }))

    const result = calculateConcentration(holdings)

    expect(result.hhi).toBe(1000)
    expect(result.top3Weight).toBeCloseTo(0.3, 5)
    expect(result.risk).toBe('low')
  })

  it('treats dominant single-industry exposure as critical', () => {
    const result = calculateConcentration([
      { code: 'A', value: 500, industry: '半導體' },
      { code: 'B', value: 300, industry: '電子零組件' },
      { code: 'C', value: 200, industry: '半導體' },
    ])

    expect(result.maxIndustryWeight).toBeCloseTo(0.7, 5)
    expect(result.risk).toBe('critical')
    expect(result.warnings).toContain('半導體佔 70%')
  })

  it('warns when top holding exceeds threshold', () => {
    const result = calculateConcentration([
      { code: 'A', value: 350, industry: '半導體' },
      { code: 'B', value: 250, industry: '電子' },
      { code: 'C', value: 200, industry: '生技' },
      { code: 'D', value: 200, industry: '金融' },
    ])

    expect(result.top1Weight).toBeCloseTo(0.35, 5)
    expect(result.warnings).toContain('Top 1 佔 35%')
    expect(result.risk).toBe('critical')
  })

  it('aggregates two industries at 50 50 split', () => {
    const result = calculateConcentration([
      { code: 'A', value: 400, industry: '半導體' },
      { code: 'B', value: 100, industry: '半導體' },
      { code: 'C', value: 300, industry: '生技' },
      { code: 'D', value: 200, industry: '生技' },
    ])

    expect(result.industryBreakdown).toEqual([
      { industry: '半導體', weight: 0.5, count: 2 },
      { industry: '生技', weight: 0.5, count: 2 },
    ])
    expect(result.maxIndustryWeight).toBe(0.5)
    expect(result.risk).toBe('critical')
  })

  it('falls back to unknown label when industry metadata is missing', () => {
    const result = calculateConcentration([{ code: 'UNKNOWN', value: 100 }])

    expect(result.industryBreakdown).toEqual([{ industry: '未分類', weight: 1, count: 1 }])
  })

  it('skips holdings with zero value', () => {
    const result = calculateConcentration([
      { code: 'A', value: 0, industry: '半導體' },
      { code: 'B', value: 100, industry: '電子' },
    ])

    expect(result.hhi).toBe(10000)
    expect(result.industryBreakdown).toEqual([{ industry: '電子', weight: 1, count: 1 }])
  })

  it('uses stock meta fallback when industry is absent on holding', () => {
    const result = calculateConcentration(
      [
        { code: '2330', value: 600 },
        { code: '1799', value: 400 },
      ],
      {
        stockMeta: {
          2330: { industry: '半導體' },
          1799: { industry: '生技醫療' },
        },
      }
    )

    expect(result.industryBreakdown).toEqual([
      { industry: '半導體', weight: 0.6, count: 1 },
      { industry: '生技醫療', weight: 0.4, count: 1 },
    ])
    expect(result.risk).toBe('critical')
  })
})
