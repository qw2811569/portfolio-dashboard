import { describe, expect, it } from 'vitest'
import {
  buildDashboardCompareStrip,
  buildOverviewDashboardHeadline,
} from '../../src/lib/overviewCompare.js'

describe('lib/overviewCompare', () => {
  it('prefers the owner portfolio and active compare target when building the strip', () => {
    const strip = buildDashboardCompareStrip(
      [
        {
          id: 'me',
          name: '我',
          todayRetPct: 0.72,
          todayTopContributor: { code: '2330', name: '台積電', pnl: 120 },
        },
        {
          id: '7865',
          name: '金聯成',
          todayRetPct: 0.61,
          todayTopDrag: { code: '2489', name: '瑞軒', pnl: -40 },
        },
        { id: 'p3', name: '第三組', todayRetPct: 0.2 },
      ],
      { activePortfolioId: '7865', staleStatus: 'stale' }
    )

    expect(strip.primary.label).toBe('小奎主要投資')
    expect(strip.secondary.label).toBe('金聯成組合')
    expect(strip.summaryText).toContain('今日差距 +0.1pp')
    expect(strip.insightText).toContain('主要拉動是 台積電 (2330)')
    expect(strip.staleStatus).toBe('stale')
  })

  it('writes a softer losing-side insight when the owner portfolio trails', () => {
    const strip = buildDashboardCompareStrip(
      [
        { id: 'me', name: '我', todayRetPct: -0.2, todayTopDrag: { code: '2489', pnl: -80 } },
        { id: '7865', name: '金聯成', todayRetPct: 0.15 },
      ],
      { activePortfolioId: 'me' }
    )

    expect(strip.summaryText).toContain('今日差距 -0.3pp')
    expect(strip.insightText).toContain('金聯成組合 今天更穩')
    expect(strip.insightText).toContain('2489')
    expect(strip.tone).toBe('watch')
  })

  it('falls back to pending-items language when compare data is unavailable', () => {
    expect(
      buildOverviewDashboardHeadline({
        compareStrip: null,
        portfolioCount: 2,
        duplicateHoldingsCount: 1,
        pendingItemsCount: 3,
      })
    ).toEqual({
      headline: '跨組合還有 3 件事件排隊 · 先看哪組需要先打開',
      tone: 'watch',
    })
  })

  it('drops portfolios whose today price data is unavailable so the strip does not fake a 0.0% compare', () => {
    const strip = buildDashboardCompareStrip(
      [
        { id: 'me', name: '我', todayRetPct: 0, todayHasPriceData: false },
        { id: '7865', name: '金聯成', todayRetPct: 0.12, todayHasPriceData: true },
      ],
      { activePortfolioId: 'me' }
    )

    expect(strip).toBeNull()
  })

  it('keeps the strip rendered on weekends with 今日休市 placeholder instead of disappearing', () => {
    const saturday = new Date('2026-04-25T08:00:00.000+08:00')
    const strip = buildDashboardCompareStrip(
      [
        { id: 'me', name: '我', todayRetPct: null },
        { id: '7865', name: '金聯成', todayRetPct: null },
      ],
      { activePortfolioId: 'me', now: saturday }
    )

    expect(strip).not.toBeNull()
    expect(strip.marketClosed).toBe(true)
    expect(strip.summaryText).toContain('今日休市')
    expect(strip.insightText).toContain('今日休市')
    expect(strip.deltaPp).toBeNull()
    expect(strip.deltaText).toBe('')
    expect(strip.pendingDataPortfolios).toEqual(['小奎主要投資', '金聯成組合'])
  })

  it('keeps the strip rendered post-close on weekdays (after 13:30 Taipei time)', () => {
    const weekdayPostClose = new Date('2026-04-21T13:35:00.000+08:00') // Tuesday 13:35
    const strip = buildDashboardCompareStrip(
      [
        { id: 'me', name: '我', todayRetPct: null },
        { id: '7865', name: '金聯成', todayRetPct: null },
      ],
      { activePortfolioId: 'me', now: weekdayPostClose }
    )

    expect(strip).not.toBeNull()
    expect(strip.marketClosed).toBe(true)
    expect(strip.insightText).toContain('今日休市')
  })

  it('treats the 13:30 close minute precisely (open at 13:29, closed at 13:30 sharp)', () => {
    const oneMinuteBeforeClose = new Date('2026-04-21T13:29:00.000+08:00')
    const closeMinute = new Date('2026-04-21T13:30:00.000+08:00')
    const stripBefore = buildDashboardCompareStrip(
      [
        { id: 'me', name: '我', todayRetPct: null },
        { id: '7865', name: '金聯成', todayRetPct: null },
      ],
      { activePortfolioId: 'me', now: oneMinuteBeforeClose }
    )
    const stripAtClose = buildDashboardCompareStrip(
      [
        { id: 'me', name: '我', todayRetPct: null },
        { id: '7865', name: '金聯成', todayRetPct: null },
      ],
      { activePortfolioId: 'me', now: closeMinute }
    )

    expect(stripBefore.marketClosed).toBe(false)
    expect(stripAtClose.marketClosed).toBe(true)
  })

  it('keeps the strip rendered with 盤前 copy in the early-morning weekday window (before 09:00)', () => {
    const weekdayPreOpen = new Date('2026-04-21T08:30:00.000+08:00') // Tuesday 08:30
    const strip = buildDashboardCompareStrip(
      [
        { id: 'me', name: '我', todayRetPct: null },
        { id: '7865', name: '金聯成', todayRetPct: null },
      ],
      { activePortfolioId: 'me', now: weekdayPreOpen }
    )

    expect(strip).not.toBeNull()
    expect(strip.marketClosed).toBe(true)
    expect(strip.summaryText).toContain('今日休市')
  })
})
