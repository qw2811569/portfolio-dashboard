import { describe, expect, it } from 'vitest'
import {
  buildEventReviewBrainSystemPrompt,
  buildEventReviewBrainUserPrompt,
  buildWeeklyReportTemplate,
} from '../../src/lib/promptTemplateCatalog.js'

describe('lib/promptTemplateCatalog', () => {
  it('builds the event review brain prompts with stable fixed copy', () => {
    const systemPrompt = buildEventReviewBrainSystemPrompt()
    const userPrompt = buildEventReviewBrainUserPrompt({
      event: { title: '法說會', pred: 'up', predReason: '市場預期上修' },
      notesContext: '投資偏好：成長股',
      reviewDossierContext: '',
      actual: 'down',
      savedNote: '法說不如預期',
      wasCorrect: false,
      reviewedEvent: { eventDate: '2026/03/20', exitDate: '2026/03/28' },
      reviewDate: '2026/03/28',
      savedLessons: '',
      currentBrain: { rules: [{ text: '營收連增可續抱' }] },
    })

    expect(systemPrompt).toContain('你是策略知識庫管理器')
    expect(systemPrompt).toContain('【Accuracy Gate】')
    expect(systemPrompt).toContain('historicalAnalogs')
    expect(userPrompt).toContain('事件：法說會')
    expect(userPrompt).toContain('【Accuracy Gate】')
    expect(userPrompt).toContain('預測：看漲')
    expect(userPrompt).toContain('實際走勢：下跌')
    expect(userPrompt).toContain('無可用持股 dossier')
    expect(userPrompt).toContain('用戶覆盤心得：（未填）')
  })

  it('builds the weekly report template with portfolio and brain sections', () => {
    const report = buildWeeklyReportTemplate({
      today: '2026/03/28',
      holdings: [{ code: '2330', name: '台積電', cost: 900, qty: 1000, type: '股票', price: 950 }],
      watchlist: [{ code: '2454', name: '聯發科', price: 1180, target: 1300, status: '觀察中' }],
      analysisHistory: [
        { date: '2026/03/28', time: '14:00', totalTodayPnl: 5000, aiInsight: 'AI 看法摘要' },
      ],
      newsEvents: [
        {
          date: '2026/03/20',
          title: '法說',
          pred: 'up',
          actualNote: '結果優於預期',
          correct: true,
          status: 'closed',
        },
        {
          date: '2026/03/30',
          title: '營收',
          pred: 'down',
          predReason: '基期偏高',
          status: 'pending',
        },
      ],
      strategyBrain: {
        rules: [{ text: '規則 A' }],
        candidateRules: [],
        checklists: { preEntry: ['先看量價'], preAdd: [], preExit: [] },
        commonMistakes: ['追高'],
        stats: { hitRate: '3/4', totalAnalyses: 9 },
        lessons: [{ date: '2026/03/27', text: '不要忽略流動性' }],
      },
      totalCost: 900000,
      totalVal: 950000,
      totalPnl: 50000,
      retPct: 5.56,
      isClosedEvent: (event) => event.status === 'closed',
      resolveHoldingPrice: (holding) => holding.price,
      getHoldingUnrealizedPnl: (holding) => (holding.price - holding.cost) * holding.qty,
      getHoldingReturnPct: (holding) =>
        Math.round((holding.price / holding.cost - 1) * 10000) / 100,
      brainRuleSummary: (rule) => rule.text,
    })

    expect(report).toContain('# 持倉看板週報素材')
    expect(report).toContain('持股數：1 檔')
    expect(report).toContain('事件預測命中率：100%（1/1）')
    expect(report).toContain('台積電(2330)')
    expect(report).toContain('聯發科(2454)')
    expect(report).toContain('## 策略大腦')
    expect(report).toContain('先看量價')
  })
})
