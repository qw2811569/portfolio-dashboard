const ACCURACY_GATE_HEADLINE = '這段分析暫時不給 · 為避免幻覺'
const LONG_RETRY_BACKOFF_MS = 5 * 60 * 1000

const INSIDER_ACTION_CUE =
  /(操作建議|買賣策略|買進|買入|賣出|加碼|減碼|停損|出場|持倉調整|資金調度|最需要行動|布局|佈局|續抱|\bbuy\b|\bsell\b|\btrim\b|\bexit\b|\baccumulate\b|\brebalance\b|\baction\b|\blong\b|\bshort\b)/iu

const REASON_LABELS = {
  'stale-data': '資料還在補齊',
  'fundamentals-incomplete': '財報 / 營收未齊',
  'insider-compliance': '合規邊界',
  'prompt-injection-detected': '輸入安全檢查',
  'quota-exceeded': '模型額度',
  'api-timeout': '分析逾時',
  'analysis-unavailable': '分析暫停',
}

const RESOURCE_LABELS = {
  daily: '收盤分析',
  research: '深度研究',
  thesis: '投資 thesis',
  dashboard: '首頁 headline',
}

function toText(value) {
  return String(value || '').trim()
}

function formatSlashDate(value) {
  const normalized = toText(value).replace(/-/g, '/').slice(0, 10)
  return /^\d{4}\/\d{2}\/\d{2}$/.test(normalized) ? normalized : ''
}

function formatRetryAt(value) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''

  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
}

function readPendingCount(context = {}) {
  if (Number.isFinite(Number(context.pendingCount)))
    return Math.max(0, Number(context.pendingCount))
  if (Array.isArray(context.pendingCodes)) return context.pendingCodes.filter(Boolean).length
  return 0
}

function buildDailyStaleBody(context = {}) {
  const marketDate = formatSlashDate(context.expectedMarketDate || context.date)
  const pendingCount = readPendingCount(context)
  const baseLead = marketDate ? `${marketDate} 這輪先停在收盤快版` : '這輪先停在收盤快版'
  const pendingDetail =
    pendingCount > 0
      ? `，還有 ${pendingCount} 檔在等 FinMind 收盤後資料`
      : '，FinMind 收盤後資料還沒完全到齊'
  const retryAt = formatRetryAt(context.nextRetryAt)
  const retryNote =
    context.retryCoolingDown && retryAt
      ? ` 這段時間先讓資料往前跑，${retryAt} 之後再看會比較完整。`
      : context.retryCoolingDown
        ? ' 這段時間先讓資料往前跑，我先不把同一段再硬算一次。'
        : ''
  return `${baseLead}${pendingDetail}。我先不把結論講滿，等資料補齊再回來看。${retryNote}`.trim()
}

function buildResearchFundamentalsBody(context = {}) {
  const stockLabel =
    context.name && context.code
      ? `${context.name} (${context.code})`
      : context.name || context.code || '這檔'
  const hasTargetGap = toText(context.targetStatus) && toText(context.targetStatus) !== '已補'
  const targetNote = hasTargetGap ? '，目標價欄位也還在補' : ''
  return `${stockLabel} 這輪先停在這裡，財報 / 營收欄位還沒補齊${targetNote}。我先不把 thesis 硬湊完整，等資料回來再看。`
}

function buildDashboardBody(reason, context = {}) {
  const holdingCount = Math.max(0, Number(context.holdingCount) || 0)
  const lead =
    holdingCount > 0 ? `目前有 ${holdingCount} 檔持倉的首頁依據還沒站穩` : '首頁依據還沒站穩'
  if (reason === 'fundamentals-incomplete') {
    return `${lead}，財報 / 營收欄位還在補齊。我先不把首頁 headline 講滿，等資料回來再看。`
  }
  return `${lead}，價格或研究資料還有點舊。我先不把首頁 headline 講滿，等更新後再回來看。`
}

export function containsInsiderActionCue(value = '') {
  return INSIDER_ACTION_CUE.test(toText(value))
}

export function classifyAccuracyGateReasonFromError(value = '') {
  const text = toText(value)
  if (!text) return 'analysis-unavailable'
  if (/prompt-injection|blocked prompt-injection|不安全/i.test(text)) {
    return 'prompt-injection-detected'
  }
  if (/quota|rate limit|429|resource exhausted|too many requests/i.test(text)) {
    return 'quota-exceeded'
  }
  if (/timeout|timed out|逾時/i.test(text)) {
    return 'api-timeout'
  }
  return 'analysis-unavailable'
}

export function shouldDisableAccuracyGateRetry(context = {}) {
  if (context.retryDisabled === true) return true
  const nextRetryAt = Number(context.nextRetryAt)
  if (!Number.isFinite(nextRetryAt) || nextRetryAt <= 0) return false
  return nextRetryAt - Date.now() > LONG_RETRY_BACKOFF_MS
}

export function buildAccuracyGateBlockModel({ reason = '', resource = '', context = {} } = {}) {
  const normalizedReason = REASON_LABELS[reason] ? reason : 'analysis-unavailable'
  const normalizedResource = RESOURCE_LABELS[resource] ? resource : 'thesis'

  let body = '這輪資料還沒整理到可以安心下結論的程度，我先停在這裡。'

  if (normalizedReason === 'stale-data' && normalizedResource === 'daily') {
    body = buildDailyStaleBody(context)
  } else if (
    normalizedReason === 'fundamentals-incomplete' &&
    (normalizedResource === 'research' || normalizedResource === 'thesis')
  ) {
    body = buildResearchFundamentalsBody(context)
  } else if (normalizedReason === 'insider-compliance') {
    const label = context.portfolioLabel ? `${context.portfolioLabel} 這段內容` : '這段內容'
    body = `${label}碰到 insider 合規邊界，我先只留狀態與風險，不把語氣往買賣建議延伸。`
  } else if (normalizedResource === 'dashboard') {
    body = buildDashboardBody(normalizedReason, context)
  } else if (normalizedReason === 'prompt-injection-detected') {
    body = '這輪輸入混進了不該跟著走的指令片段，我先把分析停在這裡，避免把外來要求誤當成事實。'
  } else if (normalizedReason === 'quota-exceeded') {
    body = '這輪模型額度剛好卡住，我先不拿殘缺回覆往下推，晚一點回來會比較完整。'
  } else if (normalizedReason === 'api-timeout') {
    body = '這輪分析還沒在可用時間內收斂，我先不拿半段內容硬湊結論。'
  }

  return {
    headline: ACCURACY_GATE_HEADLINE,
    body,
    reason: normalizedReason,
    resource: normalizedResource,
    reasonLabel: REASON_LABELS[normalizedReason],
    resourceLabel: RESOURCE_LABELS[normalizedResource],
    retryDisabled: shouldDisableAccuracyGateRetry(context),
  }
}

export function resolveDailyAccuracyGate({
  report = null,
  staleStatus = 'fresh',
  viewMode = 'retail',
  autoConfirmState = null,
} = {}) {
  if (!report || typeof report !== 'object') return null

  const insight = toText(report.aiInsight)
  const error = toText(report.aiError)
  const pendingCodes = Array.isArray(autoConfirmState?.confirmation?.pendingCodes)
    ? autoConfirmState.confirmation.pendingCodes
    : Array.isArray(report?.finmindConfirmation?.pendingCodes)
      ? report.finmindConfirmation.pendingCodes
      : []

  if (viewMode === 'insider-compressed' && containsInsiderActionCue(insight)) {
    return {
      reason: 'insider-compliance',
      resource: 'daily',
      context: {
        portfolioLabel: report?.portfolioLabel,
      },
    }
  }

  if (!insight && error) {
    return {
      reason: classifyAccuracyGateReasonFromError(error),
      resource: 'daily',
      context: {
        date: report?.date,
      },
    }
  }

  if (
    report.analysisStage === 't0-preliminary' ||
    staleStatus === 'stale' ||
    staleStatus === 'missing'
  ) {
    return {
      reason: 'stale-data',
      resource: 'daily',
      context: {
        date: report?.date,
        expectedMarketDate: report?.finmindConfirmation?.expectedMarketDate,
        pendingCodes,
        retryCoolingDown: autoConfirmState?.status === 'cooldown',
        nextRetryAt: autoConfirmState?.nextProbeAt,
      },
    }
  }

  return null
}

export function resolveResearchAccuracyGate({
  results = null,
  dataRefreshRows = [],
  viewMode = 'retail',
} = {}) {
  if (!results || typeof results !== 'object') return null

  const text = [
    toText(results.summary),
    ...(Array.isArray(results.rounds) ? results.rounds.map((round) => round?.content) : []),
  ]
    .filter(Boolean)
    .join('\n')

  if (viewMode === 'insider-compressed' && containsInsiderActionCue(text)) {
    return {
      reason: 'insider-compliance',
      resource: 'research',
      context: {},
    }
  }

  const matchedRow = (Array.isArray(dataRefreshRows) ? dataRefreshRows : []).find(
    (item) => toText(item?.code) && toText(item?.code) === toText(results.code)
  )

  if (matchedRow && toText(matchedRow.fundamentalStatus) !== '新鮮') {
    return {
      reason: 'fundamentals-incomplete',
      resource: 'research',
      context: {
        code: matchedRow.code,
        name: matchedRow.name || results.name,
        fundamentalStatus: matchedRow.fundamentalStatus,
        targetStatus: matchedRow.targetStatus,
      },
    }
  }

  return null
}

function readFundamentalFreshness(value = '') {
  const normalized = toText(value).toLowerCase()
  if (!normalized) return 'missing'
  return normalized
}

export function resolveDashboardAccuracyGate({ holdingDossiers = [], dataRefreshRows = [] } = {}) {
  const safeDossiers = Array.isArray(holdingDossiers) ? holdingDossiers.filter(Boolean) : []
  if (safeDossiers.length === 0) return null

  const freshness = safeDossiers.map((item) =>
    readFundamentalFreshness(item?.freshness?.fundamentals)
  )
  const missingCount = freshness.filter((status) => status === 'missing').length
  const staleCount = freshness.filter((status) => status === 'stale' || status === 'aging').length
  const blockedCount = missingCount + staleCount

  if (blockedCount !== safeDossiers.length) return null

  return {
    reason: missingCount > 0 ? 'fundamentals-incomplete' : 'stale-data',
    resource: 'dashboard',
    context: {
      holdingCount: safeDossiers.length,
      pendingCount: Array.isArray(dataRefreshRows) ? dataRefreshRows.length : 0,
    },
  }
}
