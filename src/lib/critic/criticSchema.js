/**
 * Critic schema — criticReport 結構
 *
 * 來源: design doc v1 §1 (7 條規則) + Codex round 1 + Qwen round 1
 *
 * Critic 是 dual-lane:
 *   - rule lane (deterministic, fast)
 *   - LLM lane (semantic, expensive)
 *
 * 兩 lane 結果經 severityMerge 產出 criticReport
 */

import { Severity } from '../factPack/evidenceLevels.js'

// ─────────────────────────────────────────────────────────────
// 7 條 critic rule definitions
// ─────────────────────────────────────────────────────────────

export const CriticRule = Object.freeze({
  // Rule 1: 結論引用的數字不在 fact pack
  NUMBER_NOT_IN_FACTPACK: {
    id: 'rule_1_number_not_in_factpack',
    lane: 'rule',
    severity: Severity.CRITICAL,
    description: '結論引用的數字不在 fact pack 內',
  },

  // Rule 2: 同份輸出兩個矛盾數字
  CONTRADICTORY_NUMBERS: {
    id: 'rule_2_contradictory_numbers',
    lane: 'rule',
    severity: Severity.CRITICAL,
    description: '同份輸出有兩個明顯矛盾的數字 (例: 第三章 PE 47 + 第七章 PE 39)',
  },

  // Rule 3: 動作建議與 base case 衝突
  ACTION_VS_BASE_CASE_CONFLICT: {
    id: 'rule_3_action_vs_base_case',
    lane: 'rule',
    severity: Severity.HIGH,
    description: '動作建議的價位與 base case 估值衝突 (例: base 64 但喊目標 90)',
  },

  // Rule 4: 用過期事實但沒標 stale
  STALE_FACT_NOT_FLAGGED: {
    id: 'rule_4_stale_fact_not_flagged',
    lane: 'llm',
    severity: Severity.MEDIUM,
    description: '引用過期事實 (>30 天) 但沒標 stale 或重新驗證',
  },

  // Rule 5: 信心等級超過證據等級
  CONFIDENCE_EXCEEDS_EVIDENCE: {
    id: 'rule_5_confidence_exceeds_evidence',
    lane: 'llm',
    severity: Severity.MEDIUM,
    description: '信心等級超過證據等級允許範圍 (例: scenario 寫成 fact)',
  },

  // Rule 6: draft 引用 0 條 news + 該股 30 天有 ≥1 重大新聞
  // ← 1717 失敗的根本原因
  NO_NEWS_BUT_NEWS_AVAILABLE: {
    id: 'rule_6_no_news_but_news_available',
    lane: 'rule',
    severity: Severity.CRITICAL,
    description:
      'draft 引用 0 條 news source, 但該股近 30 天有 ≥1 條重大新聞 (Rule 0 違反)',
  },

  // Rule 7: 主催化歸因錯誤 (Codex round 1 加的最重要規則)
  // ← 1717 v3.1 把 unresolved CoWoS 當主因, 忽略油價題材是 dominant catalyst
  DOMINANT_CATALYST_MISMATCH: {
    id: 'rule_7_dominant_catalyst_mismatch',
    lane: 'both', // rule + LLM
    severity: Severity.CRITICAL,
    description:
      'draft 主結論 / 主要催化 / action 方向與近 30 天最高權重 news cluster / dominant sentiment 不一致, 且未明確解釋 why-not',
  },
})

export const CRITIC_RULES = Object.freeze(Object.values(CriticRule))

// ─────────────────────────────────────────────────────────────
// CriticReport schema
// ─────────────────────────────────────────────────────────────

/**
 * 每個 violation 的 shape
 */
export function makeViolation({
  ruleId,
  severity,
  lane,
  message,
  location,
  evidence,
  suggested_fix,
}) {
  return {
    rule_id: ruleId,
    severity,
    lane,
    message,
    location: location || null,
    evidence: evidence || null,
    suggested_fix: suggested_fix || null,
    detected_at: new Date().toISOString(),
  }
}

/**
 * 空的 criticReport
 */
export function emptyCriticReport(meta = {}) {
  return {
    schema_version: '0.1',
    meta: {
      target_id: meta.target_id || null,
      target_type: meta.target_type || 'draft', // draft | factPack | thesis
      run_id: meta.run_id || `critic_${Date.now()}`,
      mode: meta.mode || 'shadow', // shadow | warn | block
      ran_at: new Date().toISOString(),
    },
    verdict: 'pass', // pass | warn | fail
    rule_violations: [],
    semantic_findings: [],
    stale_segments: [],
    evidence_violations: [],
    recommendations: [],
    statistics: {
      total_rules_checked: 0,
      total_rules_passed: 0,
      total_rules_failed: 0,
      severity_breakdown: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    },
  }
}

/**
 * 驗證 criticReport shape
 */
export function validateCriticReport(report) {
  const errors = []
  if (!report || typeof report !== 'object') {
    return [{ code: 'NOT_OBJECT', message: 'criticReport 必須是物件' }]
  }
  if (!report.verdict) {
    errors.push({ code: 'MISSING_VERDICT', message: 'verdict 必填' })
  }
  if (!['pass', 'warn', 'fail'].includes(report.verdict)) {
    errors.push({
      code: 'INVALID_VERDICT',
      message: `verdict 必須是 pass/warn/fail, got ${report.verdict}`,
    })
  }
  if (!Array.isArray(report.rule_violations)) {
    errors.push({ code: 'MISSING_VIOLATIONS', message: 'rule_violations 必須是陣列' })
  }
  return errors
}
