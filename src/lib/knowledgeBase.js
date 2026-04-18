// 知識庫存取模組
// 供 dossierUtils.js 等 prompt 組裝層使用
// 只注入高信心度、與持股策略相關的條目，避免 prompt 膨脹

import chipAnalysis from './knowledge-base/chip-analysis.json' with { type: 'json' }
import technicalAnalysis from './knowledge-base/technical-analysis.json' with { type: 'json' }
import industryTrends from './knowledge-base/industry-trends.json' with { type: 'json' }
import fundamentalAnalysis from './knowledge-base/fundamental-analysis.json' with { type: 'json' }
import riskManagement from './knowledge-base/risk-management.json' with { type: 'json' }
import strategyCases from './knowledge-base/strategy-cases.json' with { type: 'json' }
import newsCorrelation from './knowledge-base/news-correlation.json' with { type: 'json' }
import { getMissingRuleRequirements } from './knowledgeAvailability.js'

const KNOWLEDGE_CATALOG = {
  chip: chipAnalysis,
  technical: technicalAnalysis,
  industry: industryTrends,
  fundamentals: fundamentalAnalysis,
  risk: riskManagement,
  strategyCases,
  news: newsCorrelation,
}

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

const DEFAULT_QUERY_PROFILE = {
  fundamentals: 0.3,
  industry: 0.25,
  chip: 0.25,
  technical: 0.1,
  news: 0.1,
}

export function buildKnowledgeQueryProfile(holding = {}, marketContext = {}) {
  const holdingPeriod = String(
    holding?.holdingPeriod ||
      holding?.period ||
      holding?.stockMeta?.period ||
      holding?.meta?.period ||
      ''
  )
  const profile = holdingPeriod.includes('短')
    ? { technical: 0.4, news: 0.3, risk: 0.2, fundamentals: 0.05, industry: 0.05 }
    : holdingPeriod.includes('長')
      ? { fundamentals: 0.4, industry: 0.3, strategyCases: 0.2, risk: 0.05, others: 0.05 }
      : holdingPeriod.includes('中')
        ? { fundamentals: 0.3, industry: 0.25, chip: 0.25, technical: 0.1, news: 0.1 }
        : { ...DEFAULT_QUERY_PROFILE }

  if (String(marketContext?.regime || marketContext?.sentiment || '').includes('risk-off')) {
    profile.risk = Math.max(profile.risk || 0, 0.15)
  }

  return profile
}

function getCatalogItemsByKey(key) {
  return Array.isArray(KNOWLEDGE_CATALOG[key]?.items) ? KNOWLEDGE_CATALOG[key].items : []
}

/**
 * 依持股的 strategy 類型，回傳最相關的高信心度知識條目
 * @param {{ strategy?: string, industry?: string }} stockMeta
 * @param {{ maxItems?: number, minConfidence?: number }} options
 * @returns {{ fact: string, interpretation: string, action: string, title: string }[]}
 */
// 載入 persona-knowledge-map（Qwen 產出的 600 條分類）
let _personaMap = null
function getPersonaMap() {
  if (_personaMap) return _personaMap
  try {
    // Node 環境（回測/API）
    if (
      typeof globalThis !== 'undefined' &&
      typeof globalThis.__personaKnowledgeMap !== 'undefined'
    ) {
      _personaMap = globalThis.__personaKnowledgeMap
      return _personaMap
    }
  } catch {
    /* ignore */
  }
  return null
}

export function getRelevantKnowledge(
  stockMeta = {},
  {
    maxItems = 5,
    minConfidence = 0.7,
    queryProfile = null,
    persona = null,
    dataAvailability = null,
    onRuleSkipped = null,
  } = {}
) {
  const { strategy } = stockMeta
  const resolvedProfile = queryProfile || buildKnowledgeQueryProfile(stockMeta)
  const personaMap = getPersonaMap()?.classifications || null
  const personaId = persona?.id || null
  const weightedCandidates = []

  Object.entries(resolvedProfile || {}).forEach(([key, weight]) => {
    if (key === 'others') return
    const items = getCatalogItemsByKey(key)
    items.forEach((item) => {
      const confidence = Number(item?.confidence ?? 0)
      if (confidence < minConfidence) return
      const missingRequirements = dataAvailability
        ? getMissingRuleRequirements(item, dataAvailability)
        : []
      if (missingRequirements.length > 0) {
        onRuleSkipped?.({
          ruleId: item.id,
          missingRequirements,
          reason: 'missing-data',
        })
        return
      }

      // 如果有 persona filtering，優先選該人格的規則
      let personaBoost = 1.0
      if (personaId && personaMap && item.id) {
        const rulePersona = personaMap[item.id]
        if (rulePersona === personaId)
          personaBoost = 1.5 // 對應人格加 50% 權重
        else if (rulePersona === 'shared')
          personaBoost = 1.2 // 通用規則加 20%
        else personaBoost = 0.5 // 不對應的人格降 50%
      }

      weightedCandidates.push({
        ...item,
        __sourceKey: key,
        __score: confidence * Number(weight || 0) * personaBoost,
      })
    })
  })

  if (weightedCandidates.length === 0) {
    const strategySources = STRATEGY_KNOWLEDGE_MAP[strategy] ?? [
      technicalAnalysis,
      fundamentalAnalysis,
    ]
    strategySources.forEach((source) => {
      ;(source.items ?? []).forEach((item) => {
        if ((item.confidence ?? 0) >= minConfidence) {
          const missingRequirements = dataAvailability
            ? getMissingRuleRequirements(item, dataAvailability)
            : []
          if (missingRequirements.length > 0) {
            onRuleSkipped?.({
              ruleId: item.id,
              missingRequirements,
              reason: 'missing-data',
            })
            return
          }
          weightedCandidates.push({
            ...item,
            __sourceKey: 'fallback',
            __score: item.confidence ?? 0,
          })
        }
      })
    })
  }

  const seen = new Set()
  return weightedCandidates
    .sort((a, b) => {
      const scoreDiff = (b.__score ?? 0) - (a.__score ?? 0)
      if (scoreDiff !== 0) return scoreDiff
      return (b.confidence ?? 0) - (a.confidence ?? 0)
    })
    .filter((item) => {
      if (!item?.id || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .slice(0, maxItems)
    .map(({ __sourceKey, __score, ...item }) => item)
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
  {
    maxItems = 5,
    minConfidence = 0.7,
    maxCaseItems = 2,
    dataAvailability = null,
    onRuleSkipped = null,
  } = {}
) {
  const knowledge = getRelevantKnowledge(stockMeta, {
    maxItems,
    minConfidence,
    dataAvailability,
    onRuleSkipped,
  })
  const cases = getRelevantCases(stockMeta, { maxItems: maxCaseItems })
  return {
    knowledge,
    cases,
    itemIds: Array.from(
      new Set([...knowledge, ...cases].map((item) => String(item?.id || '').trim()).filter(Boolean))
    ),
  }
}

function compactKnowledgeText(value, limit = 32) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

export function collectInjectedKnowledgeIdsFromDossiers(
  dossiers = [],
  { maxItems = 5, minConfidence = 0.7, maxCaseItems = 2, getDataAvailability = null } = {}
) {
  return Array.from(
    new Set(
      (Array.isArray(dossiers) ? dossiers : []).flatMap(
        (dossier) =>
          getKnowledgeSelection(dossier?.stockMeta ?? {}, {
            maxItems,
            minConfidence,
            maxCaseItems,
            dataAvailability: getDataAvailability ? getDataAvailability(dossier) : null,
          }).itemIds
      )
    )
  )
}

export function buildCompactKnowledgeContext(
  stockMeta = {},
  {
    maxItems = 2,
    minConfidence = 0.7,
    maxCaseItems = 1,
    dataAvailability = null,
    onRuleSkipped = null,
  } = {}
) {
  const { knowledge, cases } = getKnowledgeSelection(stockMeta, {
    maxItems,
    minConfidence,
    maxCaseItems,
    dataAvailability,
    onRuleSkipped,
  })

  trackUsage([...knowledge, ...cases])

  const lines = []
  if (knowledge.length > 0) {
    lines.push(
      `知識: ${knowledge
        .map(
          (item) =>
            `${compactKnowledgeText(item.title, 18)}→${compactKnowledgeText(item.action, 26)}`
        )
        .join(' | ')}`
    )
  }
  if (cases.length > 0) {
    lines.push(
      `案例: ${cases
        .map(
          (item) =>
            `${compactKnowledgeText(item.title, 18)}→${compactKnowledgeText(item.lessons, 24)}`
        )
        .join(' | ')}`
    )
  }

  return lines.join('\n')
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
export function getTopKnowledgeRules({ maxItems = 10, minConfidence = 0.75 } = {}) {
  const items = Object.values(KNOWLEDGE_CATALOG)
    .flatMap((catalog) => catalog?.items || [])
    .filter((item) => Number(item?.confidence || 0) >= minConfidence)
    .sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0))

  const seen = new Set()
  return items
    .filter((item) => {
      if (!item?.id || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .slice(0, maxItems)
}

export function buildKnowledgeContext(
  stockMeta = {},
  { dataAvailability = null, onRuleSkipped = null } = {}
) {
  const { knowledge, cases } = getKnowledgeSelection(stockMeta, {
    dataAvailability,
    onRuleSkipped,
  })

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
