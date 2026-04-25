import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createFlatDataPathResolver,
  createHybridStore,
} from '../../api/_lib/hybrid-store.js'
import { createJsonStream } from './store-test-helpers.js'

function setEnvCase({ primary, shadowRead, shadowWrite }) {
  process.env.STORAGE_PRIMARY_TEST_HYBRID = primary
  process.env.STORAGE_SHADOW_READ_TEST_HYBRID = String(shadowRead)
  process.env.STORAGE_SHADOW_WRITE_TEST_HYBRID = String(shadowWrite)
}

function createStore(dataDir, overrides = {}) {
  const resolveDataPath = createFlatDataPathResolver(dataDir)
  return createHybridStore({
    keyspaceId: 'test.hybrid',
    loggerPrefix: 'test-hybrid-store',
    envPrefix: 'TEST_HYBRID',
    localPath: (key) => resolveDataPath(String(key || '').trim()),
    localRootPath: dataDir,
    vercelKey: (key) => String(key || '').trim(),
    gcsKey: (key) => String(key || '').trim(),
    bucketClass: overrides.bucketClass || 'private',
    authoritySource: overrides.authoritySource || 'local',
    promoteOnFallback: overrides.promoteOnFallback ?? true,
    getVercelToken: overrides.getVercelToken || (() => 'blob-token'),
  })
}

async function createDataDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hybrid-store-'))
  const dataDir = path.join(tempDir, 'data')
  await mkdir(dataDir, { recursive: true })
  return dataDir
}

async function writeLocalPayload(dataDir, key, payload) {
  const resolveDataPath = createFlatDataPathResolver(dataDir)
  const target = resolveDataPath(key)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(payload, null, 2), 'utf8')
  return target
}

function createGcsReadResult(payload) {
  return {
    body: Buffer.from(JSON.stringify(payload)),
  }
}

describe('api/_lib/hybrid-store.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
    process.env.GCS_BUCKET_PUBLIC = 'jcv-dev-public'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.GCS_BUCKET_PUBLIC
    delete process.env.STORAGE_PRIMARY_TEST_HYBRID
    delete process.env.STORAGE_SHADOW_READ_TEST_HYBRID
    delete process.env.STORAGE_SHADOW_WRITE_TEST_HYBRID
  })

  it('supports the four cutover shapes for local-mandatory writes and remote routing', async () => {
    const cases = [
      {
        name: 'vercel primary without shadow',
        policy: {
          primary: 'vercel',
          shadowRead: false,
          shadowWrite: false,
        },
        expected: {
          putCalls: 1,
          gcsWriteCalls: 0,
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
          putCalls: 1,
          gcsWriteCalls: 1,
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
          putCalls: 1,
          gcsWriteCalls: 1,
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
          putCalls: 0,
          gcsWriteCalls: 1,
        },
      },
    ]

    for (const testCase of cases) {
      const dataDir = await createDataDir()
      const resolveDataPath = createFlatDataPathResolver(dataDir)
      const store = createStore(dataDir)
      const putImpl = vi.fn().mockResolvedValue({ backend: 'vercel' })
      const gcsWriteImpl = vi.fn().mockResolvedValue({ backend: 'gcs' })

      setEnvCase(testCase.policy)

      await store.write('research/2330/123.json', { ok: true }, { putImpl, gcsWriteImpl })
      const storedPayload = JSON.parse(await readFile(resolveDataPath('research/2330/123.json'), 'utf8'))

      expect(storedPayload, testCase.name).toEqual({ ok: true })
      expect(putImpl, testCase.name).toHaveBeenCalledTimes(testCase.expected.putCalls)
      expect(gcsWriteImpl, testCase.name).toHaveBeenCalledTimes(testCase.expected.gcsWriteCalls)
    }
  })

  it('prefers local reads without touching remote backends', async () => {
    const dataDir = await createDataDir()
    const store = createStore(dataDir)
    const getImpl = vi.fn()
    const gcsReadImpl = vi.fn()

    await writeLocalPayload(dataDir, 'strategy-brain.json', { source: 'local' })

    const payload = await store.read('strategy-brain.json', {
      getImpl,
      gcsReadImpl,
      storagePolicyOverride: {
        primary: 'vercel',
        shadowRead: true,
        shadowWrite: false,
      },
    })

    expect(payload).toEqual({ source: 'local' })
    expect(getImpl).not.toHaveBeenCalled()
    expect(gcsReadImpl).not.toHaveBeenCalled()
  })

  it('falls back to the primary remote backend and promotes the payload into local cache', async () => {
    const dataDir = await createDataDir()
    const resolveDataPath = createFlatDataPathResolver(dataDir)
    const store = createStore(dataDir)
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ source: 'vercel' }),
    })

    const payload = await store.read('strategy-brain.json', {
      getImpl,
      storagePolicyOverride: {
        primary: 'vercel',
        shadowRead: false,
        shadowWrite: false,
      },
    })

    expect(payload).toEqual({ source: 'vercel' })
    expect(JSON.parse(await readFile(resolveDataPath('strategy-brain.json'), 'utf8'))).toEqual({
      source: 'vercel',
    })
  })

  it('uses shadow remote fallback when the primary remote misses and shadowRead is enabled', async () => {
    const dataDir = await createDataDir()
    const resolveDataPath = createFlatDataPathResolver(dataDir)
    const store = createStore(dataDir)
    const getImpl = vi.fn().mockResolvedValue(null)
    const gcsReadImpl = vi.fn().mockResolvedValue(createGcsReadResult({ source: 'gcs-shadow' }))

    const payload = await store.read('research-index.json', {
      getImpl,
      gcsReadImpl,
      storagePolicyOverride: {
        primary: 'vercel',
        shadowRead: true,
        shadowWrite: false,
      },
    })

    expect(payload).toEqual({ source: 'gcs-shadow' })
    expect(getImpl).toHaveBeenCalledTimes(1)
    expect(gcsReadImpl).toHaveBeenCalledWith('jcv-dev-private', 'research-index.json')
    expect(JSON.parse(await readFile(resolveDataPath('research-index.json'), 'utf8'))).toEqual({
      source: 'gcs-shadow',
    })
  })

  it('can disable local promotion for remote fallback reads', async () => {
    const dataDir = await createDataDir()
    const resolveDataPath = createFlatDataPathResolver(dataDir)
    const store = createStore(dataDir, { promoteOnFallback: false })
    const getImpl = vi.fn().mockResolvedValue({
      stream: createJsonStream({ source: 'vercel' }),
    })

    const payload = await store.read('strategy-brain.json', {
      getImpl,
      storagePolicyOverride: {
        primary: 'vercel',
        shadowRead: false,
        shadowWrite: false,
      },
    })

    await expect(stat(resolveDataPath('strategy-brain.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(payload).toEqual({ source: 'vercel' })
  })

  it('uses atomic overwrite for remote replaces instead of delete-then-put', async () => {
    const dataDir = await createDataDir()
    const store = createStore(dataDir)
    const putImpl = vi.fn().mockResolvedValue({ backend: 'vercel' })
    const delImpl = vi.fn()

    await store.write('strategy-brain.json', { version: 5 }, {
      putImpl,
      delImpl,
      storagePolicyOverride: {
        primary: 'vercel',
        shadowRead: false,
        shadowWrite: false,
      },
    })

    expect(delImpl).not.toHaveBeenCalled()
    expect(putImpl).toHaveBeenCalledWith(
      'strategy-brain.json',
      expect.any(String),
      expect.objectContaining({
        addRandomSuffix: false,
        allowOverwrite: true,
        access: 'private',
      })
    )
  })

  it('lists local items first and only falls back to remote when the local cache is empty', async () => {
    const dataDir = await createDataDir()
    const store = createStore(dataDir)
    const listImpl = vi.fn().mockResolvedValue({
      blobs: [{ pathname: 'research/2330/remote.json' }],
      cursor: null,
    })
    const gcsListPrefixImpl = vi.fn().mockResolvedValue({
      items: [{ key: 'research/2330/shadow.json' }],
      cursor: null,
    })

    await writeLocalPayload(dataDir, 'research/2330/local.json', { source: 'local' })

    const localItems = await store.list('research/2330/', {
      listImpl,
      gcsListPrefixImpl,
      storagePolicyOverride: {
        primary: 'vercel',
        shadowRead: true,
        shadowWrite: false,
      },
    })

    expect(localItems).toEqual([
      expect.objectContaining({
        key: 'research/2330/local.json',
        source: 'local',
      }),
    ])
    expect(listImpl).not.toHaveBeenCalled()
    expect(gcsListPrefixImpl).not.toHaveBeenCalled()

    const emptyDataDir = await createDataDir()
    const emptyStore = createStore(emptyDataDir)
    const remoteItems = await emptyStore.list('research/2330/', {
      listImpl: vi.fn().mockResolvedValue({
        blobs: [],
        cursor: null,
      }),
      gcsListPrefixImpl,
      storagePolicyOverride: {
        primary: 'vercel',
        shadowRead: true,
        shadowWrite: false,
      },
    })

    expect(remoteItems).toEqual([
      expect.objectContaining({
        key: 'research/2330/shadow.json',
        source: 'gcs',
      }),
    ])
  })

  it('deletes the local file and clears both remote mirrors to avoid stale fallback resurrection', async () => {
    const dataDir = await createDataDir()
    const resolveDataPath = createFlatDataPathResolver(dataDir)
    const store = createStore(dataDir)
    const delImpl = vi.fn().mockResolvedValue(undefined)
    const gcsDeleteManyImpl = vi.fn().mockResolvedValue({
      deletedKeys: ['strategy-brain.json'],
      missingKeys: [],
      failedKeys: [],
    })

    await writeLocalPayload(dataDir, 'strategy-brain.json', { version: 4 })

    await store.delete('strategy-brain.json', {
      delImpl,
      gcsDeleteManyImpl,
      storagePolicyOverride: {
        primary: 'vercel',
        shadowRead: false,
        shadowWrite: false,
      },
    })

    await expect(stat(resolveDataPath('strategy-brain.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(delImpl).toHaveBeenCalledWith('strategy-brain.json', { token: 'blob-token' })
    expect(gcsDeleteManyImpl).toHaveBeenCalledWith('jcv-dev-private', ['strategy-brain.json'])
  })
})
