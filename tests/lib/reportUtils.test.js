import { describe, expect, it } from 'vitest'
import { normalizeAnalystReportItem } from '../../src/lib/reportUtils.js'

describe('lib/reportUtils.js', () => {
  it('preserves aggregate payloads on analyst report items', () => {
    const item = normalizeAnalystReportItem({
      id: 'agg-1',
      title: '台積電 Cnyes 目標價共識',
      url: 'https://example.com',
      source: 'cnyes_aggregate',
      targetType: 'aggregate',
      aggregate: {
        medianTarget: 2352.5,
        meanTarget: 2390.17,
        min: 1900,
        max: 3030,
        firmsCount: 36,
        numEst: 36,
        rateDate: '2026-04-13',
      },
    })

    expect(item.targetType).toBe('aggregate')
    expect(item.aggregate).toEqual({
      medianTarget: 2352.5,
      meanTarget: 2390.17,
      min: 1900,
      max: 3030,
      firmsCount: 36,
      numEst: 36,
      rateDate: '2026-04-13',
    })
  })
})
