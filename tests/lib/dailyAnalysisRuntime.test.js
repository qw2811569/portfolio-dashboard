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
  extractDailyBrainUpdate,
  extractDailyEventAssessments,
  extractTomorrowActionCard,
  stripDailyAnalysisEmbeddedBlocks,
  buildTaiwanMarketSignals,
  formatTaiwanMarketSignals,
  formatHistoricalAnalogsForPrompt,
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
    const signals = buildTaiwanMarketSignals({
      today: '2026-03-28',
      holdings: [{ code: '2330', name: '台積電' }],
      dossiers: [
        {
          code: '2330',
          name: '台積電',
          meta: { industry: '半導體' },
          fundamentals: {
            revenueYoY: 25.6,
            institutionalInvestors: {
              last5Days: { foreign: 1200, investmentTrust: 150, dealer: -20 },
            },
          },
          targets: [{ firm: '高盛', target: 1200, date: '2026-03-20' }],
        },
      ],
      newsEvents: [
        {
          id: 'e1',
          title: '台積電法說會',
          type: 'conference',
          date: '2026-03-30',
          stocks: ['台積電 2330'],
        },
      ],
    })
    const analysisRequest = buildDailyAnalysisRequest({
      today: '2026/03/28',
      holdingSummary: '持股摘要',
      coverageContext: '創意(3443) | 上游: 台積電 | 相關主題: CoWoS',
      blindPredictions: [],
      taiwanMarketSignals: formatTaiwanMarketSignals(signals),
      historicalAnalogs: formatHistoricalAnalogsForPrompt({
        2330: [
          {
            code: 'sc-001',
            name: '2023 台積電 AI 行情 - 成功案例',
            period: '2026-03-30',
            thesis: 'AI 趨勢',
            verdict: 'supported',
            note: 'test note',
          },
        ],
      }),
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
      analysisStage: 't1-confirmed',
      analysisStageLabel: '資料確認版',
      analysisVersion: 2,
      rerunReason: 'finmind-confirmed',
      finmindConfirmation: {
        expectedMarketDate: '2026-03-28',
        status: 'confirmed',
        pendingCodes: [],
      },
      ritualMode: {
        mode: 'post-close',
        label: '收盤後儀式模式',
        triggerSource: 'manual',
      },
      tomorrowActionCard: {
        title: '明日動作卡',
        immediateActions: ['2330 站回月線才加碼'],
        watchlist: ['3443 等法說後再看'],
      },
    })

    expect(request.systemPrompt).toContain('這是盲測')
    expect(request.systemPrompt).toContain('【Accuracy Gate】')
    expect(request.maxTokens).toBe(900)
    expect(request.allowThinking).toBe(false)
    expect(request.userPrompt).toContain('持股摘要')
    expect(request.userPrompt).toContain('【Accuracy Gate】')
    expect(request.userPrompt).toContain('<analysis_packet mode="blind_prediction">')
    expect(request.userPrompt).toContain('<instruction>')
    expect(analysisRequest.systemPrompt).toContain('A 級優先處理')
    expect(analysisRequest.systemPrompt).toContain('【Accuracy Gate】')
    expect(analysisRequest.systemPrompt).toContain('700-1200 字為目標')
    expect(analysisRequest.maxTokens).toBe(2200)
    expect(analysisRequest.allowThinking).toBe(false)
    expect(analysisRequest.userPrompt).toContain('<analysis_packet mode="daily_close">')
    expect(analysisRequest.userPrompt).toContain('【Accuracy Gate】')
    expect(analysisRequest.userPrompt).toContain('<coverage_context>')
    expect(analysisRequest.userPrompt).toContain('創意(3443) | 上游: 台積電 | 相關主題: CoWoS')
    expect(analysisRequest.userPrompt).toContain('<taiwan_market_signals>')
    expect(analysisRequest.userPrompt).toContain('月營收YoY')
    expect(analysisRequest.userPrompt).toContain('<historical_analogs>')
    expect(analysisRequest.userPrompt).toContain('2023 台積電 AI 行情 - 成功案例')
    expect(analysisRequest.userPrompt).toContain('<portfolio_holdings>')
    expect(analysisRequest.userPrompt).toContain('A 級優先處理只選 1-3 檔')
    expect(analysisRequest.userPrompt).toContain('不要在每檔持股重複改寫整段供應鏈')
    expect(analysisRequest.userPrompt).toContain('必須先寫完整的中文分析評論')
    expect(extractDailyEventAssessments(insight)).toEqual([])
    expect(extractDailyBrainUpdate(insight)).toEqual({})
    expect(stripDailyAnalysisEmbeddedBlocks(insight)).toBe('## 今日總結\nOK')
    expect(report).toMatchObject({
      date: '2026/03/28',
      totalTodayPnl: 1234,
      injectedKnowledgeIds: ['fa-001', 'rm-001'],
      analysisStage: 't1-confirmed',
      analysisStageLabel: '資料確認版',
      analysisVersion: 2,
      rerunReason: 'finmind-confirmed',
      finmindConfirmation: expect.objectContaining({
        expectedMarketDate: '2026-03-28',
        status: 'confirmed',
      }),
      ritualMode: expect.objectContaining({
        label: '收盤後儀式模式',
      }),
      tomorrowActionCard: expect.objectContaining({
        title: '明日動作卡',
      }),
    })
  })

  it('falls back to raw text when the analysis only contains embedded json blocks', () => {
    const jsonOnlyInsight = `## 📋 EVENT_ASSESSMENTS\n\`\`\`json\n[]\n\`\`\`\n## 🧬 BRAIN_UPDATE\n\`\`\`json\n{}\n\`\`\`\n`

    expect(stripDailyAnalysisEmbeddedBlocks(jsonOnlyInsight)).toContain('## 📋 EVENT_ASSESSMENTS')
    expect(stripDailyAnalysisEmbeddedBlocks(jsonOnlyInsight)).toContain('## 🧬 BRAIN_UPDATE')
  })

  it('extracts and strips embedded blocks even when headings, emoji, and code fences vary', () => {
    const mixedInsight = `## 今日總結\n先看評論\n\n🛠 EVENT_ASSESSMENTS\n[{"eventId":"evt-1","todayImpact":"positive"}]\n\n### 🧬 BRAIN_UPDATE\n{"rules":[{"text":"法說前兩週布局"}]}\n`

    expect(extractDailyEventAssessments(mixedInsight)).toEqual([
      { eventId: 'evt-1', todayImpact: 'positive' },
    ])
    expect(extractDailyBrainUpdate(mixedInsight)).toEqual({
      rules: [{ text: '法說前兩週布局' }],
    })
    expect(stripDailyAnalysisEmbeddedBlocks(mixedInsight)).toBe('## 今日總結\n先看評論')
  })

  it('extracts a tomorrow action card from the ritual section', () => {
    const insight = `## 今日總結
今晚先守紀律。

## 🎯 明日觀察與操作建議
明日立即執行
1. 2330 若站回 5 日線，先補回 1/3；如果我錯了：量縮跌破今日低點。
2. 2317 開高不追，等拉回再看。
觀察清單
- 3443 等法說後再決定是否加碼。
- 2454 只觀察法人續買。`

    expect(extractTomorrowActionCard(insight)).toEqual({
      title: '明日動作卡',
      summary: '',
      immediateActions: [
        '2330 若站回 5 日線，先補回 1/3；如果我錯了：量縮跌破今日低點。',
        '2317 開高不追，等拉回再看。',
      ],
      watchlist: ['3443 等法說後再決定是否加碼。', '2454 只觀察法人續買。'],
      notes: [],
      sourceSection: `明日立即執行
1. 2330 若站回 5 日線，先補回 1/3；如果我錯了：量縮跌破今日低點。
2. 2317 開高不追，等拉回再看。
觀察清單
- 3443 等法說後再決定是否加碼。
- 2454 只觀察法人續買。`,
    })
  })
})
