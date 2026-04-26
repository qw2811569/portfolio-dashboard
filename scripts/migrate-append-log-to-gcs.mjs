import process from 'node:process'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { get, list } from '@vercel/blob'

import { getPrivateBlobToken } from '../api/_lib/blob-tokens.js'
import { gcsReadWithVersion, gcsWriteIfGeneration } from '../api/_lib/gcs-storage.js'
import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'
import { extractBlobPathname } from '../api/_lib/signed-url.js'
import {
  acquireMigrationLock,
  assertSafeBuckets,
  buildInitialState,
  parseArgs as parseCommonArgs,
  readStateIfPresent,
  writeReverseManifest,
  writeState,
} from './migrate-last-success-to-gcs.mjs'

export const APPEND_LOG_MIGRATION_CONFIGS = Object.freeze({
  morning_note_log: Object.freeze({
    keyspace: 'morning_note_log',
    envPrefix: 'MORNING_NOTE_LOG',
    pathStem: 'morning-note-log',
    prefix: 'logs/morning-note',
    keyPattern: /^logs\/morning-note-\d{4}-\d{2}\.jsonl$/,
  }),
  daily_snapshot_log: Object.freeze({
    keyspace: 'daily_snapshot_log',
    envPrefix: 'DAILY_SNAPSHOT_LOG',
    pathStem: 'daily-snapshot-log',
    prefix: 'logs/daily-snapshot',
    keyPattern: /^logs\/daily-snapshot-\d{4}-\d{2}\.jsonl$/,
  }),
  restore_rehearsal_log: Object.freeze({
    keyspace: 'restore_rehearsal_log',
    envPrefix: 'RESTORE_REHEARSAL_LOG',
    pathStem: 'restore-rehearsal-log',
    prefix: 'logs/restore-rehearsal',
    keyPattern: /^logs\/restore-rehearsal-\d{4}-\d{2}\.jsonl$/,
  }),
})

export const SUPPORTED_APPEND_LOG_MIGRATIONS = Object.freeze(
  Object.keys(APPEND_LOG_MIGRATION_CONFIGS)
)

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function getBucketName() {
  return String(process.env.GCS_BUCKET_PRIVATE || '').trim()
}

function parseGeneration(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  const generation = Number(normalized)
  return Number.isFinite(generation) && generation >= 0 ? generation : null
}

function formatCurrentMonth(now = new Date(), timeZone = 'Asia/Taipei') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}`
}

function extractMonthFromKey(key) {
  return String(key || '').match(/-(\d{4}-\d{2})\.jsonl$/)?.[1] || null
}

function isCurrentMonthKey(key, now = new Date()) {
  return extractMonthFromKey(key) === formatCurrentMonth(now)
}

function isShadowWriteEnabled(envPrefix) {
  return String(process.env[`STORAGE_SHADOW_WRITE_${envPrefix}`] || '')
    .trim()
    .toLowerCase() === 'true'
}

function assertShadowWriteForCurrentMonth(inventory, keyspaceConfig, now = new Date()) {
  const currentMonth = formatCurrentMonth(now)
  const hasCurrentMonth = inventory.some((item) => extractMonthFromKey(item.key) === currentMonth)
  if (!hasCurrentMonth || isShadowWriteEnabled(keyspaceConfig.envPrefix)) return

  throw new Error(
    `STORAGE_SHADOW_WRITE_${keyspaceConfig.envPrefix}=true is required before migrating current-month ${keyspaceConfig.keyspace}; enable shadow-write so active append writers dual-write to GCS, then rerun the migration`
  )
}

export function getAppendLogMigrationConfig(keyspace) {
  const normalizedKeyspace = String(keyspace || '').trim()
  const config = APPEND_LOG_MIGRATION_CONFIGS[normalizedKeyspace]
  if (!config) {
    throw new Error(
      `Unsupported --keyspace=${normalizedKeyspace || '<missing>'}; expected one of: ${SUPPORTED_APPEND_LOG_MIGRATIONS.join(', ')}`
    )
  }
  return config
}

export function resolveDefaultPathsForKeyspace(keyspace) {
  const { pathStem } = getAppendLogMigrationConfig(keyspace)
  return {
    statePath: path.resolve(`.tmp/migration-state/${pathStem}.json`),
    reverseManifestPath: path.resolve(`.tmp/migration-state/${pathStem}.reverse.json`),
    lockPath: path.resolve(`.tmp/migration-state/${pathStem}.lock`),
  }
}

export function parseArgs(argv = []) {
  const commonArgs = []
  let keyspace = ''

  for (const rawArg of argv) {
    const arg = String(rawArg || '').trim()
    if (!arg) continue
    if (arg.startsWith('--keyspace=')) {
      keyspace = arg.slice('--keyspace='.length).trim()
      continue
    }
    commonArgs.push(arg)
  }

  const options = parseCommonArgs(commonArgs)
  if (!keyspace) {
    throw new Error(
      `Missing required --keyspace=<name>; expected one of: ${SUPPORTED_APPEND_LOG_MIGRATIONS.join(', ')}`
    )
  }

  return {
    ...options,
    keyspace,
  }
}

export function resolvePaths(options = {}, keyspaceConfig = getAppendLogMigrationConfig(options.keyspace)) {
  const defaults = resolveDefaultPathsForKeyspace(keyspaceConfig.keyspace)
  return {
    statePath: options.statePath || defaults.statePath,
    reverseManifestPath: options.reverseManifestPath || defaults.reverseManifestPath,
    lockPath: options.lockPath || defaults.lockPath,
  }
}

function createInventoryItem(key, bucketName, keyspaceConfig) {
  const normalizedKey = String(key || '').trim()
  if (!keyspaceConfig.keyPattern.test(normalizedKey)) return null
  return {
    key: normalizedKey,
    access: 'private',
    bucketName,
  }
}

function mergeInventory(existingItems = [], inventory = []) {
  const merged = new Map(
    (Array.isArray(existingItems) ? existingItems : []).map((item) => [item.key, item])
  )

  for (const item of inventory) {
    if (merged.has(item.key)) continue
    merged.set(item.key, {
      ...item,
      status: 'pending',
      attempts: 0,
      sourceHash: null,
      destinationHash: null,
      bytes: null,
      generation: null,
      lastError: null,
      updatedAt: null,
    })
  }

  return Array.from(merged.values()).sort((left, right) => left.key.localeCompare(right.key))
}

export async function loadKeyInventory({
  keyspace,
  listImpl = list,
  getPrivateBlobTokenImpl = getPrivateBlobToken,
} = {}) {
  const keyspaceConfig = getAppendLogMigrationConfig(keyspace)
  const token = String(getPrivateBlobTokenImpl() || '').trim()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for append-log migration reads')
  }

  const bucketName = getBucketName()
  const items = new Map()
  let cursor = null

  do {
    const page = await listImpl({
      token,
      prefix: keyspaceConfig.prefix,
      cursor: cursor || undefined,
      limit: 1000,
    })

    for (const blob of Array.isArray(page?.blobs) ? page.blobs : []) {
      const key = extractBlobPathname(blob?.pathname || blob?.url)
      const item = createInventoryItem(key, bucketName, keyspaceConfig)
      if (item) items.set(item.key, item)
    }

    cursor = page?.cursor || null
  } while (cursor)

  return Array.from(items.values()).sort((left, right) => left.key.localeCompare(right.key))
}

export async function readSource(
  item,
  { getImpl = get, getPrivateBlobTokenImpl = getPrivateBlobToken } = {}
) {
  const token = String(getPrivateBlobTokenImpl() || '').trim()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for append-log migration reads')
  }

  try {
    const blob = await getImpl(item.key, {
      access: 'private',
      token,
      useCache: false,
    })
    if (!blob) return null
    const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer())
    return {
      key: item.key,
      buffer,
      bytes: buffer.length,
      contentType: blob.contentType || 'application/x-ndjson',
    }
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
  }
}

export async function readDestination(
  item,
  { gcsReadWithVersionImpl = gcsReadWithVersion } = {}
) {
  return gcsReadWithVersionImpl(item.bucketName, item.key)
}

export async function migrateItem(item, options, deps = {}) {
  const readSourceImpl = deps.readSourceImpl || ((entry) => readSource(entry, deps))
  const readDestinationImpl = deps.readDestinationImpl || ((entry) => readDestination(entry, deps))
  const gcsWriteIfGenerationImpl = deps.gcsWriteIfGenerationImpl || gcsWriteIfGeneration
  const forceOverwrite = options.previousStatus === 'stale-source-changed'
  const keyspaceConfig = getAppendLogMigrationConfig(options.keyspace)
  const now = deps.now || new Date()
  const isCurrentMonth = isCurrentMonthKey(item.key, now)

  if (forceOverwrite && !isCurrentMonth) {
    const logger = deps.consoleImpl || console
    logger.warn?.(
      `[stale-source-changed-skip] ${item.key} is historical/immutable; marking done without overwriting GCS`
    )
    return {
      status: 'done',
      bytes: item.bytes ?? 0,
      sourceHash: item.sourceHash ?? null,
      destinationHash: item.destinationHash ?? null,
      generation: item.generation ?? null,
      contentType: item.contentType ?? null,
    }
  }

  if (forceOverwrite && !isShadowWriteEnabled(keyspaceConfig.envPrefix)) {
    throw new Error(
      `STORAGE_SHADOW_WRITE_${keyspaceConfig.envPrefix}=true is required before overwriting current-month ${keyspaceConfig.keyspace} stale-source-changed items`
    )
  }

  const source = await readSourceImpl(item)
  if (!source) {
    return {
      status: 'source-missing',
      bytes: 0,
      sourceHash: null,
      destinationHash: null,
      generation: null,
      contentType: null,
    }
  }

  const sourceHash = sha256(source.buffer)
  const existingDestination = await readDestinationImpl(item)
  const existingDestinationHash = existingDestination ? sha256(existingDestination.body) : null

  if (options.dryRun) {
    return {
      status:
        existingDestinationHash == null
          ? 'dry-run-copy'
          : existingDestinationHash === sourceHash
            ? 'dry-run-skip'
            : 'dry-run-skip-existing',
      bytes: source.bytes,
      sourceHash,
      destinationHash: existingDestinationHash,
      generation: existingDestination?.generation || null,
      contentType: source.contentType,
    }
  }

  if (!forceOverwrite && existingDestinationHash === sourceHash) {
    return {
      status: 'skipped-existing-match',
      bytes: source.bytes,
      sourceHash,
      destinationHash: existingDestinationHash,
      generation: existingDestination?.generation || null,
      contentType: source.contentType,
    }
  }

  if (!forceOverwrite && existingDestinationHash != null) {
    return {
      status: 'skipped-existing-present',
      bytes: source.bytes,
      sourceHash,
      destinationHash: existingDestinationHash,
      generation: existingDestination?.generation || null,
      contentType: source.contentType,
    }
  }

  let writtenGeneration = null
  try {
    const expectedGeneration = forceOverwrite
      ? parseGeneration(existingDestination?.generation) ?? 0
      : 0
    const writeResult = forceOverwrite
      ? await gcsWriteIfGenerationImpl(
          item.bucketName,
          item.key,
          source.buffer,
          expectedGeneration,
          {
            contentType: source.contentType,
            cacheControl: 'no-store',
            public: false,
          }
        )
      : await gcsWriteIfGenerationImpl(item.bucketName, item.key, source.buffer, 0, {
          contentType: source.contentType,
          cacheControl: 'no-store',
          public: false,
        })
    writtenGeneration = parseGeneration(writeResult?.generation)
  } catch (error) {
    if (forceOverwrite || error?.code !== 'PRECONDITION_FAILED') throw error
    const racedDestination = await readDestinationImpl(item)
    const racedDestinationHash = racedDestination ? sha256(racedDestination.body) : null
    return {
      status:
        racedDestinationHash === sourceHash ? 'skipped-existing-match' : 'skipped-existing-present',
      bytes: source.bytes,
      sourceHash,
      destinationHash: racedDestinationHash,
      generation: racedDestination?.generation || null,
      contentType: source.contentType,
    }
  }

  const verifiedDestination = await readDestinationImpl(item)
  const verifiedDestinationHash = verifiedDestination ? sha256(verifiedDestination.body) : null
  const verifiedGeneration = parseGeneration(verifiedDestination?.generation)

  if (!verifiedDestination) {
    throw new Error(`verify failed for gs://${item.bucketName}/${item.key}: not found`)
  }

  if (!verifiedGeneration) {
    throw new Error(`verify failed for gs://${item.bucketName}/${item.key}: missing generation`)
  }

  if (writtenGeneration != null && verifiedGeneration > writtenGeneration) {
    return {
      status: 'skipped-raced-newer',
      bytes: source.bytes,
      sourceHash,
      destinationHash: verifiedDestinationHash,
      generation: verifiedDestination.generation || null,
      contentType: source.contentType,
    }
  }

  if (writtenGeneration != null && verifiedGeneration < writtenGeneration) {
    throw new Error(
      `verify failed for gs://${item.bucketName}/${item.key}: generation regressed from ${writtenGeneration} to ${verifiedGeneration}`
    )
  }

  if (verifiedDestinationHash !== sourceHash) {
    throw new Error(`verify failed for gs://${item.bucketName}/${item.key}: payload mismatch`)
  }

  const verifiedSource = await readSourceImpl(item)
  const verifiedSourceHash = verifiedSource ? sha256(verifiedSource.buffer) : null

  if (verifiedSourceHash !== sourceHash) {
    return {
      status: 'stale-source-changed',
      bytes: source.bytes,
      sourceHash,
      destinationHash: verifiedDestinationHash,
      generation: verifiedDestination.generation || null,
      contentType: source.contentType,
    }
  }

  return {
    status: 'done',
    bytes: source.bytes,
    sourceHash,
    destinationHash: verifiedDestinationHash,
    generation: verifiedDestination.generation || null,
    contentType: source.contentType,
  }
}

export function printItemSummary(item, outcome, options, { consoleImpl = console } = {}) {
  const label = options.dryRun ? 'dry-run' : outcome.status
  consoleImpl.log(
    `[${label}] ${item.key} -> gs://${item.bucketName}/${item.key} (${outcome.bytes || 0} bytes${outcome.contentType ? `, ${outcome.contentType}` : ''})`
  )
}

export async function runMigration(rawOptions = {}, deps = {}) {
  const keyspaceConfig = getAppendLogMigrationConfig(rawOptions.keyspace)
  const options = {
    keyspace: keyspaceConfig.keyspace,
    dryRun: Boolean(rawOptions.dryRun),
    resume: Boolean(rawOptions.resume),
  }
  const paths = resolvePaths(rawOptions, keyspaceConfig)
  const consoleImpl = deps.consoleImpl || console
  const lock = deps.acquireMigrationLockImpl || acquireMigrationLock
  const loadKeyInventoryImpl = deps.loadKeyInventoryImpl || loadKeyInventory
  const readStateIfPresentImpl = deps.readStateIfPresentImpl || readStateIfPresent
  const writeStateImpl = deps.writeStateImpl || writeState
  const writeReverseManifestImpl = deps.writeReverseManifestImpl || writeReverseManifest
  const migrateItemImpl = deps.migrateItemImpl || migrateItem
  const bucketName = getBucketName()

  assertSafeBuckets([{ bucketName }])

  const releaseLock = await lock({
    lockPath: paths.lockPath,
    mkdirImpl: deps.mkdirImpl || mkdir,
    readFileImpl: deps.readFileImpl || readFile,
    unlinkImpl: deps.unlinkImpl || unlink,
    writeFileImpl: deps.writeFileImpl || writeFile,
    consoleImpl,
    killImpl: deps.killImpl,
    now: deps.now,
  })

  try {
    const inventory = await loadKeyInventoryImpl({
      keyspace: keyspaceConfig.keyspace,
      listImpl: deps.listImpl,
      getPrivateBlobTokenImpl: deps.getPrivateBlobTokenImpl,
    })
    assertShadowWriteForCurrentMonth(inventory, keyspaceConfig, deps.now || new Date())

    const existingState = options.resume
      ? await readStateIfPresentImpl({
          statePath: paths.statePath,
          readFileImpl: deps.readFileImpl,
        })
      : null
    const state = existingState || buildInitialState(inventory, options)
    if (existingState?.keyspace && existingState.keyspace !== keyspaceConfig.keyspace) {
      throw new Error(
        `Migration state keyspace mismatch: ${existingState.keyspace} != ${keyspaceConfig.keyspace}`
      )
    }
    state.keyspace = keyspaceConfig.keyspace
    if (existingState) state.items = mergeInventory(state.items, inventory)

    await writeStateImpl(state, {
      statePath: paths.statePath,
      mkdirImpl: deps.mkdirImpl || mkdir,
      writeFileImpl: deps.writeFileImpl || writeFile,
      now: deps.now,
    })
    await writeReverseManifestImpl(state, {
      reverseManifestPath: paths.reverseManifestPath,
      mkdirImpl: deps.mkdirImpl || mkdir,
      writeFileImpl: deps.writeFileImpl || writeFile,
      now: deps.now,
    })

    for (const item of state.items) {
      const previousStatus = String(item.status || '')
      if (
        options.resume &&
        [
          'done',
          'skipped-raced-newer',
          'skipped-existing-match',
          'skipped-existing-present',
          'source-missing',
        ].includes(previousStatus)
      ) {
        consoleImpl.log(`[resume-skip] ${item.key} (${item.status})`)
        continue
      }

      item.attempts = Number(item.attempts || 0) + 1
      item.lastError = null

      try {
        const outcome = await migrateItemImpl(item, { ...options, previousStatus }, deps)
        Object.assign(item, outcome, {
          updatedAt: new Date(deps.now || new Date()).toISOString(),
        })
        printItemSummary(item, outcome, options, { consoleImpl })
      } catch (error) {
        item.status = 'error'
        item.lastError = error?.message || String(error)
        item.updatedAt = new Date(deps.now || new Date()).toISOString()
        await writeStateImpl(state, {
          statePath: paths.statePath,
          mkdirImpl: deps.mkdirImpl || mkdir,
          writeFileImpl: deps.writeFileImpl || writeFile,
          now: deps.now,
        })
        await writeReverseManifestImpl(state, {
          reverseManifestPath: paths.reverseManifestPath,
          mkdirImpl: deps.mkdirImpl || mkdir,
          writeFileImpl: deps.writeFileImpl || writeFile,
          now: deps.now,
        })
        throw error
      }

      await writeStateImpl(state, {
        statePath: paths.statePath,
        mkdirImpl: deps.mkdirImpl || mkdir,
        writeFileImpl: deps.writeFileImpl || writeFile,
        now: deps.now,
      })
      await writeReverseManifestImpl(state, {
        reverseManifestPath: paths.reverseManifestPath,
        mkdirImpl: deps.mkdirImpl || mkdir,
        writeFileImpl: deps.writeFileImpl || writeFile,
        now: deps.now,
      })
    }

    return state
  } finally {
    await releaseLock()
  }
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  loadLocalEnvIfPresent()
  const options = parseArgs(argv)
  return runMigration(options, deps)
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((error) => {
    console.error('[migrate-append-log-to-gcs] failed:', error?.message || error)
    process.exitCode = 1
  })
}
