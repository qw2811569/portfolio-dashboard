import { describe, expect, it } from 'vitest'
import { mapFinMindToFundamentals } from '../../src/lib/dataAdapters/finmindFundamentalsMapper.js'
import { normalizeFundamentalsEntry } from '../../src/lib/dossierUtils.js'

const FIXED_NOW = new Date('2026-04-12T10:00:00.000Z')

function buildFullFixture() {
  return {
    revenue: [
      {
        date: '2026-03-31',
        revenueMonth: 3,
        revenueYear: 2026,
        revenue: 1000000,
        revenueYoY: 12.5,
        revenueMoM: -2.3,
      },
    ],
    financials: [
      {
        date: '2025-12-31',
        EPS: 8.25,
        Revenue: 850000,
        GrossProfit: 450000,
        NetIncome: 200000,
      },
    ],
    balanceSheet: [
      {
        date: '2025-12-31',
        Equity: 1500000,
      },
    ],
  }
}

function buildRevenueOnlyFixture() {
  return {
    revenue: [
      {
        date: '2026-03-31',
        revenueMonth: 3,
        revenueYear: 2026,
        revenue: 1000000,
        revenueYoY: 12.5,
        revenueMoM: -2.3,
      },
    ],
    financials: [],
    balanceSheet: [],
  }
}

function buildFinancialsOnlyFixture() {
  return {
    revenue: [],
    financials: [
      {
        date: '2025-12-31',
        EPS: 8.25,
        Revenue: 850000,
        GrossProfit: 450000,
      },
    ],
    balanceSheet: [],
  }
}

describe('lib/dataAdapters/finmindFundamentalsMapper', () => {
  describe('mapFinMindToFundamentals — full coverage (fresh)', () => {
    it('maps full FinMind response to a fresh fundamentals entry', () => {
      const result = mapFinMindToFundamentals(buildFullFixture(), {
        code: '2330',
        now: FIXED_NOW,
      })

      expect(result).not.toBeNull()
      expect(result.completeness).toBe('fresh')

      const { entry } = result
      expect(entry.code).toBe('2330')
      expect(entry.revenueMonth).toBe('2026-03')
      expect(entry.revenueYoY).toBe(12.5)
      expect(entry.revenueMoM).toBe(-2.3)
      expect(entry.quarter).toBe('2025Q4')
      expect(entry.eps).toBe(8.25)
      // grossMargin = (450000 / 850000) * 100 ≈ 52.94, rounded to one decimal
      expect(entry.grossMargin).toBeCloseTo(52.9, 1)
      // roe = (200000 / 1500000) * 100 ≈ 13.33, rounded to one decimal
      expect(entry.roe).toBeCloseTo(13.3, 1)
      expect(entry.source).toBe('finmind')
      expect(entry.updatedAt).toBe(FIXED_NOW.toISOString())
    })

    it('produces an entry that round-trips through normalizeFundamentalsEntry', () => {
      const result = mapFinMindToFundamentals(buildFullFixture(), {
        code: '2330',
        now: FIXED_NOW,
      })
      const normalized = normalizeFundamentalsEntry(result.entry)
      expect(normalized).not.toBeNull()
      expect(normalized.code).toBe('2330')
      expect(normalized.revenueMonth).toBe('2026-03')
      expect(normalized.revenueYoY).toBe(12.5)
      expect(normalized.eps).toBe(8.25)
      expect(normalized.source).toBe('finmind')
    })
  })

  describe('mapFinMindToFundamentals — partial coverage', () => {
    it('maps revenue-only response to a partial entry with zeroed financials', () => {
      const result = mapFinMindToFundamentals(buildRevenueOnlyFixture(), {
        code: '2330',
        now: FIXED_NOW,
      })

      expect(result).not.toBeNull()
      expect(result.completeness).toBe('partial')

      const { entry } = result
      expect(entry.revenueMonth).toBe('2026-03')
      expect(entry.revenueYoY).toBe(12.5)
      expect(entry.quarter).toBe('')
      expect(entry.eps).toBe(0)
      expect(entry.grossMargin).toBe(0)
      expect(entry.roe).toBe(0)
    })

    it('maps financials-only response to a partial entry with empty revenue fields', () => {
      const result = mapFinMindToFundamentals(buildFinancialsOnlyFixture(), {
        code: '2330',
        now: FIXED_NOW,
      })

      expect(result).not.toBeNull()
      expect(result.completeness).toBe('partial')

      const { entry } = result
      expect(entry.revenueMonth).toBe('')
      expect(entry.revenueYoY).toBe(0)
      expect(entry.quarter).toBe('2025Q4')
      expect(entry.eps).toBe(8.25)
      expect(entry.grossMargin).toBeCloseTo(52.9, 1)
    })
  })

  describe('mapFinMindToFundamentals — empty or null', () => {
    it('returns null when raw is null', () => {
      expect(mapFinMindToFundamentals(null, { code: '2330' })).toBeNull()
    })

    it('returns null when all datasets are empty arrays', () => {
      expect(
        mapFinMindToFundamentals(
          { revenue: [], financials: [], balanceSheet: [] },
          { code: '2330' }
        )
      ).toBeNull()
    })

    it('returns null when required datasets are missing from the raw object', () => {
      expect(mapFinMindToFundamentals({}, { code: '2330' })).toBeNull()
    })
  })

  describe('mapFinMindToFundamentals — field defaults', () => {
    it('handles missing revenueYoY and revenueMoM gracefully', () => {
      const result = mapFinMindToFundamentals(
        {
          revenue: [{ date: '2026-03-31', revenueMonth: 3, revenueYear: 2026, revenue: 1000000 }],
          financials: [],
          balanceSheet: [],
        },
        { code: '2330', now: FIXED_NOW }
      )
      expect(result).not.toBeNull()
      expect(result.entry.revenueYoY).toBe(0)
      expect(result.entry.revenueMoM).toBe(0)
    })

    it('skips grossMargin when Revenue is zero', () => {
      const result = mapFinMindToFundamentals(
        {
          revenue: [],
          financials: [{ date: '2025-12-31', EPS: 5, Revenue: 0, GrossProfit: 100 }],
          balanceSheet: [],
        },
        { code: '2330', now: FIXED_NOW }
      )
      expect(result).not.toBeNull()
      expect(result.entry.grossMargin).toBe(0)
      expect(result.entry.eps).toBe(5)
    })

    it('computes roe from IncomeAfterTaxes when NetIncome is absent', () => {
      const result = mapFinMindToFundamentals(
        {
          revenue: [],
          financials: [
            {
              date: '2025-12-31',
              quarter: '2025Q4',
              statementPeriodMode: 'standalone-monthly-verified',
              Revenue: 1000,
              GrossProfit: 400,
              IncomeAfterTaxes: 120,
              EPS: 2.5,
            },
          ],
          balanceSheet: [
            {
              date: '2025-12-31',
              EquityAttributableToOwnersOfParent: 800,
            },
          ],
        },
        { code: '2330', now: FIXED_NOW }
      )

      expect(result).not.toBeNull()
      expect(result.entry.quarter).toBe('2025Q4')
      expect(result.entry.roe).toBeCloseTo(15, 1)
      expect(result.entry.note).toContain('statementPeriodMode=standalone-monthly-verified')
    })
  })
})
