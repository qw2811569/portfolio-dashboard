import { describe, expect, it } from 'vitest'
import { calculateEventCountdown } from '../../src/lib/eventCountdown.js'

const NOW = new Date('2026-04-16T09:00:00')

describe('calculateEventCountdown', () => {
  it('marks events older than 3 days as past and auto review ready', () => {
    expect(calculateEventCountdown({ date: '2026-04-10' }, NOW)).toMatchObject({
      daysUntil: -6,
      urgency: 'past',
      label: '已過 6 天',
      autoReviewReady: true,
    })
  })

  it('keeps recent past events outside the review window', () => {
    expect(calculateEventCountdown({ date: '2026-04-14' }, NOW)).toMatchObject({
      daysUntil: -2,
      urgency: 'past',
      label: '已過 2 天',
      autoReviewReady: false,
    })
  })

  it('marks same-day events as today', () => {
    expect(calculateEventCountdown({ date: '2026-04-16' }, NOW)).toMatchObject({
      daysUntil: 0,
      urgency: 'today',
      label: '今天',
      autoReviewReady: false,
    })
  })

  it('treats events within 3 days as imminent', () => {
    expect(calculateEventCountdown({ date: '2026-04-19' }, NOW)).toMatchObject({
      daysUntil: 3,
      urgency: 'imminent',
      label: '3 天後',
      autoReviewReady: false,
    })
  })

  it('treats events within 7 days as soon', () => {
    expect(calculateEventCountdown({ date: '2026-04-23' }, NOW)).toMatchObject({
      daysUntil: 7,
      urgency: 'soon',
      label: '7 天後',
      autoReviewReady: false,
    })
  })

  it('treats distant events as far', () => {
    expect(calculateEventCountdown({ date: '2026-05-16' }, NOW)).toMatchObject({
      daysUntil: 30,
      urgency: 'far',
      label: '30 天後',
      autoReviewReady: false,
    })
  })

  it('returns a stable fallback when date is missing', () => {
    expect(calculateEventCountdown({}, NOW)).toMatchObject({
      daysUntil: null,
      urgency: 'far',
      label: '日期未定',
      autoReviewReady: false,
    })
  })
})
