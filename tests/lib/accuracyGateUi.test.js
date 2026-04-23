import { describe, expect, it, vi } from 'vitest'
import {
  buildAccuracyGateBlockModel,
  containsInsiderActionCue,
  resolveDashboardAccuracyGate,
  resolveDailyAccuracyGate,
  resolveResearchAccuracyGate,
} from '../../src/lib/accuracyGateUi.js'

describe('lib/accuracyGateUi', () => {
  it('detects insider action cues in analysis text', () => {
    expect(containsInsiderActionCue('這裡建議先減碼，再等拉回')).toBe(true)
    expect(containsInsiderActionCue('這裡只保留風險與待驗證事項')).toBe(false)
  })

  it('keeps retry enabled when the retry window is within five minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-24T10:00:00.000Z'))

    const copy = buildAccuracyGateBlockModel({
      reason: 'stale-data',
      resource: 'daily',
      context: {
        date: '2026/04/24',
        pendingCodes: ['2330'],
        retryCoolingDown: true,
        nextRetryAt: Date.now() + 4 * 60 * 1000,
      },
    })

    expect(copy.retryDisabled).toBe(false)
    expect(copy.body).toContain('之後再看')

    vi.useRealTimers()
  })

  it('disables retry when backoff is longer than five minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-24T10:00:00.000Z'))

    const copy = buildAccuracyGateBlockModel({
      reason: 'api-timeout',
      resource: 'research',
      context: {
        nextRetryAt: Date.now() + 6 * 60 * 1000,
      },
    })

    expect(copy.retryDisabled).toBe(true)

    vi.useRealTimers()
  })

  it('resolves daily stale-data gates from preliminary reports', () => {
    const gate = resolveDailyAccuracyGate({
      report: {
        id: 'daily-1',
        date: '2026/04/24',
        analysisStage: 't0-preliminary',
        finmindConfirmation: {
          expectedMarketDate: '2026-04-24',
          pendingCodes: ['2330'],
        },
        aiInsight: '先不要把結論講滿',
      },
      staleStatus: 'fresh',
    })

    expect(gate).toMatchObject({
      reason: 'stale-data',
      resource: 'daily',
    })
    expect(gate.context.pendingCodes).toEqual(['2330'])
  })

  it('resolves research gates from missing fundamentals rows', () => {
    const gate = resolveResearchAccuracyGate({
      results: {
        code: '2330',
        name: '台積電',
        mode: 'single',
        summary: '研究摘要',
        rounds: [{ title: '基本面', content: '先看財報' }],
      },
      dataRefreshRows: [
        {
          code: '2330',
          name: '台積電',
          fundamentalStatus: '缺失',
          targetStatus: '缺少',
        },
      ],
    })

    expect(gate).toMatchObject({
      reason: 'fundamentals-incomplete',
      resource: 'research',
    })
  })

  it('resolves dashboard gates only when every dossier is stale or missing', () => {
    const blocked = resolveDashboardAccuracyGate({
      holdingDossiers: [
        { code: '2330', freshness: { fundamentals: 'missing' } },
        { code: '2454', freshness: { fundamentals: 'aging' } },
      ],
      dataRefreshRows: [{ code: '2330' }, { code: '2454' }],
    })

    const passthrough = resolveDashboardAccuracyGate({
      holdingDossiers: [
        { code: '2330', freshness: { fundamentals: 'fresh' } },
        { code: '2454', freshness: { fundamentals: 'missing' } },
      ],
      dataRefreshRows: [{ code: '2454' }],
    })

    expect(blocked).toMatchObject({
      reason: 'fundamentals-incomplete',
      resource: 'dashboard',
    })
    expect(passthrough).toBeNull()
  })
})
