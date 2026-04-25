import process from 'node:process'
import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { get, list } from '@vercel/blob'
import { gcsRead, gcsWrite } from '../api/_lib/gcs-storage.js'
import { getPrivateBlobToken } from '../api/_lib/blob-tokens.js'
import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'

const MIGRATION_MANIFEST_PATH = path.resolve(
  '.tmp/vercel-full-decoupling/phase-0/migration-manifest.json'
)
const STATE_PATH = path.resolve('.tmp/migration-state/last-success.json')
const REVERSE_MANIFEST_PATH = path.resolve('.tmp/migration-state/last-success.reverse.json')

function parseArgs(argv = []) {
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

function assertSafeBuckets(items = []) {
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

async function loadKeyInventory() {
  const raw = await readFile(MIGRATION_MANIFEST_PATH, 'utf8')
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

async function readStateIfPresent() {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function buildInitialState(items, options) {
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

async function writeState(state) {
  await mkdir(path.dirname(STATE_PATH), { recursive: true })
  state.updatedAt = new Date().toISOString()
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

async function writeReverseManifest(state) {
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

  await mkdir(path.dirname(REVERSE_MANIFEST_PATH), { recursive: true })
  await writeFile(
    REVERSE_MANIFEST_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        items,
      },
      null,
      2
    )}\n`,
    'utf8'
  )
}

async function readPublicSource(key) {
  const token = getPublicBlobToken()
  if (!token) {
    throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for public last-success migration reads')
  }

  const page = await list({ token, prefix: key, limit: 1 })
  const blob = Array.isArray(page?.blobs) ? page.blobs[0] : null
  if (!blob) return null

  const response = await fetch(blob.url)
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

async function readPrivateSource(key) {
  const token = getPrivateBlobToken()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for private last-success migration reads')
  }

  try {
    const blob = await get(key, {
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

async function readSource(item) {
  return item.access === 'public' ? readPublicSource(item.key) : readPrivateSource(item.key)
}

async function readDestination(item) {
  return gcsRead(item.bucketName, item.key)
}

async function migrateItem(item, options) {
  const source = await readSource(item)
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
  const existingDestination = await readDestination(item)
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

  await gcsWrite(item.bucketName, item.key, source.buffer, {
    contentType: source.contentType,
    cacheControl: item.access === 'public' ? 'public, max-age=0, must-revalidate' : 'no-store',
    public: item.access === 'public',
  })

  const verifiedDestination = await readDestination(item)
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

function printItemSummary(item, outcome, options) {
  const label = options.dryRun ? 'dry-run' : outcome.status
  const sizeText = `${outcome.bytes || 0} bytes`
  console.log(
    `[${label}] ${item.key} -> gs://${item.bucketName}/${item.key} (${sizeText}${outcome.contentType ? `, ${outcome.contentType}` : ''})`
  )
}

async function main() {
  loadLocalEnvIfPresent()

  const options = parseArgs(process.argv.slice(2))
  const items = await loadKeyInventory()
  assertSafeBuckets(items)

  if (items.length === 0) {
    throw new Error('No last-success keys were found in the migration manifest')
  }

  const existingState = options.resume ? await readStateIfPresent() : null
  const state = existingState || buildInitialState(items, options)

  if (!Array.isArray(state.items) || state.items.length === 0) {
    throw new Error('Migration state is missing item inventory')
  }

  await writeState(state)
  await writeReverseManifest(state)

  for (const item of state.items) {
    if (
      options.resume &&
      ['done', 'skipped-existing-match', 'source-missing'].includes(String(item.status || ''))
    ) {
      console.log(`[resume-skip] ${item.key} (${item.status})`)
      continue
    }

    item.attempts = Number(item.attempts || 0) + 1
    item.lastError = null

    try {
      const outcome = await migrateItem(item, options)
      Object.assign(item, outcome, {
        updatedAt: new Date().toISOString(),
      })
      printItemSummary(item, outcome, options)
    } catch (error) {
      item.status = 'error'
      item.lastError = error?.message || String(error)
      item.updatedAt = new Date().toISOString()
      await writeState(state)
      await writeReverseManifest(state)
      throw error
    }

    await writeState(state)
    await writeReverseManifest(state)
  }

  const summary = {
    dryRun: options.dryRun,
    resume: options.resume,
    totalItems: state.items.length,
    done: state.items.filter((item) => item.status === 'done').length,
    skippedExisting: state.items.filter((item) => item.status === 'skipped-existing-match').length,
    missing: state.items.filter((item) => item.status === 'source-missing').length,
    dryRunCopy: state.items.filter((item) => item.status === 'dry-run-copy').length,
    dryRunSkip: state.items.filter((item) => item.status === 'dry-run-skip').length,
    reverseManifest: REVERSE_MANIFEST_PATH,
    statePath: STATE_PATH,
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error('[migrate-last-success-to-gcs] failed:', error?.message || error)
  process.exitCode = 1
})
