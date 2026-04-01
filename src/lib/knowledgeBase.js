// 知識庫存取模組
// 供 dossierUtils.js 等 prompt 組裝層使用
// 只注入高信心度、與持股策略相關的條目，避免 prompt 膨脹

import chipAnalysis from './knowledge-base/chip-analysis.json'
import technicalAnalysis from './knowledge-base/technical-analysis.json'
import industryTrends from './knowledge-base/industry-trends.json'
import fundamentalAnalysis from './knowledge-base/fundamental-analysis.json'
import riskManagement from './knowledge-base/risk-management.json'
import strategyCases from './knowledge-base/strategy-cases.json'
import newsCorrelation from './knowledge-base/news-correlation.json'

// strategy 欄位 → 最相關的知識庫分類
const STRATEGY_KNOWLEDGE_MAP = {
  成長股: [fundamentalAnalysis, industryTrends, technicalAnalysis],
  景氣循環: [industryTrends, fundamentalAnalysis, technicalAnalysis],
  事件驅動: [newsCorrelation, chipAnalysis, fundamentalAnalysis],
  權證: [chipAnalysis, technicalAnalysis],
  // 以下處理 STOCK_META 中的實際名稱 + 別名
  ETF指數: [technicalAnalysis, riskManagement],
  'ETF/指數': [technicalAnalysis, riskManagement],
  價值投資: [fundamentalAnalysis, riskManagement],
  價值股: [fundamentalAnalysis, riskManagement],
  股息成長: [fundamentalAnalysis, riskManagement],
  轉機股: [fundamentalAnalysis, newsCorrelation, chipAnalysis],
  轉型股: [fundamentalAnalysis, newsCorrelation, chipAnalysis],
}

// 所有策略通用的風險管理知識（每次都會附加）
const UNIVERSAL_SOURCES = [riskManagement]

/**
 * 依持股的 strategy 類型，回傳最相關的高信心度知識條目
 * @param {{ strategy?: string, industry?: string }} stockMeta
 * @param {{ maxItems?: number, minConfidence?: number }} options
 * @returns {{ fact: string, interpretation: string, action: string, title: string }[]}
 */
export function getRelevantKnowledge(stockMeta = {}, { maxItems = 5, minConfidence = 0.7 } = {}) {
  const { strategy } = stockMeta
  const strategySources = STRATEGY_KNOWLEDGE_MAP[strategy] ?? [
    technicalAnalysis,
    fundamentalAnalysis,
  ]

  // 策略知識和風險管理知識分開選取，各佔固定名額
  // 避免高 confidence 的 rm 擠掉策略相關知識
  const rmSlots = Math.min(1, maxItems - 1) // 風險管理最多 1 條
  const strategySlots = maxItems - rmSlots // 其餘給策略知識

  const strategyCandidates = strategySources.flatMap((source) =>
    (source.items ?? []).filter((item) => (item.confidence ?? 0) >= minConfidence)
  )
  const rmCandidates = UNIVERSAL_SOURCES.flatMap((source) =>
    (source.items ?? []).filter((item) => (item.confidence ?? 0) >= minConfidence)
  )

  // 去重
  const seen = new Set()
  const dedup = (items) =>
    items.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })

  // 策略知識優先選滿，再補風險管理
  const strategyPicks = dedup(
    strategyCandidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
  ).slice(0, strategySlots)
  const rmPicks = dedup(
    rmCandidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
  ).slice(0, rmSlots)

  return [...strategyPicks, ...rmPicks]
}

/**
 * 取得與持股 strategy 相關的歷史策略案例（只取成功案例）
 * @param {{ strategy?: string }} stockMeta
 * @param {{ maxItems?: number }} options
 * @returns {{ title: string, fact: string, lessons: string }[]}
 */
export function getRelevantCases(stockMeta = {}, { maxItems = 2 } = {}) {
  const { strategy } = stockMeta
  const strategyTagMap = {
    事件驅動: ['事件驅動', '法說會', '月營收', '催化劑'],
    權證: ['權證', '時間價值', '事件驅動'],
    成長股: ['趨勢追蹤', '成長股', '技術面', '基本面', '成長投資'],
    景氣循環: ['循環股', '產業輪動', '景氣'],
    價值投資: ['價值投資', '低本益比', '高股息'],
    價值股: ['價值投資', '低本益比', '高股息'],
    股息成長: ['高股息', '配息', '長期投資'],
    轉機股: ['轉機股', '反向操作', '底部訊號'],
    轉型股: ['轉機股', '反向操作', '底部訊號'],
    'ETF/指數': ['ETF', '定時定額', '長期投資'],
    ETF指數: ['ETF', '定時定額', '長期投資'],
  }

  const tags = strategyTagMap[strategy] ?? []
  if (tags.length === 0) return []

  const matched = (strategyCases.items ?? []).filter((item) =>
    item.tags?.some((t) => tags.includes(t))
  )

  // 成功案例優先，但也保留失敗案例作為教訓
  const successes = matched.filter((item) => item.outcome === 'success')
  const failures = matched.filter((item) => item.outcome === 'failure')

  // 至少給 1 個失敗案例作為風險提醒
  const successSlots = Math.max(1, maxItems - 1)
  const result = [
    ...successes.slice(0, successSlots),
    ...failures.slice(0, maxItems - Math.min(successes.length, successSlots)),
  ]

  return result.slice(0, maxItems)
}

export function getKnowledgeSelection(
  stockMeta = {},
  { maxItems = 5, minConfidence = 0.7, maxCaseItems = 2 } = {}
) {
  const knowledge = getRelevantKnowledge(stockMeta, { maxItems, minConfidence })
  const cases = getRelevantCases(stockMeta, { maxItems: maxCaseItems })
  return {
    knowledge,
    cases,
    itemIds: Array.from(
      new Set(
        [...knowledge, ...cases]
          .map((item) => String(item?.id || '').trim())
          .filter(Boolean)
      )
    ),
  }
}

export function collectInjectedKnowledgeIdsFromDossiers(
  dossiers = [],
  { maxItems = 5, minConfidence = 0.7, maxCaseItems = 2 } = {}
) {
  return Array.from(
    new Set(
      (Array.isArray(dossiers) ? dossiers : []).flatMap((dossier) =>
        getKnowledgeSelection(dossier?.stockMeta ?? {}, {
          maxItems,
          minConfidence,
          maxCaseItems,
        }).itemIds
      )
    )
  )
}

/**
 * 格式化知識條目為 prompt 文字（結構化格式）
 */
export function formatKnowledgeItem(item) {
  return `【${item.title}】
  事實：${item.fact}
  解讀：${item.interpretation}
  行動：${item.action}
  信心度：${(item.confidence * 100).toFixed(0)}%`
}

/**
 * 格式化策略案例為 prompt 文字（結構化格式）
 */
export function formatCaseItem(item) {
  const returnStr =
    item.return >= 0 ? `+${(item.return * 100).toFixed(0)}%` : `${(item.return * 100).toFixed(0)}%`
  return `【${item.title}】
  背景：${item.fact}
  教訓：${item.lessons}
  結果：${returnStr}（${item.outcome === 'success' ? '成功' : '失敗'}）`
}

/**
 * 回傳 prompt 可用的知識摘要區塊（有內容才回傳，空字串代表略過）
 */
export function buildKnowledgeContext(stockMeta = {}) {
  const { knowledge, cases } = getKnowledgeSelection(stockMeta)

  // Usage tracking: 記錄哪些 entry 被選中（side-effect，不阻塞主流程）
  trackUsage([...knowledge, ...cases])

  if (knowledge.length === 0 && cases.length === 0) return ''

  const lines = []
  lines.push('=== 知識庫參考 ===')

  if (knowledge.length > 0) {
    lines.push('')
    lines.push('📊 相關知識：')
    knowledge.forEach((item, index) => {
      lines.push(`${index + 1}. ${formatKnowledgeItem(item)}`)
      if (index < knowledge.length - 1) lines.push('')
    })
  }

  if (cases.length > 0) {
    lines.push('')
    lines.push('📚 歷史案例：')
    cases.forEach((item, index) => {
      lines.push(`${index + 1}. ${formatCaseItem(item)}`)
      if (index < cases.length - 1) lines.push('')
    })
  }

  lines.push('')
  lines.push('===============')

  return lines.join('\n')
}

/**
 * 記錄 usage 到 localStorage（side-effect，不阻塞主流程）
 * @param {Array<{id: string}>} items
 */
function trackUsage(items) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    const log = JSON.parse(localStorage.getItem('kb-usage-log') || '[]')
    const entry = {
      timestamp: Date.now(),
      itemIds: items.map((i) => i.id),
    }
    log.push(entry)
    // 只保留最近 500 條
    if (log.length > 500) log.splice(0, log.length - 500)
    localStorage.setItem('kb-usage-log', JSON.stringify(log))
  } catch {
    // silent fail - 不影響主流程
  }
}
