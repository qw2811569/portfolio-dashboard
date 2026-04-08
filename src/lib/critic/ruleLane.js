/**
 * Rule lane — deterministic critic
 *
 * 來源: design doc v1 §1
 *
 * 負責 7 條規則中的 rule lane 部分:
 *   - Rule 1: 結論引用的數字不在 fact pack
 *   - Rule 2: 同份輸出兩個矛盾數字
 *   - Rule 3: 動作建議與 base case 衝突
 *   - Rule 6: draft 引用 0 條 news + 該股 30 天有 ≥1 重大新聞 (Rule 0)
 *   - Rule 7: dominant catalyst mismatch (rule lane 部分)
 *
 * Rule 4, 5 是純 LLM lane (見 llmLane.js)
 *
 * 設計原則:
 *   - deterministic, 不靠 LLM
 *   - fast (< 100ms)
 *   - 只回傳 violations, 不回傳 verdict (verdict 由 severityMerge 決定)
 */

import { CriticRule, makeViolation } from './criticSchema.js'
import { Severity } from '../factPack/evidenceLevels.js'

// ─────────────────────────────────────────────────────────────
// 工具: 從 draft 抽取所有「看起來像數字」的 token
// ─────────────────────────────────────────────────────────────

const NUMBER_PATTERN = /(\d+(?:\.\d+)?)\s*(?:元|%|億|百萬|千萬|萬|倍|x)/gi

function extractNumbersFromDraft(draftText = '') {
  if (!draftText) return []
  const matches = []
  let m
  const re = new RegExp(NUMBER_PATTERN.source, NUMBER_PATTERN.flags)
  while ((m = re.exec(draftText)) !== null) {
    matches.push({
      raw: m[0],
      value: parseFloat(m[1]),
      index: m.index,
      context: draftText.substring(Math.max(0, m.index - 30), m.index + m[0].length + 30),
    })
  }
  return matches
}

// ─────────────────────────────────────────────────────────────
// Rule 1: 數字不在 fact pack
// ─────────────────────────────────────────────────────────────

export function checkRule1_NumberNotInFactPack(draft, factPack) {
  const violations = []
  if (!draft || !factPack) return violations

  const draftText = typeof draft === 'string' ? draft : draft.text || ''
  const numbers = extractNumbersFromDraft(draftText)

  // 把 factPack 內所有 fact 的 value 收集起來
  const factValues = new Set()
  const allFacts = [
    ...(factPack.valuation_facts || []),
    ...(factPack.earnings_facts || []),
    ...(factPack.chip_facts || []),
    ...(factPack.news_facts || []),
    ...(factPack.resolved_facts || []),
  ]
  for (const fact of allFacts) {
    if (fact?.value != null && typeof fact.value === 'number') {
      // 允許 ±2% 浮動 (rounding tolerance)
      factValues.add(Math.round(fact.value * 100) / 100)
    }
  }

  // 對 draft 內每個數字, 看是否在 fact pack
  for (const num of numbers) {
    const rounded = Math.round(num.value * 100) / 100
    let found = false
    for (const fv of factValues) {
      if (Math.abs(fv - rounded) / Math.max(Math.abs(fv), 1) < 0.02) {
        found = true
        break
      }
    }
    if (!found) {
      // 不在 fact pack — flag 為 violation
      violations.push(
        makeViolation({
          ruleId: CriticRule.NUMBER_NOT_IN_FACTPACK.id,
          severity: CriticRule.NUMBER_NOT_IN_FACTPACK.severity,
          lane: 'rule',
          message: `數字 ${num.raw} 不在 factPack 內`,
          location: `index ${num.index}`,
          evidence: num.context,
          suggested_fix: '檢查這個數字來源, 加進 factPack 對應 fact, 或從 draft 移除',
        }),
      )
    }
  }

  return violations
}

// ─────────────────────────────────────────────────────────────
// Rule 2: 同份輸出兩個矛盾數字
// ─────────────────────────────────────────────────────────────

/**
 * 偵測 draft 內同一個 metric 出現多個不同數字
 * 例: 「PE 47.59」跟「PE 39」同時存在
 */
export function checkRule2_ContradictoryNumbers(draft) {
  const violations = []
  if (!draft) return violations

  const draftText = typeof draft === 'string' ? draft : draft.text || ''

  // 抓常見 metric 名稱 + 後續數字
  const METRIC_PATTERNS = [
    { name: 'PE', regex: /PE\s*[=≈:]?\s*(\d+(?:\.\d+)?)/gi },
    { name: 'EPS', regex: /EPS\s*[=≈:]?\s*(\d+(?:\.\d+)?)/gi },
    { name: 'PBR', regex: /PBR\s*[=≈:]?\s*(\d+(?:\.\d+)?)/gi },
    { name: '殖利率', regex: /殖利率\s*[=≈:]?\s*(\d+(?:\.\d+)?)\s*%/gi },
  ]

  for (const { name, regex } of METRIC_PATTERNS) {
    const valuesFound = new Map() // value → [index1, index2, ...]
    const re = new RegExp(regex.source, regex.flags)
    let m
    while ((m = re.exec(draftText)) !== null) {
      const v = parseFloat(m[1])
      const rounded = Math.round(v * 100) / 100
      if (!valuesFound.has(rounded)) {
        valuesFound.set(rounded, [])
      }
      valuesFound.get(rounded).push({ index: m.index, raw: m[0] })
    }

    // 如果有 2 個以上不同的值, 且差異 > 5% → 矛盾
    if (valuesFound.size >= 2) {
      const allValues = [...valuesFound.keys()]
      const min = Math.min(...allValues)
      const max = Math.max(...allValues)
      if ((max - min) / Math.max(min, 1) > 0.05) {
        violations.push(
          makeViolation({
            ruleId: CriticRule.CONTRADICTORY_NUMBERS.id,
            severity: CriticRule.CONTRADICTORY_NUMBERS.severity,
            lane: 'rule',
            message: `${name} 在同份輸出有 ${valuesFound.size} 個不同數值: ${allValues.join(', ')}`,
            location: 'multiple positions',
            evidence: JSON.stringify(Object.fromEntries(valuesFound)),
            suggested_fix: `檢查 ${name} 應該是哪個值, 統一全文`,
          }),
        )
      }
    }
  }

  return violations
}

// ─────────────────────────────────────────────────────────────
// Rule 3: 動作建議與 base case 衝突
// ─────────────────────────────────────────────────────────────

export function checkRule3_ActionVsBaseCase(draft, baseCase) {
  const violations = []
  if (!draft || baseCase == null) return violations

  const draftText = typeof draft === 'string' ? draft : draft.text || ''

  // 抓「目標 X 元」「漲到 X」「Bull X」這類目標價
  const TARGET_PATTERNS = [
    /目標\s*[:=]?\s*(\d+(?:\.\d+)?)\s*元/gi,
    /Target\s*[:=]?\s*(\d+(?:\.\d+)?)/gi,
    /Bull\s*[:=]?\s*(\d+(?:\.\d+)?)/gi,
    /漲到\s*(\d+(?:\.\d+)?)/gi,
  ]

  const targets = []
  for (const re of TARGET_PATTERNS) {
    let m
    const reCloned = new RegExp(re.source, re.flags)
    while ((m = reCloned.exec(draftText)) !== null) {
      targets.push({ value: parseFloat(m[1]), raw: m[0], index: m.index })
    }
  }

  // 如果有任何 target 超過 base case * 1.3 (即超過 base case 30%) → flag
  for (const t of targets) {
    const ratio = t.value / baseCase
    if (ratio > 1.3) {
      violations.push(
        makeViolation({
          ruleId: CriticRule.ACTION_VS_BASE_CASE_CONFLICT.id,
          severity: CriticRule.ACTION_VS_BASE_CASE_CONFLICT.severity,
          lane: 'rule',
          message: `目標 ${t.value} 比 base case ${baseCase} 高 ${Math.round((ratio - 1) * 100)}%, 超出合理範圍`,
          location: `index ${t.index}`,
          evidence: t.raw,
          suggested_fix: '檢查 base case 的計算, 或把目標改回 base case ± 15% 內',
        }),
      )
    }
  }

  return violations
}

// ─────────────────────────────────────────────────────────────
// Rule 6: 沒引用新聞 + 該股有重大新聞 (Rule 0 違反)
// ← 1717 失敗的核心
// ─────────────────────────────────────────────────────────────

export function checkRule6_NoNewsButNewsAvailable(draft, factPack) {
  const violations = []
  if (!draft || !factPack) return violations

  const draftText = typeof draft === 'string' ? draft : draft.text || ''
  const newsFacts = factPack.news_facts || []

  // 計算 draft 內 news_fact 的引用數
  let citationCount = 0
  for (const newsFact of newsFacts) {
    if (newsFact.headline && draftText.includes(newsFact.headline.substring(0, 10))) {
      citationCount++
    }
    if (newsFact.id && draftText.includes(newsFact.id)) {
      citationCount++
    }
  }

  // material news 數量
  const materialNews = newsFacts.filter(n => n.is_material === true)

  // 觸發條件:
  //   - draft citation = 0
  //   - 且 material news >= 1
  if (citationCount === 0 && materialNews.length >= 1) {
    violations.push(
      makeViolation({
        ruleId: CriticRule.NO_NEWS_BUT_NEWS_AVAILABLE.id,
        severity: CriticRule.NO_NEWS_BUT_NEWS_AVAILABLE.severity,
        lane: 'rule',
        message: `draft 引用 0 條 news 但 factPack 內有 ${materialNews.length} 條 material news (Rule 0 違反)`,
        location: 'whole draft',
        evidence: materialNews
          .slice(0, 3)
          .map(n => `${n.headline?.substring(0, 50)} (score=${n.total_score})`)
          .join('; '),
        suggested_fix: 'draft 必須引用至少 1 條 material news, 並標明 sentiment 與引用段落',
      }),
    )
  }

  return violations
}

// ─────────────────────────────────────────────────────────────
// Rule 7 (rule lane 部分): dominant catalyst mismatch
// ← Codex round 1 加的最重要規則, 這裡只做 rule lane 偵測, LLM lane 補語義
// ─────────────────────────────────────────────────────────────

export function checkRule7_DominantCatalystMismatch(draft, factPack, dominantNewsCluster) {
  const violations = []
  if (!draft || !factPack || !dominantNewsCluster) return violations

  const draftText = typeof draft === 'string' ? draft : draft.text || ''

  // 簡化版 rule lane 偵測:
  //   1. 找 dominant cluster 的 representative headline
  //   2. 看 draft 有沒有「以那個事件為主因」的字樣
  //   3. 如果 draft 主結論完全沒提到 dominant cluster 的關鍵詞 → flag

  const dominantHeadline = dominantNewsCluster.headline || ''
  if (!dominantHeadline) return violations

  // 從 dominant headline 抽出 1-2 個關鍵詞
  // 簡化: 取 4 字以上的詞
  const keywords = dominantHeadline
    .replace(/[【】「」『』,，。.!！?？;；:：「」"'（）()\[\]/\\]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && t !== '長興' && !/^\d+$/.test(t))
    .slice(0, 5)

  // draft 內有沒有任何一個關鍵詞?
  const matched = keywords.some(k => draftText.includes(k))

  if (!matched && keywords.length > 0) {
    violations.push(
      makeViolation({
        ruleId: CriticRule.DOMINANT_CATALYST_MISMATCH.id,
        severity: CriticRule.DOMINANT_CATALYST_MISMATCH.severity,
        lane: 'rule',
        message: `draft 沒有提到 dominant news cluster 的任何關鍵詞 (${keywords.join('/')})`,
        location: 'main thesis',
        evidence: `dominant cluster: "${dominantHeadline}"`,
        suggested_fix: `draft 必須明確說明這個 cluster 為什麼不是主因, 或修正 main thesis`,
      }),
    )
  }

  return violations
}

// ─────────────────────────────────────────────────────────────
// 主介面: 跑全部 rule lane checks
// ─────────────────────────────────────────────────────────────

export function runRuleLane({ draft, factPack, baseCase, dominantNewsCluster }) {
  const allViolations = []

  allViolations.push(...checkRule1_NumberNotInFactPack(draft, factPack))
  allViolations.push(...checkRule2_ContradictoryNumbers(draft))
  if (baseCase != null) {
    allViolations.push(...checkRule3_ActionVsBaseCase(draft, baseCase))
  }
  allViolations.push(...checkRule6_NoNewsButNewsAvailable(draft, factPack))
  if (dominantNewsCluster) {
    allViolations.push(
      ...checkRule7_DominantCatalystMismatch(draft, factPack, dominantNewsCluster),
    )
  }

  return allViolations
}
