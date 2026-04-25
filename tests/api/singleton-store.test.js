import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readBenchmarkSnapshots } from '../../api/_lib/benchmark-snapshots.js'
import { createSingletonStore } from '../../api/_lib/singleton-store.js'
import { createJsonStream } from './store-test-helpers.js'

function createStore() {
  return createSingletonStore({
    keyspaceId: 'test.singleton',
    loggerPrefix: 'test-store',
    envPrefix: 'TEST_SINGLETON',
    access: 'private',
    bucketClass: 'private',
    contentType: 'application/json',
    cacheControl: 'no-store',
    format: 'json',
    readMethod: 'get',
    useCache: false,
    vercelKey: ({ id }) => `test/${String(id || '').trim()}.json`,
    resolveListDescriptor: () => ({
      keyspace: 'test.singleton',
      key: 'test',
      prefix: 'test',
      access: 'private',
      bucketClass: 'private',
      matcher: /^test\/[^/]+\.json$/,
    }),
  })
}

describe('api/_lib/singleton-store.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_TEST_SINGLETON
    delete process.env.STORAGE_SHADOW_READ_TEST_SINGLETON
    delete process.env.STORAGE_SHADOW_WRITE_TEST_SINGLETON
  })

  it('uses the env cutover flags for primary read and shadow write', async () => {
    process.env.STORAGE_PRIMARY_TEST_SINGLETON = 'gcs'
    process.env.STORAGE_SHADOW_READ_TEST_SINGLETON = 'false'
    process.env.STORAGE_SHADOW_WRITE_TEST_SINGLETON = 'true'

    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ backend: 'vercel' }),
    })
    const putImpl = vi.fn().mockResolvedValue({ backend: 'vercel' })
    const gcsReadImpl = vi.fn().mockResolvedValue({
      body: Buffer.from('{"backend":"gcs"}'),
    })
    const gcsWriteImpl = vi.fn().mockResolvedValue({ backend: 'gcs' })
    const store = createStore()

    const readResult = await store.read(
      { id: 'alpha' },
      {
        token: 'blob-token',
        getImpl,
        gcsReadImpl,
      }
    )
    const writeResult = await store.write(
      { id: 'alpha' },
      { ok: true },
      {
        token: 'blob-token',
        putImpl,
        gcsWriteImpl,
      }
    )

    expect(readResult).toEqual({ backend: 'gcs' })
    expect(gcsReadImpl).toHaveBeenCalledWith('jcv-dev-private', 'test/alpha.json')
    expect(getImpl).not.toHaveBeenCalled()
    expect(writeResult).toEqual({ backend: 'gcs' })
    expect(gcsWriteImpl).toHaveBeenCalledWith(
      'jcv-dev-private',
      'test/alpha.json',
      expect.any(String),
      expect.objectContaining({
        contentType: 'application/json',
        cacheControl: 'no-store',
        public: false,
      })
    )
    expect(putImpl).toHaveBeenCalledWith(
      'test/alpha.json',
      expect.any(String),
      expect.objectContaining({
        token: 'blob-token',
        access: 'private',
      })
    )
  })

  it('records shadow divergence asynchronously without blocking the primary read', async () => {
    process.env.STORAGE_PRIMARY_TEST_SINGLETON = 'vercel'
    process.env.STORAGE_SHADOW_READ_TEST_SINGLETON = 'true'
    process.env.STORAGE_SHADOW_WRITE_TEST_SINGLETON = 'false'

    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ ok: true, updatedAt: '2026-04-25T00:00:00.000Z' }),
    })
    const gcsReadImpl = vi.fn().mockResolvedValue({
      body: Buffer.from('{"ok":false,"updatedAt":"2026-04-24T00:00:00.000Z"}'),
    })
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const mkdirImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }
    let backgroundPromise = Promise.resolve()
    const store = createStore()

    const result = await store.read(
      { id: 'alpha' },
      {
        token: 'blob-token',
        getImpl,
        gcsReadImpl,
        appendMetricImpl,
        mkdirImpl,
        logger,
        now: new Date('2026-04-25T01:02:03.000Z'),
        scheduleBackgroundTask(task) {
          backgroundPromise = Promise.resolve().then(task)
        },
      }
    )

    await backgroundPromise

    expect(result).toEqual({
      ok: true,
      updatedAt: '2026-04-25T00:00:00.000Z',
    })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('shadow read divergence for test/alpha.json')
    )
    expect(appendMetricImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(appendMetricImpl.mock.calls[0][1].trim())).toMatchObject({
      keyspace: 'test.singleton',
      key: 'test/alpha.json',
      primary: 'vercel',
      shadow: 'gcs',
      op: 'read',
      result: 'mismatch',
    })
  })

  it('throws for invalid env flag values instead of silently falling back', async () => {
    process.env.STORAGE_PRIMARY_TEST_SINGLETON = 'vercell'
    const store = createStore()

    await expect(
      store.read(
        { id: 'alpha' },
        {
          token: 'blob-token',
          getImpl: vi.fn(),
        }
      )
    ).rejects.toThrow(/STORAGE_PRIMARY_TEST_SINGLETON must be "vercel" or "gcs"/)
  })

  it('does not let divergence metric failures break the primary read', async () => {
    process.env.STORAGE_PRIMARY_TEST_SINGLETON = 'vercel'
    process.env.STORAGE_SHADOW_READ_TEST_SINGLETON = 'true'

    let backgroundPromise = Promise.resolve()
    const logger = { warn: vi.fn() }
    const store = createStore()

    const result = await store.read(
      { id: 'alpha' },
      {
        token: 'blob-token',
        getImpl: vi.fn().mockResolvedValue({
          stream: createJsonStream({ ok: true }),
        }),
        gcsReadImpl: vi.fn().mockResolvedValue({
          body: Buffer.from('{"ok":false}'),
        }),
        appendMetricImpl: vi.fn().mockRejectedValue(new Error('disk full')),
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logger,
        scheduleBackgroundTask(task) {
          backgroundPromise = Promise.resolve().then(task)
        },
      }
    )

    await backgroundPromise

    expect(result).toEqual({ ok: true })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to append divergence metric for test/alpha.json:'),
      expect.objectContaining({ message: 'disk full' })
    )
  })

  it('records shadow list divergence asynchronously without blocking the primary list', async () => {
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const mkdirImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }
    let backgroundPromise = Promise.resolve()
    const store = createStore()

    const items = await store.list(
      {},
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'gcs',
          shadowRead: true,
          shadowWrite: false,
        },
        gcsListPrefixImpl: vi.fn().mockResolvedValue({
          items: [{ key: 'test/2026-04-25.json' }],
          cursor: null,
        }),
        listImpl: vi.fn().mockResolvedValue({
          blobs: [
            { pathname: 'test/2026-04-24.json' },
            { pathname: 'test/2026-04-25.json' },
          ],
          cursor: null,
        }),
        appendMetricImpl,
        mkdirImpl,
        logger,
        scheduleBackgroundTask(task) {
          backgroundPromise = Promise.resolve().then(task)
        },
      }
    )

    await backgroundPromise

    expect(items).toEqual([
      expect.objectContaining({
        key: 'test/2026-04-25.json',
        pathname: 'test/2026-04-25.json',
      }),
    ])
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('shadow list divergence for test:')
    )
    expect(appendMetricImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(appendMetricImpl.mock.calls[0][1].trim())).toMatchObject({
      type: 'list-divergence',
      keyspace: 'test.singleton',
      key: 'test',
      primary: 'gcs',
      shadow: 'vercel',
      op: 'list',
      result: 'primary-missing-keys',
      primaryCount: 1,
      shadowCount: 2,
      primaryOnlyKeys: [],
      shadowOnlyKeys: ['test/2026-04-24.json'],
    })
  })

  it('does not append list divergence when primary and shadow inventories match', async () => {
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }
    let backgroundPromise = Promise.resolve()
    const store = createStore()

    const items = await store.list(
      {},
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'gcs',
          shadowRead: true,
          shadowWrite: false,
        },
        gcsListPrefixImpl: vi.fn().mockResolvedValue({
          items: [
            { key: 'test/2026-04-24.json' },
            { key: 'test/2026-04-25.json' },
          ],
          cursor: null,
        }),
        listImpl: vi.fn().mockResolvedValue({
          blobs: [
            { pathname: 'test/2026-04-24.json' },
            { pathname: 'test/2026-04-25.json' },
          ],
          cursor: null,
        }),
        appendMetricImpl,
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logger,
        scheduleBackgroundTask(task) {
          backgroundPromise = Promise.resolve().then(task)
        },
      }
    )

    await backgroundPromise

    expect(items).toHaveLength(2)
    expect(appendMetricImpl).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('lets benchmark snapshot reads use generic shadow list and shadow read paths together', async () => {
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const scheduledTasks = []

    const snapshots = await readBenchmarkSnapshots(
      {
        fromDate: '2026-04-25',
        toDate: '2026-04-25',
      },
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'gcs',
          shadowRead: true,
          shadowWrite: false,
        },
        gcsListPrefixImpl: vi.fn().mockResolvedValue({
          items: [{ key: 'snapshot/benchmark/2026-04-25.json' }],
          cursor: null,
        }),
        listImpl: vi.fn().mockResolvedValue({
          blobs: [
            { pathname: 'snapshot/benchmark/2026-04-24.json' },
            { pathname: 'snapshot/benchmark/2026-04-25.json' },
          ],
          cursor: null,
        }),
        gcsReadImpl: vi.fn().mockResolvedValue({
          body: Buffer.from('{"date":"2026-04-25","close":100}'),
        }),
        getImpl: vi.fn().mockResolvedValue({
          stream: createJsonStream({ date: '2026-04-25', close: 100 }),
        }),
        appendMetricImpl,
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logger: { warn: vi.fn() },
        scheduleBackgroundTask(task) {
          scheduledTasks.push(Promise.resolve().then(task))
        },
      }
    )

    await Promise.all(scheduledTasks)

    expect(snapshots).toEqual([
      expect.objectContaining({
        date: '2026-04-25',
        close: 100,
      }),
    ])
    expect(appendMetricImpl).toHaveBeenCalledTimes(2)

    const records = appendMetricImpl.mock.calls.map(([, payload]) => JSON.parse(payload.trim()))
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'list-divergence',
          keyspace: 'snapshot.benchmark',
          key: 'snapshot/benchmark',
          primary: 'gcs',
          shadow: 'vercel',
          op: 'list',
          result: 'primary-missing-keys',
        }),
        expect.objectContaining({
          keyspace: 'snapshot.benchmark',
          key: 'snapshot/benchmark/2026-04-25.json',
          primary: 'gcs',
          shadow: 'vercel',
          op: 'read',
          result: 'match',
        }),
      ])
    )
  })
})
