import { Storage } from '@google-cloud/storage'

let storageClient = null

function getProjectId() {
  return String(process.env.GCS_PROJECT || '').trim() || undefined
}

function getStorageClient() {
  if (storageClient) return storageClient

  const projectId = getProjectId()
  storageClient = projectId ? new Storage({ projectId }) : new Storage()
  return storageClient
}

function getBucket(bucketName) {
  const normalizedBucketName = String(bucketName || '').trim()
  if (!normalizedBucketName) {
    throw new Error('[gcs-storage] bucket name is required')
  }

  return getStorageClient().bucket(normalizedBucketName)
}

function isPermissionError(error) {
  return error?.code === 401 || error?.code === 403
}

function isRetryableNetworkError(error) {
  if (!error) return false
  if (typeof error?.code === 'number' && error.code >= 500) return true

  const candidates = [error.code, error.name, error.message]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  return candidates.some((value) =>
    [
      'econnreset',
      'etimedout',
      'timeout',
      'network',
      'socket hang up',
      'service unavailable',
      'internal error',
      'backend error',
      'unavailable',
    ].some((needle) => value.includes(needle))
  )
}

function normalizeGcsError(error, bucketName, key) {
  if (error?.code === 404) return null
  if (isPermissionError(error)) throw error

  if (isRetryableNetworkError(error)) {
    const wrapped = new Error(
      `[gcs-storage] transient failure for gs://${bucketName}/${key}; retry suggested: ${error?.message || error}`
    )
    wrapped.cause = error
    throw wrapped
  }

  throw error
}

function normalizeLastModified(value) {
  if (!value) return null
  const lastModified = new Date(value)
  return Number.isNaN(lastModified.getTime()) ? null : lastModified
}

function normalizeSize(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

function normalizeIfGenerationMatch(value) {
  if (value == null) return undefined
  if (value === 0 || Number.isFinite(Number(value))) {
    return Number(value)
  }
  throw new Error(`[gcs-storage] ifGenerationMatch must be a number; received "${value}"`)
}

function createReadResult(metadata, body) {
  return {
    body,
    etag: metadata.etag || null,
    contentType: metadata.contentType || null,
    generation: metadata.generation || null,
  }
}

function createWriteResult(metadata, bucketName, key, opts = {}) {
  return {
    key,
    bucketName,
    contentType: metadata.contentType || opts.contentType || null,
    cacheControl: metadata.cacheControl || opts.cacheControl || null,
    public: Boolean(opts.public),
    etag: metadata.etag || null,
    generation: metadata.generation || null,
  }
}

function createConditionFailedError(bucketName, key, error) {
  const conditionFailed = new Error(
    `[gcs-storage] precondition failed for gs://${bucketName}/${key}`
  )
  conditionFailed.name = 'ConditionFailed'
  conditionFailed.code = 'PRECONDITION_FAILED'
  conditionFailed.status = 412
  conditionFailed.cause = error
  return conditionFailed
}

async function readGcsFile(bucketName, key) {
  const file = getBucket(bucketName).file(key)
  const [[metadata], [body]] = await Promise.all([file.getMetadata(), file.download()])
  return createReadResult(metadata, body)
}

async function writeGcsFile(bucketName, key, body, opts = {}) {
  const file = getBucket(bucketName).file(key)
  const contentType = String(opts.contentType || '').trim() || undefined
  const cacheControl = String(opts.cacheControl || '').trim() || undefined
  const ifGenerationMatch = normalizeIfGenerationMatch(opts.ifGenerationMatch)

  await file.save(body, {
    resumable: false,
    metadata: {
      ...(contentType ? { contentType } : {}),
      ...(cacheControl ? { cacheControl } : {}),
    },
    ...(ifGenerationMatch != null
      ? {
          preconditionOpts: {
            ifGenerationMatch,
          },
        }
      : {}),
  })

  const [metadata] = await file.getMetadata()
  return createWriteResult(metadata, bucketName, key, {
    contentType,
    cacheControl,
    public: opts.public,
  })
}

export async function gcsRead(bucketName, key) {
  try {
    return await readGcsFile(bucketName, key)
  } catch (error) {
    const normalized = normalizeGcsError(error, bucketName, key)
    if (normalized === null) return null
    throw normalized
  }
}

export async function gcsReadWithVersion(bucketName, key) {
  const result = await gcsRead(bucketName, key)
  if (!result) return null

  return {
    body: result.body,
    contentType: result.contentType,
    generation: result.generation,
  }
}

export async function gcsWrite(bucketName, key, body, opts = {}) {
  try {
    return await writeGcsFile(bucketName, key, body, opts)
  } catch (error) {
    const normalized = normalizeGcsError(error, bucketName, key)
    if (normalized === null) return null
    throw normalized
  }
}

export async function gcsWriteIfGeneration(bucketName, key, body, expectedGeneration, opts = {}) {
  try {
    return await writeGcsFile(bucketName, key, body, {
      ...opts,
      ifGenerationMatch: expectedGeneration,
    })
  } catch (error) {
    if (error?.code === 412) {
      throw createConditionFailedError(bucketName, key, error)
    }

    const normalized = normalizeGcsError(error, bucketName, key)
    if (normalized === null) return null
    throw normalized
  }
}

export async function gcsHead(bucketName, key) {
  try {
    const [metadata] = await getBucket(bucketName).file(key).getMetadata()

    return {
      etag: metadata.etag || null,
      generation: metadata.generation || null,
      lastModified: normalizeLastModified(metadata.updated),
    }
  } catch (error) {
    const normalized = normalizeGcsError(error, bucketName, key)
    if (normalized === null) return null
    throw normalized
  }
}

export async function gcsDeleteMany(bucketName, keys = []) {
  const uniqueKeys = Array.from(
    new Set(
      (Array.isArray(keys) ? keys : [])
        .map((key) => String(key || '').trim())
        .filter(Boolean)
    )
  )

  const outcomes = await Promise.all(
    uniqueKeys.map(async (key) => {
      try {
        await getBucket(bucketName).file(key).delete()
        return {
          key,
          status: 'deleted',
        }
      } catch (error) {
        const normalized = normalizeGcsError(error, bucketName, key)
        if (normalized === null) {
          return {
            key,
            status: 'missing',
          }
        }

        return {
          key,
          status: 'error',
          error: normalized,
        }
      }
    })
  )

  return {
    deletedKeys: outcomes.filter((outcome) => outcome.status === 'deleted').map((outcome) => outcome.key),
    missingKeys: outcomes.filter((outcome) => outcome.status === 'missing').map((outcome) => outcome.key),
    failedKeys: outcomes
      .filter((outcome) => outcome.status === 'error')
      .map((outcome) => ({
        key: outcome.key,
        error: outcome.error,
      })),
  }
}

export async function gcsListPrefix(bucketName, prefix, { cursor, limit = 1000 } = {}) {
  try {
    const [files, , apiResponse] = await getBucket(bucketName).getFiles({
      prefix: String(prefix || '').trim(),
      pageToken: cursor || undefined,
      maxResults: limit,
      autoPaginate: false,
    })

    return {
      items: (Array.isArray(files) ? files : []).map((file) => ({
        key: file.name,
        pathname: file.name,
        uploadedAt: normalizeLastModified(file.metadata?.updated)?.toISOString() || null,
        size: normalizeSize(file.metadata?.size),
        sizeBytes: normalizeSize(file.metadata?.size),
        contentType: file.metadata?.contentType || null,
      })),
      cursor: apiResponse?.nextPageToken || null,
    }
  } catch (error) {
    const normalized = normalizeGcsError(error, bucketName, prefix)
    if (normalized === null) {
      return {
        items: [],
        cursor: null,
      }
    }
    throw normalized
  }
}
