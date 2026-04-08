/**
 * Tests for factPackBuilder.js
 * Phase 1 unit test — design doc v1 §0 + Qwen pre-flight check
 *
 * 核心測試: Rule 0 enforcement
 *   - news_facts 為空但 source 有資料 → throw
 *   - 4 大支柱必填
 *   - 1717 真實 dossier 應產出有 4 條 material news 的 factPack
 */

import { describe, it, expect } from 'vitest'
import { buildFactPack, preflightNewsCheck } from '../factPackBuilder.js'
import { FactPackError, validateFactPackShape } from '../factPackSchema.js'

describe('factPackBuilder', () => {
  describe('buildFactPack — basic shape', () => {
    it('給最小可用 input → 產出有效 factPack shape', () => {
      const factPack = buildFactPack(
        {
          stockId: '1717',
          stockName: '長興',
          dossierData: {
            valuation: [],
            financials: [],
            institutional: [],
            margin: [],
            shareholding: [],
            news: [],
          },
        },
        { skipPreflightCheck: true },
      )

      const errors = validateFactPackShape(factPack)
      expect(errors).toHaveLength(0)
    })

    it('4 大支柱必填: 即使空也要是陣列', () => {
      const factPack = buildFactPack(
        {
          stockId: '1717',
          dossierData: {
            valuation: [],
            financials: [],
            institutional: [],
            margin: [],
            shareholding: [],
            news: [],
          },
        },
        { skipPreflightCheck: true },
      )

      expect(Array.isArray(factPack.valuation_facts)).toBe(true)
      expect(Array.isArray(factPack.earnings_facts)).toBe(true)
      expect(Array.isArray(factPack.chip_facts)).toBe(true)
      expect(Array.isArray(factPack.news_facts)).toBe(true)
    })

    it('meta.code 缺 → 從 stockId 帶', () => {
      const factPack = buildFactPack(
        {
          stockId: '1717',
          dossierData: { news: [] },
        },
        { skipPreflightCheck: true },
      )
      expect(factPack.meta.code).toBe('1717')
    })

    it('stockId 缺 → throw FactPackError', () => {
      expect(() => {
        buildFactPack({ dossierData: { news: [] } }, { skipPreflightCheck: true })
      }).toThrow(FactPackError)
    })
  })

  describe('Rule 0 — preflightNewsCheck', () => {
    it('news_facts 空但 raw news 有資料 → throw', () => {
      expect(() => {
        preflightNewsCheck({
          rawNews: [{ title: '長興消息', date: '2026-04-08', source: 'CMoney' }],
          newsFacts: [], // 沒抽出任何 fact
          stockId: '1717',
          factPackPartial: {},
        })
      }).toThrow(FactPackError)
    })

    it('news_facts 空且 raw news 也空 → 不 throw (真的沒新聞)', () => {
      expect(() => {
        preflightNewsCheck({
          rawNews: [],
          newsFacts: [],
          stockId: '1717',
          factPackPartial: {},
        })
      }).not.toThrow()
    })

    it('news_facts 非空 → 不 throw', () => {
      expect(() => {
        preflightNewsCheck({
          rawNews: [{ title: '長興消息', date: '2026-04-08', source: 'CMoney' }],
          newsFacts: [{ id: 'news_1', headline: '長興消息' }],
          stockId: '1717',
          factPackPartial: {},
        })
      }).not.toThrow()
    })

    it('throw 的 error 帶 NEWS_FACTS_EMPTY_BUT_SOURCE_HAS_DATA code', () => {
      try {
        preflightNewsCheck({
          rawNews: [{ title: '消息', date: '2026-04-08' }],
          newsFacts: [],
          stockId: '1717',
          factPackPartial: { meta: { code: '1717' } },
        })
        expect.fail('應該 throw 才對')
      } catch (err) {
        expect(err).toBeInstanceOf(FactPackError)
        expect(err.code).toBe('NEWS_FACTS_EMPTY_BUT_SOURCE_HAS_DATA')
        expect(err.suggested_fix).toBeTruthy()
      }
    })
  })

  describe('1717 真實 dossier 模擬', () => {
    it('給 1717 4/8 的 dossier (含 news) → 應產出非空 news_facts', () => {
      const dossier = {
        valuation: [
          { date: '2026-04-08', PER: 47.59, PBR: 2.84, dividend_yield: 1.49 },
        ],
        financials: [
          { date: '2025-12-31', type: 'EPS', value: 0.32 },
        ],
        institutional: [
          { date: '2026-04-08', name: 'Foreign_Investor', buy: 14000000, sell: 0 },
        ],
        margin: [
          {
            date: '2026-04-08',
            MarginPurchaseTodayBalance: 28609,
          },
        ],
        shareholding: [
          { date: '2026-04-08', ForeignInvestmentSharesRatio: 11.99 },
        ],
        news: [
          {
            title: '長興(1717)攻上漲停 67.1 元, 受惠油價推升特化題材發酵',
            date: '2026-04-08 02:56:33',
            source: 'CMoney投資網誌',
            link: 'https://example.com/1',
          },
          {
            title: '長興 2 月稅前虧損 0.71 億元',
            date: '2026-04-08 03:00:00',
            source: '聯合新聞網',
            link: 'https://example.com/2',
          },
        ],
      }

      const factPack = buildFactPack({
        stockId: '1717',
        stockName: '長興',
        dossierData: dossier,
      })

      // news_facts 必須非空
      expect(factPack.news_facts.length).toBeGreaterThan(0)

      // 應該至少有 1 條 material
      const material = factPack.news_facts.filter(n => n.is_material)
      expect(material.length).toBeGreaterThanOrEqual(1)

      // 4 大支柱都填了
      expect(factPack.valuation_facts.length).toBeGreaterThan(0)
      expect(factPack.earnings_facts.length).toBeGreaterThan(0)
      expect(factPack.chip_facts.length).toBeGreaterThan(0)
      expect(factPack.news_facts.length).toBeGreaterThan(0)
    })

    it('給 1717 dossier 但 news 是空陣列 → factPack 仍可產出 + unresolved 標 news_empty', () => {
      const dossier = {
        valuation: [{ date: '2026-04-08', PER: 47.59 }],
        financials: [],
        institutional: [],
        margin: [],
        shareholding: [],
        news: [],
      }

      const factPack = buildFactPack({
        stockId: '1717',
        dossierData: dossier,
      })

      expect(factPack.news_facts).toHaveLength(0)
      expect(factPack.unresolved.length).toBeGreaterThanOrEqual(1)
      const newsUnresolved = factPack.unresolved.find(u => u.id === 'news_empty_1717')
      expect(newsUnresolved).toBeTruthy()
    })

    it('給 raw news 有 5 筆但全部 score 後 newsFacts 仍非空 → 不 throw (Rule 0 通過)', () => {
      const dossier = {
        valuation: [],
        financials: [],
        institutional: [],
        margin: [],
        shareholding: [],
        news: [
          { title: '長興(1717)漲停', date: '2026-04-08', source: 'CMoney', link: 'a' },
          { title: '長興(1717)爆量', date: '2026-04-08', source: 'CMoney', link: 'b' },
          { title: '長興(1717)外資狂掃', date: '2026-04-08', source: 'CMoney', link: 'c' },
          { title: '長興(1717)油價題材', date: '2026-04-08', source: 'CMoney', link: 'd' },
          { title: '長興(1717)突破前高', date: '2026-04-08', source: 'CMoney', link: 'e' },
        ],
      }

      const factPack = buildFactPack({
        stockId: '1717',
        stockName: '長興',
        dossierData: dossier,
      })

      expect(factPack.news_facts.length).toBe(5)
    })
  })
})
