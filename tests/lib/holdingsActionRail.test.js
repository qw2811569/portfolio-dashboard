import { describe, expect, it } from 'vitest'
import { buildTodayActions } from '../../src/lib/holdingsActionRail.js'

describe('lib/holdingsActionRail', () => {
  it('builds do, dont, and risk actions from alerts, targets, thesis, and concentration', () => {
    const actions = buildTodayActions({
      now: new Date('2026-04-26T04:00:00.000Z'),
      holdings: [
        {
          code: '2308',
          name: '台達電',
          price: 96,
          targetPrice: 100,
          value: 600000,
          pct: 12,
          alert: '⚡ 法說會後確認毛利率',
        },
        {
          code: '3037',
          name: '欣興',
          price: 80,
          value: 200000,
          pct: -12,
          createdAt: '2026-04-25',
        },
      ],
      dossiers: [
        {
          code: '3037',
          thesis: {
            targetPrice: 82,
            pillars: [{ id: 'p1', label: 'ABF 報價', status: 'at_risk' }],
          },
          events: [{ date: '2026-04-30', title: '法說會', stocks: ['3037'] }],
        },
      ],
    })

    expect(actions.doItems.some((item) => item.body.includes('法說會後確認'))).toBe(true)
    expect(actions.doItems.some((item) => item.body.includes('ABF 報價'))).toBe(true)
    expect(actions.dontItems.some((item) => item.body.includes('剛漲多'))).toBe(true)
    expect(actions.riskItems.some((item) => item.body.includes('單一部位'))).toBe(true)
    expect(actions.riskItems.some((item) => item.body.includes('回撤'))).toBe(true)
  })

  it('returns usable fallback actions when no rule is triggered', () => {
    const actions = buildTodayActions({
      holdings: [{ code: '0050', name: '元大台灣50', price: 100, value: 100000, pct: 1 }],
    })

    expect(actions.doItems).toHaveLength(1)
    expect(actions.dontItems.length).toBeGreaterThanOrEqual(1)
    expect(actions.riskItems).toHaveLength(1)
  })
})
