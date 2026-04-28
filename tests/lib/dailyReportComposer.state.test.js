import { describe, expect, it } from 'vitest'
import { composeDailyReportRitual } from '../../src/lib/dailyReportComposer.js'

describe('composeDailyReportRitual state machine', () => {
  it('derives waiting when there is no report', () => {
    const ritual = composeDailyReportRitual({ dailyReport: null })

    expect(ritual.state).toBe('waiting')
    expect(ritual.canShowActions).toBe(false)
    expect(ritual.canShowArchive).toBe(false)
  })

  it('derives waiting when report explicitly waits for fresh data', () => {
    const ritual = composeDailyReportRitual({
      dailyReport: { id: 'waiting', waiting: true, changes: [{ code: '2330' }] },
    })

    expect(ritual.state).toBe('waiting')
    expect(ritual.hero.text).toContain('等明早')
  })

  it('derives partial when report has changes but no insight', () => {
    const ritual = composeDailyReportRitual({
      dailyReport: { id: 'partial', changes: [{ code: '2330', name: '台積電' }] },
    })

    expect(ritual.state).toBe('partial')
    expect(ritual.hero.text).toBe('資料已收齊 · 點下方按鈕開始分析')
    expect(ritual.hero.partialPendingAnalysis).toBe(true)
    expect(ritual.isPartialPendingAnalysis).toBe(true)
    expect(ritual.canShowActions).toBe(false)
    expect(ritual.canShowArchive).toBe(true)
  })

  it('derives ready when report has insight', () => {
    const ritual = composeDailyReportRitual({
      dailyReport: { id: 'ready', aiInsight: '今日摘要完成。', changes: [{ code: '2330' }] },
    })

    expect(ritual.state).toBe('ready')
    expect(ritual.canShowActions).toBe(true)
    expect(ritual.canShowHitRate).toBe(true)
  })

  it('keeps T0 preliminary stage orthogonal to readiness and exposes canonical stage flags', () => {
    const ritual = composeDailyReportRitual({
      dailyReport: {
        id: 'preliminary-ready',
        aiInsight: '快版已有可讀摘要。',
        analysisStage: 't0-preliminary',
      },
    })

    expect(ritual.state).toBe('ready')
    expect(ritual.stageKind).toBe('preliminary')
    expect(ritual.isPreliminaryReport).toBe(true)
    expect(ritual.isConfirmedReport).toBe(false)
  })

  it('exposes confirmed stage flag', () => {
    const ritual = composeDailyReportRitual({
      dailyReport: {
        id: 'confirmed-ready',
        aiInsight: '資料確認版。',
        analysisStage: 't1-confirmed',
      },
    })

    expect(ritual.isConfirmedReport).toBe(true)
    expect(ritual.isPreliminaryReport).toBe(false)
  })

  it('does not let streaming override ready actions', () => {
    const ritual = composeDailyReportRitual({
      isStreaming: true,
      dailyReport: { id: 'streaming-ready', aiInsight: '串流中但已有摘要。' },
    })

    expect(ritual.state).toBe('ready')
    expect(ritual.isStreaming).toBe(true)
    expect(ritual.canShowActions).toBe(true)
  })
})
