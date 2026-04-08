/**
 * Tests for ruleLane.js
 * Phase 2 critic rule lane unit tests
 *
 * 1717 case 重現驗證:
 *   - Rule 6: draft 沒引用 news 但 factPack 有 material news → fail
 *   - Rule 7: draft 主結論與 dominant cluster 不一致 → fail
 *   - Rule 1: draft 引用 PE 39 但 factPack 是 47.59 → fail
 *   - Rule 2: 同份輸出 PE 39 與 PE 47.59 → fail
 *   - Rule 3: base case 64 但喊目標 90 → fail
 */

import { describe, it, expect } from 'vitest'
import {
  checkRule1_NumberNotInFactPack,
  checkRule2_ContradictoryNumbers,
  checkRule3_ActionVsBaseCase,
  checkRule6_NoNewsButNewsAvailable,
  checkRule7_DominantCatalystMismatch,
  runRuleLane,
} from '../ruleLane.js'
import { CriticRule } from '../criticSchema.js'

describe('ruleLane', () => {
  describe('Rule 1: 結論引用的數字不在 fact pack', () => {
    it('draft 引用 PE 39 但 factPack 是 47.59 → 1 violation', () => {
      const draft = 'PE 39 倍, 估值便宜'
      const factPack = {
        valuation_facts: [{ id: 'pe', value: 47.59 }],
        earnings_facts: [],
        chip_facts: [],
        news_facts: [],
      }
      const violations = checkRule1_NumberNotInFactPack(draft, factPack)
      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].rule_id).toBe(CriticRule.NUMBER_NOT_IN_FACTPACK.id)
    })

    it('draft 引用 PE 47.59 且 factPack 有 47.59 → 0 violation', () => {
      const draft = 'PE 47.59 倍, 估值已偏貴'
      const factPack = {
        valuation_facts: [{ id: 'pe', value: 47.59 }],
        earnings_facts: [],
        chip_facts: [],
        news_facts: [],
      }
      const violations = checkRule1_NumberNotInFactPack(draft, factPack)
      // 47.59 應該被找到
      const peIssues = violations.filter(v => v.message.includes('47.59'))
      expect(peIssues.length).toBe(0)
    })
  })

  describe('Rule 2: 同份輸出兩個矛盾數字', () => {
    it('1717 v1 vs v2 case: PE 39 + PE 47.59 同時出現 → 1 violation', () => {
      const draft = '第三章 PE 47.59 倍, 但第七章還寫 PE 39 倍'
      const violations = checkRule2_ContradictoryNumbers(draft)
      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].rule_id).toBe(CriticRule.CONTRADICTORY_NUMBERS.id)
    })

    it('只有一個 PE 數字 → 0 violation', () => {
      const draft = 'PE 47.59 倍'
      const violations = checkRule2_ContradictoryNumbers(draft)
      expect(violations).toHaveLength(0)
    })
  })

  describe('Rule 3: 動作建議與 base case 衝突', () => {
    it('1717 v1 case: base case 64 但喊目標 90 (40% 高於) → 1 violation', () => {
      const draft = '目標: 90 元'
      const violations = checkRule3_ActionVsBaseCase(draft, 64)
      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].rule_id).toBe(CriticRule.ACTION_VS_BASE_CASE_CONFLICT.id)
    })

    it('base case 70 + 目標 78 (僅 11% 高於) → 0 violation', () => {
      const draft = '目標: 78 元'
      const violations = checkRule3_ActionVsBaseCase(draft, 70)
      expect(violations).toHaveLength(0)
    })

    it('沒給 baseCase → 0 violation', () => {
      const draft = '目標: 100 元'
      const violations = checkRule3_ActionVsBaseCase(draft, null)
      expect(violations).toHaveLength(0)
    })
  })

  describe('Rule 6: 沒引用新聞 + 該股有重大新聞 (Rule 0 違反)', () => {
    it('1717 v3.1 case: draft 0 引用 + factPack 有 4 條 material news → 1 violation', () => {
      const draft = '估值面: PE 47.59. 籌碼面: 外資 -906 萬. 結論: 中性續抱.'
      const factPack = {
        news_facts: [
          { id: 'n1', headline: '長興 2 月稅前虧損 0.71 億', is_material: true, total_score: 10 },
          { id: 'n2', headline: '長興攻上漲停 67.1 元', is_material: true, total_score: 9 },
          { id: 'n3', headline: '長興取得 WMCM 訂單', is_material: true, total_score: 8 },
        ],
      }
      const violations = checkRule6_NoNewsButNewsAvailable(draft, factPack)
      expect(violations).toHaveLength(1)
      expect(violations[0].rule_id).toBe(CriticRule.NO_NEWS_BUT_NEWS_AVAILABLE.id)
      expect(violations[0].severity).toBe('critical')
    })

    it('draft 引用了 1 條 news → 0 violation', () => {
      const draft = '4/8 油價漲, 長興攻上漲停 67.1 元 (CMoney). 結論: 續抱.'
      const factPack = {
        news_facts: [
          { id: 'n1', headline: '長興攻上漲停 67.1 元, 受惠油價', is_material: true },
        ],
      }
      const violations = checkRule6_NoNewsButNewsAvailable(draft, factPack)
      expect(violations).toHaveLength(0)
    })

    it('factPack 無 material news → 0 violation', () => {
      const draft = '中性續抱.'
      const factPack = { news_facts: [{ id: 'n1', headline: 'noise', is_material: false }] }
      const violations = checkRule6_NoNewsButNewsAvailable(draft, factPack)
      expect(violations).toHaveLength(0)
    })
  })

  describe('Rule 7: dominant catalyst mismatch (Codex round 1 加的最重要規則)', () => {
    it('1717 v3.1 case: draft 主因寫 CoWoS (unresolved), 但 dominant cluster 是油價題材 → 1 violation', () => {
      const draft = '主結論: 1717 是審慎樂觀續抱, CoWoS 訂單方向被確認、量化未確認'
      const factPack = { news_facts: [] }
      const dominantCluster = {
        headline: '長興攻上漲停 67.1 元 受惠油價推升特化題材發酵',
        total_score: 12,
      }
      const violations = checkRule7_DominantCatalystMismatch(draft, factPack, dominantCluster)
      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].rule_id).toBe(CriticRule.DOMINANT_CATALYST_MISMATCH.id)
      expect(violations[0].severity).toBe('critical')
    })

    it('draft 有提到 dominant cluster 關鍵詞 → 0 violation', () => {
      const draft = '4/8 漲停受惠油價推升特化題材發酵, 但要小心題材冷卻風險'
      const factPack = { news_facts: [] }
      const dominantCluster = {
        headline: '長興攻上漲停 67.1 元 受惠油價推升特化題材發酵',
        total_score: 12,
      }
      const violations = checkRule7_DominantCatalystMismatch(draft, factPack, dominantCluster)
      expect(violations).toHaveLength(0)
    })

    it('沒給 dominantCluster → 0 violation', () => {
      const draft = 'anything'
      const violations = checkRule7_DominantCatalystMismatch(draft, {}, null)
      expect(violations).toHaveLength(0)
    })
  })

  describe('runRuleLane (整合)', () => {
    it('1717 v3.1 完整重現 → 應抓出 Rule 6 + Rule 7 兩條', () => {
      const draft = `
PE 47.59 倍是 3 年最高
estimation: 中性續抱
策略: 審慎樂觀, CoWoS 訂單方向被確認、量化未確認
目標: 80 元
      `
      const factPack = {
        valuation_facts: [{ id: 'pe', value: 47.59 }],
        earnings_facts: [],
        chip_facts: [],
        news_facts: [
          { id: 'n1', headline: '長興 2 月稅前虧損 0.71 億', is_material: true, total_score: 10 },
          { id: 'n2', headline: '長興攻上漲停 67.1 元 受惠油價', is_material: true, total_score: 9 },
        ],
      }
      const violations = runRuleLane({
        draft,
        factPack,
        baseCase: 64,
        dominantNewsCluster: {
          headline: '長興攻上漲停 67.1 元 受惠油價推升特化題材發酵',
          total_score: 12,
        },
      })

      // 應抓: rule_3 (target 80 vs base 64 → 25% 高, 不到 30% threshold → 不一定 fail)
      //        rule_6 (沒引用 news)
      //        rule_7 (沒提 dominant cluster 關鍵詞)
      const ruleIds = new Set(violations.map(v => v.rule_id))
      expect(ruleIds.has(CriticRule.NO_NEWS_BUT_NEWS_AVAILABLE.id)).toBe(true)
      expect(ruleIds.has(CriticRule.DOMINANT_CATALYST_MISMATCH.id)).toBe(true)
    })
  })
})
