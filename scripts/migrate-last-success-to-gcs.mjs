import process from 'node:process'
import path from 'node:path'
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { get, list } from '@vercel/blob'
import { gcsRead, gcsWrite } from '../api/_lib/gcs-storage.js'
import { getPrivateBlobToken } from '../api/_lib/blob-tokens.js'
import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'

export const DEFAULT_MIGRATION_MANIFEST_PATH = path.resolve(
  '.tmp/vercel-full-decoupling/phase-0/migration-manifest.json'
)
export const DEFAULT_STATE_PATH = path.resolve('.tmp/migration-state/last-success.json')
export const DEFAULT_REVERSE_MANIFEST_PATH = path.resolve(
  '.tmp/migration-state/last-success.reverse.json'
)
export const DEFAULT_LOCK_PATH = path.resolve('.tmp/migration-state/last-success.lock')

export function parseArgs(argv = []) {
  const options = {
    dryRun: false,
    resume: false,
  }

  for (const rawArg of argv) {
    const arg = String(rawArg || '').trim()
    if (!arg) continue
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--resume') {
      options.resume = true
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function getPublicBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
}

function getBucketName(access) {
  return String(
    access === 'public' ? process.env.GCS_BUCKET_PUBLIC || '' : process.env.GCS_BUCKET_PRIVATE || ''
  ).trim()
}

function resolvePaths(options = {}) {
  return {
    migrationManifestPath: options.migrationManifestPath || DEFAULT_MIGRATION_MANIFEST_PATH,
    statePath: options.statePath || DEFAULT_STATE_PATH,
    reverseManifestPath: options.reverseManifestPath || DEFAULT_REVERSE_MANIFEST_PATH,
    lockPath: options.lockPath || DEFAULT_LOCK_PATH,
  }
}

export async function acquireMigrationLock({
  lockPath = DEFAULT_LOCK_PATH,
  mkdirImpl = mkdir,
  openImpl = open,
  unlinkImpl = unlink,
  now = new Date(),
} = {}) {
  await mkdirImpl(path.dirname(lockPath), { recursive: true })

  let handle
  try {
    handle = await openImpl(lockPath, 'wx')
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error('migration already in progress')
    }
    throw error
  }

  try {
    await handle.writeFile(
      `${JSON.stringify(
        {
          pid: process.pid,
          startedAt: new Date(now).toISOString(),
        },
        null,
        2
      )}\n`,
      'utf8'
    )
  } catch (error) {
    await handle.close().catch(() => {})
    await unlinkImpl(lockPath).catch(() => {})
    throw error
  }

  let released = false
  return async () => {
    if (released) return
    released = true

    await handle.close().catch(() => {})
    await unlinkImpl(lockPath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error
    })
  }
}

export function assertSafeBuckets(items = []) {
  const missingTargets = items.filter((item) => !item.bucketName)
  if (missingTargets.length > 0) {
    throw new Error('GCS_BUCKET_PUBLIC and GCS_BUCKET_PRIVATE must be configured before migration')
  }

  const prodTargets = items.filter((item) => /\bprod\b/i.test(item.bucketName))
  if (prodTargets.length > 0) {
    throw new Error(
      `Refusing to migrate last-success markers into production buckets: ${prodTargets
        .map((item) => item.bucketName)
        .join(', ')}`
    )
  }
}

export async function loadKeyInventory({
  migrationManifestPath = DEFAULT_MIGRATION_MANIFEST_PATH,
  readFileImpl = readFile,
} = {}) {
  const raw = await readFileImpl(migrationManifestPath, 'utf8')
  const manifest = JSON.parse(raw)
  const keyspaces = Array.isArray(manifest?.keyspaces) ? manifest.keyspaces : []
  const relevantEntries = keyspaces.filter(
    ({ id }) => id === 'last_success_public' || id === 'last_success_private'
  )

  const items = []
  for (const entry of relevantEntries) {
    const access = entry.id === 'last_success_public' ? 'public' : 'private'
    const bucketName = getBucketName(access)

    for (const key of entry.key_patterns || []) {
      if (String(key).includes('{')) continue
      items.push({
        key,
        access,
        bucketName,
      })
    }
  }

  return items.sort((left, right) => left.key.localeCompare(right.key))
}

export async function readStateIfPresent({
  statePath = DEFAULT_STATE_PATH,
  readFileImpl = readFile,
} = {}) {
  try {
    return JSON.parse(await readFileImpl(statePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

export function buildInitialState(items, options) {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mode: options.dryRun ? 'dry-run' : 'live',
    items: items.map((item) => ({
      ...item,
      status: 'pending',
      attempts: 0,
      sourceHash: null,
      destinationHash: null,
      bytes: null,
      generation: null,
      lastError: null,
      updatedAt: null,
    })),
  }
}

export async function writeState(
  state,
  {
    statePath = DEFAULT_STATE_PATH,
    mkdirImpl = mkdir,
    writeFileImpl = writeFile,
    now = new Date(),
  } = {}
) {
  await mkdirImpl(path.dirname(statePath), { recursive: true })
  state.updatedAt = new Date(now).toISOString()
  await writeFileImpl(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export async function writeReverseManifest(
  state,
  {
    reverseManifestPath = DEFAULT_REVERSE_MANIFEST_PATH,
    mkdirImpl = mkdir,
    writeFileImpl = writeFile,
    now = new Date(),
  } = {}
) {
  const items = (state.items || [])
    .filter((item) => item.status === 'done' || item.status === 'skipped-existing-match')
    .map((item) => ({
      key: item.key,
      access: item.access,
      bucketName: item.bucketName,
      gcsUrl: `gs://${item.bucketName}/${item.key}`,
      sourceHash: item.sourceHash,
      destinationHash: item.destinationHash,
      status: item.status,
    }))

  await mkdirImpl(path.dirname(reverseManifestPath), { recursive: true })
  await writeFileImpl(
    reverseManifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date(now).toISOString(),
        items,
      },
      null,
      2
    )}\n`,
    'utf8'
  )
}

export async function readPublicSource(
  key,
  { listImpl = list, fetchImpl = fetch, getPublicBlobTokenImpl = getPublicBlobToken } = {}
) {
  const token = getPublicBlobTokenImpl()
  if (!token) {
    throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for public last-success migration reads')
  }

  const page = await listImpl({ token, prefix: key, limit: 1 })
  const blob = Array.isArray(page?.blobs) ? page.blobs[0] : null
  if (!blob) return null

  const response = await fetchImpl(blob.url)
  if (!response.ok) {
    throw new Error(`public Vercel source read failed (${response.status}) for ${key}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  return {
    key,
    buffer,
    bytes: buffer.length,
    contentType: response.headers.get('content-type') || 'application/json',
  }
}

export async function readPrivateSource(
  key,
  { getImpl = get, getPrivateBlobTokenImpl = getPrivateBlobToken } = {}
) {
  const token = getPrivateBlobTokenImpl()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for private last-success migration reads')
  }

  try {
    const blob = await getImpl(key, {
      access: 'private',
      token,
      useCache: false,
    })
    if (!blob) return null

    const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer())
    return {
      key,
      buffer,
      bytes: buffer.length,
      contentType: blob.contentType || 'application/json',
    }
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
  }
}

export async function readSource(item, deps = {}) {
  return item.access === 'public'
    ? readPublicSource(item.key, deps)
    : readPrivateSource(item.key, deps)
}

export async function readDestination(item, { gcsReadImpl = gcsRead } = {}) {
  return gcsReadImpl(item.bucketName, item.key)
}

export async function migrateItem(item, options, deps = {}) {
  const readSourceImpl = deps.readSourceImpl || ((entry) => readSource(entry, deps))
  const readDestinationImpl = deps.readDestinationImpl || ((entry) => readDestination(entry, deps))
  const gcsWriteImpl = deps.gcsWriteImpl || gcsWrite

  const source = await readSourceImpl(item)
  if (!source) {
    return {
      status: 'source-missing',
      bytes: 0,
      sourceHash: null,
      destinationHash: null,
      generation: null,
    }
  }

  const sourceHash = sha256(source.buffer)
  const existingDestination = await readDestinationImpl(item)
  const existingDestinationHash = existingDestination ? sha256(existingDestination.body) : null

  if (options.dryRun) {
    return {
      status: existingDestinationHash === sourceHash ? 'dry-run-skip' : 'dry-run-copy',
      bytes: source.bytes,
      sourceHash,
      destinationHash: existingDestinationHash,
      generation: existingDestination?.generation || null,
      contentType: source.contentType,
    }
  }

  if (existingDestinationHash === sourceHash) {
    return {
      status: 'skipped-existing-match',
      bytes: source.bytes,
      sourceHash,
      destinationHash: existingDestinationHash,
      generation: existingDestination?.generation || null,
      contentType: source.contentType,
    }
  }

  await gcsWriteImpl(item.bucketName, item.key, source.buffer, {
    contentType: source.contentType,
    cacheControl: item.access === 'public' ? 'public, max-age=0, must-revalidate' : 'no-store',
    public: item.access === 'public',
  })

  const verifiedDestination = await readDestinationImpl(item)
  const verifiedHash = verifiedDestination ? sha256(verifiedDestination.body) : null
  if (!verifiedDestination || verifiedHash !== sourceHash) {
    throw new Error(`verify failed for gs://${item.bucketName}/${item.key}`)
  }

  return {
    status: 'done',
    bytes: source.bytes,
    sourceHash,
    destinationHash: verifiedHash,
    generation: verifiedDestination.generation || null,
    contentType: source.contentType,
  }
}

export function printItemSummary(item, outcome, options, { consoleImpl = console } = {}) {
  const label = options.dryRun ? 'dry-run' : outcome.status
  const sizeText = `${outcome.bytes || 0} bytes`
  consoleImpl.log(
    `[${label}] ${item.key} -> gs://${item.bucketName}/${item.key} (${sizeText}${outcome.contentType ? `, ${outcome.contentType}` : ''})`
  )
}

export async function runMigration(rawOptions = {}, deps = {}) {
  const options = {
    dryRun: Boolean(rawOptions.dryRun),
    resume: Boolean(rawOptions.resume),
  }
  const paths = resolvePaths(rawOptions)
  const consoleImpl = deps.consoleImpl || console
  const lock = deps.acquireMigrationLockImpl || acquireMigrationLock
  const writeStateImpl = deps.writeStateImpl || writeState
  const writeReverseManifestImpl = deps.writeReverseManifestImpl || writeReverseManifest
  const loadKeyInventoryImpl = deps.loadKeyInventoryImpl || loadKeyInventory
  const readStateIfPresentImpl = deps.readStateIfPresentImpl || readStateIfPresent
  const migrateItemImpl = deps.migrateItemImpl || migrateItem

  const releaseLock = await lock({
    lockPath: paths.lockPath,
    mkdirImpl: deps.mkdirImpl,
    openImpl: deps.openImpl,
    unlinkImpl: deps.unlinkImpl,
    now: deps.now,
  })

  try {
    const items = await loadKeyInventoryImpl({
      migrationManifestPath: paths.migrationManifestPath,
      readFileImpl: deps.readFileImpl,
    })
    assertSafeBuckets(items)

    if (items.length === 0) {
      throw new Error('No last-success keys were found in the migration manifest')
    }

    const existingState = options.resume
      ? await readStateIfPresentImpl({
          statePath: paths.statePath,
          readFileImpl: deps.readFileImpl,
        })
      : null
    const state = existingState || buildInitialState(items, options)

    if (!Array.isArray(state.items) || state.items.length === 0) {
      throw new Error('Migration state is missing item inventory')
    }

    await writeStateImpl(state, {
      statePath: paths.statePath,
      mkdirImpl: deps.mkdirImpl,
      writeFileImpl: deps.writeFileImpl,
      now: deps.now,
    })
    await writeReverseManifestImpl(state, {
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
        printItemSummary(item, outcome, options, { consoleImpl })
      } catch (error) {
        item.status = 'error'
        item.lastError = error?.message || String(error)
        item.updatedAt = new Date(deps.now || new Date()).toISOString()
        await writeStateImpl(state, {
          statePath: paths.statePath,
          mkdirImpl: deps.mkdirImpl,
          writeFileImpl: deps.writeFileImpl,
          now: deps.now,
        })
        await writeReverseManifestImpl(state, {
          reverseManifestPath: paths.reverseManifestPath,
          mkdirImpl: deps.mkdirImpl,
          writeFileImpl: deps.writeFileImpl,
          now: deps.now,
        })
        throw error
      }

      await writeStateImpl(state, {
        statePath: paths.statePath,
        mkdirImpl: deps.mkdirImpl,
        writeFileImpl: deps.writeFileImpl,
        now: deps.now,
      })
      await writeReverseManifestImpl(state, {
        reverseManifestPath: paths.reverseManifestPath,
        mkdirImpl: deps.mkdirImpl,
        writeFileImpl: deps.writeFileImpl,
        now: deps.now,
      })
    }

    const summary = {
      dryRun: options.dryRun,
      resume: options.resume,
      totalItems: state.items.length,
      done: state.items.filter((item) => item.status === 'done').length,
      skippedExisting: state.items.filter((item) => item.status === 'skipped-existing-match')
        .length,
      missing: state.items.filter((item) => item.status === 'source-missing').length,
      dryRunCopy: state.items.filter((item) => item.status === 'dry-run-copy').length,
      dryRunSkip: state.items.filter((item) => item.status === 'dry-run-skip').length,
      reverseManifest: paths.reverseManifestPath,
      statePath: paths.statePath,
      lockPath: paths.lockPath,
    }

    consoleImpl.log(JSON.stringify(summary, null, 2))
    return { state, summary }
  } finally {
    await releaseLock()
  }
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
    console.error('[migrate-last-success-to-gcs] failed:', error?.message || error)
    process.exitCode = 1
  })
}
