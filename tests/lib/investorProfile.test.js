import { describe, it, expect } from 'vitest'
import { deriveInvestorProfile } from '../../src/lib/investorProfile.js'

describe('investorProfile', () => {
  describe('deriveInvestorProfile', () => {
    it('returns empty profile when no holdings', () => {
      const result = deriveInvestorProfile([])
      expect(result.style).toBe('尚無持倉')
      expect(result.summary).toContain('沒有持倉')
    })

    it('derives growth-oriented profile from classified holdings', () => {
      const holdings = [
        {
          holding: { code: '2330', price: 600, qty: 1000 },
          classification: {
            strategy: { value: '成長股' },
            period: { value: '中長' },
            position: { value: '核心' },
          },
        },
        {
          holding: { code: '2382', price: 300, qty: 500 },
          classification: {
            strategy: { value: '成長股' },
            period: { value: '中' },
            position: { value: '衛星' },
          },
        },
        {
          holding: { code: '1503', price: 200, qty: 200 },
          classification: {
            strategy: { value: '景氣循環' },
            period: { value: '中' },
            position: { value: '戰術' },
          },
        },
      ]

      const result = deriveInvestorProfile(holdings, {
        getMarketValue: (h) => h.price * h.qty,
      })

      expect(result.style).toBe('成長型')
      expect(result.summary).toContain('成長型')
      expect(result.strategyDistribution['成長股']).toBeGreaterThan(50)
    })

    it('flags high concentration when one strategy dominates', () => {
      const holdings = [
        {
          holding: { code: '2330', price: 600, qty: 1000 },
          classification: {
            strategy: { value: '成長股' },
            period: { value: '中長' },
            position: { value: '核心' },
          },
        },
      ]

      const result = deriveInvestorProfile(holdings, {
        getMarketValue: (h) => h.price * h.qty,
      })

      expect(result.summary).toContain('集中度偏高')
    })

    it('handles mixed portfolio styles', () => {
      const holdings = [
        {
          holding: { code: '2330', price: 600, qty: 500 },
          classification: {
            strategy: { value: '成長股' },
            period: { value: '中長' },
            position: { value: '核心' },
          },
        },
        {
          holding: { code: '1503', price: 250, qty: 800 },
          classification: {
            strategy: { value: '景氣循環' },
            period: { value: '中' },
            position: { value: '衛星' },
          },
        },
      ]

      const result = deriveInvestorProfile(holdings, {
        getMarketValue: (h) => h.price * h.qty,
      })

      // Both strategies are significant; summary should reflect primary
      expect(result.strategyDistribution).toHaveProperty('成長股')
      expect(result.strategyDistribution).toHaveProperty('景氣循環')
    })
  })
})
