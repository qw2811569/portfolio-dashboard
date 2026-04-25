import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadKeyInventory,
  runMigration,
} from '../../scripts/migrate-prefix-keyspace-to-gcs.mjs'

const RESEARCH_KEYSPACE = 'snapshot.research'

function resolvePathStem(keyspace = RESEARCH_KEYSPACE) {
  switch (keyspace) {
    case 'snapshot.brain':
      return 'snapshot-brain'
    case 'snapshot.portfolio_state':
      return 'snapshot-portfolio-state'
    case RESEARCH_KEYSPACE:
    default:
      return 'snapshot-research'
  }
}

function withKeyspace(keyspace, options = {}) {
  return {
    keyspace,
    ...options,
  }
}

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
      }
    },
    write(bucketName, key, body) {
      const mapKey = `${bucketName}/${key}`
      const existing = store.get(mapKey)
      const nextGeneration = Number(existing?.generation || 0) + 1
      store.set(mapKey, {
        body: Buffer.from(body),
        generation: String(nextGeneration),
      })

      return {
        generation: String(nextGeneration),
      }
    },
    writeIfGeneration(bucketName, key, body, expectedGeneration) {
      const mapKey = `${bucketName}/${key}`
      const existing = store.get(mapKey)

      if (expectedGeneration === 0 && existing) {
        const error = new Error('precondition failed')
        error.code = 'PRECONDITION_FAILED'
        throw error
      }

      const nextGeneration = Number(existing?.generation || 0) + 1
      store.set(mapKey, {
        body: Buffer.from(body),
        generation: String(nextGeneration),
      })

      return {
        generation: String(nextGeneration),
      }
    },
  }
}

function buildPaths(tempDir, keyspace = RESEARCH_KEYSPACE) {
  const pathStem = resolvePathStem(keyspace)
  return {
    statePath: path.join(tempDir, '.tmp', 'migration-state', `${pathStem}.json`),
    reverseManifestPath: path.join(tempDir, '.tmp', 'migration-state', `${pathStem}.reverse.json`),
    lockPath: path.join(tempDir, '.tmp', 'migration-state', `${pathStem}.lock`),
  }
}

describe('scripts/migrate-prefix-keyspace-to-gcs.mjs', () => {
  const originalCwd = process.cwd()

  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
    process.env.STORAGE_SHADOW_WRITE_SNAPSHOT_RESEARCH = 'true'
    process.env.STORAGE_SHADOW_WRITE_SNAPSHOT_BRAIN = 'true'
    process.env.STORAGE_SHADOW_WRITE_SNAPSHOT_PORTFOLIO_STATE = 'true'
  })

  afterEach(() => {
    process.chdir(originalCwd)
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_SHADOW_WRITE_SNAPSHOT_RESEARCH
    delete process.env.STORAGE_SHADOW_WRITE_SNAPSHOT_BRAIN
    delete process.env.STORAGE_SHADOW_WRITE_SNAPSHOT_PORTFOLIO_STATE
  })

  it('lists snapshot.research inventory with cursor pagination from the Blob prefix', async () => {
    const listImpl = vi
      .fn()
      .mockResolvedValueOnce({
        blobs: [
          { pathname: 'snapshot/research/2026-04-24/research-index.json' },
          { pathname: 'snapshot/research/2026-04-24/portfolio-me-research-history.json' },
          { pathname: 'snapshot/research/ignore.txt' },
        ],
        cursor: 'page-2',
      })
      .mockResolvedValueOnce({
        blobs: [{ pathname: 'snapshot/research/2026-04-25/research-index.json' }],
        cursor: null,
      })

    const items = await loadKeyInventory({
      keyspace: RESEARCH_KEYSPACE,
      listImpl,
      getPrivateBlobTokenImpl: vi.fn(() => 'blob-token'),
    })

    expect(items).toEqual([
      {
        key: 'snapshot/research/2026-04-24/portfolio-me-research-history.json',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
      {
        key: 'snapshot/research/2026-04-24/research-index.json',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
      {
        key: 'snapshot/research/2026-04-25/research-index.json',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
    ])
    expect(listImpl).toHaveBeenNthCalledWith(1, {
      token: 'blob-token',
      prefix: 'snapshot/research/',
      cursor: undefined,
      limit: 1000,
    })
    expect(listImpl).toHaveBeenNthCalledWith(2, {
      token: 'blob-token',
      prefix: 'snapshot/research/',
      cursor: 'page-2',
      limit: 1000,
    })
  })

  it('supports snapshot.brain and snapshot.portfolio_state through the generic keyspace config', async () => {
    const cases = [
      {
        keyspace: 'snapshot.brain',
        listPrefix: 'snapshot/brain/',
        key: 'snapshot/brain/2026-04-24/analysis-history/2026/04/23-1.json',
        ignoredKey: 'snapshot/brain/not-a-date.json',
        sourceBody: '{"schemaVersion":1,"id":"analysis-1"}',
      },
      {
        keyspace: 'snapshot.portfolio_state',
        listPrefix: 'snapshot/portfolio-state/',
        key: 'snapshot/portfolio-state/2026-04-24/me/holdings.json',
        ignoredKey: 'snapshot/portfolio-state/2026-04-24.json',
        sourceBody: '[{"code":"2330","qty":1}]',
      },
    ]

    for (const testCase of cases) {
      const tempDir = await mkdtemp(
        path.join(os.tmpdir(), `${testCase.keyspace.replace(/[._]/g, '-')}-migrate-`)
      )
      const paths = buildPaths(tempDir, testCase.keyspace)
      const destinations = createDestinationStore()
      const listImpl = vi.fn().mockResolvedValue({
        blobs: [
          { pathname: testCase.key },
          { pathname: testCase.ignoredKey },
          { pathname: 'snapshot/research/2026-04-24/research-index.json' },
        ],
        cursor: null,
      })

      const items = await loadKeyInventory({
        keyspace: testCase.keyspace,
        listImpl,
        getPrivateBlobTokenImpl: vi.fn(() => 'blob-token'),
      })
      const gcsWriteIfGenerationImpl = vi.fn(async (bucketName, key, body, expectedGeneration) =>
        destinations.writeIfGeneration(bucketName, key, body, expectedGeneration)
      )

      const { summary } = await runMigration(withKeyspace(testCase.keyspace, paths), {
        consoleImpl: createConsoleSpy(),
        loadKeyInventoryImpl: vi.fn(async () => items),
        readSourceImpl: vi.fn(async () => createSourceRecord(testCase.sourceBody)),
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl,
      })

      const state = JSON.parse(await readFile(paths.statePath, 'utf8'))
      const reverseManifest = JSON.parse(await readFile(paths.reverseManifestPath, 'utf8'))

      expect(items).toEqual([
        {
          key: testCase.key,
          access: 'private',
          bucketName: 'jcv-dev-private',
        },
      ])
      expect(listImpl).toHaveBeenCalledWith({
        token: 'blob-token',
        prefix: testCase.listPrefix,
        cursor: undefined,
        limit: 1000,
      })
      expect(summary).toMatchObject({
        keyspace: testCase.keyspace,
        totalItems: 1,
        done: 1,
      })
      expect(gcsWriteIfGenerationImpl).toHaveBeenCalledTimes(1)
      expect(state).toMatchObject({
        keyspace: testCase.keyspace,
      })
      expect(state.items).toEqual([
        expect.objectContaining({
          key: testCase.key,
          status: 'done',
        }),
      ])
      expect(reverseManifest.items).toEqual([
        expect.objectContaining({
          key: testCase.key,
          bucketName: 'jcv-dev-private',
          status: 'done',
        }),
      ])
    }
  })

  it('is idempotent for matching destination payloads and writes a reverse manifest', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'snapshot-research-migrate-idempotent-'))
    const paths = buildPaths(tempDir)
    const destinations = createDestinationStore()
    const gcsWriteIfGenerationImpl = vi.fn(async (bucketName, key, body, expectedGeneration) =>
      destinations.writeIfGeneration(bucketName, key, body, expectedGeneration)
    )
    const runtime = {
      consoleImpl: createConsoleSpy(),
      loadKeyInventoryImpl: vi.fn(async () => [
        {
          key: 'snapshot/research/2026-04-24/research-index.json',
          access: 'private',
          bucketName: 'jcv-dev-private',
        },
      ]),
      readSourceImpl: vi.fn(async () =>
        createSourceRecord('{"schemaVersion":1,"items":[{"id":"research-1"}]}')
      ),
      readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
      gcsWriteIfGenerationImpl,
    }

    const firstRun = await runMigration(withKeyspace(RESEARCH_KEYSPACE, paths), runtime)
    const secondRun = await runMigration(withKeyspace(RESEARCH_KEYSPACE, paths), runtime)
    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))
    const reverseManifest = JSON.parse(await readFile(paths.reverseManifestPath, 'utf8'))

    expect(firstRun.summary).toMatchObject({
      totalItems: 1,
      done: 1,
      skippedExistingMatch: 0,
    })
    expect(secondRun.summary).toMatchObject({
      totalItems: 1,
      done: 0,
      skippedExistingMatch: 1,
    })
    expect(gcsWriteIfGenerationImpl).toHaveBeenCalledTimes(1)
    expect(state.items).toEqual([
      expect.objectContaining({
        key: 'snapshot/research/2026-04-24/research-index.json',
        status: 'skipped-existing-match',
      }),
    ])
    expect(reverseManifest.items).toEqual([
      expect.objectContaining({
        key: 'snapshot/research/2026-04-24/research-index.json',
        bucketName: 'jcv-dev-private',
        status: 'skipped-existing-match',
      }),
    ])
  })

  it('does not overwrite an existing different destination object', async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), 'snapshot-research-migrate-existing-present-')
    )
    const paths = buildPaths(tempDir)
    const destinations = createDestinationStore({
      'jcv-dev-private/snapshot/research/2026-04-24/research-index.json': {
        body: Buffer.from('{"schemaVersion":1,"items":[{"id":"older"}]}'),
        generation: '7',
      },
    })
    const gcsWriteIfGenerationImpl = vi.fn(async (bucketName, key, body, expectedGeneration) =>
      destinations.writeIfGeneration(bucketName, key, body, expectedGeneration)
    )

    const { summary } = await runMigration(
      withKeyspace(RESEARCH_KEYSPACE, paths),
      {
        consoleImpl: createConsoleSpy(),
        loadKeyInventoryImpl: vi.fn(async () => [
          {
            key: 'snapshot/research/2026-04-24/research-index.json',
            access: 'private',
            bucketName: 'jcv-dev-private',
          },
        ]),
        readSourceImpl: vi.fn(async () =>
          createSourceRecord('{"schemaVersion":1,"items":[{"id":"newer"}]}')
        ),
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl,
      }
    )

    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))
    const reverseManifest = JSON.parse(await readFile(paths.reverseManifestPath, 'utf8'))

    expect(summary).toMatchObject({
      totalItems: 1,
      done: 0,
      skippedExistingPresent: 1,
    })
    expect(gcsWriteIfGenerationImpl).not.toHaveBeenCalled()
    expect(state.items).toEqual([
      expect.objectContaining({
        key: 'snapshot/research/2026-04-24/research-index.json',
        status: 'skipped-existing-present',
      }),
    ])
    expect(reverseManifest.items).toEqual([])
  })

  it('marks the item stale when the source changes after the copy verify step', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'snapshot-research-migrate-stale-source-'))
    const paths = buildPaths(tempDir)
    const destinations = createDestinationStore()
    const gcsWriteIfGenerationImpl = vi.fn(async (bucketName, key, body, expectedGeneration) =>
      destinations.writeIfGeneration(bucketName, key, body, expectedGeneration)
    )

    const { summary } = await runMigration(withKeyspace(RESEARCH_KEYSPACE, paths), {
      consoleImpl: createConsoleSpy(),
      loadKeyInventoryImpl: vi.fn(async () => [
        {
          key: 'snapshot/research/2026-04-24/research-index.json',
          access: 'private',
          bucketName: 'jcv-dev-private',
        },
      ]),
      readSourceImpl: vi
        .fn()
        .mockResolvedValueOnce(createSourceRecord('{"schemaVersion":1,"items":[{"id":"stale"}]}'))
        .mockResolvedValueOnce(createSourceRecord('{"schemaVersion":1,"items":[{"id":"fresh"}]}')),
      readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
      gcsWriteIfGenerationImpl,
    })

    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))
    const reverseManifest = JSON.parse(await readFile(paths.reverseManifestPath, 'utf8'))

    expect(summary).toMatchObject({
      totalItems: 1,
      done: 0,
      staleSourceChanged: 1,
    })
    expect(gcsWriteIfGenerationImpl).toHaveBeenCalledTimes(1)
    expect(state.items).toEqual([
      expect.objectContaining({
        key: 'snapshot/research/2026-04-24/research-index.json',
        status: 'stale-source-changed',
      }),
    ])
    expect(reverseManifest.items).toEqual([])
  })

  it('force-overwrites stale-source-changed items on resume until they converge to done', async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), 'snapshot-research-migrate-stale-converge-')
    )
    const paths = buildPaths(tempDir)
    const destinations = createDestinationStore()
    const key = 'snapshot/research/2026-04-24/research-index.json'
    const staleBody = '{"schemaVersion":1,"items":[{"id":"stale"}]}'
    const freshBody = '{"schemaVersion":1,"items":[{"id":"fresh"}]}'
    const gcsWriteIfGenerationImpl = vi.fn(async (bucketName, entryKey, body, expectedGeneration) =>
      destinations.writeIfGeneration(bucketName, entryKey, body, expectedGeneration)
    )
    const gcsWriteImpl = vi.fn(async (bucketName, entryKey, body) =>
      destinations.write(bucketName, entryKey, body)
    )
    const readSourceImpl = vi
      .fn()
      .mockResolvedValueOnce(createSourceRecord(staleBody))
      .mockResolvedValueOnce(createSourceRecord(freshBody))
      .mockResolvedValueOnce(createSourceRecord(freshBody))
      .mockResolvedValueOnce(createSourceRecord(freshBody))

    const runtime = {
      consoleImpl: createConsoleSpy(),
      loadKeyInventoryImpl: vi.fn(async () => [
        {
          key,
          access: 'private',
          bucketName: 'jcv-dev-private',
        },
      ]),
      readSourceImpl,
      readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
      gcsWriteImpl,
      gcsWriteIfGenerationImpl,
    }

    const firstRun = await runMigration(withKeyspace(RESEARCH_KEYSPACE, paths), runtime)
    const resumedRun = await runMigration(
      withKeyspace(RESEARCH_KEYSPACE, {
        ...paths,
        resume: true,
      }),
      runtime
    )
    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))
    const reverseManifest = JSON.parse(await readFile(paths.reverseManifestPath, 'utf8'))
    const finalDestination = destinations.read({
      bucketName: 'jcv-dev-private',
      key,
    })

    expect(firstRun.summary).toMatchObject({
      totalItems: 1,
      done: 0,
      staleSourceChanged: 1,
    })
    expect(resumedRun.summary).toMatchObject({
      resume: true,
      totalItems: 1,
      done: 1,
      staleSourceChanged: 0,
      skippedExistingMatch: 0,
      skippedExistingPresent: 0,
    })
    expect(gcsWriteIfGenerationImpl).toHaveBeenCalledTimes(1)
    expect(gcsWriteImpl).toHaveBeenCalledTimes(1)
    expect(state.items).toEqual([
      expect.objectContaining({
        key,
        status: 'done',
        attempts: 2,
      }),
    ])
    expect(finalDestination).toMatchObject({
      generation: '2',
    })
    expect(finalDestination?.body.toString()).toBe(freshBody)
    expect(reverseManifest.items).toEqual([
      expect.objectContaining({
        key,
        bucketName: 'jcv-dev-private',
        status: 'done',
      }),
    ])
  })

  it('force-overwrites stale-source-changed resume items even when destination already matches', async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), 'snapshot-research-migrate-stale-force-match-')
    )
    const paths = buildPaths(tempDir)
    const destinations = createDestinationStore()
    const key = 'snapshot/research/2026-04-24/research-index.json'
    const staleBody = '{"schemaVersion":1,"items":[{"id":"stale"}]}'
    const freshBody = '{"schemaVersion":1,"items":[{"id":"fresh"}]}'
    const gcsWriteIfGenerationImpl = vi.fn(async (bucketName, entryKey, body, expectedGeneration) =>
      destinations.writeIfGeneration(bucketName, entryKey, body, expectedGeneration)
    )
    const gcsWriteImpl = vi.fn(async (bucketName, entryKey, body) =>
      destinations.write(bucketName, entryKey, body)
    )
    const readSourceImpl = vi
      .fn()
      .mockResolvedValueOnce(createSourceRecord(staleBody))
      .mockResolvedValueOnce(createSourceRecord(freshBody))
      .mockResolvedValueOnce(createSourceRecord(freshBody))
      .mockResolvedValueOnce(createSourceRecord(freshBody))

    const runtime = {
      consoleImpl: createConsoleSpy(),
      loadKeyInventoryImpl: vi.fn(async () => [
        {
          key,
          access: 'private',
          bucketName: 'jcv-dev-private',
        },
      ]),
      readSourceImpl,
      readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
      gcsWriteImpl,
      gcsWriteIfGenerationImpl,
    }

    const firstRun = await runMigration(withKeyspace(RESEARCH_KEYSPACE, paths), runtime)
    destinations.write('jcv-dev-private', key, Buffer.from(freshBody))
    const resumedRun = await runMigration(
      withKeyspace(RESEARCH_KEYSPACE, {
        ...paths,
        resume: true,
      }),
      runtime
    )
    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(firstRun.summary).toMatchObject({
      totalItems: 1,
      done: 0,
      staleSourceChanged: 1,
    })
    expect(resumedRun.summary).toMatchObject({
      resume: true,
      totalItems: 1,
      done: 1,
      skippedExistingMatch: 0,
    })
    expect(gcsWriteIfGenerationImpl).toHaveBeenCalledTimes(1)
    expect(gcsWriteImpl).toHaveBeenCalledTimes(1)
    expect(state.items).toEqual([
      expect.objectContaining({
        key,
        status: 'done',
        attempts: 2,
      }),
    ])
  })

  it('treats an empty source prefix as a successful no-op', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'snapshot-research-migrate-empty-'))
    const paths = buildPaths(tempDir)

    const { summary } = await runMigration(withKeyspace(RESEARCH_KEYSPACE, paths), {
      consoleImpl: createConsoleSpy(),
      loadKeyInventoryImpl: vi.fn(async () => []),
      readSourceImpl: vi.fn(),
      readDestinationImpl: vi.fn(),
      gcsWriteIfGenerationImpl: vi.fn(),
    })

    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))
    const reverseManifest = JSON.parse(await readFile(paths.reverseManifestPath, 'utf8'))

    expect(summary).toMatchObject({
      totalItems: 0,
      done: 0,
      skippedExistingMatch: 0,
      skippedExistingPresent: 0,
    })
    expect(state.items).toEqual([])
    expect(reverseManifest.items).toEqual([])
  })
})
