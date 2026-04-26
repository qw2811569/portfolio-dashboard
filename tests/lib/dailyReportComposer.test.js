import { describe, expect, it } from 'vitest'
import { composeDailyReportRitual } from '../../src/lib/dailyReportComposer.js'

describe('lib/dailyReportComposer', () => {
  it('builds hero, pillars, per-holding actions, archive, and hit rows', () => {
    const ritual = composeDailyReportRitual({
      dailyReport: {
        id: 'd1',
        date: '2026/04/26',
        time: '18:40',
        aiInsight: '今日收盤先看基本面與事件驗證。',
        changes: [{ code: '2330', name: '台積電', changePct: 2.1, todayPnl: 100 }],
      },
      analysisHistory: [
        {
          id: 'd0',
          date: '2026/04/25',
          hitRate: 67,
          eventAssessments: [{ correct: true }, { correct: false }],
        },
      ],
    })

    expect(ritual.hero.text).toContain('今日收盤')
    expect(ritual.pillars.map((pillar) => pillar.title)).toEqual(['基本面', '事件', '風險'])
    expect(ritual.holdingActions[0]).toMatchObject({ code: '2330', action: '續抱' })
    expect(ritual.archive.map((item) => item.date)).toEqual(['2026/04/26', '2026/04/25'])
    expect(ritual.hitRows[0].rate).toBe(50)
  })

  it('uses an explicit Taipei waiting time when report insight is missing', () => {
    const ritual = composeDailyReportRitual({ dailyReport: null })

    expect(ritual.hero.waiting).toBe(true)
    expect(ritual.hero.text).toContain('08:30（台北時間）')
  })
})
