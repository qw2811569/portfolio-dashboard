import process from 'node:process'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { list } from '@vercel/blob'

import { getPrivateBlobToken } from '../api/_lib/blob-tokens.js'
import { extractBlobPathname } from '../api/_lib/signed-url.js'
import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'
import {
  acquireMigrationLock,
  assertSafeBuckets,
  buildInitialState,
  DEFAULT_MIGRATION_MANIFEST_PATH,
  migrateItem,
  readStateIfPresent,
  writeReverseManifest,
  writeState,
} from './migrate-last-success-to-gcs.mjs'

export const CLASS1_KEYSPACES = Object.freeze([
  Object.freeze({
    cliKey: 'valuation',
    manifestId: 'valuation',
    access: 'private',
    prefix: 'valuation/',
    matcher: /^valuation\/[^/]+\.json$/,
  }),
  Object.freeze({
    cliKey: 'target-prices',
    manifestId: 'target_prices',
    access: 'private',
    prefix: 'target-prices/',
    matcher: /^target-prices\/[^/]+\.json$/,
  }),
  Object.freeze({
    cliKey: 'daily-events',
    manifestId: 'daily_events_latest',
    access: 'public',
    exactKeysFromManifest: true,
  }),
  Object.freeze({
    cliKey: 'news-feed',
    manifestId: 'news_feed_latest',
    access: 'public',
    exactKeysFromManifest: true,
  }),
  Object.freeze({
    cliKey: 'analyst-reports',
    manifestId: 'analyst_reports',
    access: 'public',
    prefix: 'analyst-reports/',
    matcher: /^analyst-reports\/[^/]+\.json$/,
  }),
  Object.freeze({
    cliKey: 'morning-note',
    manifestId: 'morning_note_snapshot',
    access: 'private',
    prefix: 'snapshot/morning-note/',
    matcher: /^snapshot\/morning-note\/\d{4}-\d{2}-\d{2}\.json$/,
  }),
  Object.freeze({
    cliKey: 'benchmark',
    manifestId: 'benchmark_snapshots',
    access: 'private',
    prefix: 'snapshot/benchmark/',
    matcher: /^snapshot\/benchmark\/\d{4}-\d{2}-\d{2}\.json$/,
  }),
])
export const DEFAULT_BATCH_LOCK_PATH = path.resolve('.tmp/migration-state/class1-batch.lock')

const KEYSPACE_ALIAS_MAP = new Map(
  CLASS1_KEYSPACES.flatMap((config) => [
    [config.cliKey, config],
    [config.manifestId, config],
  ])
)

function getPublicBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
}

function getBucketName(access) {
  return String(
    access === 'public' ? process.env.GCS_BUCKET_PUBLIC || '' : process.env.GCS_BUCKET_PRIVATE || ''
  ).trim()
}

function normalizeKeyspaceArg(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function parseArgs(argv = []) {
  const options = {
    keyspace: null,
    all: false,
    dryRun: false,
    resume: false,
  }

  for (const rawArg of argv) {
    const arg = String(rawArg || '').trim()
    if (!arg) continue

    if (arg === '--all') {
      options.all = true
      continue
    }
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--resume') {
      options.resume = true
      continue
    }
    if (arg.startsWith('--keyspace=')) {
      options.keyspace = normalizeKeyspaceArg(arg.slice('--keyspace='.length))
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (options.all === Boolean(options.keyspace)) {
    throw new Error('Specify exactly one of --all or --keyspace=<name>')
  }

  return options
}

function resolvePaths(config, options = {}) {
  const baseName = config.cliKey
  return {
    migrationManifestPath: options.migrationManifestPath || DEFAULT_MIGRATION_MANIFEST_PATH,
    statePath: options.statePath || path.resolve(`.tmp/migration-state/${baseName}.json`),
    reverseManifestPath:
      options.reverseManifestPath || path.resolve(`.tmp/migration-state/${baseName}.reverse.json`),
    lockPath: options.lockPath || path.resolve(`.tmp/migration-state/${baseName}.lock`),
  }
}

function resolveRequestedKeyspaces(options, configs = CLASS1_KEYSPACES) {
  if (options.all) return [...configs]

  const config = KEYSPACE_ALIAS_MAP.get(normalizeKeyspaceArg(options.keyspace))
  if (!config) {
    throw new Error(
      `Unsupported keyspace "${options.keyspace}". Expected one of: ${configs.map((entry) => entry.cliKey).join(', ')}`
    )
  }
  return [config]
}

function resolveBatchLockPath(options = {}) {
  return options.batchLockPath || DEFAULT_BATCH_LOCK_PATH
}

async function acquireBatchMigrationLock(rawOptions = {}, deps = {}) {
  try {
    return await (deps.acquireMigrationLockImpl || acquireMigrationLock)({
      lockPath: resolveBatchLockPath(rawOptions),
      mkdirImpl: deps.mkdirImpl,
      readFileImpl: deps.readFileImpl,
      unlinkImpl: deps.unlinkImpl,
      writeFileImpl: deps.writeFileImpl,
      consoleImpl: deps.consoleImpl || console,
      killImpl: deps.killImpl,
      now: deps.now,
    })
  } catch (error) {
    const message = String(error?.message || '')
    if (/^migration already in progress(?:\s|$)/.test(message)) {
      const pidMatch = message.match(/\(pid (\d+)\)$/)
      throw new Error(
        pidMatch
          ? `migration batch already in progress (pid ${pidMatch[1]})`
          : 'migration batch already in progress'
      )
    }
    throw error
  }
}

async function readManifest(
  migrationManifestPath = DEFAULT_MIGRATION_MANIFEST_PATH,
  { readFileImpl = readFile } = {}
) {
  return JSON.parse(await readFileImpl(migrationManifestPath, 'utf8'))
}

function getManifestEntry(manifest, manifestId) {
  const keyspaces = Array.isArray(manifest?.keyspaces) ? manifest.keyspaces : []
  return keyspaces.find((entry) => entry?.id === manifestId) || null
}

async function listVercelKeysForConfig(
  config,
  { listImpl = list, getPrivateBlobTokenImpl = getPrivateBlobToken } = {}
) {
  const token =
    config.access === 'public'
      ? getPublicBlobToken()
      : String(getPrivateBlobTokenImpl() || '').trim()
  if (!token) {
    throw new Error(
      config.access === 'public'
        ? `PUB_BLOB_READ_WRITE_TOKEN is required for ${config.cliKey} migration reads`
        : `BLOB_READ_WRITE_TOKEN is required for ${config.cliKey} migration reads`
    )
  }

  const items = new Map()
  let cursor = null

  do {
    const page = await listImpl({
      token,
      prefix: config.prefix,
      cursor: cursor || undefined,
      limit: 1000,
    })

    for (const blob of Array.isArray(page?.blobs) ? page.blobs : []) {
      const key = extractBlobPathname(blob?.pathname || blob?.url)
      if (!config.matcher.test(key)) continue

      items.set(key, {
        key,
        access: config.access,
        bucketName: getBucketName(config.access),
      })
    }

    cursor = page?.cursor || null
  } while (cursor)

  return Array.from(items.values()).sort((left, right) => left.key.localeCompare(right.key))
}

export async function loadKeyInventoryForKeyspace(
  config,
  {
    migrationManifestPath = DEFAULT_MIGRATION_MANIFEST_PATH,
    readFileImpl = readFile,
    listImpl = list,
    getPrivateBlobTokenImpl = getPrivateBlobToken,
  } = {}
) {
  const manifest = await readManifest(migrationManifestPath, { readFileImpl })
  const entry = getManifestEntry(manifest, config.manifestId)
  if (!entry) {
    throw new Error(`Keyspace ${config.manifestId} was not found in the migration manifest`)
  }

  if (Number(entry?.semantics_class) !== 1) {
    throw new Error(`Keyspace ${config.manifestId} is not semantics_class=1`)
  }

  if (config.exactKeysFromManifest) {
    return (Array.isArray(entry.key_patterns) ? entry.key_patterns : [])
      .filter((key) => !String(key).includes('{'))
      .map((key) => ({
        key,
        access: config.access,
        bucketName: getBucketName(config.access),
      }))
      .sort((left, right) => left.key.localeCompare(right.key))
  }

  return listVercelKeysForConfig(config, {
    listImpl,
    getPrivateBlobTokenImpl,
  })
}

function buildSummary(state, options, paths, config) {
  return {
    keyspace: config.cliKey,
    manifestId: config.manifestId,
    dryRun: options.dryRun,
    resume: options.resume,
    totalItems: state.items.length,
    done: state.items.filter((item) => item.status === 'done').length,
    skippedExisting: state.items.filter((item) => item.status === 'skipped-existing-match').length,
    missing: state.items.filter((item) => item.status === 'source-missing').length,
    dryRunCopy: state.items.filter((item) => item.status === 'dry-run-copy').length,
    dryRunSkip: state.items.filter((item) => item.status === 'dry-run-skip').length,
    reverseManifest: paths.reverseManifestPath,
    statePath: paths.statePath,
    lockPath: paths.lockPath,
  }
}

export async function runSingleKeyspaceMigration(config, rawOptions = {}, deps = {}) {
  const options = {
    dryRun: Boolean(rawOptions.dryRun),
    resume: Boolean(rawOptions.resume),
  }
  const paths = resolvePaths(config, rawOptions)
  const consoleImpl = deps.consoleImpl || console
  const migrateItemImpl = deps.migrateItemImpl || migrateItem

  const releaseLock = await (deps.acquireMigrationLockImpl || acquireMigrationLock)({
    lockPath: paths.lockPath,
    mkdirImpl: deps.mkdirImpl,
    readFileImpl: deps.readFileImpl,
    unlinkImpl: deps.unlinkImpl,
    writeFileImpl: deps.writeFileImpl,
    consoleImpl,
    killImpl: deps.killImpl,
    now: deps.now,
  })

  try {
    const items = await (deps.loadKeyInventoryImpl || loadKeyInventoryForKeyspace)(config, {
      migrationManifestPath: paths.migrationManifestPath,
      readFileImpl: deps.readFileImpl,
      listImpl: deps.listImpl,
      getPrivateBlobTokenImpl: deps.getPrivateBlobTokenImpl,
    })
    assertSafeBuckets(items)

    if (items.length === 0) {
      throw new Error(`No ${config.cliKey} keys were found in the migration manifest/source store`)
    }

    const existingState = options.resume
      ? await (deps.readStateIfPresentImpl || readStateIfPresent)({
          statePath: paths.statePath,
          readFileImpl: deps.readFileImpl,
        })
      : null
    const state = existingState || buildInitialState(items, options)

    if (!Array.isArray(state.items) || state.items.length === 0) {
      throw new Error('Migration state is missing item inventory')
    }

    await (deps.writeStateImpl || writeState)(state, {
      statePath: paths.statePath,
      mkdirImpl: deps.mkdirImpl,
      writeFileImpl: deps.writeFileImpl,
      now: deps.now,
    })
    await (deps.writeReverseManifestImpl || writeReverseManifest)(state, {
      reverseManifestPath: paths.reverseManifestPath,
      mkdirImpl: deps.mkdirImpl,
      writeFileImpl: deps.writeFileImpl,
      now: deps.now,
    })

    for (const item of state.items) {
      if (
        options.resume &&
        ['done', 'skipped-existing-match', 'source-missing'].includes(String(item.status || ''))
      ) {
        consoleImpl.log(`[resume-skip] ${item.key} (${item.status})`)
        continue
      }

      item.attempts = Number(item.attempts || 0) + 1
      item.lastError = null

      try {
        const outcome = await migrateItemImpl(item, options, deps)
        Object.assign(item, outcome, {
          updatedAt: new Date(deps.now || new Date()).toISOString(),
        })
        consoleImpl.log(
          `[${options.dryRun ? 'dry-run' : outcome.status}] ${item.key} -> gs://${item.bucketName}/${item.key} (${outcome.bytes || 0} bytes${outcome.contentType ? `, ${outcome.contentType}` : ''})`
        )
      } catch (error) {
        item.status = 'error'
        item.lastError = error?.message || String(error)
        item.updatedAt = new Date(deps.now || new Date()).toISOString()
        await (deps.writeStateImpl || writeState)(state, {
          statePath: paths.statePath,
          mkdirImpl: deps.mkdirImpl,
          writeFileImpl: deps.writeFileImpl,
          now: deps.now,
        })
        await (deps.writeReverseManifestImpl || writeReverseManifest)(state, {
          reverseManifestPath: paths.reverseManifestPath,
          mkdirImpl: deps.mkdirImpl,
          writeFileImpl: deps.writeFileImpl,
          now: deps.now,
        })
        throw error
      }

      await (deps.writeStateImpl || writeState)(state, {
        statePath: paths.statePath,
        mkdirImpl: deps.mkdirImpl,
        writeFileImpl: deps.writeFileImpl,
        now: deps.now,
      })
      await (deps.writeReverseManifestImpl || writeReverseManifest)(state, {
        reverseManifestPath: paths.reverseManifestPath,
        mkdirImpl: deps.mkdirImpl,
        writeFileImpl: deps.writeFileImpl,
        now: deps.now,
      })
    }

    const summary = buildSummary(state, options, paths, config)
    consoleImpl.log(JSON.stringify(summary, null, 2))
    return { state, summary }
  } finally {
    await releaseLock()
  }
}

export async function runMigration(rawOptions = {}, deps = {}) {
  const options = parseArgs([
    rawOptions.all ? '--all' : '',
    rawOptions.keyspace ? `--keyspace=${rawOptions.keyspace}` : '',
    rawOptions.dryRun ? '--dry-run' : '',
    rawOptions.resume ? '--resume' : '',
  ])
  const keyspaces = resolveRequestedKeyspaces(options)
  const results = []
  const releaseBatchLock = options.all ? await acquireBatchMigrationLock(rawOptions, deps) : null

  try {
    for (const config of keyspaces) {
      results.push(await runSingleKeyspaceMigration(config, rawOptions, deps))
    }
  } finally {
    await releaseBatchLock?.()
  }

  if (results.length === 1) return results[0]

  const summary = {
    dryRun: options.dryRun,
    resume: options.resume,
    keyspaces: results.map((result) => result.summary),
  }
  ;(deps.consoleImpl || console).log(JSON.stringify(summary, null, 2))
  return { results, summary }
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  ;(deps.loadLocalEnvIfPresentImpl || loadLocalEnvIfPresent)()
  const options = parseArgs(argv)
  return runMigration(options, deps)
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((error) => {
    console.error('[migrate-class1-keyspace-to-gcs] failed:', error?.message || error)
    process.exitCode = 1
  })
}
