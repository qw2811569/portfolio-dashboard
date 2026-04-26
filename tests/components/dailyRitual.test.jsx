// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DailyReportPanel } from '../../src/components/reports/DailyReportPanel.jsx'

const baseProps = {
  morningNote: null,
  analysisHistory: [
    { id: 'h1', date: '2026/04/25', hitRate: 80, eventAssessments: [{ correct: true }] },
  ],
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
  operatingContext: { portfolio: { id: 'me' }, portfolioLabel: '我的組合' },
}

describe('components/Daily ritual', () => {
  it('renders the complete close ritual above the detailed report', () => {
    render(
      <DailyReportPanel
        {...baseProps}
        dailyReport={{
          id: 'daily-ritual',
          date: '2026/04/26',
          time: '18:40',
          totalTodayPnl: 100,
          aiInsight: '今日收盤摘要：先確認事件，再看風險。',
          changes: [{ code: '2330', name: '台積電', changePct: 2.1, todayPnl: 100 }],
          anomalies: [],
          eventCorrelations: [],
          eventAssessments: [],
          needsReview: [],
          analysisStage: 't1-confirmed',
        }}
      />
    )

    expect(screen.getByTestId('daily-ritual-hero')).toBeInTheDocument()
    expect(screen.getByTestId('daily-pillars')).toBeInTheDocument()
    expect(screen.getByTestId('daily-holding-actions')).toHaveTextContent('台積電')
    expect(screen.getByTestId('daily-archive-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('daily-hit-rate-chart')).toBeInTheDocument()
    expect(screen.getByTestId('daily-copy-summary')).toBeInTheDocument()
  })

  it('does not expose per-holding ritual actions in insider-compressed mode', () => {
    render(
      <DailyReportPanel
        {...baseProps}
        viewMode="insider-compressed"
        dailyReport={{
          id: 'daily-ritual',
          date: '2026/04/26',
          totalTodayPnl: 100,
          aiInsight: '組合層級摘要。',
          changes: [{ code: '2330', name: '台積電', changePct: 2.1, todayPnl: 100 }],
          anomalies: [],
          eventCorrelations: [],
          eventAssessments: [],
          needsReview: [],
          analysisStage: 't1-confirmed',
        }}
      />
    )

    expect(screen.getByTestId('daily-ritual-hero')).toBeInTheDocument()
    expect(screen.queryByTestId('daily-holding-actions')).not.toBeInTheDocument()
    expect(screen.queryByText('台積電')).not.toBeInTheDocument()
  })
})
