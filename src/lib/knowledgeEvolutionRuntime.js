import chipAnalysis from './knowledge-base/chip-analysis.json' with { type: 'json' }
import technicalAnalysis from './knowledge-base/technical-analysis.json' with { type: 'json' }
import industryTrends from './knowledge-base/industry-trends.json' with { type: 'json' }
import fundamentalAnalysis from './knowledge-base/fundamental-analysis.json' with { type: 'json' }
import riskManagement from './knowledge-base/risk-management.json' with { type: 'json' }
import strategyCases from './knowledge-base/strategy-cases.json' with { type: 'json' }
import newsCorrelation from './knowledge-base/news-correlation.json' with { type: 'json' }

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

function writeStorageArray(storage, key, rows, limit = 500) {
  try {
    if (!storage?.setItem) return []
    const normalized = Array.isArray(rows) ? rows.slice(-limit) : []
    storage.setItem(key, JSON.stringify(normalized))
    return normalized
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
            new Set(entry.itemIds.map((itemId) => String(itemId || '').trim()).filter(Boolean))
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

export function readKnowledgeEvolutionLogs(storage = null) {
  const targetStorage = resolveStorage(storage)
  return {
    usageLog: normalizeKnowledgeUsageLog(readStorageArray(targetStorage, 'kb-usage-log', 500)),
    feedbackLog: normalizeKnowledgeFeedbackLog(
      readStorageArray(targetStorage, 'kb-feedback-log', 200)
    ),
    observationLog: readStorageArray(targetStorage, 'kb-observation-log', 500),
    evolutionLog: readStorageArray(targetStorage, 'kb-evolution-log', 500),
  }
}

export function logAnalysisObservation(params = {}, storage = null) {
  const targetStorage = resolveStorage(storage)
  const current = readStorageArray(targetStorage, 'kb-observation-log', 500)
  const entry = {
    ruleIds: Array.from(
      new Set((params.ruleIds || []).map((id) => String(id || '').trim()).filter(Boolean))
    ),
    stockCode: String(params.stockCode || '').trim(),
    date: String(params.date || '').trim() || null,
    outcome: String(params.outcome || '').trim() || 'neutral',
    evidenceRefs: Array.isArray(params.evidenceRefs) ? params.evidenceRefs : [],
    timestamp: Number(params.timestamp) || Date.now(),
  }
  if (entry.ruleIds.length === 0) return current
  return writeStorageArray(targetStorage, 'kb-observation-log', [...current, entry], 500)
}

export function scoreKnowledgeRuleOutcomes(observations = [], { now = Date.now() } = {}) {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const byRule = new Map()

  ;(Array.isArray(observations) ? observations : []).forEach((observation) => {
    const outcome = String(observation?.outcome || '').trim()
    const isPositive = ['positive', 'correct', 'helpful', 'up'].includes(outcome)
    const isNegative = ['negative', 'wrong', 'misleading', 'down'].includes(outcome)
    ;(Array.isArray(observation?.ruleIds) ? observation.ruleIds : []).forEach((ruleId) => {
      const current = byRule.get(ruleId) || {
        ruleId,
        hitCount: 0,
        positiveCount: 0,
        negativeCount: 0,
        lastUsedAt: 0,
      }
      current.hitCount += 1
      if (isPositive) current.positiveCount += 1
      if (isNegative) current.negativeCount += 1
      current.lastUsedAt = Math.max(current.lastUsedAt, Number(observation?.timestamp) || 0)
      byRule.set(ruleId, current)
    })
  })

  return Array.from(byRule.values()).map((item) => {
    const positiveRate = item.hitCount > 0 ? item.positiveCount / item.hitCount : 0
    let suggestedConfidenceChange = 0
    const reasons = []

    if (positiveRate > 0.7) {
      suggestedConfidenceChange += 0.02
      reasons.push('正面率 > 70%')
    } else if (positiveRate < 0.3) {
      suggestedConfidenceChange -= 0.03
      reasons.push('正面率 < 30%')
    }

    if (item.lastUsedAt > 0 && now - item.lastUsedAt > THIRTY_DAYS_MS) {
      suggestedConfidenceChange -= 0.01
      reasons.push('未使用 > 30 天')
    }

    if (suggestedConfidenceChange > 0.05) suggestedConfidenceChange = 0.05
    if (suggestedConfidenceChange < -0.05) suggestedConfidenceChange = -0.05

    return {
      ruleId: item.ruleId,
      hitCount: item.hitCount,
      positiveRate: Math.round(positiveRate * 10000) / 10000,
      suggestedConfidenceChange: roundDelta(suggestedConfidenceChange),
      lastUsedAt: item.lastUsedAt,
      reason: reasons.join('；'),
    }
  })
}

export function applyKnowledgeConfidenceAdjustments(scores = [], { storage = null } = {}) {
  const catalog = buildKnowledgeCatalog()
  const catalogById = new Map(catalog.map((item) => [item.id, item]))
  const applied = (Array.isArray(scores) ? scores : [])
    .map((score) => {
      const current = catalogById.get(score.ruleId)
      if (!current || !score.suggestedConfidenceChange) return null
      const nextConfidence = clampConfidence(
        current.confidence + Number(score.suggestedConfidenceChange || 0),
        0.5,
        0.95
      )
      return {
        ruleId: score.ruleId,
        sourceKey: current.sourceKey,
        fromConfidence: current.confidence,
        toConfidence: nextConfidence,
        delta: roundDelta(nextConfidence - current.confidence),
        reason: score.reason || '',
      }
    })
    .filter(Boolean)

  const targetStorage = resolveStorage(storage)
  const evolutionLog = readStorageArray(targetStorage, 'kb-evolution-log', 500)
  writeStorageArray(
    targetStorage,
    'kb-evolution-log',
    [...evolutionLog, ...applied.map((item) => ({ ...item, timestamp: Date.now() }))],
    500
  )

  return applied
}

export function buildKnowledgeEvolutionProposal({
  usageLog = [],
  feedbackLog = [],
  maxAdjustments = 12,
  now = Date.now(),
} = {}) {
  const catalog = buildKnowledgeCatalogMap()
  const normalizedUsageLog = normalizeKnowledgeUsageLog(usageLog)
  const normalizedFeedbackLog = normalizeKnowledgeFeedbackLog(feedbackLog)
  const usageCountById = new Map()
  const lastUsedAtById = new Map()
  const feedbackStatsById = new Map()
  let feedbackMissingLinkCount = 0
  let ignoredFeedbackIdCount = 0

  normalizedUsageLog.forEach((entry) => {
    entry.itemIds.forEach((itemId) => {
      if (!catalog.has(itemId)) return
      usageCountById.set(itemId, (usageCountById.get(itemId) || 0) + 1)
      const timestamp = Number(entry.timestamp) || 0
      if (timestamp > (lastUsedAtById.get(itemId) || 0)) {
        lastUsedAtById.set(itemId, timestamp)
      }
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

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const allItemIds = new Set([...usageCountById.keys(), ...feedbackStatsById.keys()])

  const confidenceAdjustments = Array.from(allItemIds)
    .map((itemId) => {
      const item = catalog.get(itemId)
      if (!item) return null

      const helpfulCount = feedbackStatsById.get(itemId)?.helpful || 0
      const misleadingCount = feedbackStatsById.get(itemId)?.misleading || 0
      const usageCount = usageCountById.get(itemId) || 0
      const lastUsedAt = lastUsedAtById.get(itemId) || 0
      const unusedTooLong = lastUsedAt > 0 && now - lastUsedAt > THIRTY_DAYS_MS

      let targetConfidence = item.confidence
      const reasons = []
      let statusAction = 'keep'

      if (helpfulCount > misleadingCount) {
        targetConfidence = clampConfidence(targetConfidence + 0.02, 0.5, 0.95)
        reasons.push(`正面回饋 ${helpfulCount} 次，高於負面 ${misleadingCount} 次`)
        statusAction = 'reinforce'
      } else if (misleadingCount > helpfulCount) {
        targetConfidence = clampConfidence(targetConfidence - 0.03, 0.5, 0.95)
        reasons.push(`負面回饋 ${misleadingCount} 次，高於正面 ${helpfulCount} 次`)
        statusAction = 'pending-review'
      }

      if (unusedTooLong) {
        targetConfidence = clampConfidence(targetConfidence - 0.01, 0.5, 0.95)
        reasons.push('超過 30 天未使用')
        if (statusAction === 'keep') statusAction = 'cooldown'
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
        lastUsedAt,
        statusAction,
        reason: reasons.join('；'),
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
    issues.push(
      `confidence 調整 ${confidenceAdjustments.length} 筆，超過單次 ${maxAdjustments} 筆上限`
    )
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
