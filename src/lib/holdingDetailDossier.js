import {
  computeFreshnessGrade,
  parseFlexibleDate,
  TARGETS_FRESHNESS_THRESHOLDS,
} from './dateUtils.js'
import { getEventStockCodes } from './eventUtils.js'
import { inferEventType } from './eventTypeMeta.js'

function toFiniteNumber(value) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeCode(value) {
  return String(value || '').trim()
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactText(value, limit = 160) {
  const text = normalizeText(value)
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function sortByDateDesc(rows = [], resolver = (row) => row?.date) {
  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    const leftDate = parseFlexibleDate(resolver(left))
    const rightDate = parseFlexibleDate(resolver(right))
    const dateDiff = (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0)
    if (dateDiff !== 0) return dateDiff
    return (Number(right?.priority) || 0) - (Number(left?.priority) || 0)
  })
}

function getDisplayName({ holding = null, dossier = null, code = '' } = {}) {
  return (
    normalizeText(holding?.name) ||
    normalizeText(dossier?.name) ||
    normalizeText(dossier?.displayName) ||
    code
  )
}

function getHoldingPosition(holding = null, dossier = null, code = '', displayName = '') {
  const fallbackPosition =
    dossier?.position && typeof dossier.position === 'object' ? dossier.position : null
  return {
    ...(fallbackPosition || {}),
    ...(holding && typeof holding === 'object' ? holding : {}),
    code: normalizeCode(holding?.code || fallbackPosition?.code || code),
    name: normalizeText(holding?.name || fallbackPosition?.name || displayName),
  }
}

function getThesisText(thesis = null) {
  return normalizeText(
    thesis?.statement ||
      thesis?.reason ||
      thesis?.summary ||
      thesis?.text ||
      thesis?.expectation ||
      ''
  )
}

export function normalizeHoldingDetailPillarStatus(value) {
  const normalized = normalizeText(value).toLowerCase()
  if (['broken', 'invalidated'].includes(normalized)) return 'broken'
  if (['watch', 'behind', 'weakened'].includes(normalized)) return 'wobbly'
  return 'intact'
}

function buildThesisSlice(thesis = null) {
  if (!thesis || typeof thesis !== 'object') return null

  const text = getThesisText(thesis)
  const pillars = (Array.isArray(thesis?.pillars) ? thesis.pillars : [])
    .map((pillar, index) => ({
      id: normalizeText(pillar?.id) || `pillar-${index}`,
      label: normalizeText(pillar?.label || pillar?.name || pillar?.text),
      status: normalizeHoldingDetailPillarStatus(pillar?.status),
      trend: normalizeText(pillar?.trend),
      lastChecked: normalizeText(pillar?.lastChecked) || null,
    }))
    .filter((pillar) => pillar.label)

  if (!text && pillars.length === 0) return null

  const updateCandidates = [
    thesis?.updatedAt,
    thesis?.lastReviewedAt,
    thesis?.createdAt,
    ...(Array.isArray(thesis?.updateLog) ? thesis.updateLog.map((item) => item?.date) : []),
    ...pillars.map((pillar) => pillar.lastChecked),
  ]

  const updatedAt = sortByDateDesc(updateCandidates.filter(Boolean).map((date) => ({ date })))[0]
    ?.date

  return {
    text: text || '',
    pillars,
    updatedAt: normalizeText(updatedAt) || null,
  }
}

function derivePillarStatus(thesis = null) {
  const pillars = Array.isArray(thesis?.pillars) ? thesis.pillars : []
  if (pillars.some((pillar) => normalizeHoldingDetailPillarStatus(pillar?.status) === 'broken')) {
    return 'broken'
  }
  if (pillars.some((pillar) => normalizeHoldingDetailPillarStatus(pillar?.status) === 'wobbly')) {
    return 'wobbly'
  }
  return 'intact'
}

function resolveCurrentPrice(position = {}, dossier = null) {
  return (
    toFiniteNumber(position?.price) ??
    toFiniteNumber(position?.currentPrice) ??
    toFiniteNumber(dossier?.position?.price) ??
    toFiniteNumber(dossier?.currentPrice) ??
    null
  )
}

function buildTargetSnapshot(dossier = null) {
  const targets = Array.isArray(dossier?.targets) ? dossier.targets : []
  const aggregate =
    dossier?.targetAggregate && typeof dossier.targetAggregate === 'object'
      ? dossier.targetAggregate
      : null

  if (targets.length > 0) {
    const rows = sortByDateDesc(targets, (row) => row?.date)
    const latest = rows[0]
    return {
      targetPrice: toFiniteNumber(latest?.target),
      targetDate: normalizeText(latest?.date) || null,
      targetSource: normalizeText(latest?.firm || dossier?.targetSource) || null,
    }
  }

  if (aggregate) {
    return {
      targetPrice:
        toFiniteNumber(aggregate?.medianTarget) ??
        toFiniteNumber(aggregate?.meanTarget) ??
        toFiniteNumber(aggregate?.highTarget) ??
        toFiniteNumber(aggregate?.max) ??
        null,
      targetDate: normalizeText(aggregate?.rateDate) || null,
      targetSource: normalizeText(dossier?.targetSource || 'aggregate') || null,
    }
  }

  if (toFiniteNumber(dossier?.thesis?.targetPrice) != null) {
    return {
      targetPrice: toFiniteNumber(dossier?.thesis?.targetPrice),
      targetDate: normalizeText(dossier?.thesis?.updatedAt || dossier?.thesis?.createdAt) || null,
      targetSource: 'thesis',
    }
  }

  return {
    targetPrice: null,
    targetDate: null,
    targetSource: null,
  }
}

function buildValuationSlice(position = {}, dossier = null) {
  const valuation = Array.isArray(dossier?.finmind?.valuation) ? dossier.finmind.valuation[0] : null
  const target = buildTargetSnapshot(dossier)

  const lowerBound =
    toFiniteNumber(dossier?.targetAggregate?.lowerBound) ??
    toFiniteNumber(valuation?.lowerBound) ??
    null
  const upperBound =
    toFiniteNumber(dossier?.targetAggregate?.upperBound) ??
    toFiniteNumber(valuation?.upperBound) ??
    null

  return {
    currentPrice: resolveCurrentPrice(position, dossier),
    pe: toFiniteNumber(valuation?.per),
    pbr: toFiniteNumber(valuation?.pbr),
    dividendYield: toFiniteNumber(valuation?.dividendYield),
    peBand:
      lowerBound != null || upperBound != null
        ? {
            lower: lowerBound,
            upper: upperBound,
          }
        : null,
    targetPrice: target.targetPrice,
    targetDate: target.targetDate,
    targetSource: target.targetSource,
  }
}

function entryMentionsStock(entry = null, code = '', displayName = '') {
  const haystack = normalizeText(
    [
      entry?.code,
      entry?.stockId,
      entry?.name,
      entry?.title,
      entry?.headline,
      entry?.summary,
      entry?.note,
      entry?.label,
      entry?.text,
    ]
      .filter(Boolean)
      .join(' ')
  )
  if (!haystack) return false
  return haystack.includes(code) || (displayName ? haystack.includes(displayName) : false)
}

function buildChangeMention(change = null) {
  if (!change || typeof change !== 'object') return ''
  const changePct = toFiniteNumber(change?.changePct)
  const price = toFiniteNumber(change?.price)
  const todayPnl = toFiniteNumber(change?.todayPnl)
  const parts = []
  if (price != null) parts.push(`收盤 ${price}`)
  if (changePct != null) parts.push(`日變動 ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`)
  if (todayPnl != null) parts.push(`日損益 ${todayPnl >= 0 ? '+' : ''}${Math.round(todayPnl)}`)
  return parts.join(' · ')
}

function buildDailyMentionFromReport(report = null, code = '', displayName = '') {
  if (!report || typeof report !== 'object') return null

  const parts = []
  const changeMatch = (Array.isArray(report?.changes) ? report.changes : []).find(
    (change) => normalizeCode(change?.code) === code
  )
  if (changeMatch) {
    parts.push(buildChangeMention(changeMatch))
  }

  ;['eventAssessments', 'needsReview', 'anomalies'].forEach((key) => {
    ;(Array.isArray(report?.[key]) ? report[key] : [])
      .filter((entry) => entryMentionsStock(entry, code, displayName))
      .slice(0, 2)
      .forEach((entry) => {
        const text = compactText(entry?.summary || entry?.title || entry?.note, 120)
        if (text) parts.push(text)
      })
  })

  const insight = normalizeText(report?.aiInsight || report?.insight)
  if (insight && (insight.includes(code) || (displayName && insight.includes(displayName)))) {
    parts.push(compactText(insight, 140))
  }

  const mention = parts.filter(Boolean).join(' / ')
  if (!mention) return null

  return {
    date: normalizeText(report?.date || report?.createdAt || report?.updatedAt) || null,
    reportStage:
      normalizeText(report?.analysisStageLabel || report?.analysisStage || report?.title) ||
      '收盤摘要',
    mention,
  }
}

function collectRecentDailyMentions({
  code = '',
  displayName = '',
  dailyReport = null,
  analysisHistory = [],
}) {
  const seenKeys = new Set()
  const reports = sortByDateDesc(
    [dailyReport, ...(Array.isArray(analysisHistory) ? analysisHistory : [])].filter(Boolean),
    (report) => report?.date || report?.createdAt || report?.updatedAt || report?.id
  )

  return reports
    .map((report) => {
      const key = `${normalizeText(report?.id) || ''}:${normalizeText(report?.date) || ''}:${normalizeText(report?.analysisStage) || ''}`
      if (seenKeys.has(key)) return null
      seenKeys.add(key)
      return buildDailyMentionFromReport(report, code, displayName)
    })
    .filter(Boolean)
    .slice(0, 3)
}

function getResearchDate(entry = null) {
  if (!entry || typeof entry !== 'object') return null
  if (entry?.date) return entry.date
  if (entry?.updatedAt) return entry.updatedAt
  if (entry?.createdAt) return entry.createdAt
  if (Number.isFinite(Number(entry?.timestamp)))
    return new Date(Number(entry.timestamp)).toISOString()
  return null
}

function getResearchSourceReportId(entry = null) {
  if (!entry || typeof entry !== 'object') return null
  return (
    normalizeText(entry?.sourceReportId) ||
    normalizeText(entry?.id) ||
    normalizeText(entry?.timestamp) ||
    null
  )
}

function buildResearchCandidates(history = [], code = '', displayName = '') {
  const rows = Array.isArray(history) ? history : []
  const candidates = []

  rows.forEach((entry) => {
    const date = getResearchDate(entry)
    const sourceReportId = getResearchSourceReportId(entry)
    const directMatch =
      normalizeCode(entry?.code) === code ||
      normalizeCode(entry?.stockId) === code ||
      entryMentionsStock(entry, code, displayName)

    if (directMatch) {
      const summary = compactText(entry?.summary || entry?.content || entry?.body, 180)
      if (summary) {
        candidates.push({
          date,
          headline:
            normalizeText(entry?.title || entry?.headline || entry?.name) || `${displayName} 研究`,
          summary,
          sourceReportId,
          priority: 1,
        })
      }
    }

    ;(Array.isArray(entry?.stockSummaries) ? entry.stockSummaries : [])
      .filter(
        (item) => normalizeCode(item?.code) === code || entryMentionsStock(item, code, displayName)
      )
      .forEach((item) => {
        const summary = compactText(item?.summary || entry?.summary, 180)
        if (!summary) return
        candidates.push({
          date,
          headline:
            normalizeText(item?.headline || item?.title || entry?.title || entry?.headline) ||
            `${displayName} 研究切片`,
          summary,
          sourceReportId,
          priority: 2,
        })
      })
  })

  return candidates
}

function getRuleLatestDate(rule = null) {
  const candidates = [
    rule?.lastValidatedAt,
    ...(Array.isArray(rule?.evidenceRefs) ? rule.evidenceRefs.map((ref) => ref?.date) : []),
  ]
  return sortByDateDesc(candidates.filter(Boolean).map((date) => ({ date })))[0]?.date || null
}

function buildStrategyBrainCandidate(strategyBrain = null, code = '', displayName = '') {
  if (!strategyBrain || typeof strategyBrain !== 'object') return null

  const rules = [
    ...(Array.isArray(strategyBrain?.rules) ? strategyBrain.rules : []),
    ...(Array.isArray(strategyBrain?.candidateRules) ? strategyBrain.candidateRules : []),
  ]

  const matchedRules = rules
    .filter((rule) => {
      const codes = Array.isArray(rule?.evidenceRefs)
        ? rule.evidenceRefs.map((ref) => normalizeCode(ref?.code)).filter(Boolean)
        : []
      if (codes.includes(code)) return true
      const text = normalizeText([rule?.text, rule?.scope, rule?.note].filter(Boolean).join(' '))
      return text.includes(code) || (displayName ? text.includes(displayName) : false)
    })
    .map((rule) => ({
      date: getRuleLatestDate(rule) || strategyBrain?.lastUpdate || null,
      headline: '策略腦最近脈絡',
      summary: compactText(rule?.text || rule?.note || strategyBrain?.evolution, 180),
      sourceReportId: normalizeText(rule?.id) || 'strategy-brain',
      priority: 1,
    }))
    .filter((item) => item.summary)

  if (matchedRules.length > 0) {
    return sortByDateDesc(matchedRules)[0]
  }

  const evolution = normalizeText(strategyBrain?.evolution)
  if (evolution && (evolution.includes(code) || (displayName && evolution.includes(displayName)))) {
    return {
      date: normalizeText(strategyBrain?.lastUpdate) || null,
      headline: '策略腦最近脈絡',
      summary: compactText(evolution, 180),
      sourceReportId: 'strategy-brain',
      priority: 1,
    }
  }

  return null
}

function buildLatestResearchSlice({
  code = '',
  displayName = '',
  researchHistory = [],
  strategyBrain = null,
}) {
  const candidates = buildResearchCandidates(researchHistory, code, displayName)
  if (candidates.length > 0) {
    return sortByDateDesc(candidates)[0]
  }
  return buildStrategyBrainCandidate(strategyBrain, code, displayName)
}

function compareRelatedEvents(left, right, today) {
  const leftDate = parseFlexibleDate(left?.date)
  const rightDate = parseFlexibleDate(right?.date)
  const leftFuture = leftDate ? leftDate.getTime() >= today.getTime() : false
  const rightFuture = rightDate ? rightDate.getTime() >= today.getTime() : false

  if (leftFuture !== rightFuture) return leftFuture ? -1 : 1
  if (leftFuture && rightFuture) return (leftDate?.getTime() || 0) - (rightDate?.getTime() || 0)
  return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0)
}

function buildRelatedEvents(code = '', newsEvents = []) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return [...(Array.isArray(newsEvents) ? newsEvents : [])]
    .filter((event) => getEventStockCodes(event).includes(code))
    .map((event) => ({
      type: inferEventType(event),
      date:
        normalizeText(
          event?.eventDate || event?.date || event?.trackingStart || event?.createdAt
        ) || null,
      label: normalizeText(event?.title || event?.detail || event?.description) || '事件更新',
      status: normalizeText(event?.status) || null,
    }))
    .sort((left, right) => compareRelatedEvents(left, right, today))
    .slice(0, 5)
}

function resolveInstitutionalRowTotal(row = {}) {
  const explicit = toFiniteNumber(row?.total)
  if (explicit != null) return explicit

  const foreign = toFiniteNumber(row?.foreign) ?? toFiniteNumber(row?.foreignInvestor) ?? 0
  const investment =
    toFiniteNumber(row?.investment) ??
    toFiniteNumber(row?.investmentTrust) ??
    toFiniteNumber(row?.trust) ??
    0
  const dealer = toFiniteNumber(row?.dealer) ?? 0
  return foreign + investment + dealer
}

function buildInstitutionalFlow(dossier = null) {
  const rows = Array.isArray(dossier?.finmind?.institutional) ? dossier.finmind.institutional : []
  if (rows.length === 0) return null

  const recentRows = rows.slice(0, 5)
  const series = recentRows
    .map((row) => ({
      date: normalizeText(row?.date || row?.tradeDate || row?.Date) || null,
      value: resolveInstitutionalRowTotal(row),
    }))
    .filter((row) => row.date)
    .reverse()

  if (series.length === 0) return null

  return {
    lastUpdated: series[series.length - 1]?.date || null,
    total5d: series.reduce((sum, row) => sum + (row.value || 0), 0),
    series,
  }
}

function buildFreshness({
  dossier = null,
  recentDailyMentions = [],
  latestResearchSlice = null,
  relatedEvents = [],
}) {
  const targetsDate =
    buildTargetSnapshot(dossier).targetDate || normalizeText(dossier?.targets?.updatedAt) || null
  const fundamentalsDate = normalizeText(dossier?.fundamentals?.updatedAt) || null
  const researchDate = normalizeText(latestResearchSlice?.date) || null
  const dailyDate = normalizeText(recentDailyMentions?.[0]?.date) || null
  const eventsDate = normalizeText(relatedEvents?.[0]?.date) || null

  return {
    targets: targetsDate,
    fundamentals: fundamentalsDate,
    research: researchDate,
    daily: dailyDate,
    events: eventsDate,
    statuses: {
      targets:
        normalizeText(dossier?.freshness?.targets) ||
        computeFreshnessGrade(targetsDate ? [targetsDate] : [], {
          thresholds: TARGETS_FRESHNESS_THRESHOLDS,
        }),
      fundamentals:
        normalizeText(dossier?.freshness?.fundamentals) ||
        computeFreshnessGrade(fundamentalsDate ? [fundamentalsDate] : []),
      research: computeFreshnessGrade(researchDate ? [researchDate] : [], {
        thresholds: { fresh: 14, aging: 45 },
      }),
      daily: computeFreshnessGrade(dailyDate ? [dailyDate] : [], {
        thresholds: { fresh: 3, aging: 7 },
      }),
      events: computeFreshnessGrade(eventsDate ? [eventsDate] : [], {
        thresholds: { fresh: 7, aging: 30 },
      }),
    },
  }
}

export function buildHoldingDetailDossier({
  code = '',
  holdings = [],
  holdingDossiers = [],
  dailyReport = null,
  analysisHistory = [],
  researchHistory = [],
  newsEvents = [],
  strategyBrain = null,
} = {}) {
  const normalizedCode = normalizeCode(code)
  if (!normalizedCode) return null

  const holding =
    (Array.isArray(holdings) ? holdings : []).find(
      (item) => normalizeCode(item?.code) === normalizedCode
    ) || null
  const dossier =
    (Array.isArray(holdingDossiers) ? holdingDossiers : []).find(
      (item) => normalizeCode(item?.code) === normalizedCode
    ) || null

  if (!holding && !dossier) return null

  const displayName = getDisplayName({ holding, dossier, code: normalizedCode })
  const position = getHoldingPosition(holding, dossier, normalizedCode, displayName)
  const thesis = buildThesisSlice(dossier?.thesis)
  const recentDailyMentions = collectRecentDailyMentions({
    code: normalizedCode,
    displayName,
    dailyReport,
    analysisHistory,
  })
  const latestResearchSlice = buildLatestResearchSlice({
    code: normalizedCode,
    displayName,
    researchHistory,
    strategyBrain,
  })
  const relatedEvents = buildRelatedEvents(normalizedCode, newsEvents)

  return {
    code: normalizedCode,
    displayName,
    position,
    thesis,
    pillarStatus: derivePillarStatus(dossier?.thesis),
    valuation: buildValuationSlice(position, dossier),
    freshness: buildFreshness({
      dossier,
      recentDailyMentions,
      latestResearchSlice,
      relatedEvents,
    }),
    recentDailyMentions,
    latestResearchSlice,
    relatedEvents,
    institutionalFlow: buildInstitutionalFlow(dossier),
  }
}

export default buildHoldingDetailDossier
