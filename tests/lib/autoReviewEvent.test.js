import { describe, it, expect } from 'vitest'
import { autoReviewEvent } from '../../src/lib/eventUtils.js'

describe('autoReviewEvent', () => {
  const baseEvent = {
    id: 'evt-1',
    title: '台積電法說會',
    status: 'tracking',
    pred: 'up',
    stocks: ['2330|台積電'],
    priceAtEvent: { 2330: 580 },
    trackingStart: '2026/03/01',
    date: '2026/03/01',
  }

  it('returns closed event with correct=true when pred matches actual direction', () => {
    const priceAtExit = { 2330: 620 }
    const result = autoReviewEvent(baseEvent, priceAtExit, { today: '2026/04/12' })

    expect(result.status).toBe('closed')
    expect(result.actual).toBe('up')
    expect(result.correct).toBe(true)
    expect(result.exitDate).toBe('2026/04/12')
    expect(result.priceAtExit).toEqual(priceAtExit)
    expect(result.autoReviewed).toBe(true)
  })

  it('returns closed event with correct=false when pred does not match actual', () => {
    const priceAtExit = { 2330: 540 }
    const result = autoReviewEvent(baseEvent, priceAtExit, { today: '2026/04/12' })

    expect(result.status).toBe('closed')
    expect(result.actual).toBe('down')
    expect(result.correct).toBe(false)
    expect(result.autoReviewed).toBe(true)
  })

  it('handles neutral outcome (±1%)', () => {
    const priceAtExit = { 2330: 582 } // +0.3%
    const result = autoReviewEvent(baseEvent, priceAtExit, { today: '2026/04/12' })

    expect(result.actual).toBe('neutral')
    expect(result.correct).toBe(false) // pred=up but actual=neutral
  })

  it('handles pred=down correctly', () => {
    const event = { ...baseEvent, pred: 'down' }
    const priceAtExit = { 2330: 540 }
    const result = autoReviewEvent(event, priceAtExit, { today: '2026/04/12' })

    expect(result.actual).toBe('down')
    expect(result.correct).toBe(true)
  })

  it('returns null when priceAtEvent is missing', () => {
    const event = { ...baseEvent, priceAtEvent: null }
    const result = autoReviewEvent(event, { 2330: 600 }, { today: '2026/04/12' })
    expect(result).toBeNull()
  })

  it('returns null when priceAtExit is empty', () => {
    const result = autoReviewEvent(baseEvent, {}, { today: '2026/04/12' })
    expect(result).toBeNull()
  })

  it('still auto-reviews when stock codes differ (averagePriceRecord is code-agnostic)', () => {
    // inferEventActual uses averagePriceRecord which averages all values
    // regardless of code matching, so mismatched codes still produce a result
    const result = autoReviewEvent(baseEvent, { 9999: 100 }, { today: '2026/04/12' })
    expect(result).not.toBeNull()
    expect(result.status).toBe('closed')
    expect(result.actual).toBe('down') // 100 vs 580
  })

  it('returns null when event has no pred', () => {
    const event = { ...baseEvent, pred: undefined }
    const result = autoReviewEvent(event, { 2330: 600 }, { today: '2026/04/12' })
    expect(result).toBeNull()
  })

  it('returns null for non-tracking events', () => {
    const event = { ...baseEvent, status: 'closed' }
    const result = autoReviewEvent(event, { 2330: 600 }, { today: '2026/04/12' })
    expect(result).toBeNull()
  })
})
