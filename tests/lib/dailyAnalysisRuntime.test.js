import { describe, expect, it } from 'vitest'
import {
  buildBlindPredictionBlock,
  buildBlindPredictionRequest,
  buildDailyAnalysisRequest,
  buildDailyChanges,
  buildDailyEventCollections,
  buildDailyReport,
  buildPreviousPredictionReviewBlock,
  calculatePredictionScores,
  stripDailyAnalysisEmbeddedBlocks,
} from '../../src/lib/dailyAnalysisRuntime.js'

describe('lib/dailyAnalysisRuntime', () => {
  it('builds sorted daily change snapshots from quotes and holdings fallbacks', () => {
    const changes = buildDailyChanges({
      holdings: [
        { code: '2330', name: '台積電', type: 'stock', cost: 900, qty: 1000, price: 905 },
        { code: '2454', name: '聯發科', type: 'stock', cost: 1200, qty: 500, price: 1190 },
      ],
      priceMap: {
        2330: { price: 950, yesterday: 940, change: 10, changePct: 1.06 },
      },
      resolveHoldingPrice: (holding) => holding.price,
      getHoldingUnrealizedPnl: (holding) => (holding.price - holding.cost) * holding.qty,
      getHoldingReturnPct: (holding) =>
        Math.round((holding.price / holding.cost - 1) * 10000) / 100,
    })

    expect(changes.map((item) => item.code)).toEqual(['2330', '2454'])
    expect(changes[0]).toMatchObject({
      code: '2330',
      todayPnl: 10000,
      totalPnl: 50000,
      totalPct: 5.56,
    })
    expect(changes[1]).toMatchObject({
      code: '2454',
      price: 1190,
      todayPnl: 0,
      totalPnl: -5000,
      totalPct: -0.83,
    })
  })

  it('builds pending event collections, anomalies and review candidates', () => {
    const result = buildDailyEventCollections({
      newsEvents: [
        {
          id: 'e1',
          title: '法說',
          date: '2026/03/27',
          stocks: ['台積電 2330'],
          status: 'tracking',
        },
        {
          id: 'e2',
          title: '已結案',
          date: '2026/03/20',
          stocks: ['聯發科 2454'],
          status: 'closed',
        },
      ],
      defaultNewsEvents: [],
      isClosedEvent: (event) => event.status === 'closed',
      changes: [
        { code: '2330', name: '台積電', changePct: 4.2, change: 38 },
        { code: '2454', name: '聯發科', changePct: 0.4, change: 5 },
      ],
      today: '2026/03/28',
    })

    expect(result.pendingEvents).toHaveLength(1)
    expect(result.anomalies).toEqual([expect.objectContaining({ code: '2330' })])
    expect(result.eventCorrelations).toEqual([
      expect.objectContaining({
        id: 'e1',
        relatedStocks: [expect.objectContaining({ code: '2330', changePct: 4.2 })],
      }),
    ])
    expect(result.needsReview).toEqual([expect.objectContaining({ id: 'e1' })])
  })

  it('builds previous prediction review blocks and locked blind prediction block', () => {
    const prevReviewBlock = buildPreviousPredictionReviewBlock({
      date: '2026/03/27',
      blindPredictions: [{ code: '2330' }],
      predictionScores: {
        accuracy: 0.5,
        details: [
          { name: '台積電', predicted: 'up', actual: 'down', error: 4.2 },
          { name: '聯發科', predicted: 'flat', actual: 'flat', error: 0.2 },
        ],
      },
    })
    const blindPredBlock = buildBlindPredictionBlock([
      { code: '2330', direction: 'up', confidence: 8 },
    ])

    expect(prevReviewBlock).toContain('上次盲測準確率：50%')
    expect(prevReviewBlock).toContain('台積電 預測up，實際down')
    expect(blindPredBlock).toContain('你的盲測預測（已鎖定，不可修改）')
    expect(blindPredBlock).toContain('"2330"')
  })

  it('scores blind predictions against actual changes', () => {
    const scores = calculatePredictionScores(
      [
        { code: '2330', name: '台積電', direction: 'up', confidence: 8 },
        { code: '2454', name: '聯發科', direction: 'flat', confidence: 4 },
      ],
      [
        { code: '2330', name: '台積電', changePct: 1.2 },
        { code: '2454', name: '聯發科', changePct: -2.5 },
      ]
    )

    expect(scores).toMatchObject({
      correctCount: 1,
      total: 2,
      accuracy: 0.5,
    })
    expect(scores.weightedScore).toBeCloseTo(0.6, 5)
    expect(scores.details).toEqual([
      expect.objectContaining({ code: '2330', correct: true, actual: 'up' }),
      expect.objectContaining({ code: '2454', correct: false, actual: 'down', dirScore: -0.5 }),
    ])
  })

  it('builds prompt payloads and strips embedded json blocks from insight text', () => {
    const request = buildBlindPredictionRequest({
      today: '2026/03/28',
      notesContext: '筆記',
      brainContext: '大腦',
      blindHoldingSummary: '持股摘要',
      eventSummary: '事件摘要',
    })
    const analysisRequest = buildDailyAnalysisRequest({
      today: '2026/03/28',
      holdingSummary: '持股摘要',
      blindPredictions: [],
    })
    const insight = `## 今日總結\nOK\n## 📋 EVENT_ASSESSMENTS\n\`\`\`json\n[]\n\`\`\`\n## 🧬 BRAIN_UPDATE\n\`\`\`json\n{}\n\`\`\`\n`
    const report = buildDailyReport({
      today: '2026/03/28',
      totalTodayPnl: 1234,
      changes: [],
      anomalies: [],
      eventCorrelations: [],
      needsReview: [],
      injectedKnowledgeIds: ['fa-001', 'rm-001', 'fa-001'],
    })

    expect(request.systemPrompt).toContain('這是盲測')
    expect(request.userPrompt).toContain('持股摘要')
    expect(analysisRequest.systemPrompt).toContain('A 級優先處理')
    expect(analysisRequest.systemPrompt).toContain('700-1200 字為目標')
    expect(analysisRequest.userPrompt).toContain('只深寫最需要處理的 1-3 檔')
    expect(stripDailyAnalysisEmbeddedBlocks(insight)).toBe('## 今日總結\nOK')
    expect(report).toMatchObject({
      date: '2026/03/28',
      totalTodayPnl: 1234,
      injectedKnowledgeIds: ['fa-001', 'rm-001'],
    })
  })
})
