// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DailyReportPanel } from '../../src/components/reports/DailyReportPanel.jsx'

const baseProps = {
  morningNote: null,
  analysisHistory: [],
  analyzing: false,
  analyzeStep: '',
  stressResult: null,
  stressTesting: false,
  dailyExpanded: false,
  setDailyExpanded: vi.fn(),
  runDailyAnalysis: vi.fn(),
  runStressTest: vi.fn(),
  closeStressResult: vi.fn(),
  newsEvents: [],
  setTab: vi.fn(),
  setExpandedNews: vi.fn(),
  maybeAutoConfirmDailyReport: vi.fn(),
  expandedStock: null,
  setExpandedStock: vi.fn(),
  strategyBrain: {},
  staleStatus: 'fresh',
  operatingContext: null,
}

describe('accessibility smoke pack', () => {
  it('keeps keyboard-reachable primary actions in the empty daily state', () => {
    render(<DailyReportPanel {...baseProps} dailyReport={null} />)

    expect(screen.getByRole('button', { name: '開始今日收盤分析' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '⚠️ 風險壓力測試' })).toBeInTheDocument()
    expect(screen.getByText('資料狀態')).toBeInTheDocument()
  })

  it('keeps screen reader facing labels on the populated daily panel', () => {
    render(
      <DailyReportPanel
        {...baseProps}
        dailyReport={{
          id: 'daily-a11y',
          date: '2026/04/18',
          time: '18:40',
          totalTodayPnl: 28,
          changes: [],
          anomalies: [],
          eventCorrelations: [],
          eventAssessments: [],
          needsReview: [],
          aiInsight: '今晚先把結論收斂成明日動作。',
          analysisStage: 't1-confirmed',
          analysisStageLabel: '資料確認版',
          analysisVersion: 2,
          finmindConfirmation: {
            expectedMarketDate: '2026-04-18',
            status: 'confirmed',
            pendingCodes: [],
          },
          ritualMode: {
            label: '收盤後儀式模式',
            triggerSource: 'manual',
          },
          tomorrowActionCard: {
            title: '明日動作卡',
            immediateActions: ['2330 站回 5 日線再補回 1/3。'],
            watchlist: ['3443 等法說後再決定是否加碼。'],
          },
        }}
      />
    )

    expect(screen.getByRole('button', { name: '重新分析今日收盤' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '前往深度研究' })).toBeInTheDocument()
    expect(screen.getByText('收盤後儀式模式')).toBeInTheDocument()
    expect(screen.getByText('週報匯出內容')).toBeInTheDocument()
  })
})
