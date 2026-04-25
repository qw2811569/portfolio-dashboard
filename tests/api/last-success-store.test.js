import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getLastSuccessScopeDescriptor,
  getLastSuccessStorageMode,
  readLastSuccess,
  writeLastSuccess,
} from '../../api/_lib/last-success-store.js'

function createBackend(overrides = {}) {
  return {
    read: vi.fn(),
    write: vi.fn(),
    ...overrides,
  }
}

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('api/_lib/last-success-store.js', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PUBLIC = 'jcv-dev-public'
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
    process.env.GCS_BUCKET_ARCHIVE = 'jcv-dev-archive'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PUBLIC
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.GCS_BUCKET_ARCHIVE
    delete process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS
    delete process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC
    delete process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS_PRIVATE
    delete process.env.STORAGE_SHADOW_READ_OPS_LAST_SUCCESS
    delete process.env.STORAGE_SHADOW_WRITE_OPS_LAST_SUCCESS
  })

  it('uses Vercel only by default', async () => {
    const vercelBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        body: { job: 'collect-news', ok: true },
        rawBody: '{"job":"collect-news","ok":true}',
      }),
    })
    const gcsBackend = createBackend()

    const result = await readLastSuccess('collect-news', null, {
      vercelBackend,
      gcsBackend,
    })

    expect(result).toEqual({ job: 'collect-news', ok: true })
    expect(vercelBackend.read).toHaveBeenCalledTimes(1)
    expect(gcsBackend.read).not.toHaveBeenCalled()
  })

  it('honors split env policy independently for public reads and private writes', async () => {
    process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC = 'gcs'
    process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS_PRIVATE = 'vercel'
    process.env.STORAGE_SHADOW_READ_OPS_LAST_SUCCESS = 'false'
    process.env.STORAGE_SHADOW_WRITE_OPS_LAST_SUCCESS = 'true'

    const vercelBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        body: { backend: 'vercel' },
        rawBody: '{"backend":"vercel"}',
      }),
      write: vi.fn().mockResolvedValue({ backend: 'vercel' }),
    })
    const gcsBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        body: { backend: 'gcs' },
        rawBody: '{"backend":"gcs"}',
      }),
      write: vi.fn().mockResolvedValue({ backend: 'gcs' }),
    })

    const mode = getLastSuccessStorageMode()
    const publicRead = await readLastSuccess('collect-news', null, {
      vercelBackend,
      gcsBackend,
    })
    const privateWrite = await writeLastSuccess(
      'compute-valuations',
      null,
      { job: 'compute-valuations', ok: true },
      {
        vercelBackend,
        gcsBackend,
      }
    )

    expect(mode).toEqual({
      public: {
        primary: 'gcs',
        shadowRead: false,
        shadowWrite: true,
      },
      private: {
        primary: 'vercel',
        shadowRead: false,
        shadowWrite: true,
      },
    })
    expect(publicRead).toEqual({ backend: 'gcs' })
    expect(gcsBackend.read).toHaveBeenCalledTimes(1)
    expect(vercelBackend.read).not.toHaveBeenCalled()
    expect(privateWrite).toEqual({ backend: 'vercel' })
    expect(vercelBackend.write).toHaveBeenCalledTimes(1)
    expect(gcsBackend.write).toHaveBeenCalledTimes(1)
  })

  it('records divergence in the background without blocking the read result', async () => {
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
    let backgroundPromise = Promise.resolve()

    const result = await readLastSuccess('collect-news', null, {
      primaryMode: 'vercel-primary-gcs-shadow',
      vercelBackend,
      gcsBackend,
      appendMetricImpl,
      mkdirImpl,
      logDir: '/tmp/test-logs',
      now: new Date('2026-04-25T01:02:03.000Z'),
      logger,
      scheduleBackgroundTask(task) {
        backgroundPromise = Promise.resolve().then(task)
      },
    })

    await backgroundPromise

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

  it('throws for invalid split flags instead of silently falling back', () => {
    process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC = 'vercell'

    expect(() => getLastSuccessStorageMode()).toThrow(
      /STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC must be "vercel" or "gcs"/
    )
  })

  it('does not let divergence metric failures break primary reads', async () => {
    const vercelBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        body: { job: 'collect-news', ok: true },
        rawBody: '{"job":"collect-news","ok":true}',
      }),
    })
    const gcsBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        body: { job: 'collect-news', ok: false },
        rawBody: '{"job":"collect-news","ok":false}',
      }),
    })
    const logger = { warn: vi.fn() }
    let backgroundPromise = Promise.resolve()

    const result = await readLastSuccess('collect-news', null, {
      primaryMode: 'vercel-primary-gcs-shadow',
      vercelBackend,
      gcsBackend,
      appendMetricImpl: vi.fn().mockRejectedValue(new Error('disk full')),
      mkdirImpl: vi.fn().mockResolvedValue(undefined),
      logger,
      scheduleBackgroundTask(task) {
        backgroundPromise = Promise.resolve().then(task)
      },
    })

    await backgroundPromise

    expect(result).toEqual({ job: 'collect-news', ok: true })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'failed to append divergence metric for last-success-collect-news.json:'
      ),
      expect.objectContaining({ message: 'disk full' })
    )
  })

  it('does not block primary return on slow shadow reads', async () => {
    const deferredShadow = createDeferred()
    const vercelBackend = createBackend({
      read: vi.fn().mockResolvedValue({
        body: { job: 'collect-news', ok: true },
        rawBody: '{"job":"collect-news","ok":true}',
      }),
    })
    const gcsBackend = createBackend({
      read: vi.fn().mockReturnValue(deferredShadow.promise),
    })
    let backgroundPromise = Promise.resolve()

    const resultPromise = readLastSuccess('collect-news', null, {
      primaryMode: 'vercel-primary-gcs-shadow',
      vercelBackend,
      gcsBackend,
      appendMetricImpl: vi.fn().mockResolvedValue(undefined),
      mkdirImpl: vi.fn().mockResolvedValue(undefined),
      logger: { warn: vi.fn() },
      scheduleBackgroundTask(task) {
        backgroundPromise = Promise.resolve().then(task)
      },
    })

    let settled = false
    resultPromise.then(() => {
      settled = true
    })

    await flushMicrotasks()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(settled).toBe(true)
    await expect(resultPromise).resolves.toEqual({ job: 'collect-news', ok: true })

    deferredShadow.resolve({
      body: { job: 'collect-news', ok: true },
      rawBody: '{"job":"collect-news","ok":true}',
    })
    await backgroundPromise
  })

  it('routes dated daily-snapshot markers to the archive bucket', () => {
    expect(getLastSuccessScopeDescriptor('daily-snapshot', '2026-04-25')).toMatchObject({
      keyspace: 'ops.daily_snapshot_marker',
      bucketClass: 'archive',
      bucketName: 'jcv-dev-archive',
      key: 'last-success/daily-snapshot/2026-04-25.txt',
    })
  })

  it('rejects null payloads with InvalidPayload', async () => {
    await expect(
      writeLastSuccess('collect-news', null, null, {
        primaryMode: 'vercel-only',
        vercelBackend: createBackend(),
        gcsBackend: createBackend(),
      })
    ).rejects.toMatchObject({
      name: 'InvalidPayload',
      code: 'INVALID_PAYLOAD',
    })
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
