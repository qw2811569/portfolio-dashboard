function parseStatusCode(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 100 && number <= 599 ? number : null
}

function parseStatusFromMessage(message = '') {
  const match = String(message || '')
    .trim()
    .match(/\b(401|404|5\d{2})\b/)
  return match ? Number(match[1]) : null
}

export function normalizeSoftErrorStatus(value) {
  if (value === 'offline') return 'offline'
  if (value === '5xx') return '5xx'

  const statusCode = parseStatusCode(value)
  if (statusCode === 401 || statusCode === 404) return statusCode
  if (statusCode >= 500 && statusCode < 600) return '5xx'
  return null
}

export function createDataError(status, message, extra = {}) {
  const error = new Error(String(message || `HTTP ${status || 'error'}`))
  const normalizedStatus = normalizeSoftErrorStatus(status)
  if (normalizedStatus === 'offline') error.status = 'offline'
  else if (typeof status === 'number') error.status = status
  Object.assign(error, extra)
  return error
}

export function normalizeDataError(error, { resource = '', fallbackStatus = null } = {}) {
  if (!error) return null

  const message = String(error?.message || '').trim()
  const candidateStatus =
    error?.status ??
    error?.response?.status ??
    error?.cause?.status ??
    parseStatusFromMessage(message) ??
    fallbackStatus

  let status = normalizeSoftErrorStatus(candidateStatus)

  if (!status) {
    const text = `${String(error?.name || '')} ${message}`.toLowerCase()
    if (
      /failed to fetch|network error|networkerror|network request failed|load failed|fetch failed|offline|disconnected/.test(
        text
      )
    ) {
      status = 'offline'
    }
  }

  return {
    resource,
    status: status || '5xx',
    message,
  }
}

function normalizeResource(resource = '') {
  const normalized = String(resource || '')
    .trim()
    .toLowerCase()

  if (normalized === 'target') return 'target-prices'
  if (normalized === 'target-prices' || normalized === 'tracked-stocks') return normalized
  if (normalized === 'analyst-reports' || normalized === 'news' || normalized === 'valuation') {
    return normalized
  }
  return normalized
}

export function getSoftErrorCopy(status, resource = '') {
  const normalizedStatus = normalizeSoftErrorStatus(status) || '5xx'
  const normalizedResource = normalizeResource(resource)

  if (normalizedStatus === 'offline') return '網路不穩 · 自動重連中'
  if (normalizedStatus === '5xx') return '服務暫時不穩 · 正在重試'

  if (normalizedStatus === 401) {
    if (normalizedResource === 'tracked-stocks') return '登入 session 過期 · 重新登入後再同步一次'
    return '需要重新登入 · 前往登入'
  }

  if (normalizedStatus === 404) {
    if (normalizedResource === 'analyst-reports') return '近期無此股深度分析 · 明早更新後再看'
    if (normalizedResource === 'target-prices') return '無券商目標價 · 先拿投資理由當參考'
    if (normalizedResource === 'tracked-stocks') return '尚未同步到雲端 · 再加一次'
    if (normalizedResource === 'news') return '這段新聞暫時沒撈到 · 晚點再看'
    if (normalizedResource === 'valuation') return '估值資料暫無 · 之後再看'
    return '此資料暫無 · 之後再看'
  }

  return '服務暫時不穩 · 正在重試'
}

export function isRetryableDataErrorStatus(status) {
  const normalizedStatus = normalizeSoftErrorStatus(status)
  return normalizedStatus === 'offline' || normalizedStatus === '5xx'
}

export function getErrorRetryDelayMs(attempt = 0, { baseMs = 1000, maxMs = 8000 } = {}) {
  const safeAttempt = Math.max(0, Number(attempt) || 0)
  return Math.min(maxMs, baseMs * 2 ** safeAttempt)
}
