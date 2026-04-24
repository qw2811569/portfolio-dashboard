import { describe, expect, it } from 'vitest'
import { buildAnxietyMetrics } from '../../src/lib/anxietyMetrics.js'

describe('lib/anxietyMetrics', () => {
  it('derives X2-X5 from existing dossier, holdings, and event data while leaving X1 truthful', () => {
    const result = buildAnxietyMetrics({
      holdings: [
        { code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, value: 9500 },
        { code: '2454', name: '聯發科', qty: 5, cost: 1200, price: 1220, value: 6100 },
      ],
      holdingDossiers: [
        {
          code: '2330',
          name: '台積電',
          thesis: {
            statement: 'AI 需求延續',
            pillars: [
              { id: 'p1', text: 'CoWoS 產能續開', status: 'broken' },
              { id: 'p2', text: '先進製程滿載', status: 'on_track' },
            ],
          },
          finmind: {
            institutional: [
              { date: '2026-04-24', foreign: 100, investment: 30, dealer: -10 },
              { date: '2026-04-23', foreign: -20, investment: 10, dealer: 0 },
              { date: '2026-04-22', foreign: 10, investment: 5, dealer: 0 },
            ],
          },
        },
        {
          code: '2454',
          name: '聯發科',
          thesis: {
            statement: '手機回補',
            pillars: [{ id: 'p3', text: '庫存去化', status: 'watch' }],
          },
          finmind: {
            institutional: [
              { date: '2026-04-24', foreign: -50, investment: 0, dealer: -10 },
              { date: '2026-04-23', foreign: -20, investment: 0, dealer: -5 },
            ],
          },
        },
      ],
      newsEvents: [
        {
          id: 'evt-1',
          title: '台積電法說',
          status: 'pending',
          eventDate: '2026-04-25',
          stocks: ['台積電 2330'],
        },
        {
          id: 'evt-2',
          title: '聯發科法說',
          status: 'tracking',
          eventDate: '2026-04-27',
          stocks: ['聯發科 2454'],
        },
      ],
      now: new Date('2026-04-24T09:00:00+08:00'),
    })

    const byId = Object.fromEntries(result.metrics.map((metric) => [metric.id, metric]))

    expect(byId.x1.availability).toBe('placeholder')
    expect(byId.x2.tone).toBe('alert')
    expect(byId.x2.currentValue).toContain('主線')
    expect(byId.x3.availability).toBe('ready')
    expect(byId.x3.sparkline).toEqual([15, -35, 60])
    expect(byId.x4.currentValue).toContain('HHI')
    expect(byId.x5.currentValue).toBe('3 天內 2 件')
    expect(result.readyCount).toBe(4)
    expect(result.placeholderCount).toBe(1)
  })

  it('uses a real z-score when dailyReport already carries one', () => {
    const result = buildAnxietyMetrics({
      dailyReport: {
        marketContext: {
          relativeMarketZScore7d: 1.7,
        },
      },
    })

    const x1 = result.metrics.find((metric) => metric.id === 'x1')

    expect(x1.availability).toBe('ready')
    expect(x1.currentValue).toBe('+1.7σ')
    expect(x1.tone).toBe('warn')
  })
})
