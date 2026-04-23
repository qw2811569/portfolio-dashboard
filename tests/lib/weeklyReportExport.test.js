import { describe, expect, it } from 'vitest'
import { buildWeeklyReportTemplate } from '../../src/lib/promptTemplateCatalog.js'
import {
  buildWeeklyReportFilename,
  buildWeeklyReportHtmlDocument,
} from '../../src/lib/weeklyReportExport.js'

function buildSampleWeeklyReport() {
  return buildWeeklyReportTemplate({
    portfolioName: '金聯成',
    complianceMode: 'retail',
    today: '2026/04/24',
    holdings: [{ code: '7865', name: '金聯成', cost: 88, qty: 2000, type: '股票', price: 95 }],
    watchlist: [{ code: '2454', name: '聯發科', price: 1180, target: 1300, status: '觀察中' }],
    analysisHistory: [
      {
        date: '2026/04/24',
        time: '14:00',
        totalTodayPnl: 12000,
        aiInsight: 'Weekly Narrative 應聚焦航運題材是否延續，以及事件驗證是否足夠。',
      },
    ],
    newsEvents: [
      {
        date: '2026/04/18',
        title: '運價更新',
        pred: 'up',
        actualNote: '運價優於預期',
        correct: true,
        status: 'closed',
      },
      {
        date: '2026/04/29',
        title: '法說會',
        pred: 'down',
        predReason: '市場預期偏高',
        status: 'pending',
      },
    ],
    strategyBrain: {
      rules: [{ text: '事件催化劑要搭配成交量驗證' }],
      candidateRules: [{ text: '航運運價續強時再加碼' }],
      checklists: { preEntry: ['先看量價'], preAdd: ['確認催化劑仍在'], preExit: [] },
      commonMistakes: ['過早追價'],
      stats: { hitRate: '4/5', totalAnalyses: 12 },
      lessons: [{ date: '2026/04/23', text: '沒有驗證樣本前不要寫成既定利多' }],
    },
    totalCost: 176000,
    totalVal: 190000,
    totalPnl: 14000,
    retPct: 7.95,
    isClosedEvent: (event) => event.status === 'closed',
    resolveHoldingPrice: (holding) => holding.price,
    getHoldingUnrealizedPnl: (holding) => (holding.price - holding.cost) * holding.qty,
    getHoldingReturnPct: (holding) => Math.round((holding.price / holding.cost - 1) * 10000) / 100,
    brainRuleSummary: (rule) => rule.text,
  })
}

describe('lib/weeklyReportExport', () => {
  it('builds offline html from the markdown weekly report payload', () => {
    const markdown = buildSampleWeeklyReport()
    const html = buildWeeklyReportHtmlDocument(markdown)

    expect(html).toMatch(/<!doctype html>/i)
    expect(html).toContain('<h2>Weekly Narrative</h2>')
    expect(html).toContain('<table>')
    expect(html).toContain('金聯成(7865)')
    expect(html).toContain('事件預測紀錄')
    expect(html).toContain('近 7 日收盤分析')
  })

  it('formats filenames with ISO week numbering', () => {
    const filename = buildWeeklyReportFilename('html', new Date('2026-01-01T12:00:00.000Z'))
    expect(filename).toBe('jiucaivoice-weekly-2026-01.html')
  })
})
