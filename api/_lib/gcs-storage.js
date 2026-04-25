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

export async function gcsRead(bucketName, key) {
  try {
    const file = getBucket(bucketName).file(key)
    const [[metadata], [body]] = await Promise.all([file.getMetadata(), file.download()])

    return {
      body,
      etag: metadata.etag || null,
      contentType: metadata.contentType || null,
      generation: metadata.generation || null,
    }
  } catch (error) {
    const normalized = normalizeGcsError(error, bucketName, key)
    if (normalized === null) return null
    throw normalized
  }
}

export async function gcsWrite(bucketName, key, body, opts = {}) {
  const file = getBucket(bucketName).file(key)
  const contentType = String(opts.contentType || '').trim() || undefined
  const cacheControl = String(opts.cacheControl || '').trim() || undefined
  const ifGenerationMatch =
    opts.ifGenerationMatch === 0 || Number.isFinite(Number(opts.ifGenerationMatch))
      ? Number(opts.ifGenerationMatch)
      : undefined

  try {
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

    return {
      key,
      bucketName,
      contentType: metadata.contentType || contentType || null,
      cacheControl: metadata.cacheControl || cacheControl || null,
      public: Boolean(opts.public),
      etag: metadata.etag || null,
      generation: metadata.generation || null,
    }
  } catch (error) {
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
