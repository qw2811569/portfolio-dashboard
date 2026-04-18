const DAY_MS = 86400000

function normalizeDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const cloned = new Date(value.getTime())
    cloned.setHours(0, 0, 0, 0)
    return cloned
  }

  const raw = String(value || '').trim()
  if (!raw) return null

  const matched = raw.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  const normalizedDate = matched
    ? `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`
    : raw.replace(/\//g, '-')
  const normalized = normalizedDate.includes('T') ? normalizedDate : `${normalizedDate}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function diffInDays(target, base) {
  if (!(target instanceof Date) || !(base instanceof Date)) return null
  return Math.round((target.getTime() - base.getTime()) / DAY_MS)
}

function buildLabel(daysUntil) {
  if (!Number.isFinite(daysUntil)) return '日期未定'
  if (daysUntil === 0) return '今天'
  if (daysUntil === -1) return '昨天'
  if (daysUntil === 1) return '1 天後'
  if (daysUntil > 1) return `${daysUntil} 天後`
  return `已過 ${Math.abs(daysUntil)} 天`
}

export function calculateEventCountdown(event, now = new Date()) {
  const eventDate = normalizeDate(event?.date)
  const currentDate = normalizeDate(now) || normalizeDate(new Date())

  if (!eventDate || !currentDate) {
    return {
      daysUntil: null,
      urgency: 'far',
      label: '日期未定',
      autoReviewReady: false,
    }
  }

  const daysUntil = diffInDays(eventDate, currentDate)
  const autoReviewReady = Number.isFinite(daysUntil) && daysUntil <= -3

  let urgency = 'far'
  if (daysUntil <= -1) urgency = 'past'
  else if (daysUntil === 0) urgency = 'today'
  else if (daysUntil <= 3) urgency = 'imminent'
  else if (daysUntil <= 7) urgency = 'soon'

  return {
    daysUntil,
    urgency,
    label: buildLabel(daysUntil),
    autoReviewReady,
  }
}
