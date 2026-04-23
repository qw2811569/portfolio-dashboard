import { daysBetween, parseFlexibleDate } from './dateUtils.js'

const HOUR_MS = 60 * 60 * 1000

const BADGE_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const STALE_BADGE_THRESHOLDS = Object.freeze({
  targets: 7,
  fundamentals: 30,
  macro: 1,
  calendar: 1,
  'macro-calendar': 1,
  restore: 0,
})

export function normalizeStaleBadgeResource(resource = '') {
  const normalized = String(resource || '')
    .trim()
    .toLowerCase()

  if (normalized === 'macro/calendar') return 'macro-calendar'
  if (normalized === 'macro-calendar') return 'macro-calendar'
  if (normalized === 'calendar') return 'calendar'
  if (normalized === 'targets') return 'targets'
  if (normalized === 'fundamentals') return 'fundamentals'
  if (normalized === 'macro') return 'macro'
  if (normalized === 'restore') return 'restore'
  return ''
}

export function getMostRecentStaleBadgeDate(input) {
  const candidates = Array.isArray(input) ? input : [input]
  let latest = null

  for (const candidate of candidates) {
    const parsed = parseFlexibleDate(candidate)
    if (!parsed) continue
    if (!latest || parsed.getTime() > latest.getTime()) {
      latest = parsed
    }
  }

  return latest
}

export function formatStaleBadgeExactTimestamp(input) {
  const parsed = input instanceof Date ? input : getMostRecentStaleBadgeDate(input)
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return ''
  return BADGE_TIMESTAMP_FORMATTER.format(parsed)
}

export function formatStaleBadgeRelativeLabel(input, { now = new Date() } = {}) {
  const parsed = input instanceof Date ? input : getMostRecentStaleBadgeDate(input)
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return ''

  const diffMs = Math.max(0, now.getTime() - parsed.getTime())
  if (diffMs < HOUR_MS) return '剛剛'

  const ageDays = daysBetween(now, parsed)
  if (ageDays == null) return ''
  if (ageDays === 0) return `${Math.max(1, Math.floor(diffMs / HOUR_MS))} 小時前`
  if (ageDays === 1) return '昨天'
  return `${ageDays} 天前`
}

export function resolveStaleBadgeResourceState({
  resource = '',
  updatedAt = null,
  status = '',
  now = new Date(),
} = {}) {
  const normalizedResource = normalizeStaleBadgeResource(resource)
  if (!normalizedResource) {
    return {
      status: status || '',
      text: '',
      updatedAt: '',
      thresholdDays: null,
    }
  }

  const latest = getMostRecentStaleBadgeDate(updatedAt)
  const normalizedStatus = String(status || '')
    .trim()
    .toLowerCase()

  if (normalizedResource === 'restore') {
    return {
      status: normalizedStatus || (latest ? 'fresh' : 'missing'),
      text: latest ? formatStaleBadgeExactTimestamp(latest) : '尚無快照',
      updatedAt: latest ? latest.toISOString() : '',
      thresholdDays: null,
    }
  }

  const thresholdDays = STALE_BADGE_THRESHOLDS[normalizedResource]
  if (!latest) {
    return {
      status: normalizedStatus || 'missing',
      text: '還在補',
      updatedAt: '',
      thresholdDays,
    }
  }

  const ageMs = Math.max(0, now.getTime() - latest.getTime())
  const computedStatus =
    normalizedStatus || (ageMs > thresholdDays * 24 * HOUR_MS ? 'stale' : 'fresh')

  if (computedStatus === 'failed') {
    return {
      status: 'failed',
      text: '更新失敗',
      updatedAt: latest.toISOString(),
      thresholdDays,
    }
  }

  if (computedStatus === 'missing') {
    return {
      status: 'missing',
      text: '還在補',
      updatedAt: latest.toISOString(),
      thresholdDays,
    }
  }

  return {
    status: computedStatus,
    text: formatStaleBadgeRelativeLabel(latest, { now }),
    updatedAt: latest.toISOString(),
    thresholdDays,
  }
}
