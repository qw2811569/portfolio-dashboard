import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildInitialState, runMigration } from '../../scripts/migrate-last-success-to-gcs.mjs'

function createManifestPayload(keysByAccess = {}) {
  return {
    keyspaces: [
      {
        id: 'last_success_public',
        key_patterns: keysByAccess.public || [],
      },
      {
        id: 'last_success_private',
        key_patterns: keysByAccess.private || [],
      },
    ],
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
      const currentGeneration = Number(store.get(mapKey)?.generation || 0) + 1
      store.set(mapKey, {
        body: Buffer.from(body),
        generation: String(currentGeneration),
      })
    },
    dump() {
      return store
    },
  }
}

async function createFixturePaths(tempDir, manifestPayload) {
  const migrationManifestPath = path.join(tempDir, 'manifest.json')
  const statePath = path.join(tempDir, '.tmp', 'migration-state', 'last-success.json')
  const reverseManifestPath = path.join(
    tempDir,
    '.tmp',
    'migration-state',
    'last-success.reverse.json'
  )
  const lockPath = path.join(tempDir, '.tmp', 'migration-state', 'last-success.lock')

  await writeFile(migrationManifestPath, `${JSON.stringify(manifestPayload, null, 2)}\n`, 'utf8')

  return {
    migrationManifestPath,
    statePath,
    reverseManifestPath,
    lockPath,
  }
}

describe('scripts/migrate-last-success-to-gcs.mjs', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PUBLIC = 'jcv-dev-public'
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PUBLIC
    delete process.env.GCS_BUCKET_PRIVATE
  })

  it('supports dry-run without writing GCS and records the planned copy', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'last-success-migrate-dry-run-'))
    const paths = await createFixturePaths(
      tempDir,
      createManifestPayload({
        public: ['last-success-collect-news.json'],
      })
    )
    const sourceEntries = new Map([
      ['last-success-collect-news.json', createSourceRecord('{"job":"collect-news","ok":true}')],
    ])
    const destinations = createDestinationStore()
    const consoleImpl = createConsoleSpy()
    const gcsWriteImpl = vi.fn(async () => undefined)

    const { summary } = await runMigration(
      {
        dryRun: true,
        ...paths,
      },
      {
        consoleImpl,
        readSourceImpl: vi.fn(async (item) => sourceEntries.get(item.key) || null),
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteImpl,
      }
    )

    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))
    const reverseManifest = JSON.parse(await readFile(paths.reverseManifestPath, 'utf8'))

    expect(summary).toMatchObject({
      dryRun: true,
      dryRunCopy: 1,
      done: 0,
    })
    expect(gcsWriteImpl).not.toHaveBeenCalled()
    expect(state.items).toEqual([
      expect.objectContaining({
        key: 'last-success-collect-news.json',
        status: 'dry-run-copy',
      }),
    ])
    expect(reverseManifest.items).toEqual([])
    expect(consoleImpl.messages.join('\n')).toContain(
      '[dry-run] last-success-collect-news.json -> gs://jcv-dev-public/last-success-collect-news.json'
    )
  })

  it('is idempotent and skips a second live run when destination already matches', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'last-success-migrate-idempotent-'))
    const paths = await createFixturePaths(
      tempDir,
      createManifestPayload({
        private: ['last-success-compute-valuations.json'],
      })
    )
    const sourceEntries = new Map([
      [
        'last-success-compute-valuations.json',
        createSourceRecord('{"job":"compute-valuations","ok":true}'),
      ],
    ])
    const destinations = createDestinationStore()
    const gcsWriteImpl = vi.fn(async (bucketName, key, body) => {
      destinations.write(bucketName, key, body)
    })

    const runtime = {
      consoleImpl: createConsoleSpy(),
      readSourceImpl: vi.fn(async (item) => sourceEntries.get(item.key) || null),
      readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
      gcsWriteImpl,
    }

    const firstRun = await runMigration(
      {
        ...paths,
      },
      runtime
    )
    const secondRun = await runMigration(
      {
        ...paths,
      },
      runtime
    )
    const finalState = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(firstRun.summary).toMatchObject({
      done: 1,
      skippedExisting: 0,
    })
    expect(secondRun.summary).toMatchObject({
      done: 0,
      skippedExisting: 1,
    })
    expect(gcsWriteImpl).toHaveBeenCalledTimes(1)
    expect(finalState.items).toEqual([
      expect.objectContaining({
        key: 'last-success-compute-valuations.json',
        status: 'skipped-existing-match',
      }),
    ])
  })

  it('resumes from the persisted state file instead of restarting from item zero', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'last-success-migrate-resume-'))
    const paths = await createFixturePaths(
      tempDir,
      createManifestPayload({
        public: ['last-success-collect-news.json'],
        private: ['last-success-morning-note.json'],
      })
    )
    const sourceEntries = new Map([
      ['last-success-collect-news.json', createSourceRecord('{"job":"collect-news","ok":true}')],
      ['last-success-morning-note.json', createSourceRecord('{"job":"morning-note","ok":true}')],
    ])
    const destinations = createDestinationStore({
      'jcv-dev-public/last-success-collect-news.json': {
        body: Buffer.from('{"job":"collect-news","ok":true}'),
        generation: '1',
      },
    })

    const partialState = buildInitialState(
      [
        {
          key: 'last-success-collect-news.json',
          access: 'public',
          bucketName: 'jcv-dev-public',
        },
        {
          key: 'last-success-morning-note.json',
          access: 'private',
          bucketName: 'jcv-dev-private',
        },
      ],
      { dryRun: false }
    )
    partialState.items[0] = {
      ...partialState.items[0],
      status: 'done',
      attempts: 1,
      sourceHash: 'already-done',
      destinationHash: 'already-done',
    }
    await mkdir(path.dirname(paths.statePath), { recursive: true })
    await writeFile(paths.statePath, `${JSON.stringify(partialState, null, 2)}\n`, 'utf8')

    const readSourceImpl = vi.fn(async (item) => sourceEntries.get(item.key) || null)
    const gcsWriteImpl = vi.fn(async (bucketName, key, body) => {
      destinations.write(bucketName, key, body)
    })
    const consoleImpl = createConsoleSpy()

    const { summary } = await runMigration(
      {
        resume: true,
        ...paths,
      },
      {
        consoleImpl,
        readSourceImpl,
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteImpl,
      }
    )
    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(summary).toMatchObject({
      resume: true,
      done: 2,
    })
    expect(consoleImpl.messages).toContain('[resume-skip] last-success-collect-news.json (done)')
    expect(readSourceImpl).toHaveBeenCalledTimes(1)
    expect(readSourceImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'last-success-morning-note.json',
      })
    )
    expect(gcsWriteImpl).toHaveBeenCalledTimes(1)
    expect(state.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'last-success-collect-news.json',
          status: 'done',
        }),
        expect.objectContaining({
          key: 'last-success-morning-note.json',
          status: 'done',
        }),
      ])
    )
  })

  it('refuses to start when another migration instance already holds the lock', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'last-success-migrate-lock-'))
    const paths = await createFixturePaths(
      tempDir,
      createManifestPayload({
        public: ['last-success-collect-news.json'],
      })
    )

    await mkdir(path.dirname(paths.lockPath), { recursive: true })
    await writeFile(paths.lockPath, 'busy\n', 'utf8')

    await expect(
      runMigration({
        dryRun: true,
        ...paths,
      })
    ).rejects.toThrow(/migration already in progress/)
  })
})
