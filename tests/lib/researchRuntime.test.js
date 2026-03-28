import { describe, expect, it } from 'vitest'
import {
  buildResearchDossiers,
  buildResearchRequestBody,
  buildResearchStocks,
  getPrimaryResearchResult,
  getResearchTargetKey,
  mergeResearchHistoryEntries,
} from '../../src/lib/researchRuntime.js'

describe('lib/researchRuntime', () => {
  it('builds research target labels and stock snapshots', () => {
    const holdings = [
      { code: '2330', name: '台積電', cost: 900, qty: 1000, type: '股票', price: 950 },
      { code: '2454', name: '聯發科', cost: 1200, qty: 500, type: '股票', price: 1180 },
    ]

    const stocks = buildResearchStocks({
      mode: 'portfolio',
      holdings,
      resolveHoldingPrice: (holding) => holding.price,
      getHoldingUnrealizedPnl: (holding) => (holding.price - holding.cost) * holding.qty,
      getHoldingReturnPct: (holding) =>
        Math.round((holding.price / holding.cost - 1) * 10000) / 100,
    })

    expect(getResearchTargetKey('single', holdings[0])).toBe('2330')
    expect(getResearchTargetKey('evolve')).toBe('EVOLVE')
    expect(stocks).toEqual([
      expect.objectContaining({ code: '2330', pnl: 50000, pct: 5.56 }),
      expect.objectContaining({ code: '2454', pnl: -10000, pct: -1.67 }),
    ])
  })

  it('builds research dossiers and request payload with evolve extras', () => {
    const dossierByCode = new Map([
      [
        '2330',
        {
          code: '2330',
          name: '台積電',
          position: { type: '股票' },
          thesis: { summary: 'AI 伺服器' },
        },
      ],
    ])
    const stocks = [
      { code: '2330', name: '台積電', price: 950, pnl: 50000, pct: 5.56, cost: 900, type: '股票' },
    ]
    const researchDossiers = buildResearchDossiers({ stocks, dossierByCode })
    const body = buildResearchRequestBody({
      mode: 'evolve',
      stocks,
      holdings: stocks,
      researchDossiers,
      stockMeta: { 2330: { industry: '半導體' } },
      strategyBrain: { rules: [{ text: '規則 A' }] },
      portfolioNotes: { riskProfile: '積極' },
      canUseCloud: true,
      newsEvents: [{ id: 'e1' }, { id: 'e2' }],
      analysisHistory: [{ id: 1 }, { id: 2 }],
    })

    expect(researchDossiers).toEqual([
      expect.objectContaining({
        code: '2330',
        position: expect.objectContaining({ price: 950, pnl: 50000, pct: 5.56 }),
      }),
    ])
    expect(body).toMatchObject({
      mode: 'evolve',
      persist: true,
      events: [{ id: 'e1' }, { id: 'e2' }],
      analysisHistory: [{ id: 1 }, { id: 2 }],
    })
  })

  it('dedupes research history and extracts the primary result', () => {
    const merged = mergeResearchHistoryEntries(
      [{ timestamp: 2, title: 'newer' }],
      [
        { timestamp: 1, title: 'older' },
        { timestamp: 2, title: 'duplicate' },
      ]
    )

    expect(merged).toEqual([
      { timestamp: 2, title: 'newer' },
      { timestamp: 1, title: 'older' },
    ])
    expect(getPrimaryResearchResult({ results: [{ code: '2330' }, { code: '2454' }] })).toEqual({
      code: '2330',
    })
    expect(getPrimaryResearchResult({ results: [] })).toBeNull()
  })
})
