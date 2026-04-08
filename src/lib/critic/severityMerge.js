/**
 * Severity merge — 合併 rule lane + LLM lane 結果產生 verdict
 *
 * 來源: design doc v1 §1 + Codex round 1 (dual-lane)
 *
 * 規則:
 *   - 任何 critical violation → fail
 *   - 任何 high violation → warn
 *   - 任何 medium 在 shadow mode → 只記錄
 *   - low violation 永遠只記錄
 *
 * Rollout policy (Codex 盲點 4):
 *   - shadow mode (week 1): 只記錄, 不擋, verdict 一律 'pass' 但有 violations
 *   - warn mode (week 3): critical/high 顯示警告, 不擋
 *   - block mode (month 2): critical 直接 fail
 */

import { Severity } from '../factPack/evidenceLevels.js'

const SEVERITY_RANK = {
  [Severity.CRITICAL]: 4,
  [Severity.HIGH]: 3,
  [Severity.MEDIUM]: 2,
  [Severity.LOW]: 1,
}

/**
 * 計算最高 severity
 */
function maxSeverity(violations) {
  if (!Array.isArray(violations) || violations.length === 0) return null
  let max = null
  let maxRank = 0
  for (const v of violations) {
    const rank = SEVERITY_RANK[v.severity] ?? 0
    if (rank > maxRank) {
      maxRank = rank
      max = v.severity
    }
  }
  return max
}

/**
 * 計算 severity 統計
 */
function countBySeverity(violations) {
  const counts = {
    [Severity.CRITICAL]: 0,
    [Severity.HIGH]: 0,
    [Severity.MEDIUM]: 0,
    [Severity.LOW]: 0,
  }
  for (const v of violations || []) {
    if (counts[v.severity] != null) {
      counts[v.severity]++
    }
  }
  return counts
}

/**
 * 給定 mode, 決定 verdict
 */
function decideVerdict(violations, mode) {
  const maxSev = maxSeverity(violations)
  if (!maxSev) return 'pass'

  switch (mode) {
    case 'shadow':
      // shadow mode: 一律 pass, 但 violations 仍記錄
      return 'pass'

    case 'warn':
      // warn mode: critical / high 顯示警告
      if (maxSev === Severity.CRITICAL || maxSev === Severity.HIGH) return 'warn'
      return 'pass'

    case 'block':
      // block mode: critical 直接 fail, high 警告
      if (maxSev === Severity.CRITICAL) return 'fail'
      if (maxSev === Severity.HIGH) return 'warn'
      return 'pass'

    default:
      // 預設保守: shadow
      return 'pass'
  }
}

/**
 * 主介面: 合併 rule + LLM violations 成 criticReport
 */
export function mergeIntoCriticReport({
  ruleViolations = [],
  llmViolations = [],
  semanticFindings = [],
  staleSegments = [],
  evidenceViolations = [],
  meta = {},
}) {
  const allViolations = [...ruleViolations, ...llmViolations]
  const counts = countBySeverity(allViolations)
  const verdict = decideVerdict(allViolations, meta.mode || 'shadow')

  return {
    schema_version: '0.1',
    meta: {
      target_id: meta.target_id || null,
      target_type: meta.target_type || 'draft',
      run_id: meta.run_id || `critic_${Date.now()}`,
      mode: meta.mode || 'shadow',
      ran_at: new Date().toISOString(),
    },
    verdict,
    rule_violations: allViolations,
    semantic_findings: semanticFindings,
    stale_segments: staleSegments,
    evidence_violations: evidenceViolations,
    recommendations: deriveRecommendations(allViolations),
    statistics: {
      total_rules_checked: 7,
      total_rules_passed: 7 - new Set(allViolations.map(v => v.rule_id)).size,
      total_rules_failed: new Set(allViolations.map(v => v.rule_id)).size,
      severity_breakdown: counts,
    },
  }
}

/**
 * 從 violations 衍生 recommendations
 */
function deriveRecommendations(violations) {
  const recs = []
  const ruleIds = new Set(violations.map(v => v.rule_id))

  if (ruleIds.has('rule_6_no_news_but_news_available')) {
    recs.push({
      priority: 'critical',
      action: '回去抓 news 並引用至少 1 條 material news',
    })
  }
  if (ruleIds.has('rule_7_dominant_catalyst_mismatch')) {
    recs.push({
      priority: 'critical',
      action: '修正 main thesis, 對齊 dominant news cluster, 或明確解釋 why-not',
    })
  }
  if (ruleIds.has('rule_1_number_not_in_factpack')) {
    recs.push({
      priority: 'high',
      action: '把 draft 引用的數字加進 factPack, 或從 draft 移除',
    })
  }
  if (ruleIds.has('rule_2_contradictory_numbers')) {
    recs.push({
      priority: 'high',
      action: '統一全文 metric 數值',
    })
  }
  if (ruleIds.has('rule_3_action_vs_base_case')) {
    recs.push({
      priority: 'medium',
      action: '檢查 base case 計算或修正 action target',
    })
  }

  return recs
}
