import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildInitialState, runMigration } from '../../scripts/migrate-tracked-stocks-to-gcs.mjs'

function createInventory(keys = []) {
  return keys.map((key) => ({
    key,
    portfolioId: key.split('/')[1],
    bucketName: 'jcv-dev-private',
  }))
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
    },
    dump() {
      return store
    },
  }
}

async function createFixturePaths(tempDir) {
  const statePath = path.join(tempDir, '.tmp', 'migration-state', 'tracked-stocks.json')
  const lockPath = path.join(tempDir, '.tmp', 'migration-state', 'tracked-stocks.lock')

  return {
    statePath,
    lockPath,
  }
}

describe('scripts/migrate-tracked-stocks-to-gcs.mjs', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_PRIVATE = 'jcv-dev-private'
  })

  afterEach(() => {
    delete process.env.GCS_BUCKET_PRIVATE
  })

  it('supports dry-run without writing GCS and records the planned copy', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tracked-stocks-migrate-dry-run-'))
    const paths = await createFixturePaths(tempDir)
    const inventory = createInventory(['tracked-stocks/me/latest.json'])
    const sourceEntries = new Map([
      [
        'tracked-stocks/me/latest.json',
        createSourceRecord(
          '{"portfolioId":"me","stocks":[{"code":"2330","name":"台積電","type":"股票"}]}'
        ),
      ],
    ])
    const destinations = createDestinationStore()
    const consoleImpl = createConsoleSpy()
    const gcsWriteIfGenerationImpl = vi.fn(async () => undefined)

    const { summary } = await runMigration(
      {
        dryRun: true,
        ...paths,
      },
      {
        consoleImpl,
        loadKeyInventoryImpl: vi.fn(async () => inventory),
        readSourceImpl: vi.fn(async (item) => sourceEntries.get(item.key) || null),
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl,
      }
    )

    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(summary).toMatchObject({
      dryRun: true,
      dryRunCopy: 1,
      done: 0,
    })
    expect(gcsWriteIfGenerationImpl).not.toHaveBeenCalled()
    expect(state.items).toEqual([
      expect.objectContaining({
        key: 'tracked-stocks/me/latest.json',
        status: 'dry-run-copy',
      }),
    ])
    expect(consoleImpl.messages.join('\n')).toContain(
      '[dry-run] tracked-stocks/me/latest.json -> gs://jcv-dev-private/tracked-stocks/me/latest.json'
    )
  })

  it('is idempotent and skips a second live run when destination already matches', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tracked-stocks-migrate-idempotent-'))
    const paths = await createFixturePaths(tempDir)
    const inventory = createInventory(['tracked-stocks/me/latest.json'])
    const sourceEntries = new Map([
      [
        'tracked-stocks/me/latest.json',
        createSourceRecord(
          '{"portfolioId":"me","stocks":[{"code":"2330","name":"台積電","type":"股票"}]}'
        ),
      ],
    ])
    const destinations = createDestinationStore()
    const gcsWriteIfGenerationImpl = vi.fn(
      async (bucketName, key, body, expectedGeneration, opts) => {
        destinations.writeCreateOnly(bucketName, key, body, expectedGeneration, opts)
      }
    )
    const runtime = {
      consoleImpl: createConsoleSpy(),
      loadKeyInventoryImpl: vi.fn(async () => inventory),
      readSourceImpl: vi.fn(async (item) => sourceEntries.get(item.key) || null),
      readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
      gcsWriteIfGenerationImpl,
    }

    const firstRun = await runMigration(paths, runtime)
    const secondRun = await runMigration(paths, runtime)
    const finalState = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(firstRun.summary).toMatchObject({
      done: 1,
      skippedExistingMatch: 0,
    })
    expect(secondRun.summary).toMatchObject({
      done: 0,
      skippedExistingMatch: 1,
    })
    expect(gcsWriteIfGenerationImpl).toHaveBeenCalledTimes(1)
    expect(finalState.items).toEqual([
      expect.objectContaining({
        key: 'tracked-stocks/me/latest.json',
        status: 'skipped-existing-match',
      }),
    ])
  })

  it('resumes from the persisted state file instead of restarting from item zero', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tracked-stocks-migrate-resume-'))
    const paths = await createFixturePaths(tempDir)
    const inventory = createInventory([
      'tracked-stocks/me/latest.json',
      'tracked-stocks/jinliancheng/latest.json',
    ])
    const sourceEntries = new Map([
      [
        'tracked-stocks/me/latest.json',
        createSourceRecord(
          '{"portfolioId":"me","stocks":[{"code":"2330","name":"台積電","type":"股票"}]}'
        ),
      ],
      [
        'tracked-stocks/jinliancheng/latest.json',
        createSourceRecord(
          '{"portfolioId":"jinliancheng","stocks":[{"code":"2454","name":"聯發科","type":"股票"}]}'
        ),
      ],
    ])
    const destinations = createDestinationStore({
      'jcv-dev-private/tracked-stocks/me/latest.json': {
        body: Buffer.from(
          '{"portfolioId":"me","stocks":[{"code":"2330","name":"台積電","type":"股票"}]}'
        ),
        generation: '1',
      },
    })

    const partialState = buildInitialState(inventory, { dryRun: false })
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
    const gcsWriteIfGenerationImpl = vi.fn(
      async (bucketName, key, body, expectedGeneration, opts) => {
        destinations.writeCreateOnly(bucketName, key, body, expectedGeneration, opts)
      }
    )
    const consoleImpl = createConsoleSpy()

    const { summary } = await runMigration(
      {
        resume: true,
        ...paths,
      },
      {
        consoleImpl,
        loadKeyInventoryImpl: vi.fn(async () => inventory),
        readSourceImpl,
        readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
        gcsWriteIfGenerationImpl,
      }
    )
    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(summary).toMatchObject({
      resume: true,
      done: 2,
    })
    expect(consoleImpl.messages).toContain('[resume-skip] tracked-stocks/me/latest.json (done)')
    expect(readSourceImpl).toHaveBeenCalledTimes(1)
    expect(readSourceImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'tracked-stocks/jinliancheng/latest.json',
      })
    )
    expect(gcsWriteIfGenerationImpl).toHaveBeenCalledTimes(1)
    expect(state.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'tracked-stocks/me/latest.json',
          status: 'done',
        }),
        expect.objectContaining({
          key: 'tracked-stocks/jinliancheng/latest.json',
          status: 'done',
        }),
      ])
    )
  })

  it('clears a stale pid lock and still rejects an active pid lock', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tracked-stocks-migrate-lock-'))
    const paths = await createFixturePaths(tempDir)
    const inventory = createInventory(['tracked-stocks/me/latest.json'])
    const consoleImpl = createConsoleSpy()
    const readSourceImpl = vi.fn(async () =>
      createSourceRecord(
        '{"portfolioId":"me","stocks":[{"code":"2330","name":"台積電","type":"股票"}]}'
      )
    )

    await mkdir(path.dirname(paths.lockPath), { recursive: true })
    await writeFile(paths.lockPath, '999999\n', 'utf8')

    const { summary } = await runMigration(
      {
        dryRun: true,
        ...paths,
      },
      {
        consoleImpl,
        loadKeyInventoryImpl: vi.fn(async () => inventory),
        readSourceImpl,
        readDestinationImpl: vi.fn(async () => null),
      }
    )

    expect(summary).toMatchObject({
      dryRun: true,
      dryRunCopy: 1,
    })
    expect(consoleImpl.warn).toHaveBeenCalledWith('stale lock from pid 999999 cleared')

    await writeFile(paths.lockPath, `${process.pid}\n`, 'utf8')

    await expect(
      runMigration(
        {
          dryRun: true,
          ...paths,
        },
        {
          loadKeyInventoryImpl: vi.fn(async () => inventory),
        }
      )
    ).rejects.toThrow(new RegExp(`migration already in progress \\(pid ${process.pid}\\)`))
  })

  it('skips pre-existing GCS objects with different hashes without overwriting them', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tracked-stocks-migrate-existing-diff-'))
    const paths = await createFixturePaths(tempDir)
    const inventory = createInventory(['tracked-stocks/me/latest.json'])
    const sourceEntries = new Map([
      [
        'tracked-stocks/me/latest.json',
        createSourceRecord(
          '{"portfolioId":"me","stocks":[{"code":"2330","name":"台積電","type":"股票"}]}'
        ),
      ],
    ])
    const destinations = createDestinationStore({
      'jcv-dev-private/tracked-stocks/me/latest.json': {
        body: Buffer.from(
          '{"portfolioId":"me","stocks":[{"code":"2454","name":"聯發科","type":"股票"}]}'
        ),
        generation: '9',
      },
    })
    const gcsWriteIfGenerationImpl = vi.fn(
      async (bucketName, key, body, expectedGeneration, opts) => {
        destinations.writeCreateOnly(bucketName, key, body, expectedGeneration, opts)
      }
    )

    const { summary } = await runMigration(paths, {
      consoleImpl: createConsoleSpy(),
      loadKeyInventoryImpl: vi.fn(async () => inventory),
      readSourceImpl: vi.fn(async (item) => sourceEntries.get(item.key) || null),
      readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
      gcsWriteIfGenerationImpl,
    })
    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(summary).toMatchObject({
      done: 0,
      skippedExistingPresent: 1,
    })
    expect(gcsWriteIfGenerationImpl).not.toHaveBeenCalled()
    expect(state.items).toEqual([
      expect.objectContaining({
        key: 'tracked-stocks/me/latest.json',
        status: 'skipped-existing-present',
        generation: '9',
      }),
    ])
  })

  it('marks same-hash pre-existing GCS objects as skipped-existing-match', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tracked-stocks-migrate-existing-match-'))
    const paths = await createFixturePaths(tempDir)
    const inventory = createInventory(['tracked-stocks/me/latest.json'])
    const body = '{"portfolioId":"me","stocks":[{"code":"2330","name":"台積電","type":"股票"}]}'
    const sourceEntries = new Map([['tracked-stocks/me/latest.json', createSourceRecord(body)]])
    const destinations = createDestinationStore({
      'jcv-dev-private/tracked-stocks/me/latest.json': {
        body: Buffer.from(body),
        generation: '7',
      },
    })

    const { summary } = await runMigration(paths, {
      consoleImpl: createConsoleSpy(),
      loadKeyInventoryImpl: vi.fn(async () => inventory),
      readSourceImpl: vi.fn(async (item) => sourceEntries.get(item.key) || null),
      readDestinationImpl: vi.fn(async (item) => destinations.read(item)),
      gcsWriteIfGenerationImpl: vi.fn(async () => {
        throw new Error('should not write')
      }),
    })
    const state = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(summary).toMatchObject({
      done: 0,
      skippedExistingMatch: 1,
    })
    expect(state.items).toEqual([
      expect.objectContaining({
        key: 'tracked-stocks/me/latest.json',
        status: 'skipped-existing-match',
        generation: '7',
      }),
    ])
  })
})
