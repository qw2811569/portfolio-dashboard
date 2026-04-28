// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react'
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

  it('indexes older daily history and switches to a specific date from the calendar input', () => {
    const history = Array.from({ length: 10 }, (_, index) => {
      const day = String(25 - index).padStart(2, '0')
      return {
        id: `h-${index}`,
        date: `2026/04/${day}`,
        aiInsight: `第 ${index + 1} 天歷史摘要`,
        hitRate: 80 - index,
        eventAssessments: [],
      }
    })

    render(
      <DailyReportPanel
        {...baseProps}
        analysisHistory={history}
        dailyReport={{
          id: 'daily-current',
          date: '2026/04/26',
          aiInsight: '今日摘要',
          totalTodayPnl: 0,
          changes: [],
          anomalies: [],
          eventCorrelations: [],
          eventAssessments: [],
          needsReview: [],
          analysisStage: 't1-confirmed',
        }}
      />
    )

    const archive = screen.getByTestId('daily-archive-timeline')
    expect(
      within(archive).getByText('已建立 11 天索引，較早日期可用日曆切換。')
    ).toBeInTheDocument()
    expect(within(archive).queryByText('04/18')).not.toBeInTheDocument()

    fireEvent.change(screen.getByTestId('daily-archive-date-input'), {
      target: { value: '2026-04-18' },
    })

    expect(screen.getAllByText('第 8 天歷史摘要').length).toBeGreaterThan(0)
  })

  it('hides per-holding actions and stale advice while waiting for tomorrow data', () => {
    render(
      <DailyReportPanel
        {...baseProps}
        dailyReport={{
          id: 'daily-waiting',
          waiting: true,
          date: '2026/04/26',
          time: '18:40',
          totalTodayPnl: 100,
          changes: [{ code: '2330', name: '台積電', changePct: 9.1, todayPnl: 100 }],
          anomalies: [],
          eventCorrelations: [],
          eventAssessments: [],
          needsReview: [],
          analysisStage: 't0-preliminary',
        }}
      />
    )

    expect(screen.getByTestId('daily-ritual-hero')).toHaveTextContent('等明早')
    expect(screen.queryByTestId('daily-holding-actions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('daily-hit-rate-chart')).not.toBeInTheDocument()
    expect(screen.getByTestId('daily-waiting-review-cta')).toHaveTextContent('先補復盤')
    expect(screen.queryByText('減碼分批')).not.toBeInTheDocument()
  })

  it('treats report changes without insight as partial and keeps actions hidden', () => {
    render(
      <DailyReportPanel
        {...baseProps}
        dailyReport={{
          id: 'daily-partial',
          date: '2026/04/26',
          time: '18:40',
          totalTodayPnl: 100,
          changes: [{ code: '2330', name: '台積電', changePct: 9.1, todayPnl: 100 }],
          anomalies: [],
          eventCorrelations: [],
          eventAssessments: [],
          needsReview: [],
          analysisStage: 't0-preliminary',
        }}
      />
    )

    expect(screen.getByTestId('daily-panel')).toHaveAttribute('data-daily-state', 'partial')
    expect(screen.getByTestId('daily-ritual-hero')).toHaveTextContent(
      '資料已收齊 · 點下方按鈕開始分析'
    )
    expect(screen.getByTestId('daily-partial-pending-cta')).toBeInTheDocument()
    expect(screen.getByTestId('daily-partial-analyze-cta')).toBeInTheDocument()
    expect(screen.queryByTestId('daily-holding-actions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('daily-hit-rate-chart')).not.toBeInTheDocument()
    expect(screen.getByText('歷史紀錄')).toBeInTheDocument()
  })

  it('keeps the partial CTA mounted but disabled while analyzing', () => {
    render(
      <DailyReportPanel
        {...baseProps}
        analyzing={true}
        dailyReport={{
          id: 'daily-partial-analyzing',
          date: '2026/04/26',
          time: '18:40',
          totalTodayPnl: 100,
          changes: [{ code: '2330', name: '台積電', changePct: 9.1, todayPnl: 100 }],
          anomalies: [],
          eventCorrelations: [],
          eventAssessments: [],
          needsReview: [],
          analysisStage: 't0-preliminary',
        }}
      />
    )

    // Per Codex R31-R4 critique: don't unmount the CTA during analyzing — keep it mounted
    // and disabled so screen-reader / keyboard state stays stable.
    const cta = screen.getByTestId('daily-partial-analyze-cta')
    expect(cta).toBeInTheDocument()
    expect(cta).toBeDisabled()
    expect(cta).toHaveTextContent('分析中...')
  })
})
