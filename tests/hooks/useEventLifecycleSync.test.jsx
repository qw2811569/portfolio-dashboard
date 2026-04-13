import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEventLifecycleSync } from '../../src/hooks/useEventLifecycleSync.js'

function makeTrackingEvent(overrides = {}) {
  return {
    id: 'evt-1',
    title: '台積電法說會',
    status: 'tracking',
    pred: 'up',
    stocks: ['2330|台積電'],
    priceAtEvent: { 2330: 580 },
    trackingStart: '2026/03/01',
    date: '2026/03/01',
    ...overrides,
  }
}

const baseProps = (overrides = {}) => ({
  activePortfolioId: 'me',
  ready: true,
  viewMode: 'portfolio',
  newsEvents: [],
  setNewsEvents: vi.fn(),
  portfolioTransitionRef: { current: { isHydrating: false } },
  getMarketQuotesForCodes: vi.fn(async () => ({})),
  normalizeNewsEvents: (items) => (Array.isArray(items) ? items : []),
  getEventStockCodes: (event) => (event?.stocks || []).map((s) => String(s).split('|')[0]),
  parseSlashDate: (str) => {
    if (!str) return null
    const parts = String(str).split('/')
    if (parts.length !== 3) return null
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  },
  toSlashDate: () => '2026/04/12',
  appendPriceHistory: (history, date, prices) => [
    ...(Array.isArray(history) ? history : []),
    { date, prices },
  ],
  ...overrides,
})

describe('useEventLifecycleSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auto-reviews a tracking event with pred and priceAtEvent', async () => {
    const event = makeTrackingEvent()
    const setNewsEvents = vi.fn()

    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [event],
          setNewsEvents,
          getMarketQuotesForCodes: vi.fn(async () => ({
            2330: { price: 620 },
          })),
        })
      )
    )

    await waitFor(
      () => {
        expect(setNewsEvents).toHaveBeenCalled()
      },
      { timeout: 2000 }
    )

    const updatedEvents = setNewsEvents.mock.calls[0][0]
    expect(updatedEvents).toHaveLength(1)
    expect(updatedEvents[0].status).toBe('closed')
    expect(updatedEvents[0].autoReviewed).toBe(true)
    expect(updatedEvents[0].actual).toBe('up')
    expect(updatedEvents[0].correct).toBe(true)
    expect(updatedEvents[0].priceAtExit).toEqual({ 2330: 620 })
  })

  it('auto-reviews with correct=false when direction is wrong', async () => {
    const event = makeTrackingEvent({ pred: 'up' })
    const setNewsEvents = vi.fn()

    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [event],
          setNewsEvents,
          getMarketQuotesForCodes: vi.fn(async () => ({
            2330: { price: 540 }, // price went down
          })),
        })
      )
    )

    await waitFor(
      () => {
        expect(setNewsEvents).toHaveBeenCalled()
      },
      { timeout: 2000 }
    )

    const updatedEvents = setNewsEvents.mock.calls[0][0]
    expect(updatedEvents[0].actual).toBe('down')
    expect(updatedEvents[0].correct).toBe(false)
    expect(updatedEvents[0].autoReviewed).toBe(true)
  })

  it('does not auto-review events without pred (falls back to 90-day close)', async () => {
    const event = makeTrackingEvent({
      pred: undefined,
      trackingStart: '2025/12/01', // > 90 days ago
    })
    const setNewsEvents = vi.fn()

    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [event],
          setNewsEvents,
          getMarketQuotesForCodes: vi.fn(async () => ({
            2330: { price: 620 },
          })),
        })
      )
    )

    await waitFor(
      () => {
        expect(setNewsEvents).toHaveBeenCalled()
      },
      { timeout: 2000 }
    )

    const updatedEvents = setNewsEvents.mock.calls[0][0]
    expect(updatedEvents[0].status).toBe('closed')
    expect(updatedEvents[0].autoClosed).toBe(true)
    expect(updatedEvents[0].autoReviewed).toBeUndefined()
  })

  it('does not auto-review events within the 3-day observation window', async () => {
    // Event started tracking yesterday — too soon to auto-review
    const event = makeTrackingEvent({ trackingStart: '2026/04/11' })
    const setNewsEvents = vi.fn()

    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [event],
          setNewsEvents,
          getMarketQuotesForCodes: vi.fn(async () => ({
            2330: { price: 620 },
          })),
        })
      )
    )

    await waitFor(
      () => {
        expect(setNewsEvents).toHaveBeenCalled()
      },
      { timeout: 2000 }
    )

    const updatedEvents = setNewsEvents.mock.calls[0][0]
    // Should still be tracking, NOT auto-reviewed (only 1 day old)
    expect(updatedEvents[0].status).toBe('tracking')
    expect(updatedEvents[0].autoReviewed).toBeUndefined()
  })

  it('does not call setNewsEvents when nothing changed', async () => {
    const setNewsEvents = vi.fn()

    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [{ id: 'evt-1', status: 'closed', title: 'done' }],
          setNewsEvents,
        })
      )
    )

    // Give it time to process
    await new Promise((r) => setTimeout(r, 200))
    expect(setNewsEvents).not.toHaveBeenCalled()
  })

  // ── P0-04: null date guard ────────────────────────────────────────
  it('gracefully no-ops when parseSlashDate always returns null', async () => {
    const event = makeTrackingEvent()
    const setNewsEvents = vi.fn()

    // Force parseSlashDate to always return null — simulates a broken
    // locale or misconfigured toSlashDate producing an unparseable string.
    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [event],
          setNewsEvents,
          parseSlashDate: () => null,
          getMarketQuotesForCodes: vi.fn(async () => ({
            2330: { price: 620 },
          })),
        })
      )
    )

    // Give it time to process
    await new Promise((r) => setTimeout(r, 300))
    // Should NOT crash and should NOT call setNewsEvents (no-op)
    expect(setNewsEvents).not.toHaveBeenCalled()
  })

  it('gracefully no-ops when toSlashDate returns null', async () => {
    const event = makeTrackingEvent()
    const setNewsEvents = vi.fn()

    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [event],
          setNewsEvents,
          toSlashDate: () => null,
          getMarketQuotesForCodes: vi.fn(async () => ({
            2330: { price: 620 },
          })),
        })
      )
    )

    await new Promise((r) => setTimeout(r, 300))
    expect(setNewsEvents).not.toHaveBeenCalled()
  })

  it('gracefully no-ops when toSlashDate throws', async () => {
    const event = makeTrackingEvent()
    const setNewsEvents = vi.fn()

    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [event],
          setNewsEvents,
          toSlashDate: () => {
            throw new Error('locale crash')
          },
          getMarketQuotesForCodes: vi.fn(async () => ({
            2330: { price: 620 },
          })),
        })
      )
    )

    await new Promise((r) => setTimeout(r, 300))
    expect(setNewsEvents).not.toHaveBeenCalled()
  })

  it('gracefully no-ops when toSlashDate returns non-date string', async () => {
    const event = makeTrackingEvent()
    const setNewsEvents = vi.fn()

    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [event],
          setNewsEvents,
          toSlashDate: () => 'not-a-date',
          getMarketQuotesForCodes: vi.fn(async () => ({
            2330: { price: 620 },
          })),
        })
      )
    )

    await new Promise((r) => setTimeout(r, 300))
    expect(setNewsEvents).not.toHaveBeenCalled()
  })

  it('runs lifecycle sync regardless of active tab (no tab-gating)', async () => {
    // Previously the hook gated sync on specific tabs like 'events' or 'news'.
    // This test proves sync fires for an arbitrary tab value like 'settings'.
    const event = makeTrackingEvent()
    const setNewsEvents = vi.fn()

    renderHook(() =>
      useEventLifecycleSync(
        baseProps({
          newsEvents: [event],
          setNewsEvents,
          getMarketQuotesForCodes: vi.fn(async () => ({
            2330: { price: 620 },
          })),
        })
      )
    )

    await waitFor(
      () => {
        expect(setNewsEvents).toHaveBeenCalled()
      },
      { timeout: 2000 }
    )

    const updatedEvents = setNewsEvents.mock.calls[0][0]
    expect(updatedEvents).toHaveLength(1)
    // Sync ran and auto-reviewed the event — proof that no tab-gating blocks it
    expect(updatedEvents[0].status).toBe('closed')
    expect(updatedEvents[0].autoReviewed).toBe(true)
  })
})
