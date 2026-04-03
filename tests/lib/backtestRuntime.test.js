import { describe, expect, it } from 'vitest'
import {
  BACKTEST_DATES,
  comparePrediction,
  feedbackToKnowledge,
  runBacktestAnalysis,
} from '../../src/lib/backtestRuntime.js'

describe('lib/backtestRuntime', () => {
  it('contains the requested 20 backtest dates', () => {
    expect(BACKTEST_DATES).toHaveLength(20)
    expect(BACKTEST_DATES[0]).toBe('2024-02-15')
    expect(BACKTEST_DATES[19]).toBe('2026-02-15')
  })

  it('builds rule-based backtest analysis without calling AI', () => {
    const analysis = runBacktestAnalysis(
      {
        code: '2308',
        name: '台達電',
        meta: { industry: 'AI/伺服器', strategy: '成長股', period: '中長', position: '核心' },
        signals: {
          revenueYoY: 28,
          per: 14,
          marginDelta: -120,
          institutional5d: { foreign: 2000, investmentTrust: 300, dealer: -50 },
        },
      },
      '2025-06-01'
    )

    expect(['看多', '看空', '觀望']).toContain(analysis.verdict)
    expect(analysis.confidence).toBeGreaterThan(0)
    expect(analysis.action).toBeTruthy()
    expect(analysis.promptPacket.userPrompt).toContain('<analysis_packet mode="daily_close">')
  })

  it('compares prediction direction with actual outcome', () => {
    expect(comparePrediction({ verdict: '看多' }, { actualDirection: 'up' })).toEqual({
      predicted: 'up',
      correct: true,
    })
    expect(comparePrediction({ verdict: '觀望' }, { actualDirection: 'down' })).toEqual({
      predicted: 'flat',
      correct: false,
    })
  })

  it('aggregates feedback deltas for matched rules', () => {
    const feedback = feedbackToKnowledge([
      { correct: true, matchedRules: ['rule-a', 'rule-b'] },
      { correct: false, matchedRules: ['rule-a'] },
    ])

    expect(feedback.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleKey: 'rule-a', delta: -0.01 }),
        expect.objectContaining({ ruleKey: 'rule-b', delta: 0.02 }),
      ])
    )
  })
})
