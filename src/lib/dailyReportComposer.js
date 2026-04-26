function normalizeText(value) {
  return String(value || '').trim()
}

function firstSentence(value, fallback = '今日資料整理中，先維持既有計畫。') {
  const text = normalizeText(value).replace(/\s+/g, ' ')
  if (!text) return fallback
  return text.split(/。|\n/).find(Boolean)?.slice(0, 90) || fallback
}

function normalizeReportDate(report) {
  return normalizeText(report?.date || report?.marketDate || report?.createdAt).replace(/-/g, '/')
}

function deriveHoldingAction(change = {}) {
  const pct = Number(change?.changePct)
  const pnl = Number(change?.todayPnl)
  if (Number.isFinite(pct) && pct <= -4) return '減碼'
  if (Number.isFinite(pct) && pct >= 5) return '觀察'
  if (Number.isFinite(pnl) && pnl < 0) return '續抱'
  if (Number.isFinite(pct) && pct > 0) return '續抱'
  return '觀察'
}

export function composeDailyReportRitual({
  dailyReport = null,
  analysisHistory = [],
  selectedDate = '',
} = {}) {
  const history = Array.isArray(analysisHistory) ? analysisHistory : []
  const archive = [dailyReport, ...history]
    .filter(Boolean)
    .map((report) => ({
      id: report.id || `${normalizeReportDate(report)}-${report.time || ''}`,
      date: normalizeReportDate(report),
      time: normalizeText(report.time),
      stage: normalizeText(report.analysisStageLabel || report.analysisStage),
      report,
    }))
    .filter(
      (item, index, rows) => item.date && rows.findIndex((row) => row.date === item.date) === index
    )
    .slice(0, 7)

  const selectedReport =
    archive.find((item) => item.date === selectedDate)?.report ||
    dailyReport ||
    archive[0]?.report ||
    null
  const insight = normalizeText(selectedReport?.aiInsight || selectedReport?.insight)
  const hasInsight = Boolean(insight)
  const changes = Array.isArray(selectedReport?.changes) ? selectedReport.changes : []
  const eventText = firstSentence(
    selectedReport?.eventSummary ||
      selectedReport?.eventInsight ||
      selectedReport?.eventCorrelations?.[0]?.summary ||
      selectedReport?.eventAssessments?.[0]?.summary ||
      selectedReport?.eventAssessments?.[0]?.assessment,
    '今天事件面先看已驗證催化是否延續。'
  )
  const riskText = firstSentence(
    selectedReport?.riskSummary ||
      selectedReport?.riskInsight ||
      selectedReport?.anomalies?.[0]?.reason ||
      selectedReport?.needsReview?.[0]?.reason,
    '風險面先看集中度、回撤與未確認事件。'
  )
  const fundamentalText = firstSentence(
    selectedReport?.fundamentalSummary || selectedReport?.fundamentalInsight || insight,
    '基本面等待營收、財報或法說資料補齊。'
  )

  const hitRows = history.slice(0, 30).map((report, index) => {
    const assessments = Array.isArray(report?.eventAssessments) ? report.eventAssessments : []
    const scored = assessments.filter((item) => item.correct === true || item.correct === false)
    const hits = scored.filter((item) => item.correct === true).length
    const rate = scored.length
      ? Math.round((hits / scored.length) * 100)
      : Number(report?.hitRate) || 0
    return {
      label: normalizeReportDate(report).slice(5) || `${index + 1}`,
      rate,
    }
  })

  return {
    report: selectedReport,
    hero: {
      date: normalizeReportDate(selectedReport),
      time: normalizeText(selectedReport?.time),
      text: hasInsight ? insight : '等明早 08:30（台北時間）資料補齊後再產生收盤摘要。',
      waiting: !hasInsight,
    },
    pillars: [
      { key: 'fundamental', title: '基本面', body: fundamentalText },
      { key: 'event', title: '事件', body: eventText },
      { key: 'risk', title: '風險', body: riskText },
    ],
    holdingActions: changes.map((change) => ({
      code: normalizeText(change.code),
      name: normalizeText(change.name || change.code),
      action: normalizeText(change.action) || deriveHoldingAction(change),
      reason: firstSentence(
        change.reason || change.summary || change.note,
        Number.isFinite(Number(change.changePct))
          ? `今日漲跌 ${Number(change.changePct).toFixed(1)}%，先照原計畫檢查。`
          : '今天先照原計畫檢查。'
      ),
    })),
    archive,
    hitRows,
    copyText: [
      `收盤摘要 ${normalizeReportDate(selectedReport)}`,
      hasInsight ? insight : '等明早 08:30（台北時間）資料補齊。',
      `基本面：${fundamentalText}`,
      `事件：${eventText}`,
      `風險：${riskText}`,
    ].join('\n'),
  }
}
