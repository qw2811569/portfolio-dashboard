import { describe, it, expect } from 'vitest'
import {
  normalizeBrainRuleStaleness,
  brainRuleStalenessLabel,
  brainRuleStalenessRank,
  brainRuleText,
  brainRuleKey,
} from '../../src/lib/brain.js'

describe('lib/brain.js', () => {
  describe('brainRuleText', () => {
    it('應該返回字串規則', () => {
      expect(brainRuleText('這是規則')).toBe('這是規則')
    })

    it('應該從物件提取 text', () => {
      expect(brainRuleText({ text: '規則文字' })).toBe('規則文字')
    })

    it('應該從物件提取 rule', () => {
      expect(brainRuleText({ rule: '規則內容' })).toBe('規則內容')
    })

    it('應該返回空字串如果無效輸入', () => {
      expect(brainRuleText(null)).toBe('')
      expect(brainRuleText({})).toBe('')
    })
  })

  describe('brainRuleKey', () => {
    it('應該返回 id 如果存在', () => {
      expect(brainRuleKey({ id: 'rule-1', text: '規則' })).toBe('rule-1')
    })

    it('應該返回 text 如果沒有 id', () => {
      expect(brainRuleKey({ text: '規則文字' })).toBe('規則文字')
    })

    it('應該返回空字串如果無效輸入', () => {
      expect(brainRuleKey(null)).toBe('')
      expect(brainRuleKey({})).toBe('')
    })
  })

  describe('normalizeBrainRuleStaleness', () => {
    it('應該返回有效狀態', () => {
      expect(normalizeBrainRuleStaleness('fresh')).toBe('fresh')
      expect(normalizeBrainRuleStaleness('aging')).toBe('aging')
      expect(normalizeBrainRuleStaleness('stale')).toBe('stale')
      expect(normalizeBrainRuleStaleness('missing')).toBe('missing')
    })

    it('應該忽略大小寫', () => {
      expect(normalizeBrainRuleStaleness('FRESH')).toBe('fresh')
      expect(normalizeBrainRuleStaleness('Aging')).toBe('aging')
    })

    it('應該返回空字串如果無效輸入', () => {
      expect(normalizeBrainRuleStaleness('invalid')).toBe('')
      expect(normalizeBrainRuleStaleness(null)).toBe('')
    })
  })

  describe('brainRuleStalenessLabel', () => {
    it('應該返回正確的中文標籤', () => {
      expect(brainRuleStalenessLabel('fresh')).toBe('新鮮')
      expect(brainRuleStalenessLabel('aging')).toBe('待更新')
      expect(brainRuleStalenessLabel('stale')).toBe('陳舊')
      expect(brainRuleStalenessLabel('missing')).toBe('未驗證')
    })
  })

  describe('brainRuleStalenessRank', () => {
    it('應該返回正確的排名', () => {
      expect(brainRuleStalenessRank('fresh')).toBe(3)
      expect(brainRuleStalenessRank('aging')).toBe(2)
      expect(brainRuleStalenessRank('stale')).toBe(1)
      expect(brainRuleStalenessRank('missing')).toBe(0)
    })
  })
})
