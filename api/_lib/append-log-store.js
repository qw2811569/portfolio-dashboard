import { get, head, list, put } from '@vercel/blob'

import { getPrivateBlobToken } from './blob-tokens.js'
import { gcsListPrefix, gcsReadWithVersion, gcsWriteIfGeneration } from './gcs-storage.js'
import {
  createEnvStoragePolicyResolver,
  DEFAULT_PRIMARY_STORE,
  normalizeStoragePolicy,
} from './singleton-store.js'
import {
  appendStorageDivergenceMetric,
  bufferToUtf8,
  defaultScheduleBackgroundTask,
  sha256,
} from './storage-divergence-log.js'
import { extractBlobPathname } from './signed-url.js'

export const APPEND_LOG_CONTENT_TYPE = 'application/x-ndjson'
const CACHE_CONTROL = 'no-store'
const DEFAULT_MAX_RETRIES = 5
const DEFAULT_RETRY_DELAY_MS = 25

export const APPEND_LOG_KEYSPACES = Object.freeze({
  morning_note_log: Object.freeze({
    id: 'morning_note_log',
    envPrefix: 'MORNING_NOTE_LOG',
    prefix: 'logs/morning-note',
    keyPattern: /^logs\/morning-note-\d{4}-\d{2}\.jsonl$/,
  }),
  daily_snapshot_log: Object.freeze({
    id: 'daily_snapshot_log',
    envPrefix: 'DAILY_SNAPSHOT_LOG',
    prefix: 'logs/daily-snapshot',
    keyPattern: /^logs\/daily-snapshot-\d{4}-\d{2}\.jsonl$/,
  }),
  restore_rehearsal_log: Object.freeze({
    id: 'restore_rehearsal_log',
    envPrefix: 'RESTORE_REHEARSAL_LOG',
    prefix: 'logs/restore-rehearsal',
    keyPattern: /^logs\/restore-rehearsal-\d{4}-\d{2}\.jsonl$/,
  }),
})

export const SUPPORTED_APPEND_LOG_KEYSPACES = Object.freeze(Object.keys(APPEND_LOG_KEYSPACES))

function getBucketName() {
  return String(process.env.GCS_BUCKET_PRIVATE || '').trim()
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

function normalizeKey(value) {
  const key = String(value || '')
    .trim()
    .replace(/^\/+/, '')
  if (!key) throw new Error('[append-log-store] key is required')
  return key
}

function normalizeLine(value) {
  const line = String(value || '').replace(/\r?\n+$/u, '')
  if (!line) throw new Error('[append-log-store] append line is required')
  return line
}

function normalizeVersionToken(value) {
  const token = String(value || '').trim()
  return token || null
}

function parseGcsGeneration(versionToken) {
  if (versionToken == null || String(versionToken).trim() === '') return 0
  const generation = Number(versionToken)
  if (!Number.isFinite(generation) || generation < 0) {
    throw new Error(
      `[append-log-store] GCS version token must be a numeric generation; received "${versionToken}"`
    )
  }
  return generation
}

function resolveVercelToken(override) {
  const token = String(override || '').trim() || getPrivateBlobToken()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for append-log reads/writes')
  }
  return token
}

function createVersionConflictError(key, error) {
  const conflict = new Error(`[append-log-store] version conflict for ${key}`)
  conflict.name = 'VersionConflictError'
  conflict.code = 'VERSION_CONFLICT'
  conflict.status = 409
  conflict.cause = error
  return conflict
}

function isVercelVersionConflict(error) {
  return ['BlobPreconditionFailedError', 'BlobAlreadyExistsError'].includes(
    String(error?.name || '').trim()
  )
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function appendLineToBody(body, line) {
  const normalizedBody = String(body || '')
  if (!normalizedBody.trim()) return `${line}\n`
  return `${normalizedBody.replace(/\s*$/u, '\n')}${line}\n`
}

function getKeyspaceConfig(keyspaceId) {
  const config = APPEND_LOG_KEYSPACES[String(keyspaceId || '').trim()]
  if (!config) {
    throw new Error(
      `[append-log-store] Unsupported keyspace "${keyspaceId || '<missing>'}"; expected one of: ${SUPPORTED_APPEND_LOG_KEYSPACES.join(', ')}`
    )
  }
  return config
}

function createDescriptor(keyspaceId, key) {
  const config = getKeyspaceConfig(keyspaceId)
  const normalizedKey = normalizeKey(key)
  if (!config.keyPattern.test(normalizedKey)) {
    throw new Error(`[append-log-store] key ${normalizedKey} does not match ${config.id}`)
  }
  return {
    keyspace: config.id,
    envPrefix: config.envPrefix,
    key: normalizedKey,
    vercelKey: normalizedKey,
    gcsKey: normalizedKey,
    bucketName: getBucketName(),
    contentType: APPEND_LOG_CONTENT_TYPE,
    cacheControl: CACHE_CONTROL,
    access: 'private',
  }
}

function createListDescriptor(keyspaceId) {
  const config = getKeyspaceConfig(keyspaceId)
  return {
    keyspace: config.id,
    envPrefix: config.envPrefix,
    prefix: config.prefix,
    vercelPrefix: config.prefix,
    gcsPrefix: config.prefix,
    bucketName: getBucketName(),
    keyPattern: config.keyPattern,
    access: 'private',
  }
}

const policyResolvers = new Map()

function resolveStoragePolicy(descriptor, options = {}) {
  if (options.storagePolicyOverride) {
    return normalizeStoragePolicy(options.storagePolicyOverride, {
      source: 'options.storagePolicyOverride',
      fallback: DEFAULT_PRIMARY_STORE,
      loggerPrefix: 'append-log-store',
    })
  }

  let resolver = policyResolvers.get(descriptor.envPrefix)
  if (!resolver) {
    resolver = createEnvStoragePolicyResolver({
      envPrefix: descriptor.envPrefix,
      fallback: DEFAULT_PRIMARY_STORE,
      loggerPrefix: 'append-log-store',
    })
    policyResolvers.set(descriptor.envPrefix, resolver)
  }
  return resolver(descriptor, options)
}

const vercelBackend = {
  async readWithVersion(descriptor, { token, headImpl = head, getImpl = get } = {}) {
    const resolvedToken = resolveVercelToken(token)
    try {
      const metadata = await headImpl(descriptor.vercelKey, {
        token: resolvedToken,
        access: descriptor.access,
      })
      const blob = await getImpl(descriptor.vercelKey, {
        token: resolvedToken,
        access: descriptor.access,
        useCache: false,
      })
      if (!blob) return null
      return {
        body: await new Response(blob.stream).text(),
        versionToken: normalizeVersionToken(metadata?.etag),
      }
    } catch (error) {
      if (error?.name === 'BlobNotFoundError') return null
      throw error
    }
  },

  async writeIfVersion(descriptor, body, expectedVersionToken, { token, putImpl = put } = {}) {
    const resolvedToken = resolveVercelToken(token)
    const normalizedExpectedVersion = normalizeVersionToken(expectedVersionToken)
    const writeOptions = {
      token: resolvedToken,
      addRandomSuffix: false,
      access: descriptor.access,
      contentType: descriptor.contentType,
      cacheControl: descriptor.cacheControl,
    }
    if (normalizedExpectedVersion) {
      writeOptions.allowOverwrite = true
      writeOptions.ifMatch = normalizedExpectedVersion
    }

    try {
      const result = await putImpl(descriptor.vercelKey, body, writeOptions)
      return {
        key: descriptor.vercelKey,
        body,
        versionToken: normalizeVersionToken(result?.etag),
      }
    } catch (error) {
      if (isVercelVersionConflict(error)) {
        throw createVersionConflictError(descriptor.key, error)
      }
      throw error
    }
  },

  async list(descriptor, { token, listImpl = list } = {}) {
    const resolvedToken = resolveVercelToken(token)
    const items = []
    let cursor = null
    do {
      const page = await listImpl({
        token: resolvedToken,
        prefix: descriptor.vercelPrefix,
        cursor: cursor || undefined,
        limit: 1000,
      })
      for (const blob of Array.isArray(page?.blobs) ? page.blobs : []) {
        const key = extractBlobPathname(blob?.pathname || blob?.url)
        if (!descriptor.keyPattern.test(key)) continue
        items.push({
          key,
          pathname: key,
          uploadedAt: blob?.uploadedAt || null,
          size: blob?.size ?? null,
          source: 'vercel',
        })
      }
      cursor = page?.cursor || null
    } while (cursor)
    return items.sort((left, right) => left.key.localeCompare(right.key))
  },
}

const gcsBackend = {
  async readWithVersion(descriptor, { gcsReadWithVersionImpl = gcsReadWithVersion } = {}) {
    if (!descriptor.bucketName) {
      throw new Error('GCS_BUCKET_PRIVATE is required for append-log reads')
    }
    const result = await gcsReadWithVersionImpl(descriptor.bucketName, descriptor.gcsKey)
    if (!result) return null
    return {
      body: bufferToUtf8(result.body),
      versionToken: normalizeVersionToken(result.generation),
    }
  },

  async writeIfVersion(
    descriptor,
    body,
    expectedVersionToken,
    { gcsWriteIfGenerationImpl = gcsWriteIfGeneration } = {}
  ) {
    if (!descriptor.bucketName) {
      throw new Error('GCS_BUCKET_PRIVATE is required for append-log writes')
    }
    try {
      const result = await gcsWriteIfGenerationImpl(
        descriptor.bucketName,
        descriptor.gcsKey,
        body,
        parseGcsGeneration(expectedVersionToken),
        {
          contentType: descriptor.contentType,
          cacheControl: descriptor.cacheControl,
          public: false,
        }
      )
      return {
        key: descriptor.gcsKey,
        body,
        versionToken: normalizeVersionToken(result?.generation),
      }
    } catch (error) {
      if (error?.code === 'PRECONDITION_FAILED') {
        throw createVersionConflictError(descriptor.key, error)
      }
      throw error
    }
  },

  async list(descriptor, { gcsListPrefixImpl = gcsListPrefix } = {}) {
    if (!descriptor.bucketName) {
      throw new Error('GCS_BUCKET_PRIVATE is required for append-log list operations')
    }
    const items = []
    let cursor = null
    do {
      const page = await gcsListPrefixImpl(descriptor.bucketName, descriptor.gcsPrefix, {
        cursor,
        limit: 1000,
      })
      for (const item of Array.isArray(page?.items) ? page.items : []) {
        const key = extractBlobPathname(item?.pathname || item?.key)
        if (!descriptor.keyPattern.test(key)) continue
        items.push({
          ...item,
          key,
          pathname: key,
          source: 'gcs',
        })
      }
      cursor = page?.cursor || null
    } while (cursor)
    return items.sort((left, right) => left.key.localeCompare(right.key))
  },
}

function getBackend(name, options = {}) {
  if (name === 'gcs') return options.gcsBackend || gcsBackend
  return options.vercelBackend || vercelBackend
}

async function appendLineViaBackend(backend, descriptor, line, options = {}) {
  const maxRetries = Number.isFinite(Number(options.maxRetries))
    ? Math.max(0, Number(options.maxRetries))
    : DEFAULT_MAX_RETRIES
  const maxAttempts = maxRetries + 1
  const retryDelayMs = Number.isFinite(Number(options.retryDelayMs))
    ? Math.max(0, Number(options.retryDelayMs))
    : DEFAULT_RETRY_DELAY_MS

  let lastConflict = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const current = await backend.readWithVersion(descriptor, options)
    const body = appendLineToBody(current?.body || '', line)

    try {
      const result = await backend.writeIfVersion(
        descriptor,
        body,
        current?.versionToken || null,
        options
      )
      return {
        ...result,
        attempts: attempt,
        line,
      }
    } catch (error) {
      if (error?.code !== 'VERSION_CONFLICT') throw error
      lastConflict = error
      if (attempt <= maxRetries && retryDelayMs > 0) {
        const baseDelay = retryDelayMs * attempt
        const jitter = Math.random() * baseDelay
        await sleep(baseDelay + jitter)
      }
    }
  }

  throw lastConflict || createVersionConflictError(descriptor.key)
}

async function appendShadowDivergence(descriptor, line, primary, shadow, error, options) {
  const logger = options.logger || console
  try {
    await appendStorageDivergenceMetric(
      {
        keyspace: descriptor.keyspace,
        key: descriptor.key,
        primary,
        shadow,
        op: 'append',
        result:
          error?.code === 'VERSION_CONFLICT' ? 'shadow-version-conflict' : 'shadow-write-failed',
        lineHash: sha256(line),
      },
      options
    )
  } catch (metricError) {
    logger.warn?.(
      `[append-log-store] failed to append divergence metric for ${descriptor.key}:`,
      metricError
    )
  }
}

export function inferAppendLogKeyspaceId(key) {
  const normalizedKey = normalizeKey(key)
  for (const config of Object.values(APPEND_LOG_KEYSPACES)) {
    if (config.keyPattern.test(normalizedKey)) return config.id
  }
  throw new Error(`[append-log-store] no Class 3 keyspace matches ${normalizedKey}`)
}

export function getAppendLogStorageMode(keyspaceId, override) {
  const descriptor = {
    envPrefix: getKeyspaceConfig(keyspaceId).envPrefix,
  }
  const envPolicy = resolveStoragePolicy(descriptor)
  if (override == null) return envPolicy
  return normalizeStoragePolicy(
    typeof override === 'string'
      ? { ...envPolicy, primary: override }
      : { ...envPolicy, ...override },
    {
      source: 'override',
      fallback: DEFAULT_PRIMARY_STORE,
      loggerPrefix: 'append-log-store',
    }
  )
}

export function createAppendLogStore(keyspaceId) {
  getKeyspaceConfig(keyspaceId)

  return {
    readWithVersion(key, options = {}) {
      const descriptor = createDescriptor(keyspaceId, key)
      const policy = resolveStoragePolicy(descriptor, options)
      const { primary } = resolvePrimaryAndShadow(policy, 'read')
      return getBackend(primary, options).readWithVersion(descriptor, options)
    },

    writeIfVersion(key, body, expectedVersionToken, options = {}) {
      const descriptor = createDescriptor(keyspaceId, key)
      const policy = resolveStoragePolicy(descriptor, options)
      const { primary } = resolvePrimaryAndShadow(policy, 'write')
      return getBackend(primary, options).writeIfVersion(
        descriptor,
        String(body || ''),
        expectedVersionToken,
        options
      )
    },

    async appendLine(key, value, options = {}) {
      const descriptor = createDescriptor(keyspaceId, key)
      const line = normalizeLine(value)
      const policy = resolveStoragePolicy(descriptor, options)
      const { primary, shadow } = resolvePrimaryAndShadow(policy, 'write')
      const primaryBackend = getBackend(primary, options)
      const primaryResult = await appendLineViaBackend(primaryBackend, descriptor, line, options)

      if (!shadow) return primaryResult

      const logger = options.logger || console
      const scheduleBackgroundTask = options.scheduleBackgroundTask || defaultScheduleBackgroundTask
      scheduleBackgroundTask(async () => {
        try {
          await appendLineViaBackend(getBackend(shadow, options), descriptor, line, options)
        } catch (error) {
          logger.warn?.(
            `[append-log-store] shadow append failed for ${descriptor.key} (${primary} primary -> ${shadow} shadow):`,
            error
          )
          await appendShadowDivergence(descriptor, line, primary, shadow, error, options)
        }
      })

      return primaryResult
    },

    async list(options = {}) {
      const descriptor = createListDescriptor(keyspaceId)
      const policy = resolveStoragePolicy(descriptor, options)
      const { primary } = resolvePrimaryAndShadow(policy, 'read')
      return getBackend(primary, options).list(descriptor, options)
    },
  }
}

export async function appendLogLine(keyspaceId, key, value, options = {}) {
  return createAppendLogStore(keyspaceId).appendLine(key, value, options)
}
