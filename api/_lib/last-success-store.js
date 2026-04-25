import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { get, list, put } from '@vercel/blob'
import { getPrivateBlobToken } from './blob-tokens.js'
import { gcsRead, gcsWrite } from './gcs-storage.js'

const DEFAULT_PRIMARY_MODE = 'vercel-only'
const PRIMARY_MODES = new Set([
  'vercel-only',
  'vercel-primary-gcs-shadow',
  'gcs-primary-vercel-shadow',
  'gcs-only',
])
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_DIVERGENCE_LOG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'logs'
)

const LAST_SUCCESS_SCOPE_CONFIG = Object.freeze({
  'collect-news': Object.freeze({ access: 'public' }),
  'collect-daily-events': Object.freeze({ access: 'public' }),
  'tw-events-worker': Object.freeze({ access: 'public' }),
  'collect-target-prices': Object.freeze({ access: 'private' }),
  'compute-valuations': Object.freeze({ access: 'private' }),
  'morning-note': Object.freeze({ access: 'private' }),
  'daily-snapshot': Object.freeze({ access: 'private' }),
})

function getPublicBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
}

function resolvePrimaryMode(override) {
  const candidate = String(
    override || process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS || DEFAULT_PRIMARY_MODE
  ).trim()
  return PRIMARY_MODES.has(candidate) ? candidate : DEFAULT_PRIMARY_MODE
}

function resolvePrimaryAndShadow(primaryMode) {
  switch (primaryMode) {
    case 'vercel-primary-gcs-shadow':
      return { primary: 'vercel', shadow: 'gcs' }
    case 'gcs-primary-vercel-shadow':
      return { primary: 'gcs', shadow: 'vercel' }
    case 'gcs-only':
      return { primary: 'gcs', shadow: null }
    case 'vercel-only':
    default:
      return { primary: 'vercel', shadow: null }
  }
}

function resolveScopeDescriptor(scope, date, accessOverride) {
  const normalizedScope = String(scope || '').trim()
  if (!normalizedScope) throw new Error('[last-success-store] scope is required')

  const config = LAST_SUCCESS_SCOPE_CONFIG[normalizedScope]
  if (!config) {
    throw new Error(`[last-success-store] unsupported last-success scope: ${normalizedScope}`)
  }

  const normalizedDate = date == null ? null : String(date).trim()
  if (normalizedDate && !ISO_DATE_PATTERN.test(normalizedDate)) {
    throw new Error('[last-success-store] date must be YYYY-MM-DD')
  }

  const access = String(accessOverride || config.access || '').trim() || 'private'
  if (access !== 'public' && access !== 'private') {
    throw new Error(`[last-success-store] unsupported access for ${normalizedScope}: ${access}`)
  }

  if (normalizedDate) {
    return {
      scope: normalizedScope,
      date: normalizedDate,
      access: 'private',
      keyspace:
        normalizedScope === 'daily-snapshot'
          ? 'ops.daily_snapshot_marker'
          : 'ops.last_success_private',
      key: `last-success/${normalizedScope}/${normalizedDate}.txt`,
      contentType: 'text/plain; charset=utf-8',
      cacheControl: 'no-store',
      format: 'text',
      bucketName: String(process.env.GCS_BUCKET_PRIVATE || '').trim(),
    }
  }

  return {
    scope: normalizedScope,
    date: null,
    access,
    keyspace: access === 'public' ? 'ops.last_success_public' : 'ops.last_success_private',
    key: `last-success-${normalizedScope}.json`,
    contentType: 'application/json',
    cacheControl: access === 'public' ? 'public, max-age=0, must-revalidate' : 'no-store',
    format: 'json',
    bucketName:
      access === 'public'
        ? String(process.env.GCS_BUCKET_PUBLIC || '').trim()
        : String(process.env.GCS_BUCKET_PRIVATE || '').trim(),
  }
}

function resolveComparableText(value, descriptor) {
  if (value == null) return null
  if (descriptor.format === 'text') return String(value)
  return stableJsonStringify(value)
}

function bufferToUtf8(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8')
  return String(value)
}

function stableJsonStringify(value) {
  return JSON.stringify(sortJsonValue(value))
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue)
  if (!value || typeof value !== 'object') return value

  return Object.keys(value)
    .sort((left, right) => left.localeCompare(right))
    .reduce((accumulator, key) => {
      accumulator[key] = sortJsonValue(value[key])
      return accumulator
    }, {})
}

function sha256(value) {
  return createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex')
}

function parseStoredBody(rawBody, descriptor) {
  if (descriptor.format === 'text') return rawBody
  return JSON.parse(rawBody)
}

function normalizeReadResult(rawResult, descriptor) {
  if (!rawResult) return null

  if (Object.prototype.hasOwnProperty.call(rawResult, 'rawBody')) {
    return {
      ...rawResult,
      comparableText: resolveComparableText(rawResult.body, descriptor),
    }
  }

  const rawBody = bufferToUtf8(rawResult.body)
  return {
    ...rawResult,
    rawBody,
    body: parseStoredBody(rawBody, descriptor),
    comparableText: resolveComparableText(parseStoredBody(rawBody, descriptor), descriptor),
  }
}

function resolveVercelToken(access, override) {
  const normalizedOverride = String(override || '').trim()
  if (normalizedOverride) return normalizedOverride
  return access === 'public' ? getPublicBlobToken() : getPrivateBlobToken()
}

async function readPublicBlobText(key, { token, fetchImpl = fetch, listImpl = list } = {}) {
  const resolvedToken = resolveVercelToken('public', token)
  if (!resolvedToken) {
    throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for public last-success reads')
  }

  const { blobs } = await listImpl({ prefix: key, limit: 1, token: resolvedToken })
  if (!Array.isArray(blobs) || blobs.length === 0) return null

  const response = await fetchImpl(blobs[0].url)
  if (!response?.ok) {
    throw new Error(`public last-success read failed (${response?.status || 'unknown'})`)
  }

  if (typeof response.text === 'function') return response.text()
  if (typeof response.json === 'function') {
    return JSON.stringify(await response.json())
  }

  throw new Error('public last-success response did not expose text() or json()')
}

async function readPrivateBlobText(key, { token, getImpl = get } = {}) {
  const resolvedToken = resolveVercelToken('private', token)
  if (!resolvedToken) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for private last-success reads')
  }

  try {
    const blobResult = await getImpl(key, {
      access: 'private',
      token: resolvedToken,
      useCache: false,
    })
    if (!blobResult) return null
    return new Response(blobResult.stream).text()
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
  }
}

const defaultVercelBackend = {
  async read(descriptor, options = {}) {
    const rawBody =
      descriptor.access === 'public'
        ? await readPublicBlobText(descriptor.key, options)
        : await readPrivateBlobText(descriptor.key, options)

    if (rawBody == null) return null

    return {
      body: parseStoredBody(rawBody, descriptor),
      rawBody,
    }
  },

  async write(descriptor, payload, { token, putImpl = put } = {}) {
    const resolvedToken = resolveVercelToken(descriptor.access, token)
    if (!resolvedToken) {
      throw new Error(
        descriptor.access === 'public'
          ? 'PUB_BLOB_READ_WRITE_TOKEN is required for public last-success writes'
          : 'BLOB_READ_WRITE_TOKEN is required for private last-success writes'
      )
    }

    const rawBody =
      descriptor.format === 'text' ? String(payload ?? '') : JSON.stringify(payload, null, 2)

    return putImpl(descriptor.key, rawBody, {
      token: resolvedToken,
      addRandomSuffix: false,
      allowOverwrite: true,
      access: descriptor.access,
      contentType: descriptor.contentType,
      cacheControl: descriptor.cacheControl,
    })
  },
}

const defaultGcsBackend = {
  async read(descriptor, { gcsReadImpl = gcsRead } = {}) {
    if (!descriptor.bucketName) {
      throw new Error(
        descriptor.access === 'public'
          ? 'GCS_BUCKET_PUBLIC is required for GCS last-success reads'
          : 'GCS_BUCKET_PRIVATE is required for GCS last-success reads'
      )
    }

    return normalizeReadResult(await gcsReadImpl(descriptor.bucketName, descriptor.key), descriptor)
  },

  async write(descriptor, payload, { gcsWriteImpl = gcsWrite } = {}) {
    if (!descriptor.bucketName) {
      throw new Error(
        descriptor.access === 'public'
          ? 'GCS_BUCKET_PUBLIC is required for GCS last-success writes'
          : 'GCS_BUCKET_PRIVATE is required for GCS last-success writes'
      )
    }

    const rawBody =
      descriptor.format === 'text' ? String(payload ?? '') : JSON.stringify(payload, null, 2)

    return gcsWriteImpl(descriptor.bucketName, descriptor.key, rawBody, {
      contentType: descriptor.contentType,
      cacheControl: descriptor.cacheControl,
      public: descriptor.access === 'public',
    })
  },
}

function getBackend(name, overrides = {}) {
  if (name === 'gcs') return overrides.gcsBackend || defaultGcsBackend
  return overrides.vercelBackend || defaultVercelBackend
}

function classifyShadowRead(primaryResult, shadowResult) {
  if (!primaryResult && !shadowResult) {
    return { matches: true, result: 'match', primaryHash: null, shadowHash: null }
  }

  if (!primaryResult && shadowResult) {
    return {
      matches: false,
      result: 'primary-miss-shadow-hit',
      primaryHash: null,
      shadowHash: sha256(shadowResult.comparableText),
    }
  }

  if (primaryResult && !shadowResult) {
    return {
      matches: false,
      result: 'shadow-miss',
      primaryHash: sha256(primaryResult.comparableText),
      shadowHash: null,
    }
  }

  const primaryHash = sha256(primaryResult.comparableText)
  const shadowHash = sha256(shadowResult.comparableText)

  return {
    matches: primaryHash === shadowHash,
    result: primaryHash === shadowHash ? 'match' : 'mismatch',
    primaryHash,
    shadowHash,
  }
}

async function appendDivergenceMetric(
  record,
  {
    now = new Date(),
    logDir = DEFAULT_DIVERGENCE_LOG_DIR,
    appendMetricImpl = appendFile,
    mkdirImpl = mkdir,
  } = {}
) {
  const monthStamp = new Date(now).toISOString().slice(0, 7)
  const filePath = path.join(logDir, `storage-divergence-${monthStamp}.jsonl`)
  await mkdirImpl(path.dirname(filePath), { recursive: true })
  await appendMetricImpl(
    filePath,
    `${JSON.stringify({
      ts: new Date(now).toISOString(),
      ...record,
    })}\n`,
    'utf8'
  )
}

export function getLastSuccessStorageMode(override) {
  return resolvePrimaryMode(override)
}

export function getLastSuccessScopeDescriptor(scope, date, accessOverride) {
  return resolveScopeDescriptor(scope, date, accessOverride)
}

export async function readLastSuccess(scope, date, options = {}) {
  const descriptor = resolveScopeDescriptor(scope, date, options.accessOverride)
  const primaryMode = resolvePrimaryMode(options.primaryMode)
  const { primary, shadow } = resolvePrimaryAndShadow(primaryMode)
  const logger = options.logger || console

  const primaryBackend = getBackend(primary, options)
  const shadowBackend = shadow ? getBackend(shadow, options) : null
  const shadowReadPromise = shadowBackend
    ? shadowBackend
        .read(descriptor, options)
        .then((result) => normalizeReadResult(result, descriptor))
        .catch((error) => ({ shadowReadError: error }))
    : null

  const primaryResult = normalizeReadResult(
    await primaryBackend.read(descriptor, options),
    descriptor
  )

  if (!shadowReadPromise) return primaryResult?.body ?? null

  const shadowOutcome = await shadowReadPromise
  if (shadowOutcome?.shadowReadError) {
    logger.warn?.(
      `[last-success-store] shadow read failed for ${descriptor.key} (${primary} primary -> ${shadow} shadow):`,
      shadowOutcome.shadowReadError
    )
    return primaryResult?.body ?? null
  }

  const shadowResult = normalizeReadResult(shadowOutcome, descriptor)
  const comparison = classifyShadowRead(primaryResult, shadowResult)

  await appendDivergenceMetric(
    {
      keyspace: descriptor.keyspace,
      scope: descriptor.scope,
      date: descriptor.date,
      key: descriptor.key,
      primary,
      shadow,
      op: 'read',
      result: comparison.result,
      primaryHash: comparison.primaryHash,
      shadowHash: comparison.shadowHash,
    },
    options
  )

  if (!comparison.matches) {
    logger.warn?.(
      `[last-success-store] shadow read divergence for ${descriptor.key}: ${primary}=${comparison.primaryHash || 'miss'} ${shadow}=${comparison.shadowHash || 'miss'}`
    )
  }

  return primaryResult?.body ?? null
}

export async function writeLastSuccess(scope, date, payload, options = {}) {
  const descriptor = resolveScopeDescriptor(scope, date, options.accessOverride)
  const primaryMode = resolvePrimaryMode(options.primaryMode)
  const { primary, shadow } = resolvePrimaryAndShadow(primaryMode)
  const logger = options.logger || console

  const primaryBackend = getBackend(primary, options)
  const primaryResult = await primaryBackend.write(descriptor, payload, options)

  if (!shadow) return primaryResult

  try {
    await getBackend(shadow, options).write(descriptor, payload, options)
  } catch (error) {
    logger.warn?.(
      `[last-success-store] shadow write failed for ${descriptor.key} (${primary} primary -> ${shadow} shadow):`,
      error
    )
  }

  return primaryResult
}
