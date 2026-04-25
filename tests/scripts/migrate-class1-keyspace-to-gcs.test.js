import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildInitialState } from '../../scripts/migrate-last-success-to-gcs.mjs'
import {
  CLASS1_KEYSPACES,
  runMigration,
  runSingleKeyspaceMigration,
} from '../../scripts/migrate-class1-keyspace-to-gcs.mjs'

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
      const currentGeneration = Number(store.get(mapKey)?.generation || 0) + 1
      store.set(mapKey, {
        body: Buffer.from(body),
        generation: String(currentGeneration),
      })
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

describe('scripts/migrate-class1-keyspace-to-gcs.mjs', () => {
  const originalCwd = process.cwd()

  beforeEach(() => {
    process.env.GCS_BUCKET_PUBLIC = 'jcv-dev-public'
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    process.chdir(originalCwd)
    delete process.env.GCS_BUCKET_PUBLIC
    delete process.env.GCS_BUCKET_PRIVATE
  })

  it('supports dry-run without writing GCS and records the planned copy', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'class1-migrate-dry-run-'))
    const config = CLASS1_KEYSPACES.find((entry) => entry.cliKey === 'valuation')
    const paths = buildPaths(tempDir, config.cliKey)
    const consoleImpl = createConsoleSpy()
    const gcsWriteImpl = vi.fn(async () => undefined)

    const { summary } = await runSingleKeyspaceMigration(
      config,
      {
        dryRun: true,
        ...paths,
      },
      {
        consoleImpl,
        loadKeyInventoryImpl: vi.fn(async () => [
          {
            key: 'valuation/2330.json',
            access: 'private',
            bucketName: 'jcv-dev-private',
          },
        ]),
        readSourceImpl: vi.fn(async () => createSourceRecord('{"code":"2330"}')),
        readDestinationImpl: vi.fn(async () => null),
        gcsWriteImpl,
      }
    )

    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(summary).toMatchObject({
      keyspace: 'valuation',
      dryRun: true,
      dryRunCopy: 1,
      done: 0,
    })
    expect(gcsWriteImpl).not.toHaveBeenCalled()
    expect(state.items).toEqual([
      expect.objectContaining({
        key: 'valuation/2330.json',
        status: 'dry-run-copy',
      }),
    ])
    expect(consoleImpl.messages.join('\n')).toContain(
      '[dry-run] valuation/2330.json -> gs://jcv-dev-private/valuation/2330.json'
    )
  })

  it('is idempotent and skips a second live run when destination already matches', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'class1-migrate-idempotent-'))
    const config = CLASS1_KEYSPACES.find((entry) => entry.cliKey === 'target-prices')
    const paths = buildPaths(tempDir, config.cliKey)
    const destinations = createDestinationStore()
    const gcsWriteImpl = vi.fn(async (bucketName, key, body) => {
      destinations.write(bucketName, key, body)
    })
    const runtime = {
      consoleImpl: createConsoleSpy(),
      loadKeyInventoryImpl: vi.fn(async () => [
        {
          key: 'target-prices/2330.json',
          access: 'private',
          bucketName: 'jcv-dev-private',
        },
      ]),
      readSourceImpl: vi.fn(async () => createSourceRecord('{"code":"2330"}')),
      readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
      gcsWriteImpl,
    }

    const firstRun = await runSingleKeyspaceMigration(config, paths, runtime)
    const secondRun = await runSingleKeyspaceMigration(config, paths, runtime)
    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(firstRun.summary).toMatchObject({
      done: 1,
      skippedExisting: 0,
    })
    expect(secondRun.summary).toMatchObject({
      done: 0,
      skippedExisting: 1,
    })
    expect(gcsWriteImpl).toHaveBeenCalledTimes(1)
    expect(state.items).toEqual([
      expect.objectContaining({
        key: 'target-prices/2330.json',
        status: 'skipped-existing-match',
      }),
    ])
  })

  it('resumes from the persisted state file instead of restarting from item zero', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'class1-migrate-resume-'))
    const config = CLASS1_KEYSPACES.find((entry) => entry.cliKey === 'analyst-reports')
    const paths = buildPaths(tempDir, config.cliKey)
    const consoleImpl = createConsoleSpy()
    const destinations = createDestinationStore({
      'jcv-dev-public/analyst-reports/2330.json': {
        body: Buffer.from('{"code":"2330"}'),
        generation: '1',
      },
    })

    const partialState = buildInitialState(
      [
        {
          key: 'analyst-reports/2330.json',
          access: 'public',
          bucketName: 'jcv-dev-public',
        },
        {
          key: 'analyst-reports/2454.json',
          access: 'public',
          bucketName: 'jcv-dev-public',
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

    const { summary } = await runSingleKeyspaceMigration(
      config,
      {
        resume: true,
        ...paths,
      },
      {
        consoleImpl,
        loadKeyInventoryImpl: vi.fn(async () => [
          {
            key: 'analyst-reports/2330.json',
            access: 'public',
            bucketName: 'jcv-dev-public',
          },
          {
            key: 'analyst-reports/2454.json',
            access: 'public',
            bucketName: 'jcv-dev-public',
          },
        ]),
        readSourceImpl: vi.fn(async (item) =>
          createSourceRecord(`{"code":"${item.key.includes('2454') ? '2454' : '2330'}"}`)
        ),
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteImpl: vi.fn(async (bucketName, key, body) => {
          destinations.write(bucketName, key, body)
        }),
      }
    )

    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(summary).toMatchObject({
      resume: true,
      done: 2,
    })
    expect(consoleImpl.messages).toContain('[resume-skip] analyst-reports/2330.json (done)')
    expect(state.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'analyst-reports/2330.json', status: 'done' }),
        expect.objectContaining({ key: 'analyst-reports/2454.json', status: 'done' }),
      ])
    )
  })

  it('clears a stale pid lock and still rejects an active pid lock', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'class1-migrate-lock-'))
    const config = CLASS1_KEYSPACES.find((entry) => entry.cliKey === 'daily-events')
    const paths = buildPaths(tempDir, config.cliKey)
    const consoleImpl = createConsoleSpy()
    const runtime = {
      consoleImpl,
      loadKeyInventoryImpl: vi.fn(async () => [
        {
          key: 'daily-events/latest.json',
          access: 'public',
          bucketName: 'jcv-dev-public',
        },
      ]),
      readSourceImpl: vi.fn(async () => createSourceRecord('{"events":[]}')),
      readDestinationImpl: vi.fn(async () => null),
      gcsWriteImpl: vi.fn(async () => undefined),
    }

    await mkdir(path.dirname(paths.lockPath), { recursive: true })
    await writeFile(paths.lockPath, '999999\n', 'utf8')

    const staleRun = await runSingleKeyspaceMigration(config, { dryRun: true, ...paths }, {
      ...runtime,
      killImpl(pid, signal) {
        const error = new Error(`ESRCH ${pid} ${signal}`)
        error.code = 'ESRCH'
        throw error
      },
    })

    expect(staleRun.summary).toMatchObject({ dryRun: true, dryRunCopy: 1 })
    expect(consoleImpl.messages).toContain('stale lock from pid 999999 cleared')

    await writeFile(paths.lockPath, `${process.pid}\n`, 'utf8')

    await expect(
      runSingleKeyspaceMigration(config, { dryRun: true, ...paths }, {
        ...runtime,
        killImpl() {
          return undefined
        },
      })
    ).rejects.toThrow(/migration already in progress/)
  })

  it('runs every configured keyspace for --all with isolated state files', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'class1-migrate-all-'))
    process.chdir(tempDir)

    const { summary } = await runMigration(
      {
        all: true,
        dryRun: true,
      },
      {
        consoleImpl: createConsoleSpy(),
        loadKeyInventoryImpl: vi.fn(async (config) => [
          {
            key:
              config.access === 'public'
                ? `${config.cliKey}/latest.json`
                : `${config.cliKey}/sample.json`,
            access: config.access,
            bucketName: config.access === 'public' ? 'jcv-dev-public' : 'jcv-dev-private',
          },
        ]),
        readSourceImpl: vi.fn(async () => createSourceRecord('{"ok":true}')),
        readDestinationImpl: vi.fn(async () => null),
        gcsWriteImpl: vi.fn(async () => undefined),
      }
    )

    expect(summary.keyspaces).toHaveLength(CLASS1_KEYSPACES.length)
    expect(summary.keyspaces.every((item) => item.dryRun)).toBe(true)

    const valuationState = JSON.parse(
      await readFile(path.join(tempDir, '.tmp', 'migration-state', 'valuation.json'), 'utf8')
    )
    const benchmarkState = JSON.parse(
      await readFile(path.join(tempDir, '.tmp', 'migration-state', 'benchmark.json'), 'utf8')
    )

    expect(valuationState.items).toHaveLength(1)
    expect(benchmarkState.items).toHaveLength(1)
  })
})
