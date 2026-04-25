import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadKeyInventory,
  runMigration,
} from '../../scripts/migrate-snapshot-research-to-gcs.mjs'

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

function buildPaths(tempDir) {
  return {
    statePath: path.join(tempDir, '.tmp', 'migration-state', 'snapshot-research.json'),
    reverseManifestPath: path.join(
      tempDir,
      '.tmp',
      'migration-state',
      'snapshot-research.reverse.json'
    ),
    lockPath: path.join(tempDir, '.tmp', 'migration-state', 'snapshot-research.lock'),
  }
}

describe('scripts/migrate-snapshot-research-to-gcs.mjs', () => {
  const originalCwd = process.cwd()

  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    process.chdir(originalCwd)
    delete process.env.GCS_BUCKET_PRIVATE
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

    const firstRun = await runMigration(paths, runtime)
    const secondRun = await runMigration(paths, runtime)
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
      paths,
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

  it('treats an empty source prefix as a successful no-op', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'snapshot-research-migrate-empty-'))
    const paths = buildPaths(tempDir)

    const { summary } = await runMigration(paths, {
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
