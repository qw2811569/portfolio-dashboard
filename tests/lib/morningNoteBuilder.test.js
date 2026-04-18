import { describe, it, expect } from 'vitest'
import {
  buildTodayEvents,
  buildHoldingStatus,
  buildInstitutionalSummary,
  buildWatchlistAlerts,
  buildMorningNote,
  buildMorningNoteDeepLinks,
  renderMorningNotePlainText,
} from '../../src/lib/morningNoteBuilder.js'

describe('buildTodayEvents', () => {
  it('filters events for today and formats with impact', () => {
    const events = [
      {
        title: '台積電3月營收公布',
        date: '2026/03/29',
        catalystType: 'earnings',
        impact: 'high',
        stocks: ['台積電 2330'],
      },
      {
        title: '昨天的事件',
        date: '2026/03/28',
        catalystType: 'corporate',
        impact: 'medium',
        stocks: ['台達電 2308'],
      },
      {
        title: '奇鋐法說會',
        date: '2026/03/29',
        catalystType: 'earnings',
        impact: 'medium',
        stocks: ['奇鋐 3017'],
      },
    ]
    const theses = [{ stockId: '2330', pillars: [{ id: 'p1', text: '月營收成長' }] }]
    const result = buildTodayEvents(events, theses, '2026/03/29')
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('台積電3月營收公布')
    expect(result[0].impactLabel).toBe('HIGH')
    expect(result[0].relatedPillars).toHaveLength(1)
  })

  it('returns empty array when no events for today', () => {
    const result = buildTodayEvents([], [], '2026/03/29')
    expect(result).toEqual([])
  })
})

describe('buildHoldingStatus', () => {
  it('formats holding with thesis scorecard summary', () => {
    const holdings = [{ code: '2330', name: '台積電', price: 1845, cost: 1700, qty: 1000 }]
    const theses = [
      {
        stockId: '2330',
        conviction: 'high',
        stopLoss: 1650,
        pillars: [{ status: 'on_track' }, { status: 'on_track' }, { status: 'watch' }],
      },
    ]
    const result = buildHoldingStatus(holdings, theses)
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('2330')
    expect(result[0].conviction).toBe('high')
    expect(result[0].pillarSummary).toContain('on_track')
    expect(result[0].pillarSummary).toContain('watch')
    expect(result[0].stopLossDistance).toBeCloseTo(10.57, 1)
  })

  it('handles holding without thesis', () => {
    const holdings = [{ code: '3017', name: '奇鋐', price: 498, cost: 450, qty: 500 }]
    const result = buildHoldingStatus(holdings, [])
    expect(result[0].conviction).toBeNull()
    expect(result[0].pillarSummary).toBe('')
  })
})

describe('buildInstitutionalSummary', () => {
  it('formats institutional flow data', () => {
    const institutional = {
      foreign: { buy: 1000000, sell: 800000, net: 200000 },
      investment: { buy: 500000, sell: 300000, net: 200000 },
      dealer: { buy: 100000, sell: 150000, net: -50000 },
    }
    const result = buildInstitutionalSummary(institutional)
    expect(result.foreign.net).toBe(200000)
    expect(result.investment.net).toBe(200000)
    expect(result.dealer.net).toBe(-50000)
  })

  it('returns null for missing data', () => {
    expect(buildInstitutionalSummary(null)).toBeNull()
    expect(buildInstitutionalSummary(undefined)).toBeNull()
  })
})

describe('buildWatchlistAlerts', () => {
  it('flags stocks near entry price', () => {
    const watchlist = [{ code: '3037', name: '欣興', entryPrice: 285, currentPrice: 290 }]
    const result = buildWatchlistAlerts(watchlist)
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('3037')
    expect(result[0].nearEntry).toBe(true)
  })

  it('does not flag stocks far from entry', () => {
    const watchlist = [{ code: '3037', name: '欣興', entryPrice: 285, currentPrice: 350 }]
    const result = buildWatchlistAlerts(watchlist)
    expect(result).toHaveLength(0)
  })
})

describe('buildMorningNote', () => {
  it('assembles all sections', () => {
    const result = buildMorningNote({
      holdings: [{ code: '2330', name: '台積電', price: 1845, cost: 1700, qty: 1000 }],
      theses: [{ stockId: '2330', conviction: 'high', pillars: [], stopLoss: 1650 }],
      events: [],
      watchlist: [],
      institutional: null,
      announcements: [],
      today: '2026/03/29',
    })
    expect(result.date).toBe('2026/03/29')
    expect(result.sections).toHaveProperty('todayEvents')
    expect(result.sections).toHaveProperty('holdingStatus')
    expect(result.sections).toHaveProperty('institutional')
    expect(result.sections).toHaveProperty('watchlistAlerts')
    expect(result.sections).toHaveProperty('announcements')
  })

  it('builds cross-page handoff links for dashboard surfaces', () => {
    const note = buildMorningNote({
      holdings: [{ code: '2330', name: '台積電', price: 1845 }],
      theses: [{ stockId: '2330', conviction: 'high', pillars: [], stopLoss: 1650 }],
      events: [
        {
          title: '台積電法說',
          date: '2026/03/29',
          stocks: ['台積電 2330'],
        },
      ],
      watchlist: [],
      announcements: [],
      today: '2026/03/29',
    })

    expect(buildMorningNoteDeepLinks(note)).toEqual([
      expect.objectContaining({ target: 'events', label: '前往事件' }),
      expect.objectContaining({ target: 'holdings', label: '查看持倉' }),
      expect.objectContaining({ target: 'daily', label: '盤後接續' }),
    ])
  })
})

describe('renderMorningNotePlainText', () => {
  it('renders plain text output', () => {
    const note = {
      date: '2026/03/29',
      sections: {
        todayEvents: [{ title: '台積電3月營收公布', impactLabel: 'HIGH', relatedPillars: [] }],
        holdingStatus: [
          {
            code: '2330',
            name: '台積電',
            conviction: 'high',
            price: 1845,
            stopLossDistance: 10.57,
            pillarSummary: '3/3 on_track',
          },
        ],
        institutional: {
          foreign: { net: 200000 },
          investment: { net: 100000 },
          dealer: { net: -50000 },
        },
        watchlistAlerts: [],
        announcements: [{ code: '2308', name: '台達電', title: '董事會通過配息12元' }],
      },
    }
    const text = renderMorningNotePlainText(note)
    expect(text).toContain('每日交易備忘')
    expect(text).toContain('台積電3月營收公布')
    expect(text).toContain('台積電')
    expect(text).toContain('HIGH')
    expect(text).toContain('台達電')
  })
})
