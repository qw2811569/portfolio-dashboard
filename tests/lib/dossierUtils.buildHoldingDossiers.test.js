import { describe, it, expect } from 'vitest'
import {
  buildDailyHoldingDossierContext,
  buildHoldingDossiers,
  buildResearchHoldingDossierContext,
} from '../../src/lib/dossierUtils.js'

describe('dossierUtils - buildHoldingDossiers', () => {
  const mockHoldings = [
    { code: '2330', name: '台積電', qty: 1000, cost: 550 },
    { code: '2382', name: '廣達', qty: 500, cost: 1400 },
  ]

  const mockStockMeta = {
    2330: {
      strategy: '成長股',
      industry: '半導體',
      leader: '龍頭',
      position: '核心',
      period: '中長',
      themes: ['AI 伺服器', '先進製程'],
    },
    2382: {
      strategy: '成長股',
      industry: 'AI/伺服器',
      leader: '小龍頭',
      position: '衛星',
      period: '中',
      themes: ['AI 伺服器'],
    },
  }

  describe('basic dossier building', () => {
    it('should build dossiers from holdings array', () => {
      const dossiers = buildHoldingDossiers(mockHoldings)

      expect(dossiers).toHaveLength(2)
      expect(dossiers[0].code).toBe('2330')
      expect(dossiers[0].name).toBe('台積電')
    })

    it('should build dossiers with config object', () => {
      const dossiers = buildHoldingDossiers({
        holdings: mockHoldings,
        targets: { 2330: { reports: [] } },
      })

      expect(dossiers).toHaveLength(2)
      expect(dossiers[0].targets).toEqual([])
    })

    it('should handle empty holdings', () => {
      const dossiers = buildHoldingDossiers([])
      expect(dossiers).toHaveLength(0)
    })

    it('should handle null input', () => {
      const dossiers = buildHoldingDossiers(null)
      expect(dossiers).toHaveLength(0)
    })
  })

  describe('stockMeta wiring (regression test for critical bug)', () => {
    it('should attach stockMeta to each dossier', () => {
      const dossiers = buildHoldingDossiers({
        holdings: mockHoldings,
        stockMeta: mockStockMeta,
      })

      const tsmc = dossiers.find((d) => d.code === '2330')
      expect(tsmc.stockMeta).toBeDefined()
      expect(tsmc.stockMeta.strategy).toBe('成長股')
      expect(tsmc.stockMeta.industry).toBe('半導體')
    })

    it('should attach themes from stockMeta', () => {
      const dossiers = buildHoldingDossiers({
        holdings: mockHoldings,
        stockMeta: mockStockMeta,
      })

      const tsmc = dossiers.find((d) => d.code === '2330')
      expect(tsmc.stockMeta.themes).toContain('AI 伺服器')
      expect(tsmc.stockMeta.themes).toContain('先進製程')
    })

    it('should handle missing stockMeta gracefully', () => {
      const dossiers = buildHoldingDossiers({
        holdings: mockHoldings,
        stockMeta: {},
      })

      const tsmc = dossiers.find((d) => d.code === '2330')
      expect(tsmc.stockMeta).toBeNull()
    })

    it('should handle partial stockMeta', () => {
      const partialMeta = {
        2330: mockStockMeta['2330'],
        // 2382 is missing
      }

      const dossiers = buildHoldingDossiers({
        holdings: mockHoldings,
        stockMeta: partialMeta,
      })

      const tsmc = dossiers.find((d) => d.code === '2330')
      const quanta = dossiers.find((d) => d.code === '2382')

      expect(tsmc.stockMeta).toBeDefined()
      expect(quanta.stockMeta).toBeNull()
    })
  })

  describe('finmind field initialization', () => {
    it('should initialize finmind as null', () => {
      const dossiers = buildHoldingDossiers(mockHoldings)
      expect(dossiers[0].finmind).toBeNull()
    })

    it('should allow finmind to be populated later', () => {
      const dossiers = buildHoldingDossiers(mockHoldings)
      dossiers[0].finmind = { institutional: [] }
      expect(dossiers[0].finmind).toBeDefined()
    })
  })

  describe('freshness derivation', () => {
    function daysAgoSlashDate(days) {
      const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`
    }

    it('sets freshness.targets = fresh when the latest report is within 30 days', () => {
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        targets: { 2330: { reports: [{ firm: '元大', target: 700, date: daysAgoSlashDate(10) }] } },
      })
      expect(dossiers[0].freshness.targets).toBe('fresh')
    })

    it('sets freshness.targets = aging when the latest report is 31-90 days old', () => {
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        targets: { 2330: { reports: [{ firm: '元大', target: 700, date: daysAgoSlashDate(60) }] } },
      })
      expect(dossiers[0].freshness.targets).toBe('aging')
    })

    it('sets freshness.targets = stale when the latest report is 91-120 days old', () => {
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        targets: {
          2330: { reports: [{ firm: '元大', target: 700, date: daysAgoSlashDate(100) }] },
        },
      })
      expect(dossiers[0].freshness.targets).toBe('stale')
    })

    it('classifies >120-day-old reports as stale (Codex tiebreaker: old-but-present stays stale)', () => {
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        targets: {
          2330: { reports: [{ firm: '元大', target: 700, date: daysAgoSlashDate(200) }] },
        },
      })
      expect(dossiers[0].freshness.targets).toBe('stale')
    })

    it('sets freshness.targets = missing when the holding has no target reports', () => {
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        targets: {},
      })
      expect(dossiers[0].freshness.targets).toBe('missing')
    })

    it('ignores malformed date strings when picking the latest report', () => {
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        targets: {
          2330: {
            reports: [
              { firm: '元大', target: 700, date: '2026/13/01' },
              { firm: '富邦', target: 650, date: daysAgoSlashDate(5) },
            ],
          },
        },
      })
      expect(dossiers[0].freshness.targets).toBe('fresh')
    })

    it('picks the most recent report when multiple valid dates are present', () => {
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        targets: {
          2330: {
            reports: [
              { firm: '元大', target: 700, date: daysAgoSlashDate(100) },
              { firm: '富邦', target: 720, date: daysAgoSlashDate(5) },
              { firm: '凱基', target: 680, date: daysAgoSlashDate(50) },
            ],
          },
        },
      })
      expect(dossiers[0].freshness.targets).toBe('fresh')
    })

    it('derives freshness.fundamentals from entry.updatedAt when present', () => {
      const recentIso = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        fundamentals: {
          2330: {
            revenueMonth: '2026-03',
            revenueYoY: 12.5,
            updatedAt: recentIso,
          },
        },
      })
      expect(dossiers[0].freshness.fundamentals).toBe('fresh')
    })

    it('sets freshness.fundamentals = missing when entry is absent', () => {
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        fundamentals: {},
      })
      expect(dossiers[0].freshness.fundamentals).toBe('missing')
    })

    it('sets freshness.fundamentals = missing when entry has no updatedAt', () => {
      const dossiers = buildHoldingDossiers({
        holdings: [mockHoldings[0]],
        fundamentals: { 2330: { revenueMonth: '2026-03', revenueYoY: 12.5 } },
      })
      expect(dossiers[0].freshness.fundamentals).toBe('missing')
    })
  })

  describe('other dossier fields', () => {
    it('should attach targets to dossiers', () => {
      const mockTargets = {
        2330: { reports: [{ firm: '高盛', target: 700 }] },
      }

      const dossiers = buildHoldingDossiers({
        holdings: mockHoldings,
        targets: mockTargets,
      })

      const tsmc = dossiers.find((d) => d.code === '2330')
      expect(tsmc.targets).toHaveLength(1)
    })

    it('should attach fundamentals to dossiers', () => {
      const mockFundamentals = {
        2330: { revenueMonth: '2000 億', revenueYoY: 15 },
      }

      const dossiers = buildHoldingDossiers({
        holdings: mockHoldings,
        fundamentals: mockFundamentals,
      })

      const tsmc = dossiers.find((d) => d.code === '2330')
      expect(tsmc.fundamentals.revenueMonth).toBe('2000 億')
    })

    it('should filter events by stock code', () => {
      const mockEvents = [{ id: 'evt-001', date: '2026-04-15', title: '法說會', stocks: ['2330'] }]

      const dossiers = buildHoldingDossiers({
        holdings: mockHoldings,
        newsEvents: mockEvents,
      })

      const tsmc = dossiers.find((d) => d.code === '2330')
      const quanta = dossiers.find((d) => d.code === '2382')

      expect(tsmc.events).toHaveLength(1)
      expect(quanta.events).toHaveLength(0)
    })
  })

  describe('compact prompt summary', () => {
    it('builds a shorter compact holding summary for daily analysis prompts', () => {
      const dossier = {
        code: '2330',
        name: '台積電',
        position: { qty: 1000, cost: 550, value: 952000, pnl: 402000, pct: 73.09, price: 952 },
        thesis: {
          statement: 'AI 需求帶動先進製程與 CoWoS 產能持續吃緊，月營收維持高增速。',
          conviction: 'high',
          targetPrice: 1080,
          stopLoss: 900,
        },
        targets: [{ firm: '高盛', target: 1100 }],
        fundamentals: { revenueMonth: '2026/03', revenueYoY: 32, revenueMoM: 8 },
        events: [{ date: '2026/04/18', title: '法說會' }],
        brainContext: {
          matchedRules: [{ text: '法說前兩週可布局，若未超預期則事件後減碼。' }],
        },
        stockMeta: { strategy: '成長股' },
        finmind: {
          institutional: [{ foreign: 1200, investment: 80, dealer: -20 }],
          valuation: [{ per: 24.3, pbr: 7.12 }],
          margin: [{ marginBalance: 15000 }, { marginBalance: 15300 }],
          revenue: [{ revenueMonth: '2026/03', revenueYoY: 32, revenueMoM: 8 }],
          balanceSheet: [
            {
              totalAssets: 520000,
              totalLiabilities: 210000,
              shareholderEquity: 310000,
              debtRatio: 40.4,
            },
          ],
          cashFlow: [{ operatingCF: 62000, investingCF: -18000, financingCF: -9000 }],
          shareholding: [{ foreignShareRatio: 72.5 }, { foreignShareRatio: 71.8 }],
        },
        freshness: { fundamentals: 'fresh', targets: 'fresh', events: 'tracking' },
      }
      const change = { changePct: 2.18 }

      const verbose = buildDailyHoldingDossierContext(dossier, change)
      const compact = buildDailyHoldingDossierContext(dossier, change, { compact: true })

      expect(verbose).toContain('股票代碼: 2330')
      expect(verbose).toContain('=== 知識庫參考 ===')
      expect(verbose).toContain('月營收：月營收 2026/03')
      expect(verbose).toContain('資產負債表：')
      expect(verbose).toContain('現金流量表：')
      expect(verbose).toContain('外資持股比')
      expect(compact).toContain('<holding code="2330"')
      expect(compact).toContain('snapshot=')
      expect(compact).toContain('knowledge=')
      expect(compact).toContain('finmind=')
      expect(compact).toContain('營收2026/03')
      expect(compact).toContain('資產負債')
      expect(compact).toContain('現金流')
      expect(compact).toContain('外資持股')
      expect(compact.length).toBeLessThan(verbose.length)
    })
  })

  describe('event review compact context', () => {
    it('injects compact knowledge when stockMeta exists', () => {
      const dossier = {
        code: '2330',
        name: '台積電',
        position: { qty: 1000, cost: 550, price: 952, pnl: 402000, pct: 73.09 },
        stockMeta: mockStockMeta['2330'],
      }

      const compact = buildResearchHoldingDossierContext(dossier, { compact: true })

      expect(compact).toContain('台積電(2330)')
      expect(compact).toContain('知識:')
    })

    it('keeps compact event-review context stable when stockMeta is missing', () => {
      const dossier = {
        code: '2330',
        name: '台積電',
        position: { qty: 1000, cost: 550, price: 952, pnl: 402000, pct: 73.09 },
        stockMeta: null,
      }

      const compact = buildResearchHoldingDossierContext(dossier, { compact: true })

      expect(compact).toContain('台積電(2330)')
      expect(typeof compact).toBe('string')
      expect(compact.length).toBeGreaterThan(0)
    })
  })
})
