import process from 'node:process'
import { list, put } from '@vercel/blob'

const DEFAULT_EXCLUDE_PATTERNS = ['telemetry/', 'telemetry-events.json']

function parseArgs(argv = []) {
  const options = {
    dryRun: false,
    includePrefixes: [],
    excludePrefixes: [...DEFAULT_EXCLUDE_PATTERNS],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim()

    if (!arg) continue
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--include-prefix' || arg === '--exclude-prefix') {
      const value = String(argv[index + 1] || '').trim()
      if (!value) {
        throw new Error(`${arg} requires a value`)
      }
      if (arg === '--include-prefix') options.includePrefixes.push(value)
      if (arg === '--exclude-prefix') options.excludePrefixes.push(value)
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function getEnvValue(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim()
    if (value) return value
  }
  return ''
}

function shouldInclude(pathname, includePrefixes = []) {
  if (includePrefixes.length === 0) return true
  return includePrefixes.some((prefix) => pathname.startsWith(prefix))
}

function shouldExclude(pathname, excludePrefixes = []) {
  return excludePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix))
}

function summarizeByPrefix(blobs = []) {
  const counts = new Map()

  for (const blob of blobs) {
    const pathname = String(blob?.pathname || '').trim()
    const prefix = pathname.includes('/') ? `${pathname.split('/')[0]}/` : pathname
    counts.set(prefix, (counts.get(prefix) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([prefix, count]) => ({ prefix, count }))
}

async function listAllBlobs(token) {
  const blobs = []
  let cursor = undefined

  do {
    const page = await list({
      token,
      cursor,
      limit: 1000,
    })
    blobs.push(...(Array.isArray(page?.blobs) ? page.blobs : []))
    cursor = page?.cursor || undefined
  } while (cursor)

  return blobs
}

async function downloadBlob(blob) {
  const response = await fetch(blob.url)
  if (!response.ok) {
    throw new Error(`download failed (${response.status}) for ${blob.pathname}`)
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  const buffer = Buffer.from(await response.arrayBuffer())
  return { buffer, contentType }
}

async function migrateBlob(blob, newToken) {
  const { buffer, contentType } = await downloadBlob(blob)

  await put(blob.pathname, buffer, {
    token: newToken,
    access: 'private',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  return {
    pathname: blob.pathname,
    size: Number(blob.size) || buffer.length,
    contentType,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const oldToken = getEnvValue('OLD_BLOB_READ_WRITE_TOKEN', 'PUB_BLOB_READ_WRITE_TOKEN')
  const newToken = getEnvValue('NEW_BLOB_READ_WRITE_TOKEN', 'PRIVATE_BLOB_READ_WRITE_TOKEN')

  if (!oldToken) {
    throw new Error(
      'OLD_BLOB_READ_WRITE_TOKEN or PUB_BLOB_READ_WRITE_TOKEN is required for source reads'
    )
  }

  if (!options.dryRun && !newToken) {
    throw new Error(
      'NEW_BLOB_READ_WRITE_TOKEN or PRIVATE_BLOB_READ_WRITE_TOKEN is required for destination writes'
    )
  }

  const allBlobs = await listAllBlobs(oldToken)
  const candidates = allBlobs.filter((blob) => {
    const pathname = String(blob?.pathname || '').trim()
    if (!pathname) return false
    if (!shouldInclude(pathname, options.includePrefixes)) return false
    if (shouldExclude(pathname, options.excludePrefixes)) return false
    return true
  })

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        totalSourceBlobs: allBlobs.length,
        includedBlobs: candidates.length,
        includePrefixes: options.includePrefixes,
        excludePrefixes: options.excludePrefixes,
        byPrefix: summarizeByPrefix(candidates),
      },
      null,
      2
    )
  )

  if (candidates.length === 0) {
    console.log('No blobs matched the current filter set.')
    return
  }

  let migratedCount = 0
  let migratedBytes = 0

  for (const blob of candidates) {
    if (options.dryRun) {
      console.log(`[dry-run] ${blob.pathname} (${blob.size || 0} bytes)`)
      continue
    }

    const result = await migrateBlob(blob, newToken)
    migratedCount += 1
    migratedBytes += result.size
    console.log(`[migrated] ${result.pathname} (${result.size} bytes, ${result.contentType})`)
  }

  if (!options.dryRun) {
    console.log(
      JSON.stringify(
        {
          migratedCount,
          migratedBytes,
        },
        null,
        2
      )
    )
  }
}

main().catch((error) => {
  console.error('[migrate-blob-public-to-private] failed:', error?.message || error)
  process.exitCode = 1
})
