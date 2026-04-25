import { get, head, list, put } from '@vercel/blob'

import { getPrivateBlobToken } from './blob-tokens.js'
import { gcsHead, gcsListPrefix, gcsRead, gcsWrite } from './gcs-storage.js'
import { extractBlobPathname } from './signed-url.js'
import {
  appendStorageDivergenceMetric,
  bufferToUtf8,
  defaultScheduleBackgroundTask,
  sha256,
  stableJsonStringify,
} from './storage-divergence-log.js'

export const DEFAULT_PRIMARY_STORE = 'vercel'
export const PRIMARY_STORES = new Set(['vercel', 'gcs'])

function getPublicBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
}

export function parsePrimaryStore(
  value,
  { envName, fallback = DEFAULT_PRIMARY_STORE, loggerPrefix = 'singleton-store' } = {}
) {
  const candidate = String(value || '').trim()
  if (!candidate) return fallback
  if (PRIMARY_STORES.has(candidate)) return candidate
  throw new Error(
    `[${loggerPrefix}] ${envName} must be "vercel" or "gcs"; received "${candidate}"`
  )
}

export function parseShadowToggle(
  value,
  { envName, fallback = false, loggerPrefix = 'singleton-store' } = {}
) {
  const candidate = String(value || '')
    .trim()
    .toLowerCase()
  if (!candidate) return fallback
  if (candidate === 'true') return true
  if (candidate === 'false') return false
  throw new Error(
    `[${loggerPrefix}] ${envName} must be "true" or "false"; received "${String(value)}"`
  )
}

export function normalizeStoragePolicy(
  policy,
  {
    source = 'storage policy',
    fallback = DEFAULT_PRIMARY_STORE,
    loggerPrefix = 'singleton-store',
  } = {}
) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error(`[${loggerPrefix}] ${source} must be an object`)
  }

  return {
    primary: parsePrimaryStore(policy.primary, {
      envName: `${source}.primary`,
      fallback,
      loggerPrefix,
    }),
    shadowRead:
      typeof policy.shadowRead === 'boolean'
        ? policy.shadowRead
        : parseShadowToggle(policy.shadowRead, {
            envName: `${source}.shadowRead`,
            fallback: false,
            loggerPrefix,
          }),
    shadowWrite:
      typeof policy.shadowWrite === 'boolean'
        ? policy.shadowWrite
        : parseShadowToggle(policy.shadowWrite, {
            envName: `${source}.shadowWrite`,
            fallback: false,
            loggerPrefix,
          }),
  }
}

export function createEnvStoragePolicyResolver({
  envPrefix,
  fallback = DEFAULT_PRIMARY_STORE,
  loggerPrefix = 'singleton-store',
}) {
  const normalizedEnvPrefix = String(envPrefix || '').trim()
  if (!normalizedEnvPrefix) {
    throw new Error(`[${loggerPrefix}] envPrefix is required`)
  }

  return function resolveStoragePolicy(_descriptor, options = {}) {
    if (options.storagePolicyOverride) {
      return normalizeStoragePolicy(options.storagePolicyOverride, {
        source: 'options.storagePolicyOverride',
        fallback,
        loggerPrefix,
      })
    }

    return {
      primary: parsePrimaryStore(process.env[`STORAGE_PRIMARY_${normalizedEnvPrefix}`], {
        envName: `STORAGE_PRIMARY_${normalizedEnvPrefix}`,
        fallback,
        loggerPrefix,
      }),
      shadowRead: parseShadowToggle(process.env[`STORAGE_SHADOW_READ_${normalizedEnvPrefix}`], {
        envName: `STORAGE_SHADOW_READ_${normalizedEnvPrefix}`,
        fallback: false,
        loggerPrefix,
      }),
      shadowWrite: parseShadowToggle(process.env[`STORAGE_SHADOW_WRITE_${normalizedEnvPrefix}`], {
        envName: `STORAGE_SHADOW_WRITE_${normalizedEnvPrefix}`,
        fallback: false,
        loggerPrefix,
      }),
    }
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

function resolveShadowBackendName(primary) {
  return primary === 'gcs' ? 'vercel' : 'gcs'
}

function resolvePrimaryAndShadow(policy, operation) {
  const shadowEnabled = operation === 'read' ? policy.shadowRead : policy.shadowWrite
  return {
    primary: policy.primary,
    shadow: shadowEnabled ? resolveShadowBackendName(policy.primary) : null,
  }
}

function resolveVercelToken(access, override) {
  const normalizedOverride = String(override || '').trim()
  if (normalizedOverride) return normalizedOverride
  return access === 'public' ? getPublicBlobToken() : getPrivateBlobToken()
}

async function readPublicBlobTextViaList(
  key,
  { token, fetchImpl = fetch, listImpl = list, errorLabel = 'singleton-store' } = {}
) {
  const resolvedToken = resolveVercelToken('public', token)
  if (!resolvedToken) {
    throw new Error(`PUB_BLOB_READ_WRITE_TOKEN is required for public ${errorLabel} reads`)
  }

  const { blobs } = await listImpl({ prefix: key, limit: 1, token: resolvedToken })
  if (!Array.isArray(blobs) || blobs.length === 0) return null

  const response = await fetchImpl(blobs[0].url)
  if (!response?.ok) {
    throw new Error(`public ${errorLabel} read failed (${response?.status || 'unknown'})`)
  }

  if (typeof response.text === 'function') return response.text()
  if (typeof response.json === 'function') {
    return JSON.stringify(await response.json())
  }

  throw new Error(`public ${errorLabel} response did not expose text() or json()`)
}

async function readVercelBlobText(
  descriptor,
  { token, getImpl = get, fetchImpl = fetch, listImpl = list, errorLabel = 'singleton-store' } = {}
) {
  if (descriptor.readMethod === 'list-fetch') {
    return readPublicBlobTextViaList(descriptor.vercelKey, {
      token,
      fetchImpl,
      listImpl,
      errorLabel,
    })
  }

  const resolvedToken = resolveVercelToken(descriptor.access, token)
  if (!resolvedToken) {
    throw new Error(
      descriptor.access === 'public'
        ? `PUB_BLOB_READ_WRITE_TOKEN is required for public ${errorLabel} reads`
        : `BLOB_READ_WRITE_TOKEN is required for private ${errorLabel} reads`
    )
  }

  try {
    const blobResult = await getImpl(descriptor.vercelKey, {
      access: descriptor.access,
      token: resolvedToken,
      ...(descriptor.useCache === undefined ? {} : { useCache: descriptor.useCache }),
    })
    if (!blobResult) return null
    return new Response(blobResult.stream).text()
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
  }
}

function parseStoredBody(rawBody, descriptor) {
  if (descriptor.format === 'text') return rawBody
  return JSON.parse(rawBody)
}

function resolveComparableText(value, descriptor) {
  if (value == null) return null
  if (descriptor.format === 'text') return String(value)
  return stableJsonStringify(value)
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
  const body = parseStoredBody(rawBody, descriptor)
  return {
    ...rawResult,
    rawBody,
    body,
    comparableText: resolveComparableText(body, descriptor),
  }
}

function serializePayload(payload, descriptor) {
  if (descriptor.format === 'text') return String(payload ?? '')
  return JSON.stringify(payload, null, 2)
}

function createInvalidPayloadError(key, loggerPrefix) {
  const error = new Error(`[${loggerPrefix}] InvalidPayload for ${key}`)
  error.name = 'InvalidPayload'
  error.code = 'INVALID_PAYLOAD'
  return error
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

function resolveListedItemKey(item) {
  if (!item || typeof item !== 'object') return null

  const candidate =
    String(item.key || '').trim() ||
    String(item.pathname || '').trim() ||
    String(item.url || '').trim()

  return candidate ? extractBlobPathname(candidate) : null
}

function normalizeListedKeys(items = []) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => resolveListedItemKey(item))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right))
}

function classifyShadowList(primaryItems, shadowItems) {
  const primaryKeys = normalizeListedKeys(primaryItems)
  const shadowKeys = normalizeListedKeys(shadowItems)
  const shadowKeySet = new Set(shadowKeys)
  const primaryKeySet = new Set(primaryKeys)
  const primaryOnlyKeys = primaryKeys.filter((key) => !shadowKeySet.has(key))
  const shadowOnlyKeys = shadowKeys.filter((key) => !primaryKeySet.has(key))
  const matches = primaryOnlyKeys.length === 0 && shadowOnlyKeys.length === 0

  let result = 'match'
  if (!matches) {
    result =
      shadowOnlyKeys.length > 0 && primaryOnlyKeys.length === 0
        ? 'primary-missing-keys'
        : primaryOnlyKeys.length > 0 && shadowOnlyKeys.length === 0
          ? 'shadow-missing-keys'
          : 'inventory-mismatch'
  }

  return {
    matches,
    result,
    primaryCount: primaryKeys.length,
    shadowCount: shadowKeys.length,
    primaryOnlyKeys,
    shadowOnlyKeys,
  }
}

function normalizeDescriptor(descriptor, keyspaceId) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new Error('[singleton-store] descriptor must be an object')
  }

  const vercelKey = String(descriptor.vercelKey || descriptor.key || '').trim()
  const gcsKey = String(descriptor.gcsKey || descriptor.key || vercelKey).trim()
  if (!vercelKey || !gcsKey) throw new Error('[singleton-store] descriptor key is required')

  const access = String(descriptor.access || '').trim() || 'private'
  const bucketClass = String(descriptor.bucketClass || access || 'private').trim()
  const prefix = String(descriptor.prefix || descriptor.vercelPrefix || '').trim() || null

  return {
    ...descriptor,
    keyspace: String(descriptor.keyspace || keyspaceId || '').trim() || keyspaceId,
    key: vercelKey,
    vercelKey,
    gcsKey,
    access,
    format: descriptor.format === 'text' ? 'text' : 'json',
    bucketClass,
    bucketName: String(descriptor.bucketName || '').trim() || getBucketName(bucketClass),
    contentType:
      String(descriptor.contentType || '').trim() ||
      (descriptor.format === 'text' ? 'text/plain; charset=utf-8' : 'application/json'),
    cacheControl:
      String(descriptor.cacheControl || '').trim() ||
      (access === 'public' ? 'public, max-age=0, must-revalidate' : 'no-store'),
    readMethod: descriptor.readMethod === 'list-fetch' ? 'list-fetch' : 'get',
    useCache: descriptor.useCache,
    prefix,
    vercelPrefix: String(descriptor.vercelPrefix || prefix || '').trim() || null,
    gcsPrefix: String(descriptor.gcsPrefix || prefix || '').trim() || null,
  }
}

function buildDescriptorResolver({
  keyspaceId,
  resolveDescriptor,
  vercelKey,
  gcsKey,
  access = 'private',
  bucketClass = access,
  contentType,
  cacheControl,
  format = 'json',
  readMethod = 'get',
  useCache,
  resolveListDescriptor,
}) {
  const descriptorFactory =
    typeof resolveDescriptor === 'function'
      ? resolveDescriptor
      : (params) => ({
          keyspace: keyspaceId,
          vercelKey: typeof vercelKey === 'function' ? vercelKey(params) : vercelKey,
          gcsKey:
            typeof gcsKey === 'function'
              ? gcsKey(params)
              : gcsKey || (typeof vercelKey === 'function' ? vercelKey(params) : vercelKey),
          access,
          bucketClass,
          contentType,
          cacheControl,
          format,
          readMethod,
          useCache,
        })

  const listDescriptorFactory =
    typeof resolveListDescriptor === 'function'
      ? resolveListDescriptor
      : null

  return {
    resolve(params) {
      return normalizeDescriptor(descriptorFactory(params), keyspaceId)
    },
    resolveList(params) {
      if (!listDescriptorFactory) return null
      return normalizeDescriptor(listDescriptorFactory(params), keyspaceId)
    },
  }
}

function getInjectedBackend(storeName, options = {}) {
  if (storeName === 'gcs') return options.gcsBackend || null
  return options.vercelBackend || null
}

async function readFromStore(storeName, descriptor, options = {}) {
  const backend = getInjectedBackend(storeName, options)
  if (backend?.read) {
    return normalizeReadResult(await backend.read(descriptor, options), descriptor)
  }

  if (storeName === 'gcs') {
    if (!descriptor.bucketName) {
      throw new Error(`GCS bucket is required for ${descriptor.keyspace} reads`)
    }
    return normalizeReadResult(
      await (options.gcsReadImpl || gcsRead)(descriptor.bucketName, descriptor.gcsKey),
      descriptor
    )
  }

  const rawBody = await readVercelBlobText(descriptor, {
    token: options.token,
    getImpl: options.getImpl,
    fetchImpl: options.fetchImpl,
    listImpl: options.listImpl,
    errorLabel: descriptor.keyspace,
  })
  if (rawBody == null) return null
  return {
    body: parseStoredBody(rawBody, descriptor),
    rawBody,
    comparableText: resolveComparableText(parseStoredBody(rawBody, descriptor), descriptor),
  }
}

async function writeToStore(storeName, descriptor, payload, options = {}) {
  const backend = getInjectedBackend(storeName, options)
  if (backend?.write) {
    return backend.write(descriptor, payload, options)
  }

  const rawBody = serializePayload(payload, descriptor)

  if (storeName === 'gcs') {
    if (!descriptor.bucketName) {
      throw new Error(`GCS bucket is required for ${descriptor.keyspace} writes`)
    }
    return (options.gcsWriteImpl || gcsWrite)(descriptor.bucketName, descriptor.gcsKey, rawBody, {
      contentType: descriptor.contentType,
      cacheControl: descriptor.cacheControl,
      public: descriptor.access === 'public',
    })
  }

  const resolvedToken = resolveVercelToken(descriptor.access, options.token)
  if (!resolvedToken) {
    throw new Error(
      descriptor.access === 'public'
        ? `PUB_BLOB_READ_WRITE_TOKEN is required for public ${descriptor.keyspace} writes`
        : `BLOB_READ_WRITE_TOKEN is required for private ${descriptor.keyspace} writes`
    )
  }

  return (options.putImpl || put)(descriptor.vercelKey, rawBody, {
    token: resolvedToken,
    addRandomSuffix: false,
    allowOverwrite: true,
    access: descriptor.access,
    contentType: descriptor.contentType,
    cacheControl: descriptor.cacheControl,
  })
}

async function headStoreObject(storeName, descriptor, options = {}) {
  const backend = getInjectedBackend(storeName, options)
  if (backend?.head) {
    return backend.head(descriptor, options)
  }

  if (storeName === 'gcs') {
    if (!descriptor.bucketName) {
      throw new Error(`GCS bucket is required for ${descriptor.keyspace} heads`)
    }
    return (options.gcsHeadImpl || gcsHead)(descriptor.bucketName, descriptor.gcsKey)
  }

  const resolvedToken = resolveVercelToken(descriptor.access, options.token)
  if (!resolvedToken) {
    throw new Error(
      descriptor.access === 'public'
        ? `PUB_BLOB_READ_WRITE_TOKEN is required for public ${descriptor.keyspace} heads`
        : `BLOB_READ_WRITE_TOKEN is required for private ${descriptor.keyspace} heads`
    )
  }

  try {
    return (options.headImpl || head)(descriptor.vercelKey, {
      token: resolvedToken,
    })
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
  }
}

function matchListedKey(key, matcher) {
  if (!matcher) return true
  if (matcher instanceof RegExp) return matcher.test(key)
  if (typeof matcher === 'function') return Boolean(matcher(key))
  return true
}

async function listStorePrefix(storeName, descriptor, options = {}) {
  const backend = getInjectedBackend(storeName, options)
  if (backend?.list) {
    return backend.list(descriptor, options)
  }

  const matcher = descriptor.matcher || descriptor.matchKey

  if (storeName === 'gcs') {
    if (!descriptor.bucketName) {
      throw new Error(`GCS bucket is required for ${descriptor.keyspace} list operations`)
    }

    const items = []
    let cursor = null
    do {
      const page = await (options.gcsListPrefixImpl || gcsListPrefix)(
        descriptor.bucketName,
        descriptor.gcsPrefix,
        {
          cursor,
          limit: descriptor.limit || 1000,
        }
      )
      for (const item of Array.isArray(page?.items) ? page.items : []) {
        const key = extractBlobPathname(item.pathname || item.key)
        if (!matchListedKey(key, matcher)) continue
        items.push({
          ...item,
          key,
          pathname: key,
        })
      }
      cursor = page?.cursor || null
    } while (cursor)

    return items.sort((left, right) => left.key.localeCompare(right.key))
  }

  const resolvedToken = resolveVercelToken(descriptor.access, options.token)
  if (!resolvedToken) {
    throw new Error(
      descriptor.access === 'public'
        ? `PUB_BLOB_READ_WRITE_TOKEN is required for public ${descriptor.keyspace} list operations`
        : `BLOB_READ_WRITE_TOKEN is required for private ${descriptor.keyspace} list operations`
    )
  }

  const items = []
  let cursor = null

  do {
    const page = await (options.listImpl || list)({
      token: resolvedToken,
      prefix: descriptor.vercelPrefix,
      cursor: cursor || undefined,
      limit: descriptor.limit || 1000,
    })

    for (const blob of Array.isArray(page?.blobs) ? page.blobs : []) {
      const key = extractBlobPathname(blob?.pathname || blob?.url)
      if (!matchListedKey(key, matcher)) continue
      items.push({
        ...blob,
        key,
        pathname: key,
      })
    }

    cursor = page?.cursor || null
  } while (cursor)

  return items.sort((left, right) => left.key.localeCompare(right.key))
}

export function createSingletonStore({
  keyspaceId,
  loggerPrefix = 'singleton-store',
  envPrefix,
  resolveStoragePolicy = envPrefix
    ? createEnvStoragePolicyResolver({ envPrefix, loggerPrefix })
    : undefined,
  resolveDescriptor,
  resolveListDescriptor,
  vercelKey,
  gcsKey,
  access = 'private',
  bucketClass = access,
  contentType,
  cacheControl,
  format = 'json',
  readMethod = 'get',
  useCache,
  assertPayload,
}) {
  if (typeof resolveStoragePolicy !== 'function') {
    throw new Error(`[${loggerPrefix}] resolveStoragePolicy is required`)
  }

  const descriptorResolver = buildDescriptorResolver({
    keyspaceId,
    resolveDescriptor,
    resolveListDescriptor,
    vercelKey,
    gcsKey,
    access,
    bucketClass,
    contentType,
    cacheControl,
    format,
    readMethod,
    useCache,
  })

  function getPolicy(descriptor, options = {}) {
    return resolveStoragePolicy(descriptor, options)
  }

  function validatePayload(payload, descriptor) {
    if (typeof assertPayload === 'function') {
      assertPayload(payload, descriptor)
      return
    }

    if (payload == null) {
      throw createInvalidPayloadError(descriptor.key, loggerPrefix)
    }
  }

  return {
    async read(params, options = {}) {
      const descriptor = descriptorResolver.resolve(params)
      const policy = getPolicy(descriptor, options)
      const { primary, shadow } = resolvePrimaryAndShadow(policy, 'read')
      const logger = options.logger || console
      const scheduleBackgroundTask = options.scheduleBackgroundTask || defaultScheduleBackgroundTask
      const shadowReadPromise = shadow
        ? readFromStore(shadow, descriptor, options).catch((error) => ({
            shadowReadError: error,
          }))
        : null

      const primaryResult = await readFromStore(primary, descriptor, options)
      if (!shadowReadPromise) return primaryResult?.body ?? null

      scheduleBackgroundTask(async () => {
        try {
          const shadowOutcome = await shadowReadPromise
          if (shadowOutcome?.shadowReadError) {
            logger.warn?.(
              `[${loggerPrefix}] shadow read failed for ${descriptor.key} (${primary} primary -> ${shadow} shadow):`,
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
                key: descriptor.key,
                primary,
                shadow,
                op: 'read',
                result: comparison.result,
                primaryHash: comparison.primaryHash,
                shadowHash: comparison.shadowHash,
                ...(descriptor.scope ? { scope: descriptor.scope } : {}),
                ...(descriptor.date ? { date: descriptor.date } : {}),
              },
              options
            )
          } catch (error) {
            logger.warn?.(
              `[${loggerPrefix}] failed to append divergence metric for ${descriptor.key}:`,
              error
            )
          }

          if (!comparison.matches) {
            logger.warn?.(
              `[${loggerPrefix}] shadow read divergence for ${descriptor.key}: ${primary}=${comparison.primaryHash || 'miss'} ${shadow}=${comparison.shadowHash || 'miss'}`
            )
          }
        } catch (error) {
          logger.warn?.(`[${loggerPrefix}] shadow read compare failed for ${descriptor.key}:`, error)
        }
      })

      return primaryResult?.body ?? null
    },

    async write(params, payload, options = {}) {
      const descriptor = descriptorResolver.resolve(params)
      validatePayload(payload, descriptor)

      const policy = getPolicy(descriptor, options)
      const { primary, shadow } = resolvePrimaryAndShadow(policy, 'write')
      const logger = options.logger || console

      const primaryResult = await writeToStore(primary, descriptor, payload, options)
      if (!shadow) return primaryResult

      try {
        await writeToStore(shadow, descriptor, payload, options)
      } catch (error) {
        logger.warn?.(
          `[${loggerPrefix}] shadow write failed for ${descriptor.key} (${primary} primary -> ${shadow} shadow):`,
          error
        )
      }

      return primaryResult
    },

    async head(params, options = {}) {
      const descriptor = descriptorResolver.resolve(params)
      const policy = getPolicy(descriptor, options)
      const { primary } = resolvePrimaryAndShadow(policy, 'read')
      return headStoreObject(primary, descriptor, options)
    },

    async list(params, options = {}) {
      const descriptor = descriptorResolver.resolveList(params)
      if (!descriptor) {
        throw new Error(`[${loggerPrefix}] list is not configured for ${keyspaceId}`)
      }

      const policy = getPolicy(descriptor, options)
      const { primary, shadow } = resolvePrimaryAndShadow(policy, 'read')
      const logger = options.logger || console
      const scheduleBackgroundTask = options.scheduleBackgroundTask || defaultScheduleBackgroundTask
      const shadowListPromise = shadow
        ? listStorePrefix(shadow, descriptor, options).catch((error) => ({
            shadowListError: error,
          }))
        : null

      const primaryItems = await listStorePrefix(primary, descriptor, options)
      if (!shadowListPromise) return primaryItems

      scheduleBackgroundTask(async () => {
        try {
          const shadowOutcome = await shadowListPromise
          if (shadowOutcome?.shadowListError) {
            logger.warn?.(
              `[${loggerPrefix}] shadow list failed for ${descriptor.key} (${primary} primary -> ${shadow} shadow):`,
              shadowOutcome.shadowListError
            )
            return
          }

          const comparison = classifyShadowList(primaryItems, shadowOutcome)
          if (comparison.matches) return

          try {
            await appendStorageDivergenceMetric(
              {
                type: 'list-divergence',
                keyspace: descriptor.keyspace,
                key: descriptor.key,
                primary,
                shadow,
                op: 'list',
                result: comparison.result,
                primaryCount: comparison.primaryCount,
                shadowCount: comparison.shadowCount,
                primaryOnlyKeys: comparison.primaryOnlyKeys,
                shadowOnlyKeys: comparison.shadowOnlyKeys,
                ...(descriptor.scope ? { scope: descriptor.scope } : {}),
                ...(descriptor.date ? { date: descriptor.date } : {}),
              },
              options
            )
          } catch (error) {
            logger.warn?.(
              `[${loggerPrefix}] failed to append list divergence metric for ${descriptor.key}:`,
              error
            )
          }

          logger.warn?.(
            `[${loggerPrefix}] shadow list divergence for ${descriptor.key}: ${primary}=${comparison.primaryCount} ${shadow}=${comparison.shadowCount} primaryOnly=${comparison.primaryOnlyKeys.length} shadowOnly=${comparison.shadowOnlyKeys.length}`
          )
        } catch (error) {
          logger.warn?.(`[${loggerPrefix}] shadow list compare failed for ${descriptor.key}:`, error)
        }
      })

      return primaryItems
    },
  }
}
