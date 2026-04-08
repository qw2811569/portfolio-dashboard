/**
 * Tests for criticRuntime.js
 * Phase 2 critic main interface unit tests
 *
 * 1717 完整 e2e: 餵 v3.1 草稿 + v3.2 factPack → 應該抓到 Rule 6 + Rule 7
 */

import { describe, it, expect } from 'vitest'
import { runCritic, shouldBlock, summarizeCriticReport } from '../criticRuntime.js'

describe('criticRuntime', () => {
  describe('runCritic', () => {
    it('1717 v3.1 e2e: 餵 draft + factPack → 抓到 Rule 6 (沒引用 news)', async () => {
      const draft = `
1717 投資論點: 中性續抱、審慎樂觀
PE 47.59 倍是 3 年最高
籌碼: 外資 -906 萬, 鋸齒型
結論: Hold, 等 Q1 EPS
      `
      const factPack = {
        meta: { code: '1717' },
        valuation_facts: [{ id: 'pe', value: 47.59 }],
        earnings_facts: [{ id: 'eps', value: 1.41 }],
        chip_facts: [],
        news_facts: [
          {
            id: 'n1',
            headline: '長興 2 月稅前虧損 0.71 億元',
            is_material: true,
            total_score: 10,
          },
          {
            id: 'n2',
            headline: '長興攻上漲停 67.1 元 受惠油價推升特化題材發酵',
            is_material: true,
            total_score: 12,
          },
          {
            id: 'n3',
            headline: '長興取得 WMCM 液態封裝料訂單',
            is_material: true,
            total_score: 9,
          },
        ],
      }

      const report = await runCritic({
        draft,
        factPack,
        baseCase: 64,
        mode: 'shadow',
      })

      expect(report.verdict).toBe('pass') // shadow mode
      const ruleIds = new Set(report.rule_violations.map(v => v.rule_id))
      expect(ruleIds.has('rule_6_no_news_but_news_available')).toBe(true)
    })

    it('shadow mode 即使有 critical 也回 pass', async () => {
      const draft = '完全沒提到新聞'
      const factPack = {
        meta: { code: '1717' },
        valuation_facts: [],
        earnings_facts: [],
        chip_facts: [],
        news_facts: [
          { id: 'n1', headline: '虧損消息', is_material: true, total_score: 9 },
        ],
      }
      const report = await runCritic({ draft, factPack, mode: 'shadow' })
      expect(report.verdict).toBe('pass')
      expect(report.rule_violations.length).toBeGreaterThan(0)
    })

    it('block mode + critical → verdict fail', async () => {
      const draft = '完全沒提到新聞'
      const factPack = {
        meta: { code: '1717' },
        valuation_facts: [],
        earnings_facts: [],
        chip_facts: [],
        news_facts: [
          { id: 'n1', headline: '虧損消息', is_material: true, total_score: 9 },
        ],
      }
      const report = await runCritic({ draft, factPack, mode: 'block' })
      expect(report.verdict).toBe('fail')
    })

    it('沒給 draft → throw', async () => {
      await expect(runCritic({})).rejects.toThrow()
    })

    it('沒給 factPack → throw', async () => {
      await expect(runCritic({ draft: 'x' })).rejects.toThrow()
    })
  })

  describe('shouldBlock', () => {
    it('verdict fail → true', () => {
      expect(shouldBlock({ verdict: 'fail' })).toBe(true)
    })
    it('verdict warn → false', () => {
      expect(shouldBlock({ verdict: 'warn' })).toBe(false)
    })
    it('verdict pass → false', () => {
      expect(shouldBlock({ verdict: 'pass' })).toBe(false)
    })
    it('null → false', () => {
      expect(shouldBlock(null)).toBe(false)
    })
  })

  describe('summarizeCriticReport', () => {
    it('輸出含 verdict + severity 統計', () => {
      const report = {
        verdict: 'warn',
        meta: { mode: 'warn' },
        statistics: {
          severity_breakdown: { critical: 1, high: 2, medium: 0, low: 0 },
        },
      }
      const summary = summarizeCriticReport(report)
      expect(summary).toContain('warn')
      expect(summary).toContain('critical=1')
      expect(summary).toContain('high=2')
    })
  })
})
