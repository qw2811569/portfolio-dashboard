import { normalizeAnalysisHistoryEntries, normalizeDailyReportEntry } from './reportUtils.js'

function normalizeText(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCodeList(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean)
    )
  ).sort()
}

function sameList(a = [], b = []) {
  if (a.length !== b.length) return false
  return a.every((item, index) => item === b[index])
}

function formatStageLabel(report) {
  if (!report) return '未知版本'
  const stageLabel = String(report.analysisStageLabel || '').trim() || '既有版本'
  const version = Math.max(1, Number(report.analysisVersion) || 1)
  const time = String(report.time || '').trim()
  return [stageLabel, `v${version}`, time].filter(Boolean).join(' · ')
}

function sortCandidates(a, b) {
  const versionDiff = (Number(b?.analysisVersion) || 1) - (Number(a?.analysisVersion) || 1)
  if (versionDiff !== 0) return versionDiff
  return (Number(b?.id) || 0) - (Number(a?.id) || 0)
}

function buildRerunReasonLabel(report = null) {
  const rerunReason = String(report?.rerunReason || '').trim()

  if (rerunReason === 'finmind-confirmed') return '因收盤後資料確認而補跑'
  if (rerunReason === 'finmind-auto-confirmed') return '因 FinMind 日終資料齊全而自動補跑'
  if (rerunReason === 'manual-rerun') return '因同日手動重新分析而更新'
  return '因同日版本升級而重新比對'
}

function collectSameDayReports({ currentReport, analysisHistory = [] } = {}) {
  const normalizedCurrent = normalizeDailyReportEntry(currentReport)
  const currentDate = String(normalizedCurrent?.date || '').trim()
  if (!currentDate) return []

  return normalizeAnalysisHistoryEntries([
    normalizedCurrent,
    ...(Array.isArray(analysisHistory) ? analysisHistory : []),
  ]).filter((entry) => String(entry?.date || '').trim() === currentDate)
}

function resolveSameDayDiffPair({ currentReport, analysisHistory = [] } = {}) {
  const candidates = collectSameDayReports({ currentReport, analysisHistory }).sort(sortCandidates)
  const latestReport = candidates[0] || null
  if (!latestReport) return { currentReport: null, previousReport: null }

  const previousReport =
    findPreviousSameDayReport({
      currentReport: latestReport,
      analysisHistory: candidates,
    }) ||
    candidates.find((entry) => entry !== latestReport) ||
    null

  if (!previousReport) return { currentReport: null, previousReport: null }

  return {
    currentReport: latestReport,
    previousReport,
  }
}

export function findPreviousSameDayReport({ currentReport, analysisHistory = [] } = {}) {
  const normalizedCurrent = normalizeDailyReportEntry(currentReport)
  const currentDate = String(normalizedCurrent?.date || '').trim()
  if (!currentDate) return null

  const currentId = Number(normalizedCurrent?.id) || 0
  const currentVersion = Math.max(1, Number(normalizedCurrent?.analysisVersion) || 1)

  const candidates = collectSameDayReports({
    currentReport: normalizedCurrent,
    analysisHistory,
  })
    .filter((entry) => {
      if (!entry) return false
      const entryId = Number(entry?.id) || 0
      const entryVersion = Math.max(1, Number(entry?.analysisVersion) || 1)
      return entryId !== currentId || entryVersion !== currentVersion
    })
    .sort(sortCandidates)

  const previousVersion = candidates.find(
    (entry) => Math.max(1, Number(entry?.analysisVersion) || 1) < currentVersion
  )

  return previousVersion || candidates[0] || null
}

export function buildSameDayDailyReportDiff({ currentReport, analysisHistory = [] } = {}) {
  const { currentReport: resolvedCurrentReport, previousReport } = resolveSameDayDiffPair({
    currentReport,
    analysisHistory,
  })

  if (!resolvedCurrentReport || !previousReport) return null

  const currentStageLabel = formatStageLabel(resolvedCurrentReport)
  const previousStageLabel = formatStageLabel(previousReport)
  const currentPendingCodes = normalizeCodeList(
    resolvedCurrentReport?.finmindConfirmation?.pendingCodes
  )
  const previousPendingCodes = normalizeCodeList(previousReport?.finmindConfirmation?.pendingCodes)
  const currentInsight = normalizeText(resolvedCurrentReport?.aiInsight)
  const previousInsight = normalizeText(previousReport?.aiInsight)
  const rerunReasonLabel = buildRerunReasonLabel(resolvedCurrentReport)

  const changes = []
  const pushChange = ({ key, label, previous, current, format = 'text' }) => {
    changes.push({
      key,
      label,
      field: label,
      previous,
      current,
      t0Value: previous,
      t1Value: current,
      format,
      rerunReason: rerunReasonLabel,
    })
  }

  if (currentInsight !== previousInsight) {
    pushChange({
      key: 'insight',
      label: 'AI 總結',
      previous: String(previousReport?.aiInsight || '').trim() || '無',
      current: String(resolvedCurrentReport?.aiInsight || '').trim() || '無',
      format: 'markdown',
    })
  }

  const currentFinmindCount = Number(resolvedCurrentReport?.finmindDataCount) || 0
  const previousFinmindCount = Number(previousReport?.finmindDataCount) || 0
  if (currentFinmindCount !== previousFinmindCount) {
    pushChange({
      key: 'finmindDataCount',
      label: 'FinMind 數據筆數',
      previous: String(previousFinmindCount),
      current: String(currentFinmindCount),
      format: 'text',
    })
  }

  if (!sameList(currentPendingCodes, previousPendingCodes)) {
    pushChange({
      key: 'pendingCodes',
      label: '待確認標的',
      previous: previousPendingCodes.length > 0 ? previousPendingCodes.join('、') : '無',
      current: currentPendingCodes.length > 0 ? currentPendingCodes.join('、') : '無',
      format: 'text',
    })
  }

  const countComparisons = [
    ['needsReview', '待復盤事件'],
    ['anomalies', '異常提醒'],
    ['eventAssessments', '事件判讀'],
  ]

  countComparisons.forEach(([field, label]) => {
    const previousCount = Array.isArray(previousReport?.[field]) ? previousReport[field].length : 0
    const currentCount = Array.isArray(resolvedCurrentReport?.[field])
      ? resolvedCurrentReport[field].length
      : 0
    if (previousCount !== currentCount) {
      pushChange({
        key: `${field}Count`,
        label,
        previous: String(previousCount),
        current: String(currentCount),
        format: 'text',
      })
    }
  })

  const previousPnl = Number(previousReport?.totalTodayPnl)
  const currentPnl = Number(resolvedCurrentReport?.totalTodayPnl)
  if (Number.isFinite(previousPnl) && Number.isFinite(currentPnl) && previousPnl !== currentPnl) {
    pushChange({
      key: 'totalTodayPnl',
      label: '今日損益',
      previous: `${previousPnl >= 0 ? '+' : ''}${previousPnl.toLocaleString()}`,
      current: `${currentPnl >= 0 ? '+' : ''}${currentPnl.toLocaleString()}`,
      format: 'text',
    })
  }

  const summary =
    changes.length > 0
      ? `同日已從 ${previousStageLabel} 升級到 ${currentStageLabel}，共有 ${changes.length} 項可感知更新。`
      : `同日已從 ${previousStageLabel} 升級到 ${currentStageLabel}，但目前沒有偵測到實質差異。`

  return {
    currentReport: resolvedCurrentReport,
    previousReport,
    currentStageLabel,
    previousStageLabel,
    changes,
    changeCount: changes.length,
    summary,
    rerunReason: resolvedCurrentReport?.rerunReason || null,
    rerunReasonLabel,
    stageChanged: currentStageLabel !== previousStageLabel,
  }
}
