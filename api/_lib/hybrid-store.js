import { del, get, list, put } from '@vercel/blob'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { getPrivateBlobToken } from './blob-tokens.js'
import {
  createEnvStoragePolicyResolver,
  DEFAULT_PRIMARY_STORE,
  normalizeStoragePolicy,
} from './singleton-store.js'
import { gcsDeleteMany, gcsListPrefix, gcsRead, gcsWrite } from './gcs-storage.js'
import { extractBlobPathname } from './signed-url.js'

function getPublicBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
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

function normalizeLogicalKey(value, { allowEmpty = false, label = 'key', loggerPrefix } = {}) {
  const normalized = String(value || '')
    .trim()
    .replace(/^\/+/, '')

  if (!normalized && !allowEmpty) {
    throw new Error(`[${loggerPrefix}] ${label} is required`)
  }

  return normalized
}

function resolveShadowBackendName(primary) {
  return primary === 'gcs' ? 'vercel' : 'gcs'
}

function defaultLocalKeyFromFilePath(filePath, rootPath) {
  return path.relative(rootPath, filePath).replace(/\\/g, '/').replace(/__/g, '/')
}

async function readJsonFile(filePath, { logger = console, loggerPrefix = 'hybrid-store' } = {}) {
  const result = await readJsonFileWithVersion(filePath, { logger, loggerPrefix })
  return result?.payload ?? null
}

function serializePayload(payload) {
  return JSON.stringify(payload, null, 2)
}

function createLocalVersionToken(raw) {
  return `local:${createHash('sha256').update(raw).digest('hex')}`
}

function normalizeVersionToken(value) {
  const token = String(value || '').trim()
  return token || null
}

function createLocalCorruptError(filePath, error) {
  const corrupt = new Error(`[hybrid-store] local JSON is corrupt for ${filePath}`)
  corrupt.name = 'LocalCorruptError'
  corrupt.code = 'LOCAL_CORRUPT'
  corrupt.cause = error
  return corrupt
}

function createVersionConflictError(key, error) {
  const conflict = new Error(`[hybrid-store] version conflict for ${key}`)
  conflict.name = 'VersionConflictError'
  conflict.code = 'VERSION_CONFLICT'
  conflict.status = 409
  conflict.cause = error
  return conflict
}

async function readJsonFileWithVersion(
  filePath,
  { logger = console, loggerPrefix = 'hybrid-store' } = {}
) {
  try {
    const raw = await readFile(filePath, 'utf8')
    try {
      return {
        payload: JSON.parse(raw),
        versionToken: createLocalVersionToken(raw),
      }
    } catch (error) {
      throw createLocalCorruptError(filePath, error)
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    logger.warn?.(`[${loggerPrefix}] local read failed for ${filePath}:`, error)
    throw error
  }
}

async function writeJsonFile(
  filePath,
  payload,
  { logger = console, loggerPrefix = 'hybrid-store' } = {}
) {
  const raw = serializePayload(payload)
  const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`

  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(tmpPath, raw, 'utf8')
    await rename(tmpPath, filePath)
    return {
      status: 'written',
      filePath,
      versionToken: createLocalVersionToken(raw),
    }
  } catch (error) {
    await unlink(tmpPath).catch(() => {})
    logger.warn?.(`[${loggerPrefix}] local write failed for ${filePath}:`, error)
    throw error
  }
}

async function deleteLocalFile(filePath, { logger = console, loggerPrefix = 'hybrid-store' } = {}) {
  try {
    await unlink(filePath)
    return {
      status: 'deleted',
      filePath,
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        status: 'missing',
        filePath,
      }
    }
    logger.warn?.(`[${loggerPrefix}] local delete failed for ${filePath}:`, error)
    throw error
  }
}

function getTombstonePath(filePath) {
  return `${filePath}.tombstone`
}

async function hasLocalTombstone(filePath) {
  try {
    await stat(getTombstonePath(filePath))
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function writeLocalTombstone(
  filePath,
  { logger = console, loggerPrefix = 'hybrid-store' } = {}
) {
  const tombstonePath = getTombstonePath(filePath)
  try {
    await mkdir(path.dirname(tombstonePath), { recursive: true })
    await writeFile(
      tombstonePath,
      JSON.stringify({ deletedAt: new Date().toISOString() }, null, 2),
      'utf8'
    )
    return {
      status: 'written',
      filePath: tombstonePath,
    }
  } catch (error) {
    logger.warn?.(`[${loggerPrefix}] local tombstone write failed for ${filePath}:`, error)
    throw error
  }
}

async function clearLocalTombstone(filePath) {
  try {
    await unlink(getTombstonePath(filePath))
    return {
      status: 'deleted',
      filePath: getTombstonePath(filePath),
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        status: 'missing',
        filePath: getTombstonePath(filePath),
      }
    }
    throw error
  }
}

async function walkLocalFiles(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT') return []
    throw error
  })

  const files = []
  for (const entry of entries) {
    const target = path.join(rootPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkLocalFiles(target)))
      continue
    }
    if (entry.isFile()) files.push(target)
  }
  return files
}

function normalizeListedItem(item, source) {
  return {
    key: item.key,
    pathname: item.pathname || item.key,
    uploadedAt: item.uploadedAt || null,
    size: item.sizeBytes ?? item.size ?? null,
    sizeBytes: item.sizeBytes ?? item.size ?? null,
    contentType: item.contentType || 'application/json',
    source,
  }
}

function createInvalidPayloadError(keyspaceId, key) {
  const error = new Error(`[hybrid-store] InvalidPayload for ${keyspaceId}:${key}`)
  error.name = 'InvalidPayload'
  error.code = 'INVALID_PAYLOAD'
  return error
}

const localCasQueues = new Map()

async function withLocalCasLock(lockKey, task) {
  const previous = localCasQueues.get(lockKey) || Promise.resolve()
  let release
  const current = new Promise((resolve) => {
    release = resolve
  })
  const queued = previous.then(
    () => current,
    () => current
  )
  localCasQueues.set(lockKey, queued)

  try {
    await previous.catch(() => {})
    return await task()
  } finally {
    release()
    if (localCasQueues.get(lockKey) === queued) {
      localCasQueues.delete(lockKey)
    }
  }
}

export function createFlatDataPathResolver(dataDir) {
  const normalizedDataDir = String(dataDir || '').trim()
  if (!normalizedDataDir) {
    throw new Error('[hybrid-store] dataDir is required for createFlatDataPathResolver')
  }

  return function resolveFlatDataPath(key = '') {
    return path.join(
      normalizedDataDir,
      String(key || '')
        .trim()
        .replace(/\//g, '__')
    )
  }
}

export function createHybridStore({
  keyspaceId,
  loggerPrefix = 'hybrid-store',
  envPrefix,
  resolveStoragePolicy = envPrefix
    ? createEnvStoragePolicyResolver({
        envPrefix,
        fallback: DEFAULT_PRIMARY_STORE,
        loggerPrefix,
      })
    : undefined,
  localPath,
  localRootPath,
  localKeyFromFilePath = defaultLocalKeyFromFilePath,
  vercelKey,
  gcsKey = vercelKey,
  bucketClass = 'private',
  authoritySource = 'local',
  promoteOnFallback = true,
  getVercelToken = bucketClass === 'public' ? getPublicBlobToken : getPrivateBlobToken,
  assertPayload,
}) {
  if (typeof resolveStoragePolicy !== 'function') {
    throw new Error(`[${loggerPrefix}] resolveStoragePolicy is required`)
  }
  if (typeof localPath !== 'function') {
    throw new Error(`[${loggerPrefix}] localPath is required`)
  }
  if (typeof vercelKey !== 'function') {
    throw new Error(`[${loggerPrefix}] vercelKey is required`)
  }
  if (typeof gcsKey !== 'function') {
    throw new Error(`[${loggerPrefix}] gcsKey is required`)
  }

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

  function getAccess() {
    return bucketClass === 'public' ? 'public' : 'private'
  }

  function resolveDescriptor(params, label = 'key') {
    const logicalKey = normalizeLogicalKey(vercelKey(params), { label, loggerPrefix })
    const resolvedGcsKey = normalizeLogicalKey(gcsKey(params), { label, loggerPrefix })

    return {
      keyspace: keyspaceId,
      key: logicalKey,
      vercelKey: logicalKey,
      gcsKey: resolvedGcsKey,
      bucketClass,
      bucketName: getBucketName(bucketClass),
      access: getAccess(),
      localFilePath: localPath(params),
    }
  }

  function resolveListDescriptor(prefix) {
    const normalizedPrefix = normalizeLogicalKey(vercelKey(prefix), {
      allowEmpty: true,
      label: 'prefix',
      loggerPrefix,
    })
    const resolvedGcsPrefix = normalizeLogicalKey(gcsKey(prefix), {
      allowEmpty: true,
      label: 'prefix',
      loggerPrefix,
    })

    return {
      keyspace: keyspaceId,
      prefix: normalizedPrefix,
      vercelPrefix: normalizedPrefix,
      gcsPrefix: resolvedGcsPrefix,
      bucketClass,
      bucketName: getBucketName(bucketClass),
      access: getAccess(),
    }
  }

  function resolveToken(override) {
    const token = String(override || '').trim() || String(getVercelToken() || '').trim()
    if (!token) {
      throw new Error(
        descriptorAccessLabel(bucketClass) === 'public'
          ? `PUB_BLOB_READ_WRITE_TOKEN is required for ${keyspaceId} reads/writes`
          : `BLOB_READ_WRITE_TOKEN is required for ${keyspaceId} reads/writes`
      )
    }
    return token
  }

  async function readFromVercel(descriptor, options = {}) {
    const token = resolveToken(options.token)

    if (descriptor.access === 'public') {
      const page = await (options.listImpl || list)({
        token,
        prefix: descriptor.vercelKey,
        limit: 10,
      })
      const blob = (Array.isArray(page?.blobs) ? page.blobs : []).find(
        (item) => extractBlobPathname(item?.pathname || item?.url) === descriptor.vercelKey
      )
      if (!blob) return null

      const response = await (options.fetchImpl || fetch)(blob.url)
      if (!response?.ok) {
        throw new Error(
          `public Vercel read failed (${response?.status || 'unknown'}) for ${descriptor.vercelKey}`
        )
      }

      return response.json()
    }

    try {
      const blob = await (options.getImpl || get)(descriptor.vercelKey, {
        access: descriptor.access,
        token,
        useCache: false,
      })
      if (!blob) return null
      const raw = await new Response(blob.stream).text()
      return JSON.parse(raw)
    } catch (error) {
      if (error?.name === 'BlobNotFoundError') return null
      throw error
    }
  }

  async function readFromGcs(descriptor, options = {}) {
    if (!descriptor.bucketName) {
      throw new Error(`[${loggerPrefix}] GCS bucket is required for ${descriptor.keyspace}`)
    }

    const result = await (options.gcsReadImpl || gcsRead)(descriptor.bucketName, descriptor.gcsKey)
    if (!result) return null
    return JSON.parse(result.body.toString('utf8'))
  }

  async function readFromRemote(storeName, descriptor, options = {}) {
    if (storeName === 'gcs') return readFromGcs(descriptor, options)
    return readFromVercel(descriptor, options)
  }

  async function writeToVercel(descriptor, payload, options = {}) {
    const token = resolveToken(options.token)
    return (options.putImpl || put)(descriptor.vercelKey, JSON.stringify(payload, null, 2), {
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      access: descriptor.access,
      contentType: 'application/json',
      cacheControl: 'no-store',
    })
  }

  async function writeToGcs(descriptor, payload, options = {}) {
    if (!descriptor.bucketName) {
      throw new Error(`[${loggerPrefix}] GCS bucket is required for ${descriptor.keyspace}`)
    }

    return (options.gcsWriteImpl || gcsWrite)(
      descriptor.bucketName,
      descriptor.gcsKey,
      JSON.stringify(payload, null, 2),
      {
        contentType: 'application/json',
        cacheControl: 'no-store',
        public: descriptor.access === 'public',
      }
    )
  }

  async function writeToRemote(storeName, descriptor, payload, options = {}) {
    if (storeName === 'gcs') return writeToGcs(descriptor, payload, options)
    return writeToVercel(descriptor, payload, options)
  }

  async function deleteFromVercel(descriptor, options = {}) {
    const token = resolveToken(options.token)
    try {
      await (options.delImpl || del)(descriptor.vercelKey, { token })
      return {
        status: 'deleted',
        backend: 'vercel',
        key: descriptor.vercelKey,
      }
    } catch (error) {
      if (error?.name === 'BlobNotFoundError') {
        return {
          status: 'missing',
          backend: 'vercel',
          key: descriptor.vercelKey,
        }
      }
      throw error
    }
  }

  async function deleteFromGcs(descriptor, options = {}) {
    if (!descriptor.bucketName) {
      throw new Error(`[${loggerPrefix}] GCS bucket is required for ${descriptor.keyspace}`)
    }

    const outcome = await (options.gcsDeleteManyImpl || gcsDeleteMany)(descriptor.bucketName, [
      descriptor.gcsKey,
    ])
    const failed = Array.isArray(outcome?.failedKeys) ? outcome.failedKeys[0] : null
    if (failed) throw failed.error

    return {
      status:
        Array.isArray(outcome?.deletedKeys) && outcome.deletedKeys.length > 0
          ? 'deleted'
          : 'missing',
      backend: 'gcs',
      key: descriptor.gcsKey,
    }
  }

  async function deleteFromRemote(storeName, descriptor, options = {}) {
    if (storeName === 'gcs') return deleteFromGcs(descriptor, options)
    return deleteFromVercel(descriptor, options)
  }

  async function listFromVercel(descriptor, options = {}) {
    const token = resolveToken(options.token)
    const items = []
    let cursor = null

    do {
      const page = await (options.listImpl || list)({
        token,
        prefix: descriptor.vercelPrefix,
        cursor: cursor || undefined,
        limit: 1000,
      })

      for (const blob of Array.isArray(page?.blobs) ? page.blobs : []) {
        const key = extractBlobPathname(blob?.pathname || blob?.url)
        if (!key.startsWith(descriptor.vercelPrefix)) continue
        items.push(
          normalizeListedItem(
            {
              key,
              pathname: key,
              uploadedAt:
                blob?.uploadedAt instanceof Date
                  ? blob.uploadedAt.toISOString()
                  : blob?.uploadedAt || null,
              size: blob?.size ?? null,
              sizeBytes: blob?.size ?? null,
              contentType: blob?.contentType || 'application/json',
            },
            'vercel'
          )
        )
      }

      cursor = page?.cursor || null
    } while (cursor)

    return items.sort((left, right) => left.key.localeCompare(right.key))
  }

  async function listFromGcs(descriptor, options = {}) {
    if (!descriptor.bucketName) {
      throw new Error(`[${loggerPrefix}] GCS bucket is required for ${descriptor.keyspace}`)
    }

    const items = []
    let cursor = null

    do {
      const page = await (options.gcsListPrefixImpl || gcsListPrefix)(
        descriptor.bucketName,
        descriptor.gcsPrefix,
        {
          cursor,
          limit: 1000,
        }
      )

      for (const item of Array.isArray(page?.items) ? page.items : []) {
        const key = extractBlobPathname(item?.pathname || item?.key)
        if (!key.startsWith(descriptor.gcsPrefix)) continue
        items.push(
          normalizeListedItem(
            {
              key,
              pathname: key,
              uploadedAt: item?.uploadedAt || null,
              size: item?.size ?? null,
              sizeBytes: item?.sizeBytes ?? item?.size ?? null,
              contentType: item?.contentType || 'application/json',
            },
            'gcs'
          )
        )
      }

      cursor = page?.cursor || null
    } while (cursor)

    return items.sort((left, right) => left.key.localeCompare(right.key))
  }

  async function listFromRemote(storeName, descriptor, options = {}) {
    if (storeName === 'gcs') return listFromGcs(descriptor, options)
    return listFromVercel(descriptor, options)
  }

  async function promoteRemotePayload(descriptor, payload, options = {}) {
    if (!promoteOnFallback) return

    try {
      await writeJsonFile(descriptor.localFilePath, payload, options)
    } catch {
      /* local promotion is best-effort */
    }
  }

  async function readLocalWithVersion(descriptor, options = {}) {
    if (authoritySource === 'local' && (await hasLocalTombstone(descriptor.localFilePath))) {
      return null
    }
    return readJsonFileWithVersion(descriptor.localFilePath, options)
  }

  async function readRemoteWithVersion(storeName, descriptor, options = {}) {
    const payload = await readFromRemote(storeName, descriptor, options)
    if (payload == null) return null

    if (promoteOnFallback) {
      const localResult = await writeJsonFile(descriptor.localFilePath, payload, options)
      await clearLocalTombstone(descriptor.localFilePath).catch(() => {})
      return {
        payload,
        versionToken: localResult.versionToken,
      }
    }

    return {
      payload,
      versionToken: createLocalVersionToken(serializePayload(payload)),
    }
  }

  async function listLocal(descriptor) {
    const rootPath =
      String(localRootPath || '').trim() || path.resolve(String(localPath('') || '').trim())
    const files = await walkLocalFiles(rootPath)
    const items = []

    for (const filePath of files) {
      if (filePath.endsWith('.tombstone')) continue
      const key = normalizeLogicalKey(localKeyFromFilePath(filePath, rootPath), {
        allowEmpty: true,
        label: 'local key',
        loggerPrefix,
      })
      if (!key.startsWith(descriptor.prefix)) continue

      const metadata = await stat(filePath)
      items.push(
        normalizeListedItem(
          {
            key,
            pathname: key,
            uploadedAt: metadata.mtime.toISOString(),
            size: metadata.size,
            sizeBytes: metadata.size,
            contentType: 'application/json',
          },
          'local'
        )
      )
    }

    return items.sort((left, right) => left.key.localeCompare(right.key))
  }

  function validatePayload(payload, descriptor) {
    if (typeof assertPayload === 'function') {
      assertPayload(payload, descriptor)
      return
    }

    if (payload == null) {
      throw createInvalidPayloadError(keyspaceId, descriptor.key)
    }
  }

  async function readViaAuthority(primaryBackend, shadowBackend, descriptor, options = {}) {
    if (authoritySource === 'remote') {
      const primaryRemote = await readFromRemote(primaryBackend, descriptor, options)
      if (primaryRemote != null) {
        await promoteRemotePayload(descriptor, primaryRemote, options)
        return primaryRemote
      }

      if (shadowBackend) {
        const shadowRemote = await readFromRemote(shadowBackend, descriptor, options)
        if (shadowRemote != null) {
          await promoteRemotePayload(descriptor, shadowRemote, options)
          return shadowRemote
        }
      }

      return readJsonFile(descriptor.localFilePath, options)
    }

    if (await hasLocalTombstone(descriptor.localFilePath)) return null

    const local = await readJsonFile(descriptor.localFilePath, options)
    if (local != null) return local

    const primaryRemote = await readFromRemote(primaryBackend, descriptor, options)
    if (primaryRemote != null) {
      await promoteRemotePayload(descriptor, primaryRemote, options)
      return primaryRemote
    }

    if (!shadowBackend) return null

    const shadowRemote = await readFromRemote(shadowBackend, descriptor, options)
    if (shadowRemote != null) {
      await promoteRemotePayload(descriptor, shadowRemote, options)
    }
    return shadowRemote
  }

  async function readWithVersionViaAuthority(
    primaryBackend,
    shadowBackend,
    descriptor,
    options = {}
  ) {
    if (authoritySource === 'remote') {
      const primaryRemote = await readRemoteWithVersion(primaryBackend, descriptor, options)
      if (primaryRemote) return primaryRemote

      if (shadowBackend) {
        const shadowRemote = await readRemoteWithVersion(shadowBackend, descriptor, options)
        if (shadowRemote) return shadowRemote
      }

      return readJsonFileWithVersion(descriptor.localFilePath, options)
    }

    const local = await readLocalWithVersion(descriptor, options)
    if (local) return local
    if (await hasLocalTombstone(descriptor.localFilePath)) return null

    const primaryRemote = await readRemoteWithVersion(primaryBackend, descriptor, options)
    if (primaryRemote) return primaryRemote

    if (!shadowBackend) return null
    return readRemoteWithVersion(shadowBackend, descriptor, options)
  }

  function descriptorAccessLabel(targetBucketClass) {
    return targetBucketClass === 'public' ? 'public' : 'private'
  }

  return {
    async read(params, options = {}) {
      const descriptor = resolveDescriptor(params)
      const policy = getPolicy(options)
      const shadowBackend = policy.shadowRead ? resolveShadowBackendName(policy.primary) : null
      return readViaAuthority(policy.primary, shadowBackend, descriptor, {
        loggerPrefix,
        ...options,
      })
    },

    async readWithVersion(params, options = {}) {
      const descriptor = resolveDescriptor(params)
      const policy = getPolicy(options)
      const shadowBackend = policy.shadowRead ? resolveShadowBackendName(policy.primary) : null
      return readWithVersionViaAuthority(policy.primary, shadowBackend, descriptor, {
        loggerPrefix,
        ...options,
      })
    },

    async write(params, payload, options = {}) {
      const descriptor = resolveDescriptor(params)
      validatePayload(payload, descriptor)

      const localResult = await writeJsonFile(descriptor.localFilePath, payload, {
        loggerPrefix,
        ...options,
      })
      await clearLocalTombstone(descriptor.localFilePath)

      const policy = getPolicy(options)
      const backends = [policy.primary]
      if (policy.shadowWrite) backends.push(resolveShadowBackendName(policy.primary))

      const remoteErrors = []
      const remoteResults = []
      const logger = options.logger || console

      for (const backend of backends) {
        try {
          remoteResults.push(await writeToRemote(backend, descriptor, payload, options))
        } catch (error) {
          remoteErrors.push({
            backend,
            error,
          })
          logger.warn?.(
            `[${loggerPrefix}] remote write failed for ${descriptor.key} (${backend}):`,
            error
          )
        }
      }

      return {
        key: descriptor.key,
        localPath: descriptor.localFilePath,
        localResult,
        remoteResults,
        remoteErrors,
      }
    },

    async writeIfVersion(params, payload, expectedVersionToken, options = {}) {
      const descriptor = resolveDescriptor(params)
      validatePayload(payload, descriptor)

      let localResult
      await withLocalCasLock(descriptor.localFilePath, async () => {
        const current =
          authoritySource === 'local' && (await hasLocalTombstone(descriptor.localFilePath))
            ? null
            : await readJsonFileWithVersion(descriptor.localFilePath, {
                loggerPrefix,
                ...options,
              })
        const currentVersionToken = normalizeVersionToken(current?.versionToken)
        const normalizedExpectedVersionToken = normalizeVersionToken(expectedVersionToken)

        if (currentVersionToken !== normalizedExpectedVersionToken) {
          throw createVersionConflictError(descriptor.key)
        }

        localResult = await writeJsonFile(descriptor.localFilePath, payload, {
          loggerPrefix,
          ...options,
        })
        await clearLocalTombstone(descriptor.localFilePath)
      })

      const policy = getPolicy(options)
      const backends = [policy.primary]
      if (policy.shadowWrite) backends.push(resolveShadowBackendName(policy.primary))

      const remoteErrors = []
      const remoteResults = []
      const logger = options.logger || console

      for (const backend of backends) {
        try {
          remoteResults.push(await writeToRemote(backend, descriptor, payload, options))
        } catch (error) {
          remoteErrors.push({
            backend,
            error,
          })
          logger.warn?.(
            `[${loggerPrefix}] remote write failed for ${descriptor.key} (${backend}):`,
            error
          )
        }
      }

      return {
        key: descriptor.key,
        localPath: descriptor.localFilePath,
        localResult,
        versionToken: localResult?.versionToken || null,
        remoteResults,
        remoteErrors,
      }
    },

    async list(prefix = '', options = {}) {
      const descriptor = resolveListDescriptor(prefix)
      const policy = getPolicy(options)
      const shadowBackend = policy.shadowRead ? resolveShadowBackendName(policy.primary) : null

      if (authoritySource === 'remote') {
        const primaryRemote = await listFromRemote(policy.primary, descriptor, options)
        if (primaryRemote.length > 0) return primaryRemote

        if (shadowBackend) {
          const shadowRemote = await listFromRemote(shadowBackend, descriptor, options)
          if (shadowRemote.length > 0) return shadowRemote
        }

        return listLocal(descriptor)
      }

      const localItems = await listLocal(descriptor)
      if (localItems.length > 0) return localItems

      const primaryRemote = await listFromRemote(policy.primary, descriptor, options)
      if (primaryRemote.length > 0) return primaryRemote
      if (!shadowBackend) return []
      return listFromRemote(shadowBackend, descriptor, options)
    },

    async delete(params, options = {}) {
      const descriptor = resolveDescriptor(params)
      const policy = getPolicy(options)
      const logger = options.logger || console
      const remoteBackends = [policy.primary, resolveShadowBackendName(policy.primary)]
      const uniqueRemoteBackends = Array.from(new Set(remoteBackends))
      const remoteResults = []
      const remoteErrors = []

      const localResult = await deleteLocalFile(descriptor.localFilePath, {
        loggerPrefix,
        ...options,
      })
      const tombstoneResult =
        authoritySource === 'local'
          ? await writeLocalTombstone(descriptor.localFilePath, {
              loggerPrefix,
              ...options,
            })
          : null

      for (const backend of uniqueRemoteBackends) {
        try {
          remoteResults.push(await deleteFromRemote(backend, descriptor, options))
        } catch (error) {
          remoteErrors.push({
            backend,
            error,
          })
          logger.warn?.(
            `[${loggerPrefix}] remote delete failed for ${descriptor.key} (${backend}):`,
            error
          )
        }
      }

      const allRemoteDeletesConfirmed =
        remoteErrors.length === 0 &&
        remoteResults.length === uniqueRemoteBackends.length &&
        remoteResults.every((result) => ['deleted', 'missing'].includes(result?.status))
      if (authoritySource === 'local' && allRemoteDeletesConfirmed) {
        await clearLocalTombstone(descriptor.localFilePath)
      }

      return {
        key: descriptor.key,
        localResult,
        tombstoneResult,
        remoteResults,
        remoteErrors,
      }
    },
  }
}
