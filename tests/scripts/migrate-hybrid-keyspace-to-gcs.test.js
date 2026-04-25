import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadKeyInventory,
  readSource,
  runMigration,
} from '../../scripts/migrate-hybrid-keyspace-to-gcs.mjs'

function createSourceRecord(body, contentType = 'application/json') {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
  return {
    buffer,
    bytes: buffer.length,
    contentType,
  }
}

function createConsoleSpy() {
  const messages = []
  return {
    messages,
    log: vi.fn((message) => {
      messages.push(String(message))
    }),
    warn: vi.fn((message) => {
      messages.push(String(message))
    }),
  }
}

function createDestinationStore(initialEntries = {}) {
  const store = new Map(
    Object.entries(initialEntries).map(([key, value]) => [
      key,
      { ...value, body: Buffer.from(value.body) },
    ])
  )

  return {
    read(item) {
      const record = store.get(`${item.bucketName}/${item.key}`)
      if (!record) return null
      return {
        body: Buffer.from(record.body),
        generation: record.generation,
        contentType: record.contentType || 'application/json',
      }
    },
    writeCreateOnly(bucketName, key, body, _generation, opts = {}) {
      const mapKey = `${bucketName}/${key}`
      if (store.has(mapKey)) {
        throw Object.assign(new Error('precondition failed'), {
          code: 'PRECONDITION_FAILED',
        })
      }

      const nextGeneration = String(Number(store.get(mapKey)?.generation || 0) + 1)
      store.set(mapKey, {
        body: Buffer.from(body),
        generation: nextGeneration,
        contentType: opts.contentType || 'application/json',
      })

      return {
        generation: nextGeneration,
      }
    },
    writeLatest(bucketName, key, body, opts = {}) {
      const mapKey = `${bucketName}/${key}`
      const nextGeneration = String(Number(store.get(mapKey)?.generation || 0) + 1)
      store.set(mapKey, {
        body: Buffer.from(body),
        generation: nextGeneration,
        contentType: opts.contentType || 'application/json',
      })

      return {
        generation: nextGeneration,
      }
    },
  }
}

function buildPaths(tempDir, slug) {
  return {
    statePath: path.join(tempDir, '.tmp', 'migration-state', `${slug}.json`),
    reverseManifestPath: path.join(tempDir, '.tmp', 'migration-state', `${slug}.reverse.json`),
    lockPath: path.join(tempDir, '.tmp', 'migration-state', `${slug}.lock`),
  }
}

describe('scripts/migrate-hybrid-keyspace-to-gcs.mjs', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
    process.env.GCS_BUCKET_PUBLIC = 'jcv-dev-public'
    process.env.STORAGE_SHADOW_WRITE_BRAIN = 'true'
    process.env.STORAGE_SHADOW_WRITE_RESEARCH = 'true'
    process.env.STORAGE_SHADOW_WRITE_TELEMETRY = 'true'
    process.env.STORAGE_SHADOW_WRITE_ANALYSIS_HISTORY = 'true'
    process.env.PUB_BLOB_TELEMETRY_TOKEN = 'telemetry-token'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.GCS_BUCKET_PUBLIC
    delete process.env.STORAGE_SHADOW_WRITE_BRAIN
    delete process.env.STORAGE_SHADOW_WRITE_RESEARCH
    delete process.env.STORAGE_SHADOW_WRITE_TELEMETRY
    delete process.env.STORAGE_SHADOW_WRITE_ANALYSIS_HISTORY
    delete process.env.PUB_BLOB_TELEMETRY_TOKEN
  })

  it('lists hybrid inventories across exact-key and prefix source lanes', async () => {
    const researchListImpl = vi.fn(({ prefix }) => {
      if (prefix === 'research-index.json') {
        return Promise.resolve({
          blobs: [{ pathname: 'research-index.json' }],
          cursor: null,
        })
      }
      if (prefix === 'research/') {
        return Promise.resolve({
          blobs: [
            { pathname: 'research/2330/123.json' },
            { pathname: 'research/ignore.txt' },
          ],
          cursor: null,
        })
      }
      if (prefix === 'brain-proposals/') {
        return Promise.resolve({
          blobs: [{ pathname: 'brain-proposals/proposal-1.json' }],
          cursor: null,
        })
      }
      return Promise.resolve({ blobs: [], cursor: null })
    })

    const telemetryListImpl = vi.fn().mockResolvedValue({
      blobs: [{ pathname: 'telemetry-events.json' }],
      cursor: null,
    })

    const researchItems = await loadKeyInventory({
      keyspace: 'research',
      listImpl: researchListImpl,
      tokenResolverImpl: vi.fn(() => 'blob-token'),
    })
    const telemetryItems = await loadKeyInventory({
      keyspace: 'telemetry',
      listImpl: telemetryListImpl,
      tokenResolverImpl: vi.fn(() => 'telemetry-token'),
    })

    expect(researchItems).toEqual([
      {
        key: 'brain-proposals/proposal-1.json',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
      {
        key: 'research-index.json',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
      {
        key: 'research/2330/123.json',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
    ])
    expect(telemetryItems).toEqual([
      {
        key: 'telemetry-events.json',
        access: 'public',
        bucketName: 'jcv-dev-public',
      },
    ])
    expect(researchListImpl.mock.calls.map(([args]) => args.prefix)).toEqual([
      'research-index.json',
      'research/',
      'brain-proposals/',
    ])
  })

  it('supports all hybrid keyspaces through the generic migration config, including public telemetry writes', async () => {
    const cases = [
      {
        keyspace: 'brain',
        key: 'strategy-brain.json',
        sourceBody: '{"version":4}',
        bucketName: 'jcv-dev-private',
        public: false,
      },
      {
        keyspace: 'research',
        key: 'research/2330/123.json',
        sourceBody: '{"code":"2330"}',
        bucketName: 'jcv-dev-private',
        public: false,
      },
      {
        keyspace: 'telemetry',
        key: 'telemetry-events.json',
        sourceBody: '{"entries":[{"id":"1"}]}',
        bucketName: 'jcv-dev-public',
        public: true,
      },
      {
        keyspace: 'analysis_history',
        key: 'analysis-history/2026/04/23-1.json',
        sourceBody: '{"id":1}',
        bucketName: 'jcv-dev-private',
        public: false,
      },
    ]

    for (const testCase of cases) {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), `${testCase.keyspace}-migrate-`))
      const paths = buildPaths(tempDir, testCase.keyspace)
      const destinations = createDestinationStore()
      const gcsWriteIfGenerationImpl = vi.fn(async (bucketName, key, body, expectedGeneration, opts) =>
        destinations.writeCreateOnly(bucketName, key, body, expectedGeneration, opts)
      )

      const { summary } = await runMigration(
        {
          keyspace: testCase.keyspace,
          ...paths,
        },
        {
          consoleImpl: createConsoleSpy(),
          loadKeyInventoryImpl: vi.fn(async () => [
            {
              key: testCase.key,
              access: testCase.public ? 'public' : 'private',
              bucketName: testCase.bucketName,
            },
          ]),
          readSourceImpl: vi.fn(async () => createSourceRecord(testCase.sourceBody)),
          readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
          gcsWriteIfGenerationImpl,
        }
      )

      const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

      expect(summary).toMatchObject({
        keyspace: testCase.keyspace,
        done: 1,
        errors: 0,
      })
      expect(state.items).toEqual([
        expect.objectContaining({
          key: testCase.key,
          status: 'done',
        }),
      ])
      expect(gcsWriteIfGenerationImpl).toHaveBeenCalledWith(
        testCase.bucketName,
        testCase.key,
        expect.any(Buffer),
        0,
        expect.objectContaining({
          public: testCase.public,
        })
      )
    }
  })

  it('handles an empty source inventory without failing the run', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hybrid-migrate-empty-'))
    const paths = buildPaths(tempDir, 'telemetry')

    const { summary } = await runMigration(
      {
        keyspace: 'telemetry',
        ...paths,
      },
      {
        consoleImpl: createConsoleSpy(),
        loadKeyInventoryImpl: vi.fn(async () => []),
      }
    )

    expect(summary).toMatchObject({
      keyspace: 'telemetry',
      total: 0,
      done: 0,
      errors: 0,
    })
  })

  it('reads public telemetry sources with PUB_BLOB_TELEMETRY_TOKEN fallback during dry-run', async () => {
    delete process.env.PUB_BLOB_READ_WRITE_TOKEN
    process.env.PUB_BLOB_TELEMETRY_TOKEN = 'telemetry-token'

    const listImpl = vi.fn().mockResolvedValue({
      blobs: [{ pathname: 'telemetry-events.json', url: 'https://blob.example/telemetry-events.json' }],
      cursor: null,
    })
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: vi.fn(() => 'application/json'),
      },
      arrayBuffer: vi.fn(async () => Buffer.from('{"entries":[]}')),
    })

    const source = await readSource(
      {
        key: 'telemetry-events.json',
        access: 'public',
        bucketName: 'jcv-dev-public',
      },
      {
        listImpl,
        fetchImpl,
      }
    )

    expect(listImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'telemetry-token',
        prefix: 'telemetry-events.json',
      })
    )
    expect(source).toMatchObject({
      key: 'telemetry-events.json',
      bytes: Buffer.byteLength('{"entries":[]}'),
      contentType: 'application/json',
    })
  })

  it('resumes stale-source-changed items and converges on the next run', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hybrid-migrate-stale-'))
    const paths = buildPaths(tempDir, 'research')
    const consoleImpl = createConsoleSpy()
    const destinations = createDestinationStore()
    const inventory = [
      {
        key: 'research/2330/123.json',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
    ]

    let sourceVersion = 1
    let readCount = 0
    const readSourceImpl = vi.fn(async () => {
      readCount += 1
      if (readCount === 2) {
        sourceVersion = 2
      }
      return createSourceRecord(JSON.stringify({ version: sourceVersion }))
    })
    const gcsWriteIfGenerationImpl = vi.fn(async (bucketName, key, body, expectedGeneration, opts) =>
      destinations.writeCreateOnly(bucketName, key, body, expectedGeneration, opts)
    )
    const gcsWriteImpl = vi.fn(async (bucketName, key, body, opts) =>
      destinations.writeLatest(bucketName, key, body, opts)
    )

    const firstRun = await runMigration(
      {
        keyspace: 'research',
        ...paths,
      },
      {
        consoleImpl,
        loadKeyInventoryImpl: vi.fn(async () => inventory),
        readSourceImpl,
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl,
        gcsWriteImpl,
      }
    )

    readCount = 0
    sourceVersion = 2

    const secondRun = await runMigration(
      {
        keyspace: 'research',
        resume: true,
        ...paths,
      },
      {
        consoleImpl,
        loadKeyInventoryImpl: vi.fn(async () => inventory),
        readSourceImpl: vi.fn(async () => createSourceRecord('{"version":2}')),
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl,
        gcsWriteImpl,
      }
    )
    const finalState = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(firstRun.summary).toMatchObject({
      staleSourceChanged: 1,
      done: 0,
    })
    expect(secondRun.summary).toMatchObject({
      done: 1,
      staleSourceChanged: 0,
    })
    expect(gcsWriteIfGenerationImpl).toHaveBeenCalledTimes(1)
    expect(gcsWriteImpl).toHaveBeenCalledTimes(1)
    expect(finalState.items).toEqual([
      expect.objectContaining({
        key: 'research/2330/123.json',
        status: 'done',
      }),
    ])
  })
})
