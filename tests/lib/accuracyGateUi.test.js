import { describe, expect, it, vi } from 'vitest'
import {
  buildAccuracyGateBlockModel,
  containsInsiderActionCue,
  resolveDashboardAccuracyGate,
  resolveDailyAccuracyGate,
  resolveDetailSummaryAccuracyGate,
  resolveHoldingsAccuracyGate,
  resolveResearchAccuracyGate,
  resolveTomorrowActionsAccuracyGate,
  resolveWeeklyPdfNarrativeAccuracyGate,
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

  it('uses FinMind degraded reasons for research gates when fallback is active', () => {
    const gate = resolveResearchAccuracyGate({
      results: {
        code: '2330',
        name: '台積電',
        mode: 'single',
        summary: '研究摘要',
      },
      dataRefreshRows: [
        {
          code: '2330',
          name: '台積電',
          fundamentalStatus: 'stale',
          degradedReason: 'api-timeout',
          fallbackAgeLabel: '昨天',
        },
      ],
    })

    expect(gate).toMatchObject({
      reason: 'api-timeout',
      resource: 'research',
      context: {
        provider: 'FinMind',
        fallbackAgeLabel: '昨天',
      },
    })
  })

  it('builds softer FinMind quota copy for data-source degraded states', () => {
    const copy = buildAccuracyGateBlockModel({
      reason: 'quota-exceeded',
      resource: 'research',
      context: {
        provider: 'FinMind',
        code: '2330',
        name: '台積電',
        fallbackAgeLabel: '昨天',
      },
    })

    expect(copy.body).toContain('FinMind')
    expect(copy.body).toContain('昨天')
  })

  it('maps 401-style errors to auth-required instead of api-timeout', () => {
    const gate = resolveDailyAccuracyGate({
      report: {
        id: 'daily-auth',
        date: '2026/04/24',
        aiError: 'Unauthorized (401)',
      },
    })

    expect(gate).toMatchObject({
      reason: 'auth-required',
      resource: 'daily',
    })
  })

  it('builds login guidance for auth-required accuracy gates', () => {
    const copy = buildAccuracyGateBlockModel({
      reason: 'auth-required',
      resource: 'thesis',
      context: {
        provider: 'FinMind',
        fallbackAgeLabel: '昨天',
      },
    })

    expect(copy.headline).toBe('需要重新登入 · 前往登入')
    expect(copy.requiresLogin).toBe(true)
    expect(copy.body).toContain('重新登入後會自動補正')
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

  it('prefers FinMind degraded reasons for dashboard blocks when all dossiers are stale', () => {
    const gate = resolveDashboardAccuracyGate({
      holdingDossiers: [
        { code: '2330', freshness: { fundamentals: 'missing' } },
        { code: '2454', freshness: { fundamentals: 'aging' } },
      ],
      dataRefreshRows: [
        { code: '2330', degradedReason: 'quota-exceeded', fallbackAgeLabel: '昨天' },
        { code: '2454', degradedReason: 'quota-exceeded', fallbackAgeLabel: '昨天' },
      ],
    })

    expect(gate).toMatchObject({
      reason: 'quota-exceeded',
      resource: 'dashboard',
      context: {
        provider: 'FinMind',
      },
    })
  })

  it('resolves holdings gates from dossier-level FinMind degraded state', () => {
    const gate = resolveHoldingsAccuracyGate({
      holdingDossiers: [
        {
          code: '2330',
          finmindDegraded: {
            reason: 'api-timeout',
            fallbackAgeLabel: '昨天',
          },
        },
      ],
    })

    expect(gate).toMatchObject({
      reason: 'api-timeout',
      resource: 'thesis',
      context: {
        provider: 'FinMind',
        fallbackAgeLabel: '昨天',
      },
    })
  })

  it('prefers auth-required for holdings gates when FinMind returns 401-style degraded state', () => {
    const gate = resolveHoldingsAccuracyGate({
      holdingDossiers: [
        {
          code: '2330',
          finmindDegraded: {
            reason: 'auth-required',
          },
        },
      ],
    })

    expect(gate).toMatchObject({
      reason: 'auth-required',
      resource: 'thesis',
    })
  })

  it('resolves detail pane AI summary gates for insider action leakage', () => {
    const gate = resolveDetailSummaryAccuracyGate({
      summary: '建議先減碼，等拉回再買進',
      viewMode: 'insider-compressed',
      context: { portfolioLabel: '金聯成' },
    })

    expect(gate).toMatchObject({
      reason: 'insider-compliance',
      resource: 'detail',
    })
  })

  it('resolves tomorrow action gates for missing generated content with errors', () => {
    const gate = resolveTomorrowActionsAccuracyGate({
      actions: [],
      error: 'timeout',
    })

    expect(gate).toMatchObject({
      reason: 'api-timeout',
      resource: 'tomorrow',
    })
  })

  it('resolves weekly PDF narrative gates for insider action leakage', () => {
    const gate = resolveWeeklyPdfNarrativeAccuracyGate({
      narrative: '本週可考慮加碼並設定停損',
      viewMode: 'insider-compressed',
    })

    expect(gate).toMatchObject({
      reason: 'insider-compliance',
      resource: 'weekly',
    })
  })
})
