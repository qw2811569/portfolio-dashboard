// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  operatingContext: { portfolio: { id: '7865' }, portfolioLabel: '組合 7865' },
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
    analysisVersion: 2,
    rerunReason: 'finmind-confirmed',
    finmindConfirmation: {
      expectedMarketDate: '2026-04-19',
      status: 'confirmed',
      pendingCodes: [],
    },
  }
}

function buildSameDayHistory() {
  return [
    buildDailyReport(),
    {
      id: 'daily-viewmode-t0',
      date: '2026/04/19',
      time: '14:03',
      totalTodayPnl: 96,
      changes: [],
      anomalies: [],
      eventCorrelations: [],
      eventAssessments: [],
      needsReview: [],
      aiInsight: '先收斂成收盤快版結論。',
      analysisStage: 't0-preliminary',
      analysisStageLabel: '收盤快版',
      analysisVersion: 1,
      finmindDataCount: 1,
      finmindConfirmation: {
        expectedMarketDate: '2026-04-19',
        status: 'preliminary',
        pendingCodes: ['2330'],
      },
    },
  ]
}

describe('components/DailyReportPanel viewMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hides per-stock daily rows in insider-compressed mode', () => {
    const { container } = render(
      <DailyReportPanel
        {...baseProps}
        viewMode="insider-compressed"
        dailyReport={buildDailyReport()}
      />
    )

    const complianceNote = screen.getByTestId('viewmode-compliance-note')
    const dailyPanel = container.querySelector('[data-testid="daily-panel"]')

    expect(complianceNote).toBeInTheDocument()
    expect(complianceNote).toHaveAttribute('role', 'top-banner')
    expect(complianceNote).toHaveTextContent('這是合規壓縮版 · 僅保留組合層級觀察 · 不顯示個股細節')
    expect(dailyPanel?.firstElementChild).toBe(complianceNote)
    expect(screen.getByTestId('aggregate-daily-summary')).toBeInTheDocument()
    expect(screen.queryByText('台積電')).not.toBeInTheDocument()
    expect(screen.queryByText('聯發科')).not.toBeInTheDocument()
  })

  it('shows aggregate-only same-day diff details in insider-compressed mode', () => {
    render(
      <DailyReportPanel
        {...baseProps}
        viewMode="insider-compressed"
        analysisHistory={buildSameDayHistory()}
        dailyReport={buildDailyReport()}
      />
    )

    fireEvent.click(screen.getByTestId('daily-diff-toggle'))

    expect(screen.getByTestId('daily-diff-pane')).toHaveTextContent(
      't0/t1 差異為 aggregate · 不顯示個股細節'
    )
    expect(screen.queryByText('AI 總結')).not.toBeInTheDocument()
  })

  it('renders per-stock daily rows in owner mode', () => {
    render(<DailyReportPanel {...baseProps} viewMode="owner" dailyReport={buildDailyReport()} />)

    expect(screen.getByText('台積電')).toBeInTheDocument()
    expect(screen.getByText('聯發科')).toBeInTheDocument()
    expect(screen.queryByTestId('viewmode-compliance-note')).not.toBeInTheDocument()
  })

  it('keeps retail mode free of compliance note banners', () => {
    render(<DailyReportPanel {...baseProps} viewMode="retail" dailyReport={buildDailyReport()} />)

    expect(screen.getByText('台積電')).toBeInTheDocument()
    expect(screen.getByText('聯發科')).toBeInTheDocument()
    expect(screen.queryByTestId('viewmode-compliance-note')).not.toBeInTheDocument()
  })

  it('localizes the top freshness badge when daily data is still missing', () => {
    render(
      <DailyReportPanel
        {...baseProps}
        viewMode="retail"
        staleStatus="missing"
        dailyReport={buildDailyReport()}
      />
    )

    expect(screen.getByTitle('daily panel freshness')).toHaveTextContent('資料還在補')
    expect(screen.getByTitle('daily panel freshness')).not.toHaveTextContent('missing')
  })
})
