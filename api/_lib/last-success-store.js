import path from 'node:path'
import { get, list, put } from '@vercel/blob'
import { getPrivateBlobToken } from './blob-tokens.js'
import { gcsRead, gcsWrite } from './gcs-storage.js'
import {
  appendStorageDivergenceMetric,
  bufferToUtf8,
  defaultScheduleBackgroundTask,
  sha256,
  stableJsonStringify,
} from './storage-divergence-log.js'

const DEFAULT_PRIMARY_STORE = 'vercel'
const PRIMARY_STORES = new Set(['vercel', 'gcs'])
const LEGACY_PRIMARY_MODES = Object.freeze({
  'vercel-only': Object.freeze({ primary: 'vercel', shadowRead: false, shadowWrite: false }),
  'vercel-primary-gcs-shadow': Object.freeze({
    primary: 'vercel',
    shadowRead: true,
    shadowWrite: true,
  }),
  'gcs-primary-vercel-shadow': Object.freeze({
    primary: 'gcs',
    shadowRead: true,
    shadowWrite: true,
  }),
  'gcs-only': Object.freeze({ primary: 'gcs', shadowRead: false, shadowWrite: false }),
})
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const warnedMessages = new Set()

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

function warnOnce(logger, key, message) {
  if (warnedMessages.has(key)) return
  warnedMessages.add(key)
  logger.warn?.(message)
}

function parsePrimaryStore(value, { envName, fallback = DEFAULT_PRIMARY_STORE } = {}) {
  const candidate = String(value || '').trim()
  if (!candidate) return fallback
  if (PRIMARY_STORES.has(candidate)) return candidate
  throw new Error(
    `[last-success-store] ${envName} must be "vercel" or "gcs"; received "${candidate}"`
  )
}

function parseShadowToggle(value, { envName, fallback = false } = {}) {
  const candidate = String(value || '')
    .trim()
    .toLowerCase()
  if (!candidate) return fallback
  if (candidate === 'true') return true
  if (candidate === 'false') return false
  throw new Error(
    `[last-success-store] ${envName} must be "true" or "false"; received "${String(value)}"`
  )
}

function normalizeStoragePolicy(
  policy,
  { source = 'storage policy', fallback = DEFAULT_PRIMARY_STORE } = {}
) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error(`[last-success-store] ${source} must be an object`)
  }

  return {
    primary: parsePrimaryStore(policy.primary, {
      envName: `${source}.primary`,
      fallback,
    }),
    shadowRead:
      typeof policy.shadowRead === 'boolean'
        ? policy.shadowRead
        : parseShadowToggle(policy.shadowRead, {
            envName: `${source}.shadowRead`,
            fallback: false,
          }),
    shadowWrite:
      typeof policy.shadowWrite === 'boolean'
        ? policy.shadowWrite
        : parseShadowToggle(policy.shadowWrite, {
            envName: `${source}.shadowWrite`,
            fallback: false,
          }),
  }
}

function parseLegacyPrimaryMode(value, { envName, logger, warnDeprecated = false } = {}) {
  const candidate = String(value || '').trim()
  if (!candidate) {
    return {
      primary: DEFAULT_PRIMARY_STORE,
      shadowRead: false,
      shadowWrite: false,
    }
  }

  const resolved = LEGACY_PRIMARY_MODES[candidate]
  if (!resolved) {
    throw new Error(
      `[last-success-store] ${envName} must be one of ${Object.keys(LEGACY_PRIMARY_MODES).join(', ')}; received "${candidate}"`
    )
  }

  if (warnDeprecated && logger) {
    warnOnce(
      logger,
      'last-success-store-legacy-primary-mode',
      '[last-success-store] STORAGE_PRIMARY_OPS_LAST_SUCCESS is deprecated; use STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC/_PRIVATE plus STORAGE_SHADOW_READ_OPS_LAST_SUCCESS and STORAGE_SHADOW_WRITE_OPS_LAST_SUCCESS'
    )
  }

  return {
    primary: resolved.primary,
    shadowRead: resolved.shadowRead,
    shadowWrite: resolved.shadowWrite,
  }
}

function getBucketName(bucketClass) {
  switch (bucketClass) {
    case 'public':
      return String(process.env.GCS_BUCKET_PUBLIC || '').trim()
    case 'archive':
      return String(process.env.GCS_BUCKET_ARCHIVE || '').trim()
    case 'private':
    default:
      return String(process.env.GCS_BUCKET_PRIVATE || '').trim()
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
    const bucketClass = normalizedScope === 'daily-snapshot' ? 'archive' : 'private'
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
      bucketClass,
      bucketName: getBucketName(bucketClass),
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
    bucketClass: access,
    bucketName: getBucketName(access),
  }
}

function resolveComparableText(value, descriptor) {
  if (value == null) return null
  if (descriptor.format === 'text') return String(value)
  return stableJsonStringify(value)
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
        descriptor.bucketClass === 'public'
          ? 'GCS_BUCKET_PUBLIC is required for GCS last-success reads'
          : descriptor.bucketClass === 'archive'
            ? 'GCS_BUCKET_ARCHIVE is required for GCS last-success reads'
            : 'GCS_BUCKET_PRIVATE is required for GCS last-success reads'
      )
    }

    return normalizeReadResult(await gcsReadImpl(descriptor.bucketName, descriptor.key), descriptor)
  },

  async write(descriptor, payload, { gcsWriteImpl = gcsWrite } = {}) {
    if (!descriptor.bucketName) {
      throw new Error(
        descriptor.bucketClass === 'public'
          ? 'GCS_BUCKET_PUBLIC is required for GCS last-success writes'
          : descriptor.bucketClass === 'archive'
            ? 'GCS_BUCKET_ARCHIVE is required for GCS last-success writes'
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

function resolveShadowBackendName(primary) {
  return primary === 'gcs' ? 'vercel' : 'gcs'
}

function resolveStoragePolicy(descriptor, options = {}) {
  const logger = options.logger || console

  if (options.storagePolicyOverride) {
    return normalizeStoragePolicy(options.storagePolicyOverride, {
      source: 'options.storagePolicyOverride',
    })
  }

  if (Object.prototype.hasOwnProperty.call(options, 'primaryMode')) {
    return parseLegacyPrimaryMode(options.primaryMode, {
      envName: 'options.primaryMode',
      logger,
    })
  }

  const legacyMode = String(process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS || '').trim()
  const hasSplitConfig = [
    process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC,
    process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS_PRIVATE,
    process.env.STORAGE_SHADOW_READ_OPS_LAST_SUCCESS,
    process.env.STORAGE_SHADOW_WRITE_OPS_LAST_SUCCESS,
  ].some((value) => String(value || '').trim().length > 0)

  if (!hasSplitConfig && legacyMode) {
    return parseLegacyPrimaryMode(legacyMode, {
      envName: 'STORAGE_PRIMARY_OPS_LAST_SUCCESS',
      logger,
      warnDeprecated: true,
    })
  }

  if (hasSplitConfig && legacyMode) {
    warnOnce(
      logger,
      'last-success-store-legacy-env-ignored',
      '[last-success-store] STORAGE_PRIMARY_OPS_LAST_SUCCESS is deprecated and ignored while split ops.last_success env flags are present'
    )
  }

  return {
    primary: parsePrimaryStore(
      descriptor.access === 'public'
        ? process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC
        : process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS_PRIVATE,
      {
        envName:
          descriptor.access === 'public'
            ? 'STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC'
            : 'STORAGE_PRIMARY_OPS_LAST_SUCCESS_PRIVATE',
        fallback: DEFAULT_PRIMARY_STORE,
      }
    ),
    shadowRead: parseShadowToggle(process.env.STORAGE_SHADOW_READ_OPS_LAST_SUCCESS, {
      envName: 'STORAGE_SHADOW_READ_OPS_LAST_SUCCESS',
      fallback: false,
    }),
    shadowWrite: parseShadowToggle(process.env.STORAGE_SHADOW_WRITE_OPS_LAST_SUCCESS, {
      envName: 'STORAGE_SHADOW_WRITE_OPS_LAST_SUCCESS',
      fallback: false,
    }),
  }
}

function resolvePrimaryAndShadow(policy, operation) {
  const shadowEnabled = operation === 'read' ? policy.shadowRead : policy.shadowWrite
  return {
    primary: policy.primary,
    shadow: shadowEnabled ? resolveShadowBackendName(policy.primary) : null,
  }
}

function createInvalidPayloadError(descriptor) {
  const error = new Error(`[last-success-store] InvalidPayload for ${descriptor.key}`)
  error.name = 'InvalidPayload'
  error.code = 'INVALID_PAYLOAD'
  return error
}

function assertValidPayload(payload, descriptor) {
  if (payload == null) throw createInvalidPayloadError(descriptor)
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

export function getLastSuccessStorageMode(override) {
  const options =
    override == null ? {} : typeof override === 'string' ? { primaryMode: override } : override

  return {
    public: resolveStoragePolicy({ access: 'public' }, options),
    private: resolveStoragePolicy({ access: 'private' }, options),
  }
}

export function getLastSuccessScopeDescriptor(scope, date, accessOverride) {
  return resolveScopeDescriptor(scope, date, accessOverride)
}

export async function readLastSuccess(scope, date, options = {}) {
  const descriptor = resolveScopeDescriptor(scope, date, options.accessOverride)
  const policy = resolveStoragePolicy(descriptor, options)
  const { primary, shadow } = resolvePrimaryAndShadow(policy, 'read')
  const logger = options.logger || console
  const scheduleBackgroundTask = options.scheduleBackgroundTask || defaultScheduleBackgroundTask

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

  scheduleBackgroundTask(async () => {
    try {
      const shadowOutcome = await shadowReadPromise
      if (shadowOutcome?.shadowReadError) {
        logger.warn?.(
          `[last-success-store] shadow read failed for ${descriptor.key} (${primary} primary -> ${shadow} shadow):`,
          shadowOutcome.shadowReadError
        )
        return
      }

      const shadowResult = normalizeReadResult(shadowOutcome, descriptor)
      const comparison = classifyShadowRead(primaryResult, shadowResult)

      try {
        await appendStorageDivergenceMetric(
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
      } catch (error) {
        logger.warn?.(
          `[last-success-store] failed to append divergence metric for ${descriptor.key}:`,
          error
        )
      }

      if (!comparison.matches) {
        logger.warn?.(
          `[last-success-store] shadow read divergence for ${descriptor.key}: ${primary}=${comparison.primaryHash || 'miss'} ${shadow}=${comparison.shadowHash || 'miss'}`
        )
      }
    } catch (error) {
      logger.warn?.(`[last-success-store] shadow read compare failed for ${descriptor.key}:`, error)
    }
  })

  return primaryResult?.body ?? null
}

export async function writeLastSuccess(scope, date, payload, options = {}) {
  const descriptor = resolveScopeDescriptor(scope, date, options.accessOverride)
  assertValidPayload(payload, descriptor)

  const policy = resolveStoragePolicy(descriptor, options)
  const { primary, shadow } = resolvePrimaryAndShadow(policy, 'write')
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
