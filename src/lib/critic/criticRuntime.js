/**
 * Critic runtime — 主介面
 *
 * 來源: design doc v1 §1
 *
 * 流程:
 *   1. 跑 ruleLane (deterministic, 5 條規則)
 *   2. (可選) 跑 llmLane (semantic, 待 Phase 2d 實作)
 *   3. mergeIntoCriticReport 產出 criticReport
 *
 * 使用方式:
 *   const report = await runCritic({
 *     draft: '...',
 *     factPack,
 *     baseCase: 70,
 *     dominantNewsCluster: ...,
 *     mode: 'shadow',
 *   })
 */

import { runRuleLane } from './ruleLane.js'
import { mergeIntoCriticReport } from './severityMerge.js'
import { findDominantNewsCluster } from '../factPack/newsFactExtractor.js'

/**
 * 跑完整 critic
 *
 * @param {Object} input
 * @param {string|Object} input.draft - draft text 或 { text, sections }
 * @param {Object} input.factPack - 由 factPackBuilder 產出
 * @param {number} [input.baseCase] - base case 估值, 給 Rule 3 用
 * @param {Object} [input.dominantNewsCluster] - dominant news cluster, 給 Rule 7 用
 * @param {string} [input.mode] - 'shadow' | 'warn' | 'block', 預設 'shadow'
 * @param {Object} [input.meta] - target_id, target_type, run_id 等
 * @returns {Promise<Object>} criticReport
 */
export async function runCritic(input) {
  const {
    draft,
    factPack,
    baseCase,
    dominantNewsCluster: dominantArg,
    mode = 'shadow',
    meta = {},
  } = input || {}

  if (!draft || !factPack) {
    throw new Error('runCritic: draft 與 factPack 必填')
  }

  // 1. 如果沒給 dominant cluster, 自動從 factPack 找
  let dominantNewsCluster = dominantArg
  if (!dominantNewsCluster && factPack.news_facts) {
    dominantNewsCluster = findDominantNewsCluster(factPack.news_facts)
  }

  // 2. 跑 rule lane
  const ruleViolations = runRuleLane({
    draft,
    factPack,
    baseCase,
    dominantNewsCluster,
  })

  // 3. LLM lane 還沒實作 (Phase 2d), 先空陣列
  const llmViolations = []
  const semanticFindings = []

  // 4. 合併
  const report = mergeIntoCriticReport({
    ruleViolations,
    llmViolations,
    semanticFindings,
    staleSegments: [],
    evidenceViolations: [],
    meta: {
      ...meta,
      mode,
      target_id: meta.target_id || factPack.meta?.code || null,
      target_type: meta.target_type || 'draft',
    },
  })

  return report
}

/**
 * 給定 critic report, 是否該擋下 draft (不讓進 downstream)
 */
export function shouldBlock(report) {
  if (!report) return false
  return report.verdict === 'fail'
}

/**
 * 給定 critic report, 摘要訊息 (給人看)
 */
export function summarizeCriticReport(report) {
  if (!report) return 'critic 未跑'
  const c = report.statistics?.severity_breakdown || {}
  const parts = [
    `mode=${report.meta?.mode || '?'}`,
    `verdict=${report.verdict}`,
    `critical=${c.critical || 0}`,
    `high=${c.high || 0}`,
    `medium=${c.medium || 0}`,
    `low=${c.low || 0}`,
  ]
  return parts.join(' | ')
}
