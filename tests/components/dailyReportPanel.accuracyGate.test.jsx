// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DailyReportPanel } from '../../src/components/reports/DailyReportPanel.jsx'

function buildProps(overrides = {}) {
  return {
    morningNote: {
      date: '2026/04/24',
      sections: {
        todayEvents: [{ title: '台積電法說', impactLabel: 'HIGH' }],
        holdingStatus: [],
        watchlistAlerts: [],
        announcements: [],
      },
    },
    analysisHistory: [],
    analyzing: false,
    analyzeStep: '',
    stressResult: null,
    stressTesting: false,
    dailyExpanded: true,
    setDailyExpanded: vi.fn(),
    runDailyAnalysis: vi.fn(),
    runStressTest: vi.fn(),
    closeStressResult: vi.fn(),
    newsEvents: [],
    setTab: vi.fn(),
    setExpandedNews: vi.fn(),
    maybeAutoConfirmDailyReport: vi.fn(() =>
      Promise.resolve({
        status: 'waiting',
        confirmation: {
          pendingCodes: ['2330'],
        },
      })
    ),
    expandedStock: null,
    setExpandedStock: vi.fn(),
    strategyBrain: {},
    staleStatus: 'fresh',
    operatingContext: { portfolioLabel: '測試組合' },
    dailyReport: {
      id: 'daily-gate',
      date: '2026/04/24',
      time: '18:40',
      totalTodayPnl: 128,
      changes: [{ code: '2330', name: '台積電', price: 950, changePct: 1.2, todayPnl: 128 }],
      anomalies: [],
      eventCorrelations: [],
      eventAssessments: [],
      needsReview: [],
      aiInsight: '先看今天是否該加碼。',
      analysisStage: 't0-preliminary',
      analysisStageLabel: '收盤快版',
      analysisVersion: 1,
      finmindConfirmation: {
        expectedMarketDate: '2026-04-24',
        pendingCodes: ['2330'],
      },
    },
    ...overrides,
  }
}

describe('components/DailyReportPanel accuracy gate', () => {
  it('renders a section-level hard block for preliminary stale daily analysis and keeps other cards visible', async () => {
    const props = buildProps()

    render(<DailyReportPanel {...props} />)

    expect(screen.getByTestId('accuracy-gate-block')).toHaveAttribute('data-resource', 'daily')
    expect(screen.getByText('這段分析暫時不給 · 為避免幻覺')).toBeInTheDocument()
    expect(screen.getByText('每日交易備忘 — 2026/04/24')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('accuracy-gate-retry'))

    expect(props.maybeAutoConfirmDailyReport).toHaveBeenCalledWith(props.dailyReport)
  })
})
