import { isClosedEvent } from './eventUtils.js'

const DAY_MS = 86400000

export function getEventDateValue(event = {}) {
  return event?.date || event?.eventDate || null
}

export function getEventDayDistance(value, now = new Date()) {
  const raw = String(value || '')
    .trim()
    .replace(/\//g, '-')
  const matched = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!matched) return 14

  const eventDay = new Date(
    Number(matched[1]),
    Number(matched[2]) - 1,
    Number(matched[3]),
    12,
    0,
    0,
    0
  )
  const current = now instanceof Date ? now : new Date(now)
  const today = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 12, 0, 0, 0)
  return Math.floor((eventDay.getTime() - today.getTime()) / DAY_MS)
}

export function isEventCalendarRecord(event = {}) {
  return event?.recordType !== 'news'
}

export function selectUpcomingEventWindow(events = [], { now = new Date(), maxDays = 3 } = {}) {
  return (Array.isArray(events) ? events : [])
    .filter((event) => isEventCalendarRecord(event) && !isClosedEvent(event))
    .map((event) => ({
      event,
      daysUntil: getEventDayDistance(getEventDateValue(event), now),
    }))
    .filter(({ daysUntil }) => Number.isFinite(daysUntil) && daysUntil >= 0 && daysUntil <= maxDays)
    .sort((left, right) => left.daysUntil - right.daysUntil)
}

export function groupEventCardsByWindow(cards = [], now = new Date()) {
  const groups = [
    { key: 'expired', label: '已過期', items: [] },
    { key: 'this-week', label: '本週', items: [] },
    { key: 'next-week', label: '下週', items: [] },
    { key: 'later', label: '兩週後', items: [] },
  ]

  ;(Array.isArray(cards) ? cards : []).forEach((event) => {
    const days = getEventDayDistance(getEventDateValue(event), now)
    if (days < 0) groups[0].items.push(event)
    else if (days <= 6) groups[1].items.push(event)
    else if (days <= 13) groups[2].items.push(event)
    else groups[3].items.push(event)
  })

  return groups.filter((group) => group.items.length > 0)
}
