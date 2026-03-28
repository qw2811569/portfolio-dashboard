import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  captureClientDiagnostic,
  createAnalyticsHttpSink,
  createSentrySink,
  flushRuntimeDiagnosticsQueue,
  readClientDiagnostics,
  registerRuntimeDiagnosticsSink,
  resetRuntimeDiagnosticsState,
} from '../../src/lib/runtimeLogger.js'

const originalFetch = global.fetch

describe('lib/runtimeLogger.js', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    window.__PORTFOLIO_RUNTIME_MONITORING__ = {
      analytics: { enabled: true, endpoint: '/api/telemetry' },
      queue: { flushIntervalMs: 5, batchSize: 10 },
      sampleRate: 1,
    }
    resetRuntimeDiagnosticsState()
    window.sessionStorage.clear()
  })

  afterEach(async () => {
    await flushRuntimeDiagnosticsQueue()
    resetRuntimeDiagnosticsState()
    window.sessionStorage.clear()
    delete window.__PORTFOLIO_RUNTIME_MONITORING__
    global.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('writes diagnostics into sessionStorage', () => {
    const entry = captureClientDiagnostic(
      'window-error',
      new Error('boom'),
      { route: 'holdings' },
      { emitConsole: false }
    )
    const stored = readClientDiagnostics()

    expect(stored[0]).toMatchObject({
      id: entry.id,
      kind: 'window-error',
      context: { route: 'holdings' },
      error: {
        message: 'boom',
      },
    })
  })

  it('flushes queued diagnostics to registered sinks', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, accepted: 1 })
    registerRuntimeDiagnosticsSink({ name: 'test-sink', send })

    const entry = captureClientDiagnostic(
      'error-boundary',
      new Error('component broke'),
      {},
      { emitConsole: false }
    )
    await vi.runAllTimersAsync()
    await flushRuntimeDiagnosticsQueue()

    expect(send).toHaveBeenCalledWith([
      expect.objectContaining({
        id: entry.id,
        kind: 'error-boundary',
      }),
    ])
  })

  it('posts analytics batches to the telemetry endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, accepted: 1 }),
    })
    global.fetch = fetchMock

    const sink = createAnalyticsHttpSink({
      endpoint: '/api/telemetry',
      headers: { 'X-Test': '1' },
    })

    await sink.send([
      {
        id: 'entry-1',
        kind: 'web-vital',
        timestamp: '2026-03-28T00:00:00.000Z',
        level: 'warn',
        error: { name: 'WebVitalMetric', message: 'FCP good (1234)', stack: null },
        context: { metric: { name: 'FCP', value: 1234 } },
      },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/telemetry',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Test': '1',
        }),
      })
    )
    expect(fetchMock.mock.calls[0][1].body).toContain('"action":"capture-diagnostics"')
  })

  it('bridges diagnostics to a Sentry-compatible client', async () => {
    const setLevel = vi.fn()
    const setTag = vi.fn()
    const setContext = vi.fn()
    const setExtra = vi.fn()
    const captureException = vi.fn()
    const captureMessage = vi.fn()

    const sentryClient = {
      withScope(callback) {
        callback({ setLevel, setTag, setContext, setExtra })
      },
      captureException,
      captureMessage,
    }

    const sink = createSentrySink({
      client: sentryClient,
      tags: { app: 'portfolio-dashboard' },
    })

    await sink.send([
      {
        id: 'entry-error',
        kind: 'window-error',
        timestamp: '2026-03-28T00:00:00.000Z',
        level: 'error',
        error: { name: 'TypeError', message: 'boom', stack: 'stack' },
        context: { route: 'research' },
      },
      {
        id: 'entry-vital',
        kind: 'web-vital',
        timestamp: '2026-03-28T00:00:01.000Z',
        level: 'warn',
        error: { name: 'WebVitalMetric', message: 'TTFB good (200)', stack: null },
        context: { metric: { name: 'TTFB', rating: 'good' } },
      },
    ])

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureMessage).toHaveBeenCalledWith(expect.stringContaining('[web-vital] TTFB'), 'warn')
    expect(setTag).toHaveBeenCalledWith('diagnostic.kind', 'window-error')
    expect(setTag).toHaveBeenCalledWith('app', 'portfolio-dashboard')
    expect(setContext).toHaveBeenCalled()
    expect(setExtra).toHaveBeenCalledWith('diagnostic_id', 'entry-error')
    expect(setLevel).toHaveBeenCalledWith('error')
  })
})
