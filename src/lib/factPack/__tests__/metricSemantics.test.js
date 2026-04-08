/**
 * Tests for metricSemantics.js
 * Phase 1 unit test — design doc v1 §3 (Codex 盲點 2)
 *
 * 1717 教訓: id 不能只寫 "eps", 必須帶 dimensions 防 稅前/稅後混用
 */

import { describe, it, expect } from 'vitest'
import {
  TaxTreatment,
  Period,
  Scope,
  parseMetricId,
  buildMetricId,
  isSameMetricDifferentDimension,
  KNOWN_METRICS,
  isKnownMetric,
  validateMetricSemantics,
} from '../metricSemantics.js'

describe('metricSemantics', () => {
  describe('parseMetricId', () => {
    it('解析完整 4-段 id', () => {
      const parsed = parseMetricId('eps:tax_post:quarterly:consolidated')
      expect(parsed).toEqual({
        metric: 'eps',
        tax: 'tax_post',
        period: 'quarterly',
        scope: 'consolidated',
        raw: 'eps:tax_post:quarterly:consolidated',
      })
    })

    it('解析只有 metric 的 loose id', () => {
      const parsed = parseMetricId('eps')
      expect(parsed.metric).toBe('eps')
      expect(parsed.tax).toBe(null)
      expect(parsed.period).toBe(null)
      expect(parsed.scope).toBe(null)
    })

    it('空字串應 throw', () => {
      expect(() => parseMetricId('')).toThrow()
    })

    it('non-string 應 throw', () => {
      expect(() => parseMetricId(null)).toThrow()
      expect(() => parseMetricId(undefined)).toThrow()
      expect(() => parseMetricId(123)).toThrow()
    })
  })

  describe('buildMetricId', () => {
    it('組完整 4 段', () => {
      const id = buildMetricId({
        metric: 'eps',
        tax: 'tax_post',
        period: 'quarterly',
        scope: 'consolidated',
      })
      expect(id).toBe('eps:tax_post:quarterly:consolidated')
    })

    it('metric 缺則 throw', () => {
      expect(() => buildMetricId({ tax: 'tax_post' })).toThrow()
    })

    it('只給 metric 也可', () => {
      expect(buildMetricId({ metric: 'eps' })).toBe('eps')
    })
  })

  describe('isSameMetricDifferentDimension (1717 EPS 混用偵測)', () => {
    it('同 metric 不同 tax → true', () => {
      expect(
        isSameMetricDifferentDimension(
          'eps:tax_post:annual:consolidated',
          'eps:tax_pre:annual:consolidated',
        ),
      ).toBe(true)
    })

    it('同 metric 不同 period → true', () => {
      expect(
        isSameMetricDifferentDimension(
          'eps:tax_post:quarterly:consolidated',
          'eps:tax_post:annual:consolidated',
        ),
      ).toBe(true)
    })

    it('完全相同 → false', () => {
      expect(
        isSameMetricDifferentDimension(
          'eps:tax_post:quarterly:consolidated',
          'eps:tax_post:quarterly:consolidated',
        ),
      ).toBe(false)
    })

    it('不同 metric → false (因為 metric 已經不同, 不算「同 metric 不同 dim」)', () => {
      expect(
        isSameMetricDifferentDimension(
          'eps:tax_post:annual:consolidated',
          'pe:trailing',
        ),
      ).toBe(false)
    })
  })

  describe('KNOWN_METRICS', () => {
    it('包含 1717 case 用到的全部', () => {
      expect(KNOWN_METRICS.EPS_POST_QUARTERLY).toBeDefined()
      expect(KNOWN_METRICS.EPS_POST_ANNUAL).toBeDefined()
      expect(KNOWN_METRICS.EPS_PRE_ANNUAL).toBeDefined()
      expect(KNOWN_METRICS.PE_TRAILING).toBeDefined()
      expect(KNOWN_METRICS.NONOP_QUARTERLY).toBeDefined()
    })

    it('isKnownMetric 對 KNOWN 內的 metric 回 true', () => {
      expect(isKnownMetric('eps:tax_post:annual:consolidated')).toBe(true)
      expect(isKnownMetric('pe:trailing')).toBe(true)
    })

    it('isKnownMetric 對未知 metric 回 false', () => {
      expect(isKnownMetric('eps')).toBe(false) // loose id 不算
      expect(isKnownMetric('random:thing')).toBe(false)
    })
  })

  describe('validateMetricSemantics (1717 防呆核心)', () => {
    it('全部 facts 都用標準 id → 0 警告', () => {
      const facts = [
        { id: 'eps:tax_post:annual:consolidated' },
        { id: 'pe:trailing' },
        { id: 'revenue:monthly:consolidated' },
      ]
      expect(validateMetricSemantics(facts)).toHaveLength(0)
    })

    it('有 loose id (eps 沒帶 dim) → 警告', () => {
      const facts = [
        { id: 'eps' }, // loose
        { id: 'eps:tax_post:quarterly:consolidated' },
      ]
      const warnings = validateMetricSemantics(facts)
      expect(warnings).toHaveLength(1)
      expect(warnings[0].type).toBe('loose_metric_id')
      expect(warnings[0].fact_id).toBe('eps')
    })

    it('1717 真實 case: 把稅前 2.03 跟稅後 1.41 都寫成 "eps" → 兩條警告', () => {
      // 這就是我之前 v1 犯的錯
      const facts = [
        { id: 'eps', value: 2.03 }, // 稅前但沒標
        { id: 'eps', value: 1.41 }, // 稅後但沒標
      ]
      const warnings = validateMetricSemantics(facts)
      expect(warnings.length).toBeGreaterThanOrEqual(2)
      // 兩條都應該被抓
      const looseIds = warnings.filter(w => w.type === 'loose_metric_id')
      expect(looseIds.length).toBeGreaterThanOrEqual(2)
    })

    it('Enums 都 frozen', () => {
      expect(Object.isFrozen(TaxTreatment)).toBe(true)
      expect(Object.isFrozen(Period)).toBe(true)
      expect(Object.isFrozen(Scope)).toBe(true)
    })
  })
})
