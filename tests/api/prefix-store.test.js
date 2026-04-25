import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPrefixStore } from '../../api/_lib/prefix-store.js'
import { createJsonStream } from './store-test-helpers.js'

function createStore() {
  return createPrefixStore({
    keyspaceId: 'snapshot.research',
    loggerPrefix: 'test-prefix-store',
    envPrefix: 'TEST_PREFIX_STORE',
    bucketClass: 'private',
    access: 'private',
    vercelPrefix: 'snapshot/research/',
    gcsPrefix: 'snapshot/research/',
    contentType: 'application/json',
    cacheControl: 'no-store',
    format: 'json',
    useCache: false,
    metadataKey(item) {
      return item?.uploadedAt || ''
    },
  })
}

function setEnvCase({ primary, shadowRead, shadowWrite }) {
  process.env.STORAGE_PRIMARY_TEST_PREFIX_STORE = primary
  process.env.STORAGE_SHADOW_READ_TEST_PREFIX_STORE = String(shadowRead)
  process.env.STORAGE_SHADOW_WRITE_TEST_PREFIX_STORE = String(shadowWrite)
}

describe('api/_lib/prefix-store.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
    process.env.STORAGE_SHADOW_SAMPLE_SIZE = '0'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_PRIMARY_TEST_PREFIX_STORE
    delete process.env.STORAGE_SHADOW_READ_TEST_PREFIX_STORE
    delete process.env.STORAGE_SHADOW_WRITE_TEST_PREFIX_STORE
    delete process.env.STORAGE_SHADOW_SAMPLE_SIZE
  })

  it('supports the four cutover shapes for exact reads/writes and prefix listing', async () => {
    const cases = [
      {
        name: 'vercel primary without shadow',
        policy: {
          primary: 'vercel',
          shadowRead: false,
          shadowWrite: false,
        },
        expected: {
          vercelReadCalls: 1,
          gcsReadCalls: 0,
          vercelWriteCalls: 1,
          gcsWriteCalls: 0,
          vercelListCalls: 1,
          gcsListCalls: 0,
        },
      },
      {
        name: 'vercel primary with gcs shadow',
        policy: {
          primary: 'vercel',
          shadowRead: true,
          shadowWrite: true,
        },
        expected: {
          vercelReadCalls: 1,
          gcsReadCalls: 1,
          vercelWriteCalls: 1,
          gcsWriteCalls: 1,
          vercelListCalls: 1,
          gcsListCalls: 1,
        },
      },
      {
        name: 'gcs primary with vercel shadow',
        policy: {
          primary: 'gcs',
          shadowRead: true,
          shadowWrite: true,
        },
        expected: {
          vercelReadCalls: 1,
          gcsReadCalls: 1,
          vercelWriteCalls: 1,
          gcsWriteCalls: 1,
          vercelListCalls: 1,
          gcsListCalls: 1,
        },
      },
      {
        name: 'gcs primary without shadow',
        policy: {
          primary: 'gcs',
          shadowRead: false,
          shadowWrite: false,
        },
        expected: {
          vercelReadCalls: 0,
          gcsReadCalls: 1,
          vercelWriteCalls: 0,
          gcsWriteCalls: 1,
          vercelListCalls: 0,
          gcsListCalls: 1,
        },
      },
    ]

    for (const testCase of cases) {
      setEnvCase(testCase.policy)

      const getImpl = vi.fn().mockResolvedValue({
        stream: createJsonStream({ ok: true }),
      })
      const gcsReadImpl = vi.fn().mockResolvedValue({
        body: Buffer.from('{"ok":true}'),
      })
      const putImpl = vi.fn().mockResolvedValue({ backend: 'vercel' })
      const gcsWriteImpl = vi.fn().mockResolvedValue({ backend: 'gcs' })
      const listImpl = vi.fn().mockResolvedValue({
        blobs: [{ pathname: 'snapshot/research/2026-04-25/research-index.json' }],
        cursor: null,
      })
      const gcsListPrefixImpl = vi.fn().mockResolvedValue({
        items: [{ key: 'snapshot/research/2026-04-25/research-index.json' }],
        cursor: null,
      })
      const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
      const scheduledTasks = []
      const store = createStore()

      const readResult = await store.read('2026-04-25/research-index.json', {
        token: 'blob-token',
        getImpl,
        gcsReadImpl,
        appendMetricImpl,
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logger: { warn: vi.fn() },
        scheduleBackgroundTask(task) {
          scheduledTasks.push(Promise.resolve().then(task))
        },
      })
      const listResult = await store.list(
        {
          prefix: '',
          limit: 1,
        },
        {
          token: 'blob-token',
          listImpl,
          gcsListPrefixImpl,
          appendMetricImpl,
          mkdirImpl: vi.fn().mockResolvedValue(undefined),
          logger: { warn: vi.fn() },
          scheduleBackgroundTask(task) {
            scheduledTasks.push(Promise.resolve().then(task))
          },
        }
      )
      await store.write('2026-04-25/research-index.json', { ok: true }, {
        token: 'blob-token',
        putImpl,
        gcsWriteImpl,
      })
      await Promise.all(scheduledTasks)

      expect(readResult, testCase.name).toEqual({ ok: true })
      expect(listResult.items, testCase.name).toEqual([
        expect.objectContaining({
          key: 'snapshot/research/2026-04-25/research-index.json',
        }),
      ])
      expect(listResult.hasMore, testCase.name).toBe(false)
      expect(appendMetricImpl, testCase.name).toHaveBeenCalledTimes(
        testCase.policy.shadowRead ? 1 : 0
      )
      expect(getImpl, testCase.name).toHaveBeenCalledTimes(testCase.expected.vercelReadCalls)
      expect(gcsReadImpl, testCase.name).toHaveBeenCalledTimes(testCase.expected.gcsReadCalls)
      expect(putImpl, testCase.name).toHaveBeenCalledTimes(testCase.expected.vercelWriteCalls)
      expect(gcsWriteImpl, testCase.name).toHaveBeenCalledTimes(testCase.expected.gcsWriteCalls)
      expect(listImpl, testCase.name).toHaveBeenCalledTimes(testCase.expected.vercelListCalls)
      expect(gcsListPrefixImpl, testCase.name).toHaveBeenCalledTimes(
        testCase.expected.gcsListCalls
      )
    }
  })

  it('paginates with a logical cursor and keeps the shadow page comparison stable across backends', async () => {
    const store = createStore()
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }
    const scheduledTasks = []

    const listImpl = vi
      .fn()
      .mockResolvedValueOnce({
        blobs: [
          { pathname: 'snapshot/research/2026-04-23/research-index.json' },
          { pathname: 'snapshot/research/2026-04-24/research-index.json' },
        ],
        cursor: 'vercel-page-2',
      })
      .mockResolvedValueOnce({
        blobs: [
          { pathname: 'snapshot/research/2026-04-25/research-index.json' },
          { pathname: 'snapshot/research/2026-04-26/research-index.json' },
        ],
        cursor: null,
      })
      .mockResolvedValueOnce({
        blobs: [
          { pathname: 'snapshot/research/2026-04-23/research-index.json' },
          { pathname: 'snapshot/research/2026-04-24/research-index.json' },
        ],
        cursor: 'vercel-page-2',
      })
      .mockResolvedValueOnce({
        blobs: [
          { pathname: 'snapshot/research/2026-04-25/research-index.json' },
          { pathname: 'snapshot/research/2026-04-26/research-index.json' },
        ],
        cursor: null,
      })

    const gcsListPrefixImpl = vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          { key: 'snapshot/research/2026-04-23/research-index.json' },
          { key: 'snapshot/research/2026-04-24/research-index.json' },
        ],
        cursor: 'gcs-page-2',
      })
      .mockResolvedValueOnce({
        items: [
          { key: 'snapshot/research/2026-04-25/research-index.json' },
          { key: 'snapshot/research/2026-04-26/research-index.json' },
        ],
        cursor: null,
      })
      .mockResolvedValueOnce({
        items: [
          { key: 'snapshot/research/2026-04-23/research-index.json' },
          { key: 'snapshot/research/2026-04-24/research-index.json' },
        ],
        cursor: 'gcs-page-2',
      })
      .mockResolvedValueOnce({
        items: [
          { key: 'snapshot/research/2026-04-25/research-index.json' },
          { key: 'snapshot/research/2026-04-26/research-index.json' },
        ],
        cursor: null,
      })

    const firstPage = await store.list(
      {
        prefix: '',
        limit: 2,
      },
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'vercel',
          shadowRead: true,
          shadowWrite: false,
        },
        listImpl,
        gcsListPrefixImpl,
        appendMetricImpl,
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logger,
        scheduleBackgroundTask(task) {
          scheduledTasks.push(Promise.resolve().then(task))
        },
      }
    )

    const secondPage = await store.list(
      {
        prefix: '',
        cursor: firstPage.nextCursor,
        limit: 2,
      },
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'vercel',
          shadowRead: true,
          shadowWrite: false,
        },
        listImpl,
        gcsListPrefixImpl,
        appendMetricImpl,
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logger,
        scheduleBackgroundTask(task) {
          scheduledTasks.push(Promise.resolve().then(task))
        },
      }
    )

    await Promise.all(scheduledTasks)

    expect(firstPage).toMatchObject({
      hasMore: true,
      nextCursor: 'snapshot/research/2026-04-24/research-index.json',
    })
    expect(firstPage.items.map((item) => item.key)).toEqual([
      'snapshot/research/2026-04-23/research-index.json',
      'snapshot/research/2026-04-24/research-index.json',
    ])
    expect(secondPage).toMatchObject({
      hasMore: false,
      nextCursor: null,
    })
    expect(secondPage.items.map((item) => item.key)).toEqual([
      'snapshot/research/2026-04-25/research-index.json',
      'snapshot/research/2026-04-26/research-index.json',
    ])
    expect(appendMetricImpl).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('documents the logical cursor race when a concurrent insert lands before the cursor', async () => {
    const store = createStore()

    const listImpl = vi
      .fn()
      .mockResolvedValueOnce({
        blobs: [
          { pathname: 'snapshot/research/a.json' },
          { pathname: 'snapshot/research/c.json' },
        ],
        cursor: 'vercel-page-2',
      })
      .mockResolvedValueOnce({
        blobs: [{ pathname: 'snapshot/research/d.json' }],
        cursor: null,
      })
      .mockResolvedValueOnce({
        blobs: [
          { pathname: 'snapshot/research/b.json' },
          { pathname: 'snapshot/research/d.json' },
        ],
        cursor: null,
      })

    const firstPage = await store.list(
      {
        prefix: '',
        limit: 2,
      },
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'vercel',
          shadowRead: false,
          shadowWrite: false,
        },
        listImpl,
      }
    )

    const secondPage = await store.list(
      {
        prefix: '',
        cursor: firstPage.nextCursor,
        limit: 2,
      },
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'vercel',
          shadowRead: false,
          shadowWrite: false,
        },
        listImpl,
      }
    )

    expect(firstPage.items.map((item) => item.key)).toEqual([
      'snapshot/research/a.json',
      'snapshot/research/c.json',
    ])
    expect(firstPage).toMatchObject({
      hasMore: true,
      nextCursor: 'snapshot/research/c.json',
    })
    expect(secondPage.items.map((item) => item.key)).toEqual(['snapshot/research/d.json'])
  })

  it('records deleteMany shadow divergence when the secondary key is already gone', async () => {
    const store = createStore()
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }

    const result = await store.deleteMany(
      [
        '2026-04-24/research-index.json',
        '2026-04-24/portfolio-me-research-history.json',
      ],
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'gcs',
          shadowRead: false,
          shadowWrite: true,
        },
        gcsDeleteManyImpl: vi.fn().mockResolvedValue({
          deletedKeys: [
            'snapshot/research/2026-04-24/research-index.json',
            'snapshot/research/2026-04-24/portfolio-me-research-history.json',
          ],
          missingKeys: [],
          failedKeys: [],
        }),
        headImpl: vi
          .fn()
          .mockResolvedValueOnce({ etag: 'etag-1' })
          .mockResolvedValueOnce(null),
        delImpl: vi.fn().mockResolvedValue(undefined),
        appendMetricImpl,
        mkdirImpl: vi.fn().mockResolvedValue(undefined),
        logger,
      }
    )

    expect(result).toMatchObject({
      requestedCount: 2,
      deletedKeys: [
        'snapshot/research/2026-04-24/research-index.json',
        'snapshot/research/2026-04-24/portfolio-me-research-history.json',
      ],
      shadowMissingKeys: ['snapshot/research/2026-04-24/portfolio-me-research-history.json'],
    })
    expect(appendMetricImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(appendMetricImpl.mock.calls[0][1].trim())).toMatchObject({
      type: 'delete-divergence',
      keyspace: 'snapshot.research',
      primary: 'gcs',
      shadow: 'vercel',
      op: 'delete',
      result: 'shadow-missing-keys',
      requestedCount: 2,
      missingKeys: ['snapshot/research/2026-04-24/portfolio-me-research-history.json'],
    })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('shadow delete divergence for snapshot.research: missing=1 failed=0')
    )
  })

  it('throws immediately when the primary deleteMany call partially fails', async () => {
    const store = createStore()
    const headImpl = vi.fn()
    const delImpl = vi.fn()

    await expect(
      store.deleteMany(
        [
          '2026-04-24/research-index.json',
          '2026-04-24/portfolio-me-research-history.json',
        ],
        {
          token: 'blob-token',
          storagePolicyOverride: {
            primary: 'gcs',
            shadowRead: false,
            shadowWrite: true,
          },
          gcsDeleteManyImpl: vi.fn().mockResolvedValue({
            deletedKeys: ['snapshot/research/2026-04-24/research-index.json'],
            missingKeys: [],
            failedKeys: [
              {
                key: 'snapshot/research/2026-04-24/portfolio-me-research-history.json',
                error: new Error('primary delete failed'),
              },
            ],
          }),
          headImpl,
          delImpl,
        }
      )
    ).rejects.toMatchObject({
      name: 'DeleteManyError',
      code: 'DELETE_MANY_FAILED',
      failures: [
        expect.objectContaining({
          key: 'snapshot/research/2026-04-24/portfolio-me-research-history.json',
        }),
      ],
    })

    expect(headImpl).not.toHaveBeenCalled()
    expect(delImpl).not.toHaveBeenCalled()
  })

  it('records a list divergence when the shadow backend has an extra tail page', async () => {
    const store = createStore()
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }
    let backgroundPromise = Promise.resolve()

    const page = await store.list(
      {
        prefix: '',
        limit: 2,
      },
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'gcs',
          shadowRead: true,
          shadowWrite: false,
        },
        gcsListPrefixImpl: vi.fn().mockResolvedValue({
          items: [
            { key: 'snapshot/research/2026-04-24/research-index.json' },
            { key: 'snapshot/research/2026-04-25/research-index.json' },
          ],
          cursor: null,
        }),
        listImpl: vi
          .fn()
          .mockResolvedValueOnce({
            blobs: [
              { pathname: 'snapshot/research/2026-04-24/research-index.json' },
              { pathname: 'snapshot/research/2026-04-25/research-index.json' },
            ],
            cursor: 'shadow-tail',
          })
          .mockResolvedValueOnce({
            blobs: [{ pathname: 'snapshot/research/2026-04-26/research-index.json' }],
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

    expect(page.items.map((item) => item.key)).toEqual([
      'snapshot/research/2026-04-24/research-index.json',
      'snapshot/research/2026-04-25/research-index.json',
    ])
    expect(page.hasMore).toBe(false)
    expect(appendMetricImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(appendMetricImpl.mock.calls[0][1].trim())).toMatchObject({
      type: 'list-divergence',
      keyspace: 'snapshot.research',
      result: 'primary-missing-tail',
      primaryHasMore: false,
      shadowHasMore: true,
    })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('shadow list divergence for snapshot/research/')
    )
  })

  it('samples shared list keys and records read divergence when content differs', async () => {
    process.env.STORAGE_SHADOW_SAMPLE_SIZE = '1'

    const store = createStore()
    const appendMetricImpl = vi.fn().mockResolvedValue(undefined)
    const logger = { warn: vi.fn() }
    let backgroundPromise = Promise.resolve()

    const page = await store.list(
      {
        prefix: '',
        limit: 1,
      },
      {
        token: 'blob-token',
        storagePolicyOverride: {
          primary: 'gcs',
          shadowRead: true,
          shadowWrite: false,
        },
        gcsListPrefixImpl: vi.fn().mockResolvedValue({
          items: [{ key: 'snapshot/research/2026-04-24/research-index.json' }],
          cursor: null,
        }),
        listImpl: vi.fn().mockResolvedValue({
          blobs: [{ pathname: 'snapshot/research/2026-04-24/research-index.json' }],
          cursor: null,
        }),
        gcsReadImpl: vi.fn().mockResolvedValue({
          body: Buffer.from('{"backend":"gcs"}'),
        }),
        getImpl: vi.fn().mockResolvedValue({
          stream: createJsonStream({ backend: 'vercel' }),
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

    expect(page.items).toEqual([
      expect.objectContaining({
        key: 'snapshot/research/2026-04-24/research-index.json',
      }),
    ])
    expect(appendMetricImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(appendMetricImpl.mock.calls[0][1].trim())).toMatchObject({
      type: 'read-divergence',
      keyspace: 'snapshot.research',
      key: 'snapshot/research/2026-04-24/research-index.json',
      primary: 'gcs',
      shadow: 'vercel',
      op: 'read',
      result: 'mismatch',
    })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('shadow sampled read divergence for snapshot/research/2026-04-24/research-index.json')
    )
  })
})
