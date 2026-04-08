/**
 * Tests for severityMerge.js
 * Phase 2 critic merge unit tests
 */

import { describe, it, expect } from 'vitest'
import { mergeIntoCriticReport } from '../severityMerge.js'
import { Severity } from '../../factPack/evidenceLevels.js'

describe('severityMerge', () => {
  describe('mergeIntoCriticReport — verdict 計算', () => {
    it('shadow mode + critical → verdict pass (shadow 不擋)', () => {
      const report = mergeIntoCriticReport({
        ruleViolations: [
          { rule_id: 'r6', severity: Severity.CRITICAL, message: 'no news' },
        ],
        meta: { mode: 'shadow' },
      })
      expect(report.verdict).toBe('pass')
      expect(report.rule_violations).toHaveLength(1)
    })

    it('warn mode + critical → verdict warn', () => {
      const report = mergeIntoCriticReport({
        ruleViolations: [
          { rule_id: 'r6', severity: Severity.CRITICAL, message: 'no news' },
        ],
        meta: { mode: 'warn' },
      })
      expect(report.verdict).toBe('warn')
    })

    it('block mode + critical → verdict fail', () => {
      const report = mergeIntoCriticReport({
        ruleViolations: [
          { rule_id: 'r6', severity: Severity.CRITICAL, message: 'no news' },
        ],
        meta: { mode: 'block' },
      })
      expect(report.verdict).toBe('fail')
    })

    it('block mode + high → verdict warn (high 不擋)', () => {
      const report = mergeIntoCriticReport({
        ruleViolations: [
          { rule_id: 'r3', severity: Severity.HIGH, message: 'action vs base' },
        ],
        meta: { mode: 'block' },
      })
      expect(report.verdict).toBe('warn')
    })

    it('無 violations → verdict pass', () => {
      const report = mergeIntoCriticReport({
        ruleViolations: [],
        meta: { mode: 'block' },
      })
      expect(report.verdict).toBe('pass')
    })
  })

  describe('statistics', () => {
    it('正確統計 severity breakdown', () => {
      const report = mergeIntoCriticReport({
        ruleViolations: [
          { rule_id: 'r1', severity: Severity.CRITICAL, message: 'a' },
          { rule_id: 'r1', severity: Severity.CRITICAL, message: 'b' },
          { rule_id: 'r3', severity: Severity.HIGH, message: 'c' },
          { rule_id: 'r5', severity: Severity.MEDIUM, message: 'd' },
        ],
        meta: { mode: 'shadow' },
      })
      expect(report.statistics.severity_breakdown.critical).toBe(2)
      expect(report.statistics.severity_breakdown.high).toBe(1)
      expect(report.statistics.severity_breakdown.medium).toBe(1)
      expect(report.statistics.severity_breakdown.low).toBe(0)
    })
  })

  describe('recommendations', () => {
    it('rule_6 violation → 衍生 critical recommendation', () => {
      const report = mergeIntoCriticReport({
        ruleViolations: [
          {
            rule_id: 'rule_6_no_news_but_news_available',
            severity: Severity.CRITICAL,
            message: 'no news cited',
          },
        ],
        meta: { mode: 'shadow' },
      })
      expect(report.recommendations.length).toBeGreaterThanOrEqual(1)
      expect(report.recommendations[0].priority).toBe('critical')
      expect(report.recommendations[0].action).toContain('news')
    })

    it('rule_7 violation → 衍生 critical recommendation', () => {
      const report = mergeIntoCriticReport({
        ruleViolations: [
          {
            rule_id: 'rule_7_dominant_catalyst_mismatch',
            severity: Severity.CRITICAL,
            message: 'main thesis off',
          },
        ],
        meta: { mode: 'shadow' },
      })
      expect(
        report.recommendations.some(r => r.action.includes('main thesis')),
      ).toBe(true)
    })
  })
})
