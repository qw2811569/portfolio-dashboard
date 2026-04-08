/**
 * Tests for newsScorer.js
 * Phase 1 unit test — design doc v1 §2 (Codex 6 維度計分)
 *
 * 1717 真實 case 驗證:
 *   - 3/23 「2 月稅前虧損」→ 應 is_material=true
 *   - 4/8 「漲停 + 油價題材」→ 應 is_material=true
 *   - 3/26 「WMCM 訂單」→ 應 is_material=true
 *   - 3/13 「EPS 1.41 公告」→ 應 is_material=true
 */

import { describe, it, expect } from 'vitest'
import {
  scoreAuthority,
  scoreEventType,
  scoreDirectness,
  scoreMateriality,
  scoreMarketReaction,
  scoreCrossSource,
  scoreNews,
  filterTopNewsForHighVolume,
} from '../newsScorer.js'

describe('newsScorer', () => {
  describe('scoreAuthority (來源權威 0-3)', () => {
    it('MOPS / TWSE → 3', () => {
      expect(scoreAuthority('mops')).toBe(3)
      expect(scoreAuthority('公開資訊觀測站')).toBe(3)
      expect(scoreAuthority('TWSE')).toBe(3)
    })

    it('經濟日報 / 鉅亨 → 2', () => {
      expect(scoreAuthority('經濟日報')).toBe(2)
      expect(scoreAuthority('cnyes')).toBe(2)
      expect(scoreAuthority('聯合新聞網')).toBe(2)
    })

    it('CMoney / Yahoo → 1', () => {
      expect(scoreAuthority('CMoney')).toBe(1)
      expect(scoreAuthority('Yahoo股市')).toBe(1)
    })

    it('論壇 / 留言區 → 0', () => {
      expect(scoreAuthority('股市爆料同學會')).toBe(0)
      expect(scoreAuthority('PTT')).toBe(0)
    })
  })

  describe('scoreEventType (事件類型 0-3)', () => {
    it('虧損公告 → 3', () => {
      expect(scoreEventType('長興 2 月稅前虧損 0.71 億元')).toBe(3)
    })

    it('重大訂單 → 3', () => {
      expect(scoreEventType('取得 WMCM 液態封裝料訂單')).toBe(3)
    })

    it('關稅新聞 → 3', () => {
      expect(scoreEventType('川普攻擊台股, 加徵關稅')).toBe(3)
    })

    it('月營收 → 2', () => {
      expect(scoreEventType('長興 3 月營收公布')).toBe(2)
    })

    it('油價題材 → 2', () => {
      expect(scoreEventType('受惠油價推升特化題材發酵')).toBe(2)
    })

    it('Q&A → 1', () => {
      expect(scoreEventType('長興總經理專訪')).toBe(1)
    })

    it('純評論 → 0', () => {
      expect(scoreEventType('今天天氣不錯')).toBe(0)
    })
  })

  describe('scoreDirectness (公司直接性 0-2)', () => {
    it('標題有公司 id → 2', () => {
      expect(scoreDirectness('長興(1717)漲停', '', '1717', '長興')).toBe(2)
    })

    it('標題有公司名 → 2', () => {
      expect(scoreDirectness('長興攻上漲停', '', '1717', '長興')).toBe(2)
    })

    it('內文有公司, 標題沒有 → 1', () => {
      expect(scoreDirectness('PCB 族群表現佳', '長興表現亮眼', '1717', '長興')).toBe(1)
    })

    it('產業 evt → 0', () => {
      expect(scoreDirectness('PCB 景氣回升', '', '1717', '長興')).toBe(0)
    })
  })

  describe('scoreMateriality (金額/法規 0-2)', () => {
    it('涉及金額 + 法規 → 2', () => {
      expect(scoreMateriality('長興遭裁罰 2 億元', '')).toBe(2)
    })

    it('只有金額 → 1', () => {
      expect(scoreMateriality('長興 2 月稅前虧損 0.71 億元', '')).toBe(1)
    })

    it('只有法規關鍵字, 沒金額 → 1', () => {
      // 注意: 「關稅」會同時匹配 MATERIALITY_REGEX 跟 hasRegulatory
      // 用「裁罰」這種純法規詞測
      expect(scoreMateriality('證交所通報, 處分長興', '')).toBe(1)
    })

    it('關稅 + 金額 → 2 (兩條都中)', () => {
      // 1717 4/7 川普案例: 關稅 + 隱含金額影響 → 2
      expect(scoreMateriality('川普加徵關稅 25%', '')).toBe(2)
    })

    it('沒金額沒法規 → 0', () => {
      expect(scoreMateriality('長興表現亮眼', '')).toBe(0)
    })
  })

  describe('scoreMarketReaction (隔日漲跌 0-2)', () => {
    it('±5% 以上 → 2', () => {
      expect(scoreMarketReaction(10)).toBe(2)
      expect(scoreMarketReaction(-7.05)).toBe(2) // 1717 3/23 暴跌
    })

    it('±2-5% → 1', () => {
      expect(scoreMarketReaction(3)).toBe(1)
      expect(scoreMarketReaction(-2.5)).toBe(1)
    })

    it('±2% 內 → 0', () => {
      expect(scoreMarketReaction(1.5)).toBe(0)
      expect(scoreMarketReaction(-0.5)).toBe(0)
    })

    it('null / undefined → 0', () => {
      expect(scoreMarketReaction(null)).toBe(0)
      expect(scoreMarketReaction(undefined)).toBe(0)
    })
  })

  describe('scoreCrossSource (跨源 0-1)', () => {
    it('2+ 家媒體 → 1', () => {
      expect(scoreCrossSource(2)).toBe(1)
      expect(scoreCrossSource(5)).toBe(1)
    })

    it('單一來源 → 0', () => {
      expect(scoreCrossSource(1)).toBe(0)
    })
  })

  describe('scoreNews (整合 + is_material)', () => {
    it('1717 真實 case: 3/23 聯合新聞網 2 月虧損 → is_material=true', () => {
      const score = scoreNews({
        source_name: '聯合新聞網',
        headline: '長興自結 2 月稅前虧損 0.71 億元 精密設備、先進封裝材料貢獻 成長可期',
        content: '',
        stockId: '1717',
        stockName: '長興',
        nextDayChangePct: -7.05, // 隔日 (3/24) 反而漲停, 但前一天 3/23 跌
        sameEventSourceCount: 2,
      })
      expect(score.is_material).toBe(true)
      expect(score.authority_score).toBe(2) // 聯合新聞網
      expect(score.event_type_score).toBe(3) // 虧損
      expect(score.directness_score).toBe(2) // 標題有「長興」
      expect(score.materiality_score).toBeGreaterThanOrEqual(1) // 0.71 億
      expect(score.market_reaction_score).toBe(2) // -7.05% 在 |3/23| 那天
      expect(score.total_score).toBeGreaterThanOrEqual(7)
    })

    it('1717 真實 case: 3/26 WMCM 訂單 → is_material=true', () => {
      const score = scoreNews({
        source_name: 'CMoney',
        headline: '長興(1717)取得 WMCM 液態封裝料訂單, 今年隨產能放量受惠',
        content: '',
        stockId: '1717',
        stockName: '長興',
        nextDayChangePct: 3,
        sameEventSourceCount: 1,
      })
      expect(score.event_type_score).toBe(3) // 訂單
      expect(score.directness_score).toBe(2) // 標題有「長興(1717)」
      expect(score.is_material).toBe(true) // 應該是 material
    })

    it('1717 真實 case: 3/13 EPS 1.41 公告 → is_material=true', () => {
      const score = scoreNews({
        source_name: 'cnyes', // news.cnyes.com 鉅亨網
        headline: '長興去年 EPS1.41 元擬配息 1 元 精密設備訂單能見度達今年底',
        content: '',
        stockId: '1717',
        stockName: '長興',
        nextDayChangePct: 0,
        sameEventSourceCount: 2,
      })
      expect(score.authority_score).toBe(2) // cnyes
      // 標題有「訂單」「財報」 → event_type 高
      expect(score.event_type_score).toBeGreaterThanOrEqual(2)
      expect(score.is_material).toBe(true)
    })

    it('論壇情緒貼文 → is_material=false', () => {
      const score = scoreNews({
        source_name: '股市爆料同學會',
        headline: '能平盤就偷笑了！等拉低平攤',
        content: '',
        stockId: '1717',
        stockName: '長興',
        nextDayChangePct: 0,
        sameEventSourceCount: 1,
      })
      expect(score.is_material).toBe(false)
      expect(score.total_score).toBeLessThan(7)
    })
  })

  describe('filterTopNewsForHighVolume (高量股篩選)', () => {
    it('過濾後保留 top 3 company-specific + 1 sector + 1 macro', () => {
      const news = [
        // 5 條 company-specific (directness=2)
        { id: 'a', directness_score: 2, total_score: 10, event_type_score: 3 },
        { id: 'b', directness_score: 2, total_score: 9, event_type_score: 3 },
        { id: 'c', directness_score: 2, total_score: 8, event_type_score: 2 },
        { id: 'd', directness_score: 2, total_score: 7, event_type_score: 2 },
        { id: 'e', directness_score: 2, total_score: 6, event_type_score: 1 },
        // 2 條 sector catalyst (directness=0, event_type>=2)
        { id: 'f', directness_score: 0, total_score: 5, event_type_score: 2 },
        { id: 'g', directness_score: 0, total_score: 4, event_type_score: 2 },
        // 2 條 macro (directness=0, event_type<2)
        { id: 'h', directness_score: 0, total_score: 3, event_type_score: 1 },
        { id: 'i', directness_score: 0, total_score: 2, event_type_score: 0 },
      ]
      const filtered = filterTopNewsForHighVolume(news)
      // top 3 company + 1 sector + 1 macro = 5
      expect(filtered).toHaveLength(5)
      // top 3 company by total_score
      expect(filtered.slice(0, 3).map(n => n.id)).toEqual(['a', 'b', 'c'])
    })
  })
})
