// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWeeklyReportClipboard } from '../../src/hooks/useWeeklyReportClipboard.js'
import { downloadWeeklyPdf } from '../../src/lib/weeklyPdfBuilder.js'

vi.mock('../../src/lib/weeklyPdfBuilder.js', async () => {
  const actual = await vi.importActual('../../src/lib/weeklyPdfBuilder.js')
  return {
    ...actual,
    downloadWeeklyPdf: vi.fn(() => Promise.resolve()),
  }
})

describe('hooks/useWeeklyReportClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes active portfolio compliance mode into weekly PDF data', async () => {
    const { result } = renderHook(() =>
      useWeeklyReportClipboard({
        activePortfolioId: 'insider',
        portfolios: [
          {
            id: 'insider',
            name: '金聯成',
            compliance_mode: 'insider-compressed',
          },
        ],
        holdings: [{ code: '7865', name: '金聯成', qty: 1000, cost: 88, price: 95 }],
        now: () => new Date('2026-04-26T00:00:00.000Z'),
      })
    )

    let definition
    await act(async () => {
      definition = await result.current.downloadWeeklyReportPdf()
    })

    const contentText = definition.content.map((item) => item.text).filter(Boolean)
    expect(contentText).toContain('Insider section · 金聯成組合')
    expect(contentText).toContain(
      '本區僅列風險、狀態與公開資訊整理；不輸出 AI 買賣建議，不提供加碼、減碼或出場指令。'
    )
    expect(downloadWeeklyPdf).toHaveBeenCalledTimes(1)
  })
})
