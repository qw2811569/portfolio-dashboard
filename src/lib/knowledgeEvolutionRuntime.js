import chipAnalysis from './knowledge-base/chip-analysis.json'
import technicalAnalysis from './knowledge-base/technical-analysis.json'
import industryTrends from './knowledge-base/industry-trends.json'
import fundamentalAnalysis from './knowledge-base/fundamental-analysis.json'
import riskManagement from './knowledge-base/risk-management.json'
import strategyCases from './knowledge-base/strategy-cases.json'
import newsCorrelation from './knowledge-base/news-correlation.json'

const KNOWLEDGE_SOURCES = [
  { key: 'chip-analysis', kind: 'knowledge', data: chipAnalysis },
  { key: 'technical-analysis', kind: 'knowledge', data: technicalAnalysis },
  { key: 'industry-trends', kind: 'knowledge', data: industryTrends },
  { key: 'fundamental-analysis', kind: 'knowledge', data: fundamentalAnalysis },
  { key: 'risk-management', kind: 'knowledge', data: riskManagement },
  { key: 'strategy-cases', kind: 'case', data: strategyCases },
  { key: 'news-correlation', kind: 'knowledge', data: newsCorrelation },
]

function clampConfidence(value, min = 0.4, max = 0.95) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function roundDelta(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function readStorageArray(storage, key, limit = 200) {
  try {
    if (!storage?.getItem) return []
    const rows = JSON.parse(storage.getItem(key) || '[]')
    return Array.isArray(rows) ? rows.slice(-limit) : []
  } catch {
    return []
  }
}

function resolveStorage(storage) {
  if (storage?.getItem) return storage
  if (typeof window !== 'undefined' && window.localStorage?.getItem) return window.localStorage
  if (typeof globalThis !== 'undefined' && globalThis.localStorage?.getItem) {
    return globalThis.localStorage
  }
  return null
}

export function buildKnowledgeCatalog() {
  return KNOWLEDGE_SOURCES.flatMap(({ key, kind, data }) =>
    (Array.isArray(data?.items) ? data.items : [])
      .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
      .map((item) => ({
        id: item.id,
        title: item.title || item.id,
        confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : 0.7,
        sourceKey: key,
        kind,
      }))
  )
}

export function buildKnowledgeCatalogMap() {
  return new Map(buildKnowledgeCatalog().map((item) => [item.id, item]))
}

export function normalizeKnowledgeUsageLog(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
      const itemIds = Array.isArray(entry.itemIds)
        ? Array.from(
            new Set(
              entry.itemIds
                .map((itemId) => String(itemId || '').trim())
                .filter(Boolean)
            )
          )
        : []
      return {
        timestamp: Number(entry.timestamp) || 0,
        itemIds,
      }
    })
    .filter((entry) => entry && entry.itemIds.length > 0)
}

export function normalizeKnowledgeFeedbackLog(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
      const signal = ['helpful', 'misleading'].includes(entry.signal) ? entry.signal : null
      if (!signal) return null
      return {
        analysisId: String(entry.analysisId || '').trim() || null,
        signal,
        timestamp: Number(entry.timestamp) || 0,
        date: String(entry.date || '').trim() || null,
        injectedKnowledgeIds: Array.isArray(entry.injectedKnowledgeIds)
          ? Array.from(
              new Set(
                entry.injectedKnowledgeIds
                  .map((itemId) => String(itemId || '').trim())
                  .filter(Boolean)
              )
            )
          : [],
      }
    })
    .filter(Boolean)
}

export function readKnowledgeEvolutionLogs(
  storage = null
) {
  const targetStorage = resolveStorage(storage)
  return {
    usageLog: normalizeKnowledgeUsageLog(readStorageArray(targetStorage, 'kb-usage-log', 500)),
    feedbackLog: normalizeKnowledgeFeedbackLog(
      readStorageArray(targetStorage, 'kb-feedback-log', 200)
    ),
  }
}

export function buildKnowledgeEvolutionProposal({
  usageLog = [],
  feedbackLog = [],
  maxAdjustments = 12,
} = {}) {
  const catalog = buildKnowledgeCatalogMap()
  const normalizedUsageLog = normalizeKnowledgeUsageLog(usageLog)
  const normalizedFeedbackLog = normalizeKnowledgeFeedbackLog(feedbackLog)
  const usageCountById = new Map()
  const feedbackStatsById = new Map()
  let feedbackMissingLinkCount = 0
  let ignoredFeedbackIdCount = 0

  normalizedUsageLog.forEach((entry) => {
    entry.itemIds.forEach((itemId) => {
      if (!catalog.has(itemId)) return
      usageCountById.set(itemId, (usageCountById.get(itemId) || 0) + 1)
    })
  })

  normalizedFeedbackLog.forEach((entry) => {
    if (entry.injectedKnowledgeIds.length === 0) {
      feedbackMissingLinkCount += 1
      return
    }

    entry.injectedKnowledgeIds.forEach((itemId) => {
      if (!catalog.has(itemId)) {
        ignoredFeedbackIdCount += 1
        return
      }
      const current = feedbackStatsById.get(itemId) || { helpful: 0, misleading: 0 }
      current[entry.signal] += 1
      feedbackStatsById.set(itemId, current)
    })
  })

  const confidenceAdjustments = Array.from(feedbackStatsById.entries())
    .map(([itemId, feedbackStats]) => {
      const item = catalog.get(itemId)
      if (!item) return null

      const helpfulCount = feedbackStats.helpful || 0
      const misleadingCount = feedbackStats.misleading || 0
      const usageCount = usageCountById.get(itemId) || 0
      let targetConfidence = item.confidence
      let reason = ''
      let statusAction = 'keep'

      if (misleadingCount >= 2 && misleadingCount > helpfulCount) {
        targetConfidence = clampConfidence(item.confidence - 0.1)
        reason = `誤導回饋 ${misleadingCount} 次，高於 helpful ${helpfulCount} 次`
        statusAction = 'pending-review'
      } else if (helpfulCount >= 3 && helpfulCount > misleadingCount * 2) {
        targetConfidence = clampConfidence(item.confidence + 0.05)
        reason = `helpful 回饋 ${helpfulCount} 次，顯著高於 misleading ${misleadingCount} 次`
        statusAction = 'reinforce'
      } else {
        return null
      }

      const delta = roundDelta(targetConfidence - item.confidence)
      if (delta === 0) return null

      return {
        id: item.id,
        title: item.title,
        sourceKey: item.sourceKey,
        kind: item.kind,
        fromConfidence: item.confidence,
        toConfidence: targetConfidence,
        delta,
        usageCount,
        helpfulCount,
        misleadingCount,
        statusAction,
        reason,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const deltaDiff = Math.abs(b.delta) - Math.abs(a.delta)
      if (deltaDiff !== 0) return deltaDiff
      const signalDiff = b.misleadingCount + b.helpfulCount - (a.misleadingCount + a.helpfulCount)
      if (signalDiff !== 0) return signalDiff
      return b.usageCount - a.usageCount
    })

  const issues = []
  if (confidenceAdjustments.length > maxAdjustments) {
    issues.push(`confidence 調整 ${confidenceAdjustments.length} 筆，超過單次 ${maxAdjustments} 筆上限`)
  }

  const actionableAdjustments = confidenceAdjustments.slice(0, maxAdjustments)
  const actionable = actionableAdjustments.length > 0
  const passed = issues.length === 0
  const status = !passed ? 'blocked' : actionable ? 'candidate' : 'no-op'

  let summary = '目前 feedback 與 usage 訊號不足，暫無 confidence 調整'
  if (!passed) {
    summary = `知識庫提案未通過 gate：${issues.join('；')}`
  } else if (actionable) {
    const upgradeCount = actionableAdjustments.filter((item) => item.delta > 0).length
    const downgradeCount = actionableAdjustments.filter((item) => item.delta < 0).length
    summary = `建議調整 ${actionableAdjustments.length} 筆 confidence（上調 ${upgradeCount} / 下調 ${downgradeCount}）`
  }

  return {
    status,
    createdAt: new Date().toISOString(),
    summary,
    proposedEntries: [],
    entriesToDeprecate: [],
    confidenceAdjustments: actionableAdjustments,
    evaluation: {
      passed,
      actionable,
      status,
      summary,
      issues,
      metrics: {
        usageLogCount: normalizedUsageLog.length,
        feedbackLogCount: normalizedFeedbackLog.length,
        feedbackLinkedCount: normalizedFeedbackLog.length - feedbackMissingLinkCount,
        feedbackMissingLinkCount,
        ignoredFeedbackIdCount,
        adjustmentCount: confidenceAdjustments.length,
      },
    },
    metrics: {
      catalogCount: catalog.size,
      usageLogCount: normalizedUsageLog.length,
      feedbackLogCount: normalizedFeedbackLog.length,
      feedbackLinkedCount: normalizedFeedbackLog.length - feedbackMissingLinkCount,
      feedbackMissingLinkCount,
      ignoredFeedbackIdCount,
      adjustmentCount: actionableAdjustments.length,
      helpfulAdjustmentCount: actionableAdjustments.filter((item) => item.delta > 0).length,
      misleadingAdjustmentCount: actionableAdjustments.filter((item) => item.delta < 0).length,
    },
  }
}
