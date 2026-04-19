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
  dailyExpanded: true,
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
  operatingContext: { portfolioLabel: '組合 7865' },
}

function buildDailyReport() {
  return {
    id: 'daily-viewmode',
    date: '2026/04/19',
    time: '18:40',
    totalTodayPnl: 128,
    changes: [
      {
        code: '2330',
        name: '台積電',
        price: 880,
        changePct: 2.5,
        todayPnl: 180,
      },
      {
        code: '2454',
        name: '聯發科',
        price: 1220,
        changePct: -1.1,
        todayPnl: -52,
      },
    ],
    anomalies: [],
    eventCorrelations: [],
    eventAssessments: [],
    needsReview: [],
    aiInsight: '今日先收斂成組合層級結論。',
    analysisStage: 't1-confirmed',
    analysisStageLabel: '資料確認版',
    finmindConfirmation: {
      expectedMarketDate: '2026-04-19',
      status: 'confirmed',
      pendingCodes: [],
    },
  }
}

describe('components/DailyReportPanel viewMode', () => {
  it('hides per-stock daily rows in insider-compressed mode', () => {
    render(
      <DailyReportPanel
        {...baseProps}
        viewMode="insider-compressed"
        dailyReport={buildDailyReport()}
      />
    )

    expect(screen.getByTestId('viewmode-compliance-note')).toBeInTheDocument()
    expect(screen.getByTestId('aggregate-daily-summary')).toBeInTheDocument()
    expect(screen.queryByText('台積電')).not.toBeInTheDocument()
    expect(screen.queryByText('聯發科')).not.toBeInTheDocument()
  })

  it('renders per-stock daily rows in owner mode', () => {
    render(<DailyReportPanel {...baseProps} viewMode="owner" dailyReport={buildDailyReport()} />)

    expect(screen.getByText('台積電')).toBeInTheDocument()
    expect(screen.getByText('聯發科')).toBeInTheDocument()
    expect(screen.queryByTestId('viewmode-compliance-note')).not.toBeInTheDocument()
  })
})
