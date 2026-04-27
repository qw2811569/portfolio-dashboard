const ACCURACY_GATE_HEADLINE = '這段分析暫時不給 · 為避免幻覺'
const LONG_RETRY_BACKOFF_MS = 5 * 60 * 1000
const AUTH_REQUIRED_HEADLINE = '需要重新登入 · 前往登入'

const INSIDER_ACTION_CUE =
  /(操作建議|買賣策略|買進|買入|賣出|加碼|減碼|停損|出場|持倉調整|資金調度|最需要行動|布局|佈局|續抱|\bbuy\b|\bsell\b|\btrim\b|\bexit\b|\baccumulate\b|\brebalance\b|\baction\b|\blong\b|\bshort\b)/iu

const REASON_LABELS = {
  'auth-required': '需要重新登入',
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
  thesis: '投資理由',
  dashboard: '首頁 headline',
  detail: '個股摘要',
  tomorrow: '明日行動',
  weekly: '週報敘事',
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
  return `${stockLabel} 這輪先停在這裡，財報 / 營收欄位還沒補齊${targetNote}。我先不把投資理由硬湊完整，等資料回來再看。`
}

function buildFinMindFallbackPhrase(context = {}) {
  const ageLabel = toText(context.fallbackAgeLabel)
  if (ageLabel) return `我先用 ${ageLabel} 前那份數字先撐`
  return '我先用前一版數字先撐'
}

function buildFinMindQuotaBody(context = {}) {
  const subject =
    context.name && context.code
      ? `${context.name} (${context.code})`
      : context.name || context.code || '這段 FinMind 資料'
  return `今天 FinMind 查詢到上限，${subject}先停在這裡。${buildFinMindFallbackPhrase(context)}，剩的資料明天補。`
}

function buildFinMindTimeoutBody(context = {}) {
  const subject =
    context.name && context.code
      ? `${context.name} (${context.code})`
      : context.name || context.code || 'FinMind 資料源'
  return `${subject}現在有點卡住，${buildFinMindFallbackPhrase(context)}，稍後補正。`
}

function buildAuthRequiredBody(context = {}) {
  if (context.provider === 'FinMind') {
    return `這輪登入 session 沒帶到 FinMind 資料，${buildFinMindFallbackPhrase(context)}，重新登入後會自動補正。`
  }

  return '這輪登入 session 沒跟上，我先沿用前一版數字，重新登入後會自動補正。'
}

function buildDashboardBody(reason, context = {}) {
  const holdingCount = Math.max(0, Number(context.holdingCount) || 0)
  const lead =
    holdingCount > 0 ? `目前有 ${holdingCount} 檔持倉的首頁依據還沒站穩` : '首頁依據還沒站穩'
  if (reason === 'auth-required') {
    return `首頁這輪沒帶到可用的登入 session，${buildFinMindFallbackPhrase(context)}，重新登入後會自動補正。`
  }
  if (context.provider === 'FinMind' && reason === 'quota-exceeded') {
    return `今天 FinMind 查詢到上限，首頁先不把結論講滿。${buildFinMindFallbackPhrase(context)}，剩的資料明天補。`
  }
  if (context.provider === 'FinMind' && reason === 'api-timeout') {
    return `FinMind 資料源現在有點卡住，首頁先不把結論講滿。${buildFinMindFallbackPhrase(context)}，稍後補正。`
  }
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
  if (/unauthorized|forbidden|401|登入|session/i.test(text)) {
    return 'auth-required'
  }
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
  let headline = ACCURACY_GATE_HEADLINE

  if (normalizedReason === 'auth-required') {
    headline = AUTH_REQUIRED_HEADLINE
    body =
      normalizedResource === 'dashboard'
        ? buildDashboardBody(normalizedReason, context)
        : buildAuthRequiredBody(context)
  } else if (normalizedReason === 'stale-data' && normalizedResource === 'daily') {
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
  } else if (context.provider === 'FinMind' && normalizedReason === 'quota-exceeded') {
    body = buildFinMindQuotaBody(context)
  } else if (context.provider === 'FinMind' && normalizedReason === 'api-timeout') {
    body = buildFinMindTimeoutBody(context)
  } else if (normalizedReason === 'prompt-injection-detected') {
    body = '這輪輸入混進了不該跟著走的指令片段，我先把分析停在這裡，避免把外來要求誤當成事實。'
  } else if (normalizedReason === 'quota-exceeded') {
    body = '這輪模型額度剛好卡住，我先不拿殘缺回覆往下推，晚一點回來會比較完整。'
  } else if (normalizedReason === 'api-timeout') {
    body = '這輪分析還沒在可用時間內收斂，我先不拿半段內容硬湊結論。'
  }

  return {
    headline,
    body,
    reason: normalizedReason,
    resource: normalizedResource,
    reasonLabel: REASON_LABELS[normalizedReason],
    resourceLabel: RESOURCE_LABELS[normalizedResource],
    retryDisabled: shouldDisableAccuracyGateRetry(context),
    requiresLogin: normalizedReason === 'auth-required',
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

  if (matchedRow && readFundamentalFreshness(matchedRow.fundamentalStatus) !== 'fresh') {
    if (matchedRow.degradedReason) {
      return {
        reason: matchedRow.degradedReason,
        resource: 'research',
        context: {
          provider: 'FinMind',
          code: matchedRow.code,
          name: matchedRow.name || results.name,
          fallbackAgeLabel: matchedRow.fallbackAgeLabel,
          fallbackAt: matchedRow.fallbackAt,
        },
      }
    }

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
  if (['fresh', '新鮮', '已補', 'ok', '正常'].includes(normalized)) return 'fresh'
  if (['aging', 'stale', '有點舊了', '過期'].includes(normalized)) return 'stale'
  if (['missing', '缺失', '缺少', '還在補'].includes(normalized)) return 'missing'
  return normalized
}

export function resolveHoldingsAccuracyGate({ holdingDossiers = [] } = {}) {
  const safeDossiers = Array.isArray(holdingDossiers) ? holdingDossiers.filter(Boolean) : []
  const degraded = safeDossiers
    .map((item) =>
      item?.finmindDegraded && typeof item.finmindDegraded === 'object'
        ? item.finmindDegraded
        : null
    )
    .filter(Boolean)

  if (degraded.length === 0) return null

  const authCount = degraded.filter((item) => item.reason === 'auth-required').length
  const quotaCount = degraded.filter((item) => item.reason === 'quota-exceeded').length
  const primary = degraded[0] || null

  return {
    reason: authCount > 0 ? 'auth-required' : quotaCount > 0 ? 'quota-exceeded' : 'api-timeout',
    resource: 'thesis',
    context: {
      provider: 'FinMind',
      holdingCount: safeDossiers.length,
      fallbackAgeLabel: primary?.fallbackAgeLabel || '',
      fallbackAt: primary?.fallbackAt || null,
    },
  }
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

  const degradedRows = (Array.isArray(dataRefreshRows) ? dataRefreshRows : []).filter((item) =>
    toText(item?.degradedReason)
  )
  if (degradedRows.length > 0) {
    const authCount = degradedRows.filter((item) => item.degradedReason === 'auth-required').length
    const quotaCount = degradedRows.filter(
      (item) => item.degradedReason === 'quota-exceeded'
    ).length
    return {
      reason: authCount > 0 ? 'auth-required' : quotaCount > 0 ? 'quota-exceeded' : 'api-timeout',
      resource: 'dashboard',
      context: {
        provider: 'FinMind',
        holdingCount: safeDossiers.length,
        pendingCount: Array.isArray(dataRefreshRows) ? dataRefreshRows.length : 0,
        fallbackAgeLabel: degradedRows[0]?.fallbackAgeLabel || '',
        fallbackAt: degradedRows[0]?.fallbackAt || null,
      },
    }
  }

  return {
    reason: missingCount > 0 ? 'fundamentals-incomplete' : 'stale-data',
    resource: 'dashboard',
    context: {
      holdingCount: safeDossiers.length,
      pendingCount: Array.isArray(dataRefreshRows) ? dataRefreshRows.length : 0,
    },
  }
}

function resolveTextEntryAccuracyGate({
  text = '',
  error = '',
  resource = 'thesis',
  viewMode = 'retail',
  context = {},
} = {}) {
  const normalizedText = toText(text)
  const normalizedError = toText(error)

  if (viewMode === 'insider-compressed' && containsInsiderActionCue(normalizedText)) {
    return {
      reason: 'insider-compliance',
      resource,
      context,
    }
  }

  if (!normalizedText && normalizedError) {
    return {
      reason: classifyAccuracyGateReasonFromError(normalizedError),
      resource,
      context,
    }
  }

  return null
}

export function resolveDetailSummaryAccuracyGate({
  summary = '',
  error = '',
  viewMode = 'retail',
  context = {},
} = {}) {
  return resolveTextEntryAccuracyGate({
    text: summary,
    error,
    resource: 'detail',
    viewMode,
    context,
  })
}

export function resolveTomorrowActionsAccuracyGate({
  actions = [],
  error = '',
  viewMode = 'retail',
  context = {},
} = {}) {
  const text = Array.isArray(actions)
    ? actions
        .map((item) => [item?.title, item?.label, item?.body, item?.reason, item?.action].join(' '))
        .join('\n')
    : toText(actions)

  return resolveTextEntryAccuracyGate({
    text,
    error,
    resource: 'tomorrow',
    viewMode,
    context,
  })
}

export function resolveWeeklyPdfNarrativeAccuracyGate({
  narrative = '',
  error = '',
  viewMode = 'retail',
  context = {},
} = {}) {
  return resolveTextEntryAccuracyGate({
    text: narrative,
    error,
    resource: 'weekly',
    viewMode,
    context,
  })
}
