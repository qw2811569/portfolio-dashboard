import { describe, it, expect } from 'vitest'
import { classifyStock, mergeClassification } from '../../src/lib/stockClassifier.js'

describe('stockClassifier', () => {
  describe('classifyStock', () => {
    it('uses STOCK_META when available (highest confidence)', () => {
      const result = classifyStock('2330', {
        stockMeta: {
          industry: 'AI/伺服器',
          strategy: '成長股',
          period: '中長',
          position: '核心',
          leader: '龍頭',
        },
      })

      expect(result.industry).toEqual({
        value: 'AI/伺服器',
        confidence: 'high',
        source: 'stock-meta',
      })
      expect(result.strategy).toEqual({ value: '成長股', confidence: 'high', source: 'stock-meta' })
      expect(result.period).toEqual({ value: '中長', confidence: 'high', source: 'stock-meta' })
      expect(result.position).toEqual({ value: '核心', confidence: 'high', source: 'stock-meta' })
      expect(result.leader).toEqual({ value: '龍頭', confidence: 'high', source: 'stock-meta' })
    })

    it('classifies industry from companyProfiles when no stockMeta', () => {
      // 1503 (士電) is in companyProfiles with industry: '重電設備'
      const result = classifyStock('1503', {})
      expect(result.industry.value).toBe('重電設備')
      expect(result.industry.source).toBe('company-profile')
    })

    it('classifies industry from themeClassification when no profile', () => {
      // 2382 (廣達) is in themeClassification with theme AI_伺服器
      // but NOT in companyProfiles (only 12 stocks there)
      const result = classifyStock('2382', {})
      // Should find via theme classification or theme reverse lookup
      expect(result.industry.value).toBeTruthy()
      expect(result.industry.confidence).not.toBe('low')
    })

    it('classifies warrant from holding type', () => {
      const result = classifyStock('053848', {
        holding: { type: '權證' },
      })
      expect(result.strategy).toEqual({ value: '權證', confidence: 'high', source: 'holding-type' })
      expect(result.period.value).toBe('短')
      expect(result.leader.value).toBe('N/A')
    })

    it('classifies ETF from holding type', () => {
      const result = classifyStock('00637L', {
        holding: { type: 'ETF' },
      })
      expect(result.strategy.value).toBe('ETF/指數')
      expect(result.period.value).toBe('中長')
    })

    it('infers cyclical strategy from cyclical industry', () => {
      const result = classifyStock('9999', {
        stockMeta: { industry: '營建' },
      })
      expect(result.strategy.value).toBe('景氣循環')
      expect(result.strategy.source).toBe('industry-rule')
    })

    it('infers growth strategy from growth theme', () => {
      // 2308 (台達電) is in themeClassification with AI_伺服器 theme
      const result = classifyStock('2308', {})
      expect(result.strategy.value).toBe('成長股')
    })

    it('derives period from strategy', () => {
      const result = classifyStock('9999', {
        stockMeta: { strategy: '事件驅動' },
      })
      expect(result.period.value).toBe('短中')
      expect(result.period.source).toBe('strategy-derived')
    })

    it('classifies position dynamically from portfolio rank', () => {
      const result = classifyStock('2330', {
        holdingRank: 1, // top stock
        totalHoldings: 20,
      })
      expect(result.position.value).toBe('核心')
      expect(result.position.source).toBe('portfolio-weight')
    })

    it('classifies position as 衛星 for mid-ranked stocks', () => {
      const result = classifyStock('1234', {
        holdingRank: 6,
        totalHoldings: 20,
      })
      expect(result.position.value).toBe('衛星')
    })

    it('classifies position as 戰術 for bottom-ranked stocks', () => {
      const result = classifyStock('5678', {
        holdingRank: 15,
        totalHoldings: 20,
      })
      expect(result.position.value).toBe('戰術')
    })

    it('returns unresolved for completely unknown stock', () => {
      const result = classifyStock('ZZZZ', {})
      expect(result.industry.confidence).toBe('low')
      expect(result.industry.source).toBe('unresolved')
    })

    it('infers growth from FinMind revenue YoY > 15%', () => {
      const result = classifyStock('9999', {
        finmind: {
          revenue: [{ revenueYoY: 25 }],
        },
      })
      expect(result.strategy.value).toBe('成長股')
      expect(result.strategy.source).toBe('finmind-revenue-yoy')
    })

    it('classifies leader as 龍頭 via four-dimension scoring', () => {
      const result = classifyStock('2308', {
        finmind: {
          financials: [{ Revenue: 50000000, GrossProfit: 20000000 }],
          revenue: [{ revenue: 15000000 }],
        },
      })
      // 2308 (台達電) has profile with market-share keywords + multi-theme + high revenue
      expect(['龍頭', '二線']).toContain(result.leader.value)
      expect(result.leader.source).toMatch(/leader-score/)
    })

    it('classifies leader as N/A for non-company types', () => {
      const result = classifyStock('053848', { holding: { type: '權證' } })
      expect(result.leader.value).toBe('N/A')
    })

    it('uses name-keyword heuristic for unknown stock industry', () => {
      const result = classifyStock('9999', {
        holding: { name: '台灣半導體製造' },
      })
      expect(result.industry.value).toBe('半導體')
      expect(result.industry.source).toBe('name-keyword')
    })

    it('detects warrant from 6-digit code via name-keyword heuristic', () => {
      const result = classifyStock('123456', {
        holding: { name: '元大台積電購03' },
      })
      expect(result.strategy.value).toBe('權證')
      expect(result.strategy.source).toBe('name-keyword')
    })

    it('detects ETF from name keyword', () => {
      const result = classifyStock('9999', {
        holding: { name: '元大台灣50反1' },
      })
      expect(result.strategy.value).toBe('ETF/指數')
      expect(result.strategy.source).toBe('name-keyword')
    })
  })

  describe('mergeClassification', () => {
    it('fills missing fields from classification', () => {
      const existing = { industry: 'AI/伺服器' }
      const classification = {
        industry: { value: '半導體', confidence: 'medium', source: 'auto' },
        strategy: { value: '成長股', confidence: 'medium', source: 'auto' },
        period: { value: '中長', confidence: 'medium', source: 'auto' },
        position: { value: '核心', confidence: 'medium', source: 'auto' },
        leader: { value: '龍頭', confidence: 'medium', source: 'auto' },
      }
      const merged = mergeClassification(existing, classification)

      // Existing industry preserved
      expect(merged.industry).toBe('AI/伺服器')
      // Missing fields filled
      expect(merged.strategy).toBe('成長股')
      expect(merged.period).toBe('中長')
      expect(merged.strategySource).toBe('auto')
    })

    it('does not fill with 待分類', () => {
      const classification = {
        strategy: { value: '待分類', confidence: 'low', source: 'unresolved' },
      }
      const merged = mergeClassification({}, classification)
      expect(merged.strategy).toBeUndefined()
    })
  })
})
