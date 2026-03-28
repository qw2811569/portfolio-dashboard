import { describe, it, expect } from 'vitest'
import {
  resolveHoldingPrice,
  getHoldingMarketValue,
  getHoldingUnrealizedPnl,
  getHoldingReturnPct,
  normalizeHoldingMetrics,
} from '../../src/lib/holdings.js'
import { calculateTotalMarketValue } from '../../src/lib/holdingMath.ts'

describe('lib/holdings.js', () => {
  const mockHolding = {
    code: '2330',
    name: '台積電',
    qty: 1000,
    cost: 500,
    price: 600,
  }

  describe('resolveHoldingPrice', () => {
    it('應該返回 overridePrice 如果提供', () => {
      expect(resolveHoldingPrice(mockHolding, 700)).toBe(700)
    })

    it('應該返回 stored price 如果沒有 overridePrice', () => {
      expect(resolveHoldingPrice(mockHolding)).toBe(600)
    })

    it('應該從 value/qty 計算如果沒有 price', () => {
      const holding = { ...mockHolding, price: 0, value: 600000 }
      expect(resolveHoldingPrice(holding)).toBe(600)
    })

    it('應該返回 0 如果沒有可用價格', () => {
      expect(resolveHoldingPrice({ code: '2330', qty: 0 })).toBe(0)
    })
  })

  describe('getHoldingMarketValue', () => {
    it('應該計算正確的市值', () => {
      expect(getHoldingMarketValue(mockHolding)).toBe(600000)
    })

    it('應該使用 overridePrice 計算', () => {
      expect(getHoldingMarketValue(mockHolding, 700)).toBe(700000)
    })
  })

  describe('getHoldingUnrealizedPnl', () => {
    it('應該計算正確的未實現損益', () => {
      expect(getHoldingUnrealizedPnl(mockHolding)).toBe(100000)
    })

    it('應該使用預計算的 pnl 如果存在', () => {
      const holding = { ...mockHolding, pnl: 150000 }
      expect(getHoldingUnrealizedPnl(holding)).toBe(150000)
    })
  })

  describe('getHoldingReturnPct', () => {
    it('應該計算正確的報酬率', () => {
      expect(getHoldingReturnPct(mockHolding)).toBe(20)
    })

    it('應該使用預計算的 pct 如果存在', () => {
      const holding = { ...mockHolding, pct: 25 }
      expect(getHoldingReturnPct(holding)).toBe(25)
    })

    it('應該返回 0 如果 costBasis 為 0', () => {
      const holding = { ...mockHolding, cost: 0 }
      expect(getHoldingReturnPct(holding)).toBe(0)
    })
  })

  describe('normalizeHoldingMetrics', () => {
    it('應該正確正規化持股指標', () => {
      const normalized = normalizeHoldingMetrics(mockHolding)
      expect(normalized.price).toBe(600)
      expect(normalized.value).toBe(600000)
      expect(normalized.pnl).toBe(100000)
      expect(normalized.pct).toBe(20)
    })
  })

  describe('calculateTotalMarketValue', () => {
    it('應該根據價格表計算總市值，缺價格時回退成本價', () => {
      const holdings = [
        { code: '2330', qty: 1000, cost: 500 },
        { code: '2317', qty: 2000, cost: 100 },
      ]

      expect(calculateTotalMarketValue(holdings, { 2330: 600 })).toBe(800000)
    })
  })
})
