import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadKeyInventory,
  migrateItem,
  runMigration,
} from '../../scripts/migrate-append-log-to-gcs.mjs'

function createSourceRecord(body, contentType = 'application/x-ndjson') {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
  return {
    buffer,
    bytes: buffer.length,
    contentType,
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
      if (
        expectedGeneration !== 0 &&
        String(existing?.generation || '') !== String(expectedGeneration)
      ) {
        const error = new Error('precondition failed')
        error.code = 'PRECONDITION_FAILED'
        throw error
      }
      return this.write(bucketName, key, body)
    },
  }
}

function buildPaths(tempDir, keyspace = 'daily_snapshot_log') {
  const stem =
    keyspace === 'morning_note_log'
      ? 'morning-note-log'
      : keyspace === 'restore_rehearsal_log'
        ? 'restore-rehearsal-log'
        : 'daily-snapshot-log'
  return {
    statePath: path.join(tempDir, '.tmp', 'migration-state', `${stem}.json`),
    reverseManifestPath: path.join(tempDir, '.tmp', 'migration-state', `${stem}.reverse.json`),
    lockPath: path.join(tempDir, '.tmp', 'migration-state', `${stem}.lock`),
  }
}

describe('scripts/migrate-append-log-to-gcs.mjs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
    process.env.STORAGE_SHADOW_WRITE_DAILY_SNAPSHOT_LOG = 'true'
    process.env.STORAGE_SHADOW_WRITE_MORNING_NOTE_LOG = 'true'
    process.env.STORAGE_SHADOW_WRITE_RESTORE_REHEARSAL_LOG = 'true'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
    delete process.env.STORAGE_SHADOW_WRITE_DAILY_SNAPSHOT_LOG
    delete process.env.STORAGE_SHADOW_WRITE_MORNING_NOTE_LOG
    delete process.env.STORAGE_SHADOW_WRITE_RESTORE_REHEARSAL_LOG
  })

  it('lists monthly append log inventory with cursor pagination', async () => {
    const listImpl = vi
      .fn()
      .mockResolvedValueOnce({
        blobs: [
          { pathname: 'logs/daily-snapshot-2026-03.jsonl' },
          { pathname: 'logs/daily-snapshot-ignore.txt' },
        ],
        cursor: 'page-2',
      })
      .mockResolvedValueOnce({
        blobs: [{ pathname: 'logs/daily-snapshot-2026-04.jsonl' }],
        cursor: null,
      })

    const items = await loadKeyInventory({
      keyspace: 'daily_snapshot_log',
      listImpl,
      getPrivateBlobTokenImpl: vi.fn(() => 'blob-token'),
    })

    expect(items).toEqual([
      {
        key: 'logs/daily-snapshot-2026-03.jsonl',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
      {
        key: 'logs/daily-snapshot-2026-04.jsonl',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
    ])
    expect(listImpl).toHaveBeenNthCalledWith(1, {
      token: 'blob-token',
      prefix: 'logs/daily-snapshot',
      cursor: undefined,
      limit: 1000,
    })
    expect(listImpl).toHaveBeenNthCalledWith(2, {
      token: 'blob-token',
      prefix: 'logs/daily-snapshot',
      cursor: 'page-2',
      limit: 1000,
    })
  })

  it('requires shadow-write before migrating an active current-month log', async () => {
    delete process.env.STORAGE_SHADOW_WRITE_DAILY_SNAPSHOT_LOG
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'append-log-migrate-'))
    const paths = buildPaths(tempDir)

    await expect(
      runMigration(
        {
          keyspace: 'daily_snapshot_log',
          ...paths,
        },
        {
          now: new Date('2026-04-26T03:00:00.000Z'),
          acquireMigrationLockImpl: vi.fn(async () => async () => {}),
          loadKeyInventoryImpl: vi.fn(async () => [
            {
              key: 'logs/daily-snapshot-2026-04.jsonl',
              access: 'private',
              bucketName: 'jcv-dev-private',
            },
          ]),
        }
      )
    ).rejects.toThrow(/STORAGE_SHADOW_WRITE_DAILY_SNAPSHOT_LOG=true is required/)
  })

  it('create-only writes, verifies by hash, and records done state', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'append-log-migrate-'))
    const paths = buildPaths(tempDir)
    const destinations = createDestinationStore()
    const source = createSourceRecord('{"status":"success"}\n')

    const state = await runMigration(
      {
        keyspace: 'daily_snapshot_log',
        ...paths,
      },
      {
        now: new Date('2026-04-26T03:00:00.000Z'),
        acquireMigrationLockImpl: vi.fn(async () => async () => {}),
        loadKeyInventoryImpl: vi.fn(async () => [
          {
            key: 'logs/daily-snapshot-2026-03.jsonl',
            access: 'private',
            bucketName: 'jcv-dev-private',
          },
        ]),
        readSourceImpl: vi.fn(async () => source),
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl: vi.fn(async (...args) => destinations.writeIfGeneration(...args)),
      }
    )

    expect(state.items).toMatchObject([
      {
        key: 'logs/daily-snapshot-2026-03.jsonl',
        status: 'done',
        bytes: source.bytes,
        generation: '1',
      },
    ])
    expect(
      destinations
        .read({
          bucketName: 'jcv-dev-private',
          key: 'logs/daily-snapshot-2026-03.jsonl',
        })
        ?.body.toString('utf8')
    ).toBe('{"status":"success"}\n')
  })

  it('marks stale-source-changed when the source moves during verification', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'append-log-migrate-'))
    const paths = buildPaths(tempDir)
    const destinations = createDestinationStore()
    const readSourceImpl = vi
      .fn()
      .mockResolvedValueOnce(createSourceRecord('{"status":"first"}\n'))
      .mockResolvedValueOnce(createSourceRecord('{"status":"first"}\n{"status":"second"}\n'))

    const state = await runMigration(
      {
        keyspace: 'daily_snapshot_log',
        ...paths,
      },
      {
        now: new Date('2026-04-26T03:00:00.000Z'),
        acquireMigrationLockImpl: vi.fn(async () => async () => {}),
        loadKeyInventoryImpl: vi.fn(async () => [
          {
            key: 'logs/daily-snapshot-2026-03.jsonl',
            access: 'private',
            bucketName: 'jcv-dev-private',
          },
        ]),
        readSourceImpl,
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl: vi.fn(async (...args) => destinations.writeIfGeneration(...args)),
      }
    )

    expect(state.items[0].status).toBe('stale-source-changed')
  })

  it('marks historical stale-source-changed resumes done without overwriting GCS', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'append-log-migrate-'))
    const paths = buildPaths(tempDir)
    const destinations = createDestinationStore()
    const readSourceImpl = vi
      .fn()
      .mockResolvedValueOnce(createSourceRecord('{"status":"first"}\n'))
      .mockResolvedValueOnce(createSourceRecord('{"status":"first"}\n{"status":"second"}\n'))
    const writeIfGenerationImpl = vi.fn(async (...args) => destinations.writeIfGeneration(...args))

    const firstState = await runMigration(
      {
        keyspace: 'daily_snapshot_log',
        ...paths,
      },
      {
        now: new Date('2026-04-26T03:00:00.000Z'),
        acquireMigrationLockImpl: vi.fn(async () => async () => {}),
        loadKeyInventoryImpl: vi.fn(async () => [
          {
            key: 'logs/daily-snapshot-2026-03.jsonl',
            access: 'private',
            bucketName: 'jcv-dev-private',
          },
        ]),
        readSourceImpl,
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl: writeIfGenerationImpl,
      }
    )

    expect(firstState.items[0].status).toBe('stale-source-changed')
    expect(
      destinations
        .read({
          bucketName: 'jcv-dev-private',
          key: 'logs/daily-snapshot-2026-03.jsonl',
        })
        ?.body.toString('utf8')
    ).toBe('{"status":"first"}\n')

    const resumeReadSourceImpl = vi.fn(async () =>
      createSourceRecord('{"status":"first"}\n{"status":"second"}\n')
    )
    const resumeWriteIfGenerationImpl = vi.fn(async (...args) =>
      destinations.writeIfGeneration(...args)
    )
    const consoleImpl = {
      log: vi.fn(),
      warn: vi.fn(),
    }

    const resumedState = await runMigration(
      {
        keyspace: 'daily_snapshot_log',
        resume: true,
        ...paths,
      },
      {
        now: new Date('2026-04-26T03:00:00.000Z'),
        consoleImpl,
        acquireMigrationLockImpl: vi.fn(async () => async () => {}),
        loadKeyInventoryImpl: vi.fn(async () => [
          {
            key: 'logs/daily-snapshot-2026-03.jsonl',
            access: 'private',
            bucketName: 'jcv-dev-private',
          },
        ]),
        readSourceImpl: resumeReadSourceImpl,
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl: resumeWriteIfGenerationImpl,
      }
    )

    expect(resumedState.items[0].status).toBe('done')
    expect(resumeReadSourceImpl).not.toHaveBeenCalled()
    expect(resumeWriteIfGenerationImpl).not.toHaveBeenCalled()
    expect(consoleImpl.warn).toHaveBeenCalledWith(
      '[stale-source-changed-skip] logs/daily-snapshot-2026-03.jsonl is historical/immutable; marking done without overwriting GCS'
    )
    expect(
      destinations
        .read({
          bucketName: 'jcv-dev-private',
          key: 'logs/daily-snapshot-2026-03.jsonl',
        })
        ?.body.toString('utf8')
    ).toBe('{"status":"first"}\n')
  })

  it('uses CAS generation overwrite for current-month stale-source-changed resumes', async () => {
    const destinations = createDestinationStore({
      'jcv-dev-private/logs/daily-snapshot-2026-04.jsonl': {
        body: '{"status":"first"}\n',
        generation: '7',
      },
    })
    const source = createSourceRecord('{"status":"first"}\n{"status":"second"}\n')
    const writeIfGenerationImpl = vi.fn(async (...args) => destinations.writeIfGeneration(...args))

    const outcome = await migrateItem(
      {
        key: 'logs/daily-snapshot-2026-04.jsonl',
        access: 'private',
        bucketName: 'jcv-dev-private',
      },
      {
        keyspace: 'daily_snapshot_log',
        previousStatus: 'stale-source-changed',
      },
      {
        now: new Date('2026-04-26T03:00:00.000Z'),
        readSourceImpl: vi.fn(async () => source),
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl: writeIfGenerationImpl,
      }
    )

    expect(outcome.status).toBe('done')
    expect(writeIfGenerationImpl).toHaveBeenCalledWith(
      'jcv-dev-private',
      'logs/daily-snapshot-2026-04.jsonl',
      source.buffer,
      7,
      {
        contentType: 'application/x-ndjson',
        cacheControl: 'no-store',
        public: false,
      }
    )
    expect(
      destinations
        .read({
          bucketName: 'jcv-dev-private',
          key: 'logs/daily-snapshot-2026-04.jsonl',
        })
        ?.body.toString('utf8')
    ).toBe('{"status":"first"}\n{"status":"second"}\n')
  })
})
