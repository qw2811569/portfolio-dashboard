/**
 * Metric semantics — id 必須帶 dimensions, 避免 1717 EPS 稅前/稅後混用的悲劇
 *
 * 來源: design doc v1 §3 + Codex round 1 盲點 2
 *
 * 1717 教訓:
 * - 報告寫 "EPS = 2.03" 跟 "EPS = 1.41" 都對, 但是不同 dimension
 * - 2.03 = 稅前 EPS (年度)
 * - 1.41 = 稅後 EPS (年度) — 對應 trailing PE 47.59 用的
 * - 沒有 dimension 標記時, 兩個值會被當成同一個事實互相覆蓋
 *
 * 解法: id 用 colon-separated 帶 dimensions
 *
 * 標準格式:
 *   <metric>:<tax_treatment>:<period>:<scope>
 *
 * 範例:
 *   eps:tax_post:quarterly:consolidated      ← 季度稅後合併 EPS
 *   eps:tax_post:annual:consolidated         ← 年度稅後合併 EPS
 *   eps:tax_pre:annual:consolidated          ← 年度稅前合併 EPS
 *   pe:trailing                              ← trailing PE (本身就是衍生)
 *   revenue:monthly:consolidated             ← 月營收
 *   nonop:quarterly:consolidated             ← 季度業外損益
 */

import { EvidenceLevel } from './evidenceLevels.js'

// ─────────────────────────────────────────────────────────────
// Dimension enums
// ─────────────────────────────────────────────────────────────

export const TaxTreatment = Object.freeze({
  PRE: 'tax_pre',
  POST: 'tax_post',
  NA: 'tax_na', // PE / PB / 殖利率等不需要 tax dimension 的指標
})

export const Period = Object.freeze({
  DAILY: 'daily',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUAL: 'annual',
  TTM: 'ttm', // trailing twelve months
})

export const Scope = Object.freeze({
  CONSOLIDATED: 'consolidated',
  STANDALONE: 'standalone',
  NA: 'scope_na',
})

// ─────────────────────────────────────────────────────────────
// Metric ID parser & builder
// ─────────────────────────────────────────────────────────────

/**
 * 把 id 拆成 components
 * 例: parseMetricId("eps:tax_post:quarterly:consolidated")
 *   → { metric: "eps", tax: "tax_post", period: "quarterly", scope: "consolidated" }
 */
export function parseMetricId(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError(`parseMetricId: id 必須是非空字串, got ${typeof id}`)
  }
  const parts = id.split(':')
  if (parts.length < 1) {
    throw new TypeError(`parseMetricId: id 至少要有 metric 一段, got "${id}"`)
  }
  return {
    metric: parts[0] || null,
    tax: parts[1] || null,
    period: parts[2] || null,
    scope: parts[3] || null,
    raw: id,
  }
}

/**
 * 把 components 組成標準 id
 */
export function buildMetricId({ metric, tax, period, scope }) {
  if (!metric) throw new TypeError('buildMetricId: metric 必填')
  const parts = [metric]
  if (tax) parts.push(tax)
  if (period) parts.push(period)
  if (scope) parts.push(scope)
  return parts.join(':')
}

/**
 * 兩個 id 是不是同一個指標的不同 dimension
 * 例: eps:tax_post:quarterly vs eps:tax_pre:quarterly → 同 metric 不同 tax → true
 */
export function isSameMetricDifferentDimension(idA, idB) {
  const a = parseMetricId(idA)
  const b = parseMetricId(idB)
  if (a.metric !== b.metric) return false
  return a.tax !== b.tax || a.period !== b.period || a.scope !== b.scope
}

// ─────────────────────────────────────────────────────────────
// Standard metric registry — 1717 case 用到的全部
// ─────────────────────────────────────────────────────────────

export const KNOWN_METRICS = Object.freeze({
  // EPS family
  EPS_POST_QUARTERLY: 'eps:tax_post:quarterly:consolidated',
  EPS_POST_ANNUAL: 'eps:tax_post:annual:consolidated',
  EPS_POST_TTM: 'eps:tax_post:ttm:consolidated',
  EPS_PRE_QUARTERLY: 'eps:tax_pre:quarterly:consolidated',
  EPS_PRE_ANNUAL: 'eps:tax_pre:annual:consolidated',

  // Valuation family
  PE_TRAILING: 'pe:trailing',
  PE_FORWARD: 'pe:forward',
  PB: 'pb:current',
  DIVIDEND_YIELD: 'dividend_yield:current',

  // Income statement
  REVENUE_MONTHLY: 'revenue:monthly:consolidated',
  REVENUE_QUARTERLY: 'revenue:quarterly:consolidated',
  REVENUE_ANNUAL: 'revenue:annual:consolidated',
  GROSS_PROFIT_QUARTERLY: 'gross_profit:quarterly:consolidated',
  OPERATING_INCOME_QUARTERLY: 'operating_income:quarterly:consolidated',
  NONOP_QUARTERLY: 'nonop:quarterly:consolidated',
  PRETAX_QUARTERLY: 'pretax:quarterly:consolidated',
  TAX_QUARTERLY: 'tax:quarterly:consolidated',
  NET_INCOME_QUARTERLY: 'net_income:quarterly:consolidated',

  // Margin %
  GROSS_MARGIN_QUARTERLY: 'gross_margin:quarterly:consolidated',
  OPERATING_MARGIN_QUARTERLY: 'operating_margin:quarterly:consolidated',
})

// 反向查找
export const METRIC_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(KNOWN_METRICS).map(([k, v]) => [v, k]))
)

/**
 * 某個 metric id 是否在 KNOWN_METRICS 內
 * (不在不算錯, 只是 critic 會 warn)
 */
export function isKnownMetric(id) {
  return id in METRIC_LABELS
}

// ─────────────────────────────────────────────────────────────
// Validation helpers (給 factPack builder 用)
// ─────────────────────────────────────────────────────────────

/**
 * 檢查同一個 factPack 內有沒有 metric id 標記不一致的問題
 * 例: 某 fact 寫 id "eps", 另一 fact 寫 "eps:tax_post:annual" → 同 metric 但只有後者是嚴謹的
 *
 * 回傳: 警告陣列 (空陣列代表沒問題)
 */
export function validateMetricSemantics(facts) {
  const warnings = []
  const seenLooseMetrics = new Set()

  for (const fact of facts) {
    if (!fact || typeof fact.id !== 'string') continue
    const parsed = parseMetricId(fact.id)
    if (!parsed.tax && !parsed.period && !parsed.scope && parsed.metric) {
      // metric 但沒任何 dimension → loose id
      seenLooseMetrics.add(parsed.metric)
      warnings.push({
        type: 'loose_metric_id',
        fact_id: fact.id,
        metric: parsed.metric,
        suggestion: `把 id 改成標準格式, 例如 ${parsed.metric}:tax_post:quarterly:consolidated`,
      })
    }
  }

  return warnings
}
