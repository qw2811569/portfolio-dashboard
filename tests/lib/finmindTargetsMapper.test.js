import { describe, expect, it } from 'vitest'
import { mapFinMindToPerBandTargets } from '../../src/lib/dataAdapters/finmindTargetsMapper.js'

const FIXED_NOW = new Date('2026-04-12T00:00:00.000Z')

function buildValuationHistory(perValues) {
  return perValues.map((per, index) => ({
    date: `2026-${String(12 - (index % 12)).padStart(2, '0')}-01`,
    per,
    pbr: 5.0,
    dividendYield: 0.02,
  }))
}

function buildFinancials(eps) {
  return [{ date: '2025-12-31', EPS: eps, Revenue: 1000000, GrossProfit: 500000 }]
}

describe('lib/dataAdapters/finmindTargetsMapper', () => {
  describe('mapFinMindToPerBandTargets — happy path', () => {
    it('derives a PE-band target band from historical valuation × latest EPS', () => {
      const result = mapFinMindToPerBandTargets(
        {
          valuation: buildValuationHistory([15, 18, 20, 22, 25, 17, 19, 21, 23, 16]),
          financials: buildFinancials(40),
        },
        { code: '2330', now: FIXED_NOW }
      )

      expect(result).not.toBeNull()
      expect(result.reports).toHaveLength(3)
      const [low, mid, high] = result.reports
      expect(low.firm).toBe('歷史PE低標')
      expect(mid.firm).toBe('歷史PE均值')
      expect(high.firm).toBe('歷史PE高標')
      expect(low.target).toBeLessThan(mid.target)
      expect(mid.target).toBeLessThan(high.target)
      expect(low.date).toBe('2026/04/12')
      expect(mid.date).toBe('2026/04/12')
      expect(high.date).toBe('2026/04/12')
      expect(result.source).toBe('finmind-per-band')
    })

    it('mid target equals median PER times latest EPS (rounded to whole number)', () => {
      const result = mapFinMindToPerBandTargets(
        {
          valuation: buildValuationHistory([10, 20, 30]),
          financials: buildFinancials(50),
        },
        { code: '2330', now: FIXED_NOW }
      )
      // median of [10, 20, 30] = 20; 20 * 50 = 1000
      const mid = result.reports.find((r) => r.firm === '歷史PE均值')
      expect(mid.target).toBe(1000)
    })
  })

  describe('mapFinMindToPerBandTargets — null/partial cases', () => {
    it('returns null when raw is null', () => {
      expect(mapFinMindToPerBandTargets(null, { code: '2330' })).toBeNull()
    })

    it('returns null when raw is empty object', () => {
      expect(mapFinMindToPerBandTargets({}, { code: '2330' })).toBeNull()
    })

    it('returns null when valuation array is empty', () => {
      expect(
        mapFinMindToPerBandTargets(
          { valuation: [], financials: buildFinancials(40) },
          { code: '2330' }
        )
      ).toBeNull()
    })

    it('returns null when financials array is empty', () => {
      expect(
        mapFinMindToPerBandTargets(
          { valuation: buildValuationHistory([15, 18, 20]), financials: [] },
          { code: '2330' }
        )
      ).toBeNull()
    })

    it('returns null when latest EPS is 0', () => {
      expect(
        mapFinMindToPerBandTargets(
          { valuation: buildValuationHistory([15, 18, 20]), financials: buildFinancials(0) },
          { code: '2330' }
        )
      ).toBeNull()
    })

    it('returns null when latest EPS is negative (loss-making)', () => {
      expect(
        mapFinMindToPerBandTargets(
          {
            valuation: buildValuationHistory([15, 18, 20]),
            financials: buildFinancials(-5),
          },
          { code: '2330' }
        )
      ).toBeNull()
    })

    it('ignores non-finite PER values when computing percentiles', () => {
      const result = mapFinMindToPerBandTargets(
        {
          valuation: [
            { date: '2026-03-01', per: null },
            { date: '2026-02-01', per: 10 },
            { date: '2026-01-01', per: 'bogus' },
            { date: '2025-12-01', per: 20 },
            { date: '2025-11-01', per: 30 },
          ],
          financials: buildFinancials(50),
        },
        { code: '2330', now: FIXED_NOW }
      )
      expect(result).not.toBeNull()
      // Valid PERs: [10, 20, 30], median 20, 20 * 50 = 1000
      const mid = result.reports.find((r) => r.firm === '歷史PE均值')
      expect(mid.target).toBe(1000)
    })

    it('returns null when all PER values are invalid', () => {
      expect(
        mapFinMindToPerBandTargets(
          {
            valuation: [
              { date: '2026-03-01', per: null },
              { date: '2026-02-01', per: 'bogus' },
            ],
            financials: buildFinancials(50),
          },
          { code: '2330' }
        )
      ).toBeNull()
    })
  })

  describe('mapFinMindToPerBandTargets — synthetic report shape', () => {
    it('each report has firm, target, date, and is compatible with existing targets schema', () => {
      const result = mapFinMindToPerBandTargets(
        {
          valuation: buildValuationHistory([15, 18, 20, 22, 25]),
          financials: buildFinancials(40),
        },
        { code: '2330', now: FIXED_NOW }
      )
      for (const report of result.reports) {
        expect(report).toHaveProperty('firm')
        expect(typeof report.firm).toBe('string')
        expect(report).toHaveProperty('target')
        expect(typeof report.target).toBe('number')
        expect(report.target).toBeGreaterThan(0)
        expect(report).toHaveProperty('date')
        expect(typeof report.date).toBe('string')
      }
    })
  })
})
