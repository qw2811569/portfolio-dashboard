import process from 'node:process'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { get, list } from '@vercel/blob'

import { getPrivateBlobToken, getTelemetryBlobToken } from '../api/_lib/blob-tokens.js'
import { gcsReadWithVersion, gcsWrite, gcsWriteIfGeneration } from '../api/_lib/gcs-storage.js'
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

function getPublicBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
}

export const HYBRID_KEYSPACE_CONFIGS = Object.freeze({
  brain: Object.freeze({
    keyspace: 'brain',
    envPrefix: 'BRAIN',
    pathStem: 'hybrid-brain',
    access: 'private',
    listPrefixes: ['strategy-brain.json', 'events.json', 'holdings.json'],
    matcher: /^(strategy-brain|events|holdings)\.json$/,
    tokenResolver: getPrivateBlobToken,
  }),
  research: Object.freeze({
    keyspace: 'research',
    envPrefix: 'RESEARCH',
    pathStem: 'hybrid-research',
    access: 'private',
    listPrefixes: ['research-index.json', 'research/', 'brain-proposals/'],
    matcher: /^(research-index\.json|research\/[^/]+\/[^/]+\.json|brain-proposals\/[^/]+\.json)$/,
    tokenResolver: getPrivateBlobToken,
  }),
  telemetry: Object.freeze({
    keyspace: 'telemetry',
    envPrefix: 'TELEMETRY',
    pathStem: 'hybrid-telemetry',
    access: 'public',
    listPrefixes: ['telemetry-events.json'],
    matcher: /^telemetry-events\.json$/,
    tokenResolver: getTelemetryBlobToken,
  }),
  analysis_history: Object.freeze({
    keyspace: 'analysis_history',
    envPrefix: 'ANALYSIS_HISTORY',
    pathStem: 'hybrid-analysis-history',
    access: 'private',
    listPrefixes: ['analysis-history-index.json', 'analysis-history/'],
    matcher: /^(analysis-history-index\.json|analysis-history\/.+\.json)$/,
    tokenResolver: getPrivateBlobToken,
  }),
})

export const SUPPORTED_HYBRID_KEYSPACES = Object.freeze(Object.keys(HYBRID_KEYSPACE_CONFIGS))

export function getHybridKeyspaceConfig(keyspace) {
  const normalizedKeyspace = String(keyspace || '').trim()
  const config = HYBRID_KEYSPACE_CONFIGS[normalizedKeyspace]
  if (!config) {
    throw new Error(
      `Unsupported --keyspace=${normalizedKeyspace || '<missing>'}; expected one of: ${SUPPORTED_HYBRID_KEYSPACES.join(', ')}`
    )
  }
  return config
}

export function resolveDefaultPathsForKeyspace(keyspace) {
  const { pathStem } = getHybridKeyspaceConfig(keyspace)
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
      `Missing required --keyspace=<name>; expected one of: ${SUPPORTED_HYBRID_KEYSPACES.join(', ')}`
    )
  }

  return {
    ...options,
    keyspace,
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function parseGeneration(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return null

  const generation = Number(normalized)
  if (!Number.isFinite(generation) || generation < 0) return null
  return generation
}

function getBucketName(access) {
  return String(
    access === 'public' ? process.env.GCS_BUCKET_PUBLIC || '' : process.env.GCS_BUCKET_PRIVATE || ''
  ).trim()
}

function isShadowWriteEnabled(envPrefix) {
  return String(process.env[`STORAGE_SHADOW_WRITE_${envPrefix}`] || '')
    .trim()
    .toLowerCase() === 'true'
}

function assertShadowWriteEnabled(keyspaceConfig) {
  if (isShadowWriteEnabled(keyspaceConfig.envPrefix)) return

  throw new Error(
    `STORAGE_SHADOW_WRITE_${keyspaceConfig.envPrefix}=true is required before migrating ${keyspaceConfig.keyspace}; enable shadow-write so workers dual-write to GCS, then rerun the migration`
  )
}

export function resolvePaths(options = {}, keyspaceConfig = getHybridKeyspaceConfig(options.keyspace)) {
  const defaults = resolveDefaultPathsForKeyspace(keyspaceConfig.keyspace)
  return {
    statePath: options.statePath || defaults.statePath,
    reverseManifestPath: options.reverseManifestPath || defaults.reverseManifestPath,
    lockPath: options.lockPath || defaults.lockPath,
  }
}

function createInventoryItem(key, keyspaceConfig) {
  const normalizedKey = String(key || '').trim()
  if (!keyspaceConfig.matcher.test(normalizedKey)) return null

  return {
    key: normalizedKey,
    access: keyspaceConfig.access,
    bucketName: getBucketName(keyspaceConfig.access),
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

async function listKeysForPrefix(keyspaceConfig, prefix, deps = {}) {
  const token = String((deps.tokenResolverImpl || keyspaceConfig.tokenResolver)() || '').trim()
  if (!token) {
    throw new Error(
      keyspaceConfig.access === 'public'
        ? `PUB_BLOB_READ_WRITE_TOKEN is required for ${keyspaceConfig.keyspace} migration reads`
        : `BLOB_READ_WRITE_TOKEN is required for ${keyspaceConfig.keyspace} migration reads`
    )
  }

  const items = new Map()
  let cursor = null

  do {
    const page = await (deps.listImpl || list)({
      token,
      prefix,
      cursor: cursor || undefined,
      limit: 1000,
    })

    for (const blob of Array.isArray(page?.blobs) ? page.blobs : []) {
      const key = extractBlobPathname(blob?.pathname || blob?.url)
      const item = createInventoryItem(key, keyspaceConfig)
      if (item) items.set(item.key, item)
    }

    cursor = page?.cursor || null
  } while (cursor)

  return items
}

export async function loadKeyInventory({
  keyspace,
  listImpl = list,
  tokenResolverImpl,
} = {}) {
  const keyspaceConfig = getHybridKeyspaceConfig(keyspace)
  const items = new Map()

  for (const prefix of keyspaceConfig.listPrefixes) {
    const prefixItems = await listKeysForPrefix(keyspaceConfig, prefix, {
      listImpl,
      tokenResolverImpl,
    })

    for (const [key, value] of prefixItems.entries()) {
      items.set(key, value)
    }
  }

  return Array.from(items.values()).sort((left, right) => left.key.localeCompare(right.key))
}

export async function readSource(item, deps = {}) {
  if (item.access === 'public') {
    const token = String((deps.getPublicBlobTokenImpl || getPublicBlobToken)() || '').trim()
    if (!token) {
      throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for public hybrid migration reads')
    }

    const page = await (deps.listImpl || list)({
      token,
      prefix: item.key,
      limit: 10,
    })
    const blob = (Array.isArray(page?.blobs) ? page.blobs : []).find(
      (entry) => extractBlobPathname(entry?.pathname || entry?.url) === item.key
    )
    if (!blob) return null

    const response = await (deps.fetchImpl || fetch)(blob.url)
    if (!response?.ok) {
      throw new Error(`public Vercel source read failed (${response?.status || 'unknown'}) for ${item.key}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      key: item.key,
      buffer,
      bytes: buffer.length,
      contentType: response.headers.get('content-type') || 'application/json',
    }
  }

  const token = String((deps.getPrivateBlobTokenImpl || getPrivateBlobToken)() || '').trim()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for private hybrid migration reads')
  }

  try {
    const blob = await (deps.getImpl || get)(item.key, {
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
      contentType: blob.contentType || 'application/json',
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
  const gcsWriteImpl = deps.gcsWriteImpl || gcsWrite
  const gcsWriteIfGenerationImpl = deps.gcsWriteIfGenerationImpl || gcsWriteIfGeneration
  const forceOverwrite = options.previousStatus === 'stale-source-changed'

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
    const writeResult = forceOverwrite
      ? await gcsWriteImpl(item.bucketName, item.key, source.buffer, {
          contentType: source.contentType,
          cacheControl: 'no-store',
          public: item.access === 'public',
        })
      : await gcsWriteIfGenerationImpl(item.bucketName, item.key, source.buffer, 0, {
          contentType: source.contentType,
          cacheControl: 'no-store',
          public: item.access === 'public',
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
  const keyspaceConfig = getHybridKeyspaceConfig(rawOptions.keyspace)
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
  const bucketName = getBucketName(keyspaceConfig.access)

  assertShadowWriteEnabled(keyspaceConfig)
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
      tokenResolverImpl: deps.tokenResolverImpl,
    })

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
    if (existingState) {
      state.items = mergeInventory(state.items, inventory)
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
        ].includes(String(item.status || ''))
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

    const summary = {
      keyspace: keyspaceConfig.keyspace,
      dryRun: options.dryRun,
      resume: options.resume,
      total: state.items.length,
      done: state.items.filter((item) => item.status === 'done').length,
      staleSourceChanged: state.items.filter((item) => item.status === 'stale-source-changed').length,
      skippedExistingMatch: state.items.filter((item) => item.status === 'skipped-existing-match').length,
      skippedExistingPresent: state.items.filter((item) => item.status === 'skipped-existing-present').length,
      skippedRacedNewer: state.items.filter((item) => item.status === 'skipped-raced-newer').length,
      sourceMissing: state.items.filter((item) => item.status === 'source-missing').length,
      dryRunCopy: state.items.filter((item) => item.status === 'dry-run-copy').length,
      dryRunSkip: state.items.filter((item) => item.status === 'dry-run-skip').length,
      dryRunSkipExisting: state.items.filter((item) => item.status === 'dry-run-skip-existing').length,
      errors: state.items.filter((item) => item.status === 'error').length,
    }

    consoleImpl.log(`[summary] ${JSON.stringify(summary)}`)

    return {
      keyspace: keyspaceConfig.keyspace,
      state,
      summary,
      paths,
    }
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
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
