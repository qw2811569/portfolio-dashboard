import { describe, expect, it } from 'vitest'
import {
  buildSameDayDailyReportDiff,
  findPreviousSameDayReport,
} from '../../src/lib/dailyReportDiff.js'

describe('lib/dailyReportDiff.js', () => {
  it('finds the prior same-day staged version for the current report', () => {
    const previous = {
      id: 101,
      date: '2026/04/11',
      time: '14:03',
      analysisStage: 't0-preliminary',
      analysisStageLabel: '收盤快版',
      analysisVersion: 1,
    }
    const current = {
      id: 202,
      date: '2026/04/11',
      time: '18:40',
      analysisStage: 't1-confirmed',
      analysisStageLabel: '資料確認版',
      analysisVersion: 2,
    }

    expect(
      findPreviousSameDayReport({
        currentReport: current,
        analysisHistory: [current, previous],
      })
    ).toMatchObject(previous)
  })

  it('builds a same-day diff and ignores whitespace-only insight changes', () => {
    const diff = buildSameDayDailyReportDiff({
      currentReport: {
        id: 202,
        date: '2026/04/11',
        time: '18:40',
        analysisStage: 't1-confirmed',
        analysisStageLabel: '資料確認版',
        analysisVersion: 2,
        aiInsight: '  今天確認趨勢仍延續。  ',
        finmindDataCount: 14,
        needsReview: [{ id: 'review-1' }],
        eventAssessments: [{ id: 'event-1' }, { id: 'event-2' }],
        anomalies: [],
        totalTodayPnl: 1200,
        finmindConfirmation: {
          pendingCodes: [],
        },
      },
      analysisHistory: [
        {
          id: 101,
          date: '2026/04/11',
          time: '14:03',
          analysisStage: 't0-preliminary',
          analysisStageLabel: '收盤快版',
          analysisVersion: 1,
          aiInsight: '今天確認趨勢仍延續。',
          finmindDataCount: 8,
          needsReview: [],
          eventAssessments: [{ id: 'event-1' }],
          anomalies: [{ id: 'warn-1' }],
          totalTodayPnl: 900,
          finmindConfirmation: {
            pendingCodes: ['2330'],
          },
        },
      ],
    })

    expect(diff).toMatchObject({
      previousStageLabel: '收盤快版 · v1 · 14:03',
      currentStageLabel: '資料確認版 · v2 · 18:40',
      changeCount: 6,
    })
    expect(diff.changes.map((item) => item.key)).toEqual([
      'finmindDataCount',
      'pendingCodes',
      'needsReviewCount',
      'anomaliesCount',
      'eventAssessmentsCount',
      'totalTodayPnl',
    ])
    expect(diff.changes.some((item) => item.key === 'insight')).toBe(false)
  })

  it('returns zero-diff metadata when only the stage label changed', () => {
    const diff = buildSameDayDailyReportDiff({
      currentReport: {
        id: 202,
        date: '2026/04/11',
        time: '18:40',
        analysisStage: 't1-confirmed',
        analysisStageLabel: '資料確認版',
        analysisVersion: 2,
        aiInsight: '論點不變',
      },
      analysisHistory: [
        {
          id: 101,
          date: '2026/04/11',
          time: '14:03',
          analysisStage: 't0-preliminary',
          analysisStageLabel: '收盤快版',
          analysisVersion: 1,
          aiInsight: '論點不變',
        },
      ],
    })

    expect(diff.changeCount).toBe(0)
    expect(diff.stageChanged).toBe(true)
    expect(diff.summary).toContain('目前沒有偵測到實質差異')
  })

  it('uses the latest same-day staged pair even when the mounted report is still t0', () => {
    const diff = buildSameDayDailyReportDiff({
      currentReport: {
        id: 101,
        date: '2026/04/11',
        time: '14:03',
        analysisStage: 't0-preliminary',
        analysisStageLabel: '收盤快版',
        analysisVersion: 1,
        aiInsight: '先看今天事件是否已經落地。',
      },
      analysisHistory: [
        {
          id: 101,
          date: '2026/04/11',
          time: '14:03',
          analysisStage: 't0-preliminary',
          analysisStageLabel: '收盤快版',
          analysisVersion: 1,
          aiInsight: '先看今天事件是否已經落地。',
        },
        {
          id: 202,
          date: '2026/04/11',
          time: '18:40',
          analysisStage: 't1-confirmed',
          analysisStageLabel: '資料確認版',
          analysisVersion: 2,
          aiInsight: '今晚重點轉向明日延續性。',
          rerunReason: 'finmind-confirmed',
        },
      ],
    })

    expect(diff).toMatchObject({
      currentStageLabel: '資料確認版 · v2 · 18:40',
      previousStageLabel: '收盤快版 · v1 · 14:03',
      changeCount: 1,
      rerunReason: 'finmind-confirmed',
    })
    expect(diff.changes[0]).toMatchObject({
      key: 'insight',
      field: 'AI 總結',
      rerunReason: '因收盤後資料確認而補跑',
    })
  })

  it('returns null when there is no prior same-day version', () => {
    expect(
      buildSameDayDailyReportDiff({
        currentReport: {
          id: 202,
          date: '2026/04/11',
          analysisStage: 't1-confirmed',
          analysisVersion: 2,
        },
        analysisHistory: [
          {
            id: 101,
            date: '2026/04/10',
            analysisStage: 't0-preliminary',
            analysisVersion: 1,
          },
        ],
      })
    ).toBeNull()
  })

  it('returns null for a first same-day preliminary version', () => {
    expect(
      buildSameDayDailyReportDiff({
        currentReport: {
          id: 101,
          date: '2026/04/11',
          analysisStage: 't0-preliminary',
          analysisVersion: 1,
        },
        analysisHistory: [
          {
            id: 88,
            date: '2026/04/11',
            analysisStage: 't0-preliminary',
            analysisVersion: 1,
          },
        ],
      })
    ).toBeNull()
  })
})
