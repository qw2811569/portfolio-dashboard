import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readLastSuccess, writeLastSuccess } from '../../api/_lib/last-success-store.js'

function createBackend(overrides = {}) {
  return {
    read: vi.fn(),
    write: vi.fn(),
    ...overrides,
  }
}

describe('api/_lib/last-success-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PUBLIC = 'jcv-dev-public'
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PUBLIC
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS
  })

  it('uses Vercel only in vercel-only mode', async () => {
    const vercelBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        body: { job: 'collect-news', ok: true },
        rawBody: '{"job":"collect-news","ok":true}',
      }),
    })
    const gcsBackend = createBackend()

    const result = await readLastSuccess('collect-news', null, {
      primaryMode: 'vercel-only',
      vercelBackend,
      gcsBackend,
    })

    expect(result).toEqual({ job: 'collect-news', ok: true })
    expect(vercelBackend.read).toHaveBeenCalledTimes(1)
    expect(gcsBackend.read).not.toHaveBeenCalled()
  })

  it('keeps Vercel primary, shadow-reads GCS, and records divergence', async () => {
    const vercelBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        body: { job: 'collect-news', lastSuccessAt: '2026-04-25T00:00:00.000Z' },
        rawBody: '{"job":"collect-news","lastSuccessAt":"2026-04-25T00:00:00.000Z"}',
      }),
    })
    const gcsBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        body: { job: 'collect-news', lastSuccessAt: '2026-04-24T00:00:00.000Z' },
        rawBody: '{"job":"collect-news","lastSuccessAt":"2026-04-24T00:00:00.000Z"}',
      }),
    })
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const mkdirImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }

    const result = await readLastSuccess('collect-news', null, {
      primaryMode: 'vercel-primary-gcs-shadow',
      vercelBackend,
      gcsBackend,
      appendMetricImpl,
      mkdirImpl,
      logDir: '/tmp/test-logs',
      now: new Date('2026-04-25T01:02:03.000Z'),
      logger,
    })

    expect(result).toEqual({
      job: 'collect-news',
      lastSuccessAt: '2026-04-25T00:00:00.000Z',
    })
    expect(vercelBackend.read).toHaveBeenCalledTimes(1)
    expect(gcsBackend.read).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('shadow read divergence for last-success-collect-news.json')
    )
    expect(mkdirImpl).toHaveBeenCalled()
    expect(appendMetricImpl).toHaveBeenCalledTimes(1)

    const [, payload] = appendMetricImpl.mock.calls[0]
    expect(JSON.parse(payload.trim())).toMatchObject({
      keyspace: 'ops.last_success_public',
      key: 'last-success-collect-news.json',
      primary: 'vercel',
      shadow: 'gcs',
      op: 'read',
      result: 'mismatch',
    })
  })

  it('writes GCS primary and Vercel shadow in gcs-primary-vercel-shadow mode', async () => {
    const vercelBackend = createBackend({
      write: vi.fn().mockResolvedValue({ backend: 'vercel' }),
    })
    const gcsBackend = createBackend({
      write: vi.fn().mockResolvedValue({ backend: 'gcs' }),
    })

    const result = await writeLastSuccess(
      'compute-valuations',
      null,
      { job: 'compute-valuations', ok: true },
      {
        primaryMode: 'gcs-primary-vercel-shadow',
        vercelBackend,
        gcsBackend,
      }
    )

    expect(result).toEqual({ backend: 'gcs' })
    expect(gcsBackend.write).toHaveBeenCalledTimes(1)
    expect(vercelBackend.write).toHaveBeenCalledTimes(1)
  })

  it('uses GCS only in gcs-only mode', async () => {
    const vercelBackend = createBackend()
    const gcsBackend = createBackend({
      write: vi.fn().mockResolvedValue({ backend: 'gcs-only' }),
    })

    const result = await writeLastSuccess(
      'daily-snapshot',
      null,
      { job: 'daily-snapshot', ok: true },
      {
        primaryMode: 'gcs-only',
        vercelBackend,
        gcsBackend,
      }
    )

    expect(result).toEqual({ backend: 'gcs-only' })
    expect(gcsBackend.write).toHaveBeenCalledTimes(1)
    expect(vercelBackend.write).not.toHaveBeenCalled()
  })
})
