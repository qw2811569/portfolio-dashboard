import { del, get, head, list, put } from '@vercel/blob'

import { getPrivateBlobToken } from './blob-tokens.js'
import {
  createEnvStoragePolicyResolver,
  DEFAULT_PRIMARY_STORE,
  normalizeStoragePolicy,
} from './singleton-store.js'
import { gcsDeleteMany, gcsHead, gcsListPrefix, gcsRead, gcsWrite } from './gcs-storage.js'
import { extractBlobPathname } from './signed-url.js'
import {
  appendStorageDivergenceMetric,
  bufferToUtf8,
  defaultScheduleBackgroundTask,
  sha256,
  stableJsonStringify,
} from './storage-divergence-log.js'

const DEFAULT_LIST_LIMIT = 100
const MAX_LIST_LIMIT = 1000

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

function resolveVercelToken(override) {
  const token = String(override || '').trim() || getPrivateBlobToken()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for prefix-store reads/writes/deletes')
  }
  return token
}

function normalizeBasePrefix(value, label) {
  const normalized = String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (!normalized) throw new Error(`[prefix-store] ${label} is required`)
  return `${normalized}/`
}

function normalizeRelativePath(value, { label, allowEmpty = false, preserveTrailingSlash = false } = {}) {
  const normalized = String(value || '')
    .trim()
    .replace(/^\/+/, '')
  const candidate = preserveTrailingSlash ? normalized : normalized.replace(/\/+$/, '')

  if (!candidate && !allowEmpty) {
    throw new Error(`[prefix-store] ${label} is required`)
  }

  return candidate
}

function stripKnownPrefix(value, prefixes = []) {
  for (const prefix of prefixes) {
    const normalizedPrefix = String(prefix || '').trim()
    if (!normalizedPrefix) continue
    const barePrefix = normalizedPrefix.replace(/\/+$/, '')
    if (value === barePrefix || value === normalizedPrefix) return ''
    if (value.startsWith(normalizedPrefix)) return value.slice(normalizedPrefix.length)
  }

  return value
}

function resolveRelativeObjectPath(value, prefixes, label) {
  const normalized = normalizeRelativePath(value, { label })
  return stripKnownPrefix(normalized, prefixes)
}

function resolveRelativePrefixPath(value, prefixes, label) {
  const normalized = normalizeRelativePath(value, {
    label,
    allowEmpty: true,
    preserveTrailingSlash: true,
  })
  if (!normalized) return ''
  return stripKnownPrefix(normalized, prefixes)
}

function logicalKeyFromRelativePath(relativePath, logicalPrefix) {
  return `${logicalPrefix}${relativePath}`
}

function normalizeListLimit(value) {
  if (value == null || value === '') return DEFAULT_LIST_LIMIT

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`[prefix-store] list limit must be a positive number; received "${value}"`)
  }

  return Math.min(MAX_LIST_LIMIT, Math.trunc(numeric))
}

function normalizeUploadedAt(value) {
  if (!value) return null
  const uploadedAt = new Date(value)
  return Number.isNaN(uploadedAt.getTime()) ? null : uploadedAt.toISOString()
}

function normalizeSizeBytes(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

function parseStoredBody(rawBody, format) {
  return format === 'text' ? rawBody : JSON.parse(rawBody)
}

function resolveComparableText(value, format) {
  if (value == null) return null
  if (format === 'text') return String(value)
  return stableJsonStringify(value)
}

function normalizeReadResult(rawResult, format) {
  if (!rawResult) return null

  if (Object.prototype.hasOwnProperty.call(rawResult, 'rawBody')) {
    return {
      ...rawResult,
      comparableText: resolveComparableText(rawResult.body, format),
    }
  }

  const rawBody = bufferToUtf8(rawResult.body)
  const body = parseStoredBody(rawBody, format)
  return {
    ...rawResult,
    rawBody,
    body,
    comparableText: resolveComparableText(body, format),
  }
}

function serializePayload(payload, format) {
  if (format === 'text') return String(payload ?? '')
  return JSON.stringify(payload, null, 2)
}

function createInvalidPayloadError(key) {
  const error = new Error(`[prefix-store] InvalidPayload for ${key}`)
  error.name = 'InvalidPayload'
  error.code = 'INVALID_PAYLOAD'
  return error
}

function resolveListedItemKey(item) {
  if (!item || typeof item !== 'object') return null

  const candidate =
    String(item.key || '').trim() ||
    String(item.pathname || '').trim() ||
    String(item.url || '').trim()

  return candidate ? extractBlobPathname(candidate) : null
}

function normalizeListedItem(rawItem, storeName, descriptor) {
  const actualKey = resolveListedItemKey(rawItem)
  if (!actualKey) return null

  const backendPrefix = storeName === 'gcs' ? descriptor.gcsPrefix : descriptor.vercelPrefix
  const relativePath = stripKnownPrefix(actualKey, [backendPrefix])
  const logicalKey = logicalKeyFromRelativePath(relativePath, descriptor.logicalPrefix)
  const normalizedItem = {
    ...rawItem,
    key: logicalKey,
    pathname: logicalKey,
    backendKey: actualKey,
    uploadedAt: normalizeUploadedAt(rawItem?.uploadedAt),
    size: normalizeSizeBytes(rawItem?.sizeBytes ?? rawItem?.size),
    sizeBytes: normalizeSizeBytes(rawItem?.sizeBytes ?? rawItem?.size),
    contentType: String(rawItem?.contentType || '').trim() || null,
  }

  if (typeof descriptor.metadataKey === 'function') {
    normalizedItem.metadataValue = descriptor.metadataKey(normalizedItem) ?? null
  }

  return normalizedItem
}

function normalizeListedPageItems(rawItems, storeName, descriptor) {
  return (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => normalizeListedItem(item, storeName, descriptor))
    .filter(Boolean)
    .sort((left, right) => left.key.localeCompare(right.key))
}

function normalizeListedKeys(items = []) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item?.key || '').trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right))
}

function classifyShadowList(primaryPage, shadowPage) {
  const primaryKeys = normalizeListedKeys(primaryPage?.items)
  const shadowKeys = normalizeListedKeys(shadowPage?.items)
  const shadowKeySet = new Set(shadowKeys)
  const primaryKeySet = new Set(primaryKeys)
  const primaryOnlyKeys = primaryKeys.filter((key) => !shadowKeySet.has(key))
  const shadowOnlyKeys = shadowKeys.filter((key) => !primaryKeySet.has(key))
  const sameItems = primaryOnlyKeys.length === 0 && shadowOnlyKeys.length === 0
  const sameTail = Boolean(primaryPage?.hasMore) === Boolean(shadowPage?.hasMore)
  const matches = sameItems && sameTail

  let result = 'match'
  if (!sameItems) {
    result =
      shadowOnlyKeys.length > 0 && primaryOnlyKeys.length === 0
        ? 'primary-missing-keys'
        : primaryOnlyKeys.length > 0 && shadowOnlyKeys.length === 0
          ? 'shadow-missing-keys'
          : 'inventory-mismatch'
  } else if (!sameTail) {
    result = primaryPage?.hasMore ? 'shadow-missing-tail' : 'primary-missing-tail'
  }

  return {
    matches,
    result,
    primaryCount: primaryKeys.length,
    shadowCount: shadowKeys.length,
    primaryHasMore: Boolean(primaryPage?.hasMore),
    shadowHasMore: Boolean(shadowPage?.hasMore),
    primaryOnlyKeys,
    shadowOnlyKeys,
  }
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

function getInjectedBackend(storeName, options = {}) {
  if (storeName === 'gcs') return options.gcsBackend || null
  return options.vercelBackend || null
}

async function readFromStore(storeName, descriptor, options = {}) {
  const backend = getInjectedBackend(storeName, options)
  if (backend?.read) {
    return normalizeReadResult(await backend.read(descriptor, options), descriptor.format)
  }

  if (storeName === 'gcs') {
    if (!descriptor.bucketName) {
      throw new Error(`GCS bucket is required for ${descriptor.keyspace} reads`)
    }

    return normalizeReadResult(
      await (options.gcsReadImpl || gcsRead)(descriptor.bucketName, descriptor.gcsKey),
      descriptor.format
    )
  }

  const token = resolveVercelToken(options.token)
  try {
    const blobResult = await (options.getImpl || get)(descriptor.vercelKey, {
      access: descriptor.access,
      token,
      ...(descriptor.useCache === undefined ? {} : { useCache: descriptor.useCache }),
    })
    if (!blobResult) return null
    const rawBody = await new Response(blobResult.stream).text()
    return normalizeReadResult(
      {
        rawBody,
        body: parseStoredBody(rawBody, descriptor.format),
      },
      descriptor.format
    )
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
  }
}

async function writeToStore(storeName, descriptor, payload, options = {}) {
  const backend = getInjectedBackend(storeName, options)
  if (backend?.write) {
    return backend.write(descriptor, payload, options)
  }

  const rawBody = serializePayload(payload, descriptor.format)

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

  const token = resolveVercelToken(options.token)
  return (options.putImpl || put)(descriptor.vercelKey, rawBody, {
    token,
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

  const token = resolveVercelToken(options.token)
  try {
    return (options.headImpl || head)(descriptor.vercelKey, {
      token,
    })
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
  }
}

async function listPageFromStore(storeName, descriptor, options = {}) {
  const backend = getInjectedBackend(storeName, options)
  if (backend?.listPage) {
    return backend.listPage(descriptor, options)
  }

  const pageCursor = options.backendCursor || null
  const pageLimit = options.pageLimit || MAX_LIST_LIMIT

  if (storeName === 'gcs') {
    if (!descriptor.bucketName) {
      throw new Error(`GCS bucket is required for ${descriptor.keyspace} list operations`)
    }

    const page = await (options.gcsListPrefixImpl || gcsListPrefix)(
      descriptor.bucketName,
      descriptor.gcsPrefixRequested,
      {
        cursor: pageCursor,
        limit: pageLimit,
      }
    )

    return {
      items: normalizeListedPageItems(page?.items, storeName, descriptor),
      nextCursor: page?.cursor || null,
    }
  }

  const token = resolveVercelToken(options.token)
  const page = await (options.listImpl || list)({
    token,
    prefix: descriptor.vercelPrefixRequested,
    cursor: pageCursor || undefined,
    limit: pageLimit,
  })

  return {
    items: normalizeListedPageItems(page?.blobs, storeName, descriptor),
    nextCursor: page?.cursor || null,
  }
}

async function scanPrefixPage(storeName, descriptor, options = {}) {
  const pageLimit = descriptor.limit
  const boundaryKey = descriptor.cursorKey
  const items = []
  let backendCursor = null

  do {
    const page = await listPageFromStore(storeName, descriptor, {
      ...options,
      backendCursor,
      pageLimit: Math.min(MAX_LIST_LIMIT, Math.max(pageLimit + 1, DEFAULT_LIST_LIMIT)),
    })

    for (const item of page.items) {
      if (boundaryKey && item.key <= boundaryKey) continue
      items.push(item)
      if (items.length >= pageLimit + 1) break
    }

    if (items.length >= pageLimit + 1) break
    backendCursor = page.nextCursor || null
  } while (backendCursor)

  const pageItems = items.slice(0, pageLimit)
  return {
    items: pageItems,
    hasMore: items.length > pageLimit,
    nextCursor: items.length > pageLimit && pageItems.length > 0 ? pageItems[pageItems.length - 1].key : null,
  }
}

async function deleteManyFromStore(storeName, descriptors, options = {}) {
  const backend = getInjectedBackend(storeName, options)
  if (backend?.deleteMany) {
    return backend.deleteMany(descriptors, options)
  }

  if (storeName === 'gcs') {
    const bucketName = descriptors[0]?.bucketName || ''
    if (!bucketName) {
      throw new Error(`GCS bucket is required for ${descriptors[0]?.keyspace || 'prefix-store'} deletes`)
    }

    const result = await (options.gcsDeleteManyImpl || gcsDeleteMany)(
      bucketName,
      descriptors.map((descriptor) => descriptor.gcsKey)
    )

    return {
      deletedKeys: result.deletedKeys.map((key) =>
        logicalKeyFromRelativePath(stripKnownPrefix(key, [descriptors[0].gcsPrefix]), descriptors[0].logicalPrefix)
      ),
      missingKeys: result.missingKeys.map((key) =>
        logicalKeyFromRelativePath(stripKnownPrefix(key, [descriptors[0].gcsPrefix]), descriptors[0].logicalPrefix)
      ),
      failedKeys: result.failedKeys.map((entry) => ({
        key: logicalKeyFromRelativePath(
          stripKnownPrefix(entry.key, [descriptors[0].gcsPrefix]),
          descriptors[0].logicalPrefix
        ),
        error: entry.error,
      })),
    }
  }

  const token = resolveVercelToken(options.token)
  const deletedKeys = []
  const missingKeys = []
  const failedKeys = []

  for (const descriptor of descriptors) {
    try {
      await (options.delImpl || del)(descriptor.vercelKey, { token })
      deletedKeys.push(descriptor.key)
    } catch (error) {
      if (error?.name === 'BlobNotFoundError') {
        missingKeys.push(descriptor.key)
        continue
      }

      failedKeys.push({
        key: descriptor.key,
        error,
      })
    }
  }

  return {
    deletedKeys,
    missingKeys,
    failedKeys,
  }
}

function createDeleteManyError(keyspaceId, failedKeys) {
  const error = new Error(
    `[prefix-store] deleteMany failed for ${keyspaceId}: ${failedKeys.map((entry) => entry.key).join(', ')}`
  )
  error.name = 'DeleteManyError'
  error.code = 'DELETE_MANY_FAILED'
  error.failures = failedKeys
  return error
}

export function createPrefixStore({
  keyspaceId,
  loggerPrefix = 'prefix-store',
  envPrefix,
  resolveStoragePolicy = envPrefix
    ? createEnvStoragePolicyResolver({
        envPrefix,
        fallback: DEFAULT_PRIMARY_STORE,
        loggerPrefix,
      })
    : undefined,
  bucketClass = 'private',
  access = 'private',
  vercelPrefix,
  gcsPrefix = vercelPrefix,
  contentType = 'application/json',
  cacheControl = 'no-store',
  format = 'json',
  useCache = false,
  metadataKey,
  assertPayload,
}) {
  if (typeof resolveStoragePolicy !== 'function') {
    throw new Error(`[${loggerPrefix}] resolveStoragePolicy is required`)
  }

  const logicalPrefix = normalizeBasePrefix(vercelPrefix || gcsPrefix, 'vercelPrefix')
  const normalizedVercelPrefix = normalizeBasePrefix(vercelPrefix || logicalPrefix, 'vercelPrefix')
  const normalizedGcsPrefix = normalizeBasePrefix(gcsPrefix || logicalPrefix, 'gcsPrefix')

  function getPolicy(options = {}) {
    if (options.storagePolicyOverride) {
      return normalizeStoragePolicy(options.storagePolicyOverride, {
        source: 'options.storagePolicyOverride',
        fallback: DEFAULT_PRIMARY_STORE,
        loggerPrefix,
      })
    }

    return resolveStoragePolicy(
      {
        keyspace: keyspaceId,
      },
      options
    )
  }

  function buildObjectDescriptor(key) {
    const relativePath = resolveRelativeObjectPath(
      key,
      [logicalPrefix, normalizedVercelPrefix, normalizedGcsPrefix],
      'key'
    )

    return {
      keyspace: keyspaceId,
      key: logicalKeyFromRelativePath(relativePath, logicalPrefix),
      relativePath,
      logicalPrefix,
      vercelPrefix: normalizedVercelPrefix,
      gcsPrefix: normalizedGcsPrefix,
      vercelKey: `${normalizedVercelPrefix}${relativePath}`,
      gcsKey: `${normalizedGcsPrefix}${relativePath}`,
      bucketClass,
      bucketName: getBucketName(bucketClass),
      access,
      format,
      contentType,
      cacheControl,
      useCache,
      metadataKey,
    }
  }

  function buildListDescriptor(params = {}) {
    const relativePrefix = resolveRelativePrefixPath(
      params.prefix,
      [logicalPrefix, normalizedVercelPrefix, normalizedGcsPrefix],
      'prefix'
    )
    const prefixKey = logicalKeyFromRelativePath(relativePrefix, logicalPrefix)
    const cursorKey =
      params.cursor == null || params.cursor === ''
        ? null
        : buildObjectDescriptor(params.cursor).key

    if (cursorKey && !cursorKey.startsWith(prefixKey)) {
      throw new Error(`[${loggerPrefix}] cursor ${cursorKey} does not belong to prefix ${prefixKey}`)
    }

    return {
      keyspace: keyspaceId,
      key: prefixKey,
      logicalPrefix,
      vercelPrefix: normalizedVercelPrefix,
      gcsPrefix: normalizedGcsPrefix,
      vercelPrefixRequested: `${normalizedVercelPrefix}${relativePrefix}`,
      gcsPrefixRequested: `${normalizedGcsPrefix}${relativePrefix}`,
      bucketClass,
      bucketName: getBucketName(bucketClass),
      access,
      limit: normalizeListLimit(params.limit),
      cursorKey,
      metadataKey,
    }
  }

  function validatePayload(payload, descriptor) {
    if (typeof assertPayload === 'function') {
      assertPayload(payload, descriptor)
      return
    }

    if (payload == null) {
      throw createInvalidPayloadError(descriptor.key)
    }
  }

  async function appendDeleteDivergenceMetric(comparison, descriptor, policy, options = {}) {
    const logger = options.logger || console
    try {
      await appendStorageDivergenceMetric(
        {
          type: 'delete-divergence',
          keyspace: descriptor.keyspace,
          key: descriptor.key,
          primary: policy.primary,
          shadow: resolveShadowBackendName(policy.primary),
          op: 'delete',
          result: comparison.result,
          requestedCount: comparison.requestedCount,
          missingKeys: comparison.missingKeys,
          failedKeys: comparison.failedKeys.map((entry) => entry.key),
        },
        options
      )
    } catch (error) {
      logger.warn?.(
        `[${loggerPrefix}] failed to append delete divergence metric for ${descriptor.key}:`,
        error
      )
    }
  }

  return {
    async read(key, options = {}) {
      const descriptor = buildObjectDescriptor(key)
      const policy = getPolicy(options)
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

          const comparison = classifyShadowRead(primaryResult, shadowOutcome)
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

    async write(key, payload, options = {}) {
      const descriptor = buildObjectDescriptor(key)
      validatePayload(payload, descriptor)

      const policy = getPolicy(options)
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

    async list(params = {}, options = {}) {
      const descriptor = buildListDescriptor(params)
      const policy = getPolicy(options)
      const { primary, shadow } = resolvePrimaryAndShadow(policy, 'read')
      const logger = options.logger || console
      const scheduleBackgroundTask = options.scheduleBackgroundTask || defaultScheduleBackgroundTask
      const shadowListPromise = shadow
        ? scanPrefixPage(shadow, descriptor, options).catch((error) => ({
            shadowListError: error,
          }))
        : null

      const primaryPage = await scanPrefixPage(primary, descriptor, options)
      if (!shadowListPromise) return primaryPage

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

          const comparison = classifyShadowList(primaryPage, shadowOutcome)
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
                primaryHasMore: comparison.primaryHasMore,
                shadowHasMore: comparison.shadowHasMore,
                primaryOnlyKeys: comparison.primaryOnlyKeys,
                shadowOnlyKeys: comparison.shadowOnlyKeys,
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
            `[${loggerPrefix}] shadow list divergence for ${descriptor.key}: ${primary}=${comparison.primaryCount}/${comparison.primaryHasMore ? 'more' : 'end'} ${shadow}=${comparison.shadowCount}/${comparison.shadowHasMore ? 'more' : 'end'} primaryOnly=${comparison.primaryOnlyKeys.length} shadowOnly=${comparison.shadowOnlyKeys.length}`
          )
        } catch (error) {
          logger.warn?.(`[${loggerPrefix}] shadow list compare failed for ${descriptor.key}:`, error)
        }
      })

      return primaryPage
    },

    async deleteMany(keys = [], options = {}) {
      const descriptors = Array.from(
        new Map(
          (Array.isArray(keys) ? keys : [])
            .map((key) => buildObjectDescriptor(key))
            .map((descriptor) => [descriptor.key, descriptor])
        ).values()
      )

      if (descriptors.length === 0) {
        return {
          requestedCount: 0,
          deletedKeys: [],
          missingKeys: [],
          failedKeys: [],
          shadowMissingKeys: [],
          shadowFailedKeys: [],
        }
      }

      const policy = getPolicy(options)
      const { primary, shadow } = resolvePrimaryAndShadow(policy, 'write')
      const logger = options.logger || console

      const primaryResult = await deleteManyFromStore(primary, descriptors, options)
      if (primaryResult.failedKeys.length > 0) {
        throw createDeleteManyError(keyspaceId, primaryResult.failedKeys)
      }

      const result = {
        requestedCount: descriptors.length,
        deletedKeys: primaryResult.deletedKeys,
        missingKeys: primaryResult.missingKeys,
        failedKeys: primaryResult.failedKeys,
        shadowMissingKeys: [],
        shadowFailedKeys: [],
      }

      if (!shadow) return result

      const shadowDescriptorsToDelete = []
      for (const descriptor of descriptors) {
        try {
          const shadowHead = await headStoreObject(shadow, descriptor, options)
          if (!shadowHead) {
            result.shadowMissingKeys.push(descriptor.key)
            continue
          }
          shadowDescriptorsToDelete.push(descriptor)
        } catch (error) {
          result.shadowFailedKeys.push({
            key: descriptor.key,
            error,
          })
        }
      }

      if (shadowDescriptorsToDelete.length > 0) {
        const shadowResult = await deleteManyFromStore(shadow, shadowDescriptorsToDelete, options)
        result.shadowMissingKeys.push(...shadowResult.missingKeys)
        result.shadowFailedKeys.push(...shadowResult.failedKeys)
      }

      if (result.shadowMissingKeys.length > 0 || result.shadowFailedKeys.length > 0) {
        const comparison = {
          result:
            result.shadowFailedKeys.length > 0 ? 'shadow-delete-failed' : 'shadow-missing-keys',
          requestedCount: descriptors.length,
          missingKeys: result.shadowMissingKeys,
          failedKeys: result.shadowFailedKeys,
        }
        await appendDeleteDivergenceMetric(comparison, descriptors[0], policy, options)

        logger.warn?.(
          `[${loggerPrefix}] shadow delete divergence for ${descriptors[0].keyspace}: missing=${result.shadowMissingKeys.length} failed=${result.shadowFailedKeys.length}`
        )
      }

      return result
    },
  }
}
