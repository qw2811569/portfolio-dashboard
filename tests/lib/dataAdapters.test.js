import { describe, it, expect } from 'vitest'
import {
  FINMIND_DATASET_KEYS,
  getCompanyData,
  getSupplyChain,
  getThemes,
  getThemesForStock,
  getStocksInTheme,
} from '../../src/lib/dataAdapters/index.js'

describe('dataAdapters', () => {
  describe('getCompanyData', () => {
    it('returns merged data for known stock', () => {
      const data = getCompanyData('3017')
      expect(data.code).toBe('3017')
      expect(data.name).toBe('奇鋐')
      expect(data.source).toBe('coverage-static')
      expect(data.freshness).toBe('aging')
    })
    it('returns null for unknown stock', () => {
      expect(getCompanyData('9999')).toBeNull()
    })
  })

  describe('getSupplyChain', () => {
    it('returns supply chain for known stock', () => {
      const chain = getSupplyChain('3443')
      expect(chain.name).toBe('創意')
      expect(chain.upstream.length).toBeGreaterThan(0)
      expect(chain.customers.length).toBeGreaterThan(0)
    })
    it('returns null for unknown stock', () => {
      expect(getSupplyChain('9999')).toBeNull()
    })
  })

  describe('getThemes', () => {
    it('returns all themes', () => {
      const themes = getThemes()
      expect(Object.keys(themes).length).toBeGreaterThanOrEqual(10)
      expect(themes['AI伺服器']).toBeDefined()
      expect(themes['AI伺服器'].count).toBe(148)
    })
  })

  describe('getThemesForStock', () => {
    it('finds themes containing a stock code', () => {
      const themes = getThemesForStock('3017')
      const names = themes.map((t) => t.name)
      expect(names).toContain('AI伺服器')
    })
    it('returns empty for stock in no theme', () => {
      expect(getThemesForStock('9999')).toEqual([])
    })
  })

  describe('getStocksInTheme', () => {
    it('returns all stocks in a theme', () => {
      const stocks = getStocksInTheme('AI伺服器')
      expect(stocks.length).toBeGreaterThan(0)
      expect(stocks).toContain('2308')
    })
    it('returns empty for unknown theme', () => {
      expect(getStocksInTheme('不存在')).toEqual([])
    })
  })

  describe('FinMind registry', () => {
    it('exports the authoritative dataset registry keys', () => {
      expect(FINMIND_DATASET_KEYS).toEqual([
        'institutional',
        'margin',
        'valuation',
        'financials',
        'balanceSheet',
        'cashFlow',
        'dividend',
        'dividendResult',
        'capitalReductionReferencePrice',
        'revenue',
        'shareholding',
        'news',
      ])
    })
  })
})
