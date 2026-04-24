import { describe, expect, it } from 'vitest'
import {
  buildHoldingDetailDossier,
  normalizeHoldingDetailPillarStatus,
} from '../../src/lib/holdingDetailDossier.js'

describe('lib/holdingDetailDossier', () => {
  it('normalizes pillar states into intact / wobbly / broken', () => {
    expect(normalizeHoldingDetailPillarStatus('on_track')).toBe('intact')
    expect(normalizeHoldingDetailPillarStatus('watch')).toBe('wobbly')
    expect(normalizeHoldingDetailPillarStatus('behind')).toBe('wobbly')
    expect(normalizeHoldingDetailPillarStatus('broken')).toBe('broken')
  })

  it('builds a canonical per-stock detail dossier from holdings + dossier + daily + research state', () => {
    const result = buildHoldingDetailDossier({
      code: '2330',
      holdings: [{ code: '2330', name: '台積電', qty: 10, cost: 900, price: 950, type: '股票' }],
      holdingDossiers: [
        {
          code: '2330',
          name: '台積電',
          position: { price: 950 },
          thesis: {
            summary: 'AI 需求延續',
            updatedAt: '2026-04-24T08:30:00.000Z',
            pillars: [
              { id: 'p1', label: '先進製程需求', status: 'on_track', lastChecked: '2026-04-24' },
              { id: 'p2', label: 'CoWoS 產能', status: 'watch', lastChecked: '2026-04-23' },
            ],
          },
          freshness: {
            targets: 'fresh',
            fundamentals: 'aging',
          },
          fundamentals: {
            updatedAt: '2026-04-20T08:00:00.000Z',
          },
          targets: [{ firm: '元大', target: 1180, date: '2026-04-22' }],
          targetAggregate: {
            lowerBound: 900,
            upperBound: 1200,
            rateDate: '2026-04-22',
          },
          finmind: {
            valuation: [{ per: 24.5, pbr: 7.2, dividendYield: 0.021 }],
            institutional: [
              { date: '2026-04-24', foreign: 1200, investment: 100, dealer: -80 },
              { date: '2026-04-23', foreign: 800, investment: 50, dealer: -20 },
              { date: '2026-04-22', foreign: -300, investment: 20, dealer: 10 },
            ],
          },
        },
      ],
      dailyReport: {
        id: 'daily-t1',
        date: '2026-04-24',
        analysisStage: 't1-confirmed',
        analysisStageLabel: '資料確認版',
        changes: [{ code: '2330', price: 950, changePct: 1.2, todayPnl: 128 }],
        eventAssessments: [
          {
            eventId: 'evt-1',
            title: '台積電法說後追蹤',
            summary: '台積電法說顯示先進製程需求仍穩。',
          },
        ],
        aiInsight: '2330 法說後先看先進製程與 CoWoS 動能是否延續。',
      },
      analysisHistory: [
        {
          id: 'daily-t0',
          date: '2026-04-23',
          analysisStage: 't0-preliminary',
          analysisStageLabel: '收盤快版',
          changes: [{ code: '2330', price: 940, changePct: -0.8, todayPnl: -80 }],
        },
      ],
      researchHistory: [
        {
          id: 'research-1',
          timestamp: Date.parse('2026-04-24T09:10:00.000Z'),
          title: '台積電研究',
          summary: '整體研究摘要',
          stockSummaries: [{ code: '2330', summary: '先進製程擴產節奏仍在主線上。' }],
        },
      ],
      newsEvents: [
        {
          id: 'evt-earnings',
          title: '台積電法說會',
          eventDate: '2026-04-25',
          status: 'pending',
          stocks: ['2330 台積電'],
          type: '法說',
        },
      ],
      strategyBrain: {
        lastUpdate: '2026-04-24',
        evolution: '先進製程主線穩，但要追蹤 CoWoS 產能。',
        rules: [],
        candidateRules: [],
      },
    })

    expect(result).toMatchObject({
      code: '2330',
      displayName: '台積電',
      pillarStatus: 'wobbly',
      thesis: {
        text: 'AI 需求延續',
        updatedAt: '2026-04-24T08:30:00.000Z',
      },
      valuation: {
        currentPrice: 950,
        pe: 24.5,
        pbr: 7.2,
        targetPrice: 1180,
        targetDate: '2026-04-22',
      },
      latestResearchSlice: {
        headline: '台積電研究',
        summary: '先進製程擴產節奏仍在主線上。',
      },
    })

    expect(result.thesis.pillars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '先進製程需求', status: 'intact' }),
        expect.objectContaining({ label: 'CoWoS 產能', status: 'wobbly' }),
      ])
    )
    expect(result.recentDailyMentions).toHaveLength(2)
    expect(result.recentDailyMentions[0]).toMatchObject({
      date: '2026-04-24',
      reportStage: '資料確認版',
    })
    expect(result.recentDailyMentions[0].mention).toContain('收盤 950')
    expect(result.recentDailyMentions[0].mention).toContain('台積電法說顯示先進製程需求仍穩')
    expect(result.relatedEvents).toEqual([
      expect.objectContaining({
        type: 'earnings',
        date: '2026-04-25',
        label: '台積電法說會',
      }),
    ])
    expect(result.institutionalFlow).toMatchObject({
      lastUpdated: '2026-04-24',
      total5d: 1780,
    })
    expect(result.freshness).toMatchObject({
      targets: '2026-04-22',
      fundamentals: '2026-04-20T08:00:00.000Z',
      statuses: {
        targets: 'fresh',
        fundamentals: 'aging',
      },
    })
  })

  it('falls back to strategy brain slice when research history has no direct entry', () => {
    const result = buildHoldingDetailDossier({
      code: '2308',
      holdings: [{ code: '2308', name: '台達電', qty: 1, cost: 320, price: 380 }],
      holdingDossiers: [{ code: '2308', name: '台達電', thesis: null }],
      strategyBrain: {
        lastUpdate: '2026-04-24',
        rules: [
          {
            id: 'brain-1',
            text: '台達電要先看 AI 電源訂單是否續強。',
            lastValidatedAt: '2026-04-24',
            evidenceRefs: [{ code: '2308', date: '2026-04-24' }],
          },
        ],
        candidateRules: [],
        evolution: '',
      },
    })

    expect(result.latestResearchSlice).toMatchObject({
      headline: '策略腦最近脈絡',
      sourceReportId: 'brain-1',
    })
    expect(result.latestResearchSlice.summary).toContain('台達電要先看 AI 電源訂單是否續強')
  })

  it('returns null when the stock is not present in canonical state', () => {
    expect(buildHoldingDetailDossier({ code: '9999', holdings: [], holdingDossiers: [] })).toBe(
      null
    )
  })
})
