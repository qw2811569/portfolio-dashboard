import { describe, expect, it } from 'vitest'
import {
  PDF_CJK_FONT_FAMILY,
  PDF_CJK_FONT_REGISTRY,
  buildWeeklyPdfData,
  buildWeeklyPdfDefinition,
} from '../../src/lib/weeklyPdfBuilder.js'

describe('lib/weeklyPdfBuilder', () => {
  it('builds weekly PDF data with compliant insider section from compliance mode', () => {
    const data = buildWeeklyPdfData({
      portfolioName: '金聯成',
      complianceMode: 'insider-compressed',
      now: new Date('2026-04-26T00:00:00.000Z'),
      holdings: [{ code: '7865', name: '金聯成', qty: 1000, cost: 80, price: 90 }],
      newsEvents: [
        { date: '2026/04/20', title: '公告', status: 'closed' },
        { date: '2026/04/29', title: '法說', status: 'pending' },
      ],
      totalVal: 90000,
      totalPnl: 10000,
      retPct: 12.5,
      isClosedEvent: (event) => event.status === 'closed',
    })

    expect(data.insiderSection.copy).toContain('不輸出 AI 買賣建議')
    expect(data.verifiedEvents).toHaveLength(1)
    expect(data.pendingEvents).toHaveLength(1)

    const definition = buildWeeklyPdfDefinition(data)
    expect(definition.content.map((item) => item.text).filter(Boolean)).toContain(
      'Insider section · 金聯成'
    )
  })

  it('does not enable insider mode just because a magic stock code appears', () => {
    const data = buildWeeklyPdfData({
      portfolioName: '一般組合',
      complianceMode: 'retail',
      holdings: [{ code: '7865', name: '金聯成' }],
    })

    expect(data.insiderSection).toBeNull()
  })

  it('uses a registered CJK font instead of Roboto-only PDF output', () => {
    const definition = buildWeeklyPdfDefinition(
      buildWeeklyPdfData({
        portfolioName: '中文組合',
        holdings: [{ code: '2330', name: '台積電', qty: 1, cost: 900, price: 950 }],
      })
    )

    expect(definition.defaultStyle.font).toBe(PDF_CJK_FONT_FAMILY)
    expect(definition.defaultStyle.font).not.toBe('Roboto')
    expect(PDF_CJK_FONT_REGISTRY[PDF_CJK_FONT_FAMILY]).toEqual(
      expect.objectContaining({
        normal: expect.stringContaining('SourceHanSansTC'),
        bold: expect.stringContaining('SourceHanSansTC'),
      })
    )
  })
})
