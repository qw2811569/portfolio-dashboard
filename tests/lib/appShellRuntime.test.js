import { describe, expect, it } from 'vitest'
import {
  buildLivePortfolioSnapshot,
  filterEventsByType,
  resolveRuntimeNewsEvents,
} from '../../src/lib/appShellRuntime.js'

describe('lib/appShellRuntime.js', () => {
  it('builds a stable live portfolio snapshot shape', () => {
    expect(
      buildLivePortfolioSnapshot({
        holdings: [{ code: '2330' }],
        tradeLog: [{ id: 1 }],
        targets: { 2330: { targetPrice: 1000 } },
        portfolioNotes: { riskProfile: 'medium' },
      })
    ).toEqual({
      holdings: [{ code: '2330' }],
      tradeLog: [{ id: 1 }],
      targets: { 2330: { targetPrice: 1000 } },
      fundamentals: null,
      watchlist: null,
      analystReports: null,
      reportRefreshMeta: null,
      holdingDossiers: null,
      newsEvents: null,
      analysisHistory: null,
      dailyReport: null,
      reversalConditions: null,
      strategyBrain: null,
      researchHistory: null,
      portfolioNotes: { riskProfile: 'medium' },
    })
  })

  it('resolves runtime events and filters by type with fallback rows', () => {
    const fallbackEvents = [
      { id: 'a', type: 'earnings' },
      { id: 'b', type: 'news' },
    ]

    expect(resolveRuntimeNewsEvents(null, fallbackEvents)).toEqual(fallbackEvents)
    expect(
      filterEventsByType({
        newsEvents: null,
        fallbackEvents,
        filterType: '全部',
        allFilterLabel: '全部',
      })
    ).toEqual(fallbackEvents)
    expect(
      filterEventsByType({
        newsEvents: null,
        fallbackEvents,
        filterType: 'news',
        allFilterLabel: '全部',
      })
    ).toEqual([{ id: 'b', type: 'news' }])
  })
})
