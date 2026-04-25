import { head, put } from '@vercel/blob'
import { getPrivateBlobToken } from './blob-tokens.js'
import { gcsHead, gcsReadWithVersion, gcsWriteIfGeneration } from './gcs-storage.js'
import {
  appendStorageDivergenceMetric,
  bufferToUtf8,
  defaultScheduleBackgroundTask,
  sha256,
  stableJsonStringify,
} from './storage-divergence-log.js'
import { extractBlobPathname, fetchSignedBlobJson } from './signed-url.js'

const DEFAULT_PRIMARY_STORE = 'vercel'
const PRIMARY_STORES = new Set(['vercel', 'gcs'])
const KEYSPACE = 'portfolio.tracked-stocks'
const CONTENT_TYPE = 'application/json'
const CACHE_CONTROL = 'no-store'
const TRACKED_STOCKS_PREFIX = 'tracked-stocks/'

function assertPortfolioId(portfolioId) {
  const normalized = String(portfolioId || '').trim()
  if (!normalized) throw new Error('[tracked-stocks-store] portfolioId is required')
  return normalized
}

function getTrackedStocksKey(portfolioId) {
  return `${TRACKED_STOCKS_PREFIX}${assertPortfolioId(portfolioId)}/latest.json`
}

function parsePrimaryStore(value, { envName, fallback = DEFAULT_PRIMARY_STORE } = {}) {
  const candidate = String(value || '').trim()
  if (!candidate) return fallback
  if (PRIMARY_STORES.has(candidate)) return candidate
  throw new Error(
    `[tracked-stocks-store] ${envName} must be "vercel" or "gcs"; received "${candidate}"`
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
    `[tracked-stocks-store] ${envName} must be "true" or "false"; received "${String(value)}"`
  )
}

function normalizeStoragePolicy(policy, { source = 'storagePolicyOverride' } = {}) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error(`[tracked-stocks-store] ${source} must be an object`)
  }

  return {
    primary: parsePrimaryStore(policy.primary, {
      envName: `${source}.primary`,
      fallback: DEFAULT_PRIMARY_STORE,
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

function resolveStoragePolicy(options = {}) {
  if (options.storagePolicyOverride) {
    return normalizeStoragePolicy(options.storagePolicyOverride)
  }

  return {
    primary: parsePrimaryStore(process.env.STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS, {
      envName: 'STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS',
      fallback: DEFAULT_PRIMARY_STORE,
    }),
    shadowRead: parseShadowToggle(process.env.STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS, {
      envName: 'STORAGE_SHADOW_READ_PORTFOLIO_TRACKED_STOCKS',
      fallback: false,
    }),
    shadowWrite: parseShadowToggle(process.env.STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS, {
      envName: 'STORAGE_SHADOW_WRITE_PORTFOLIO_TRACKED_STOCKS',
      fallback: false,
    }),
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

function resolveDescriptor(portfolioId) {
  return {
    portfolioId: assertPortfolioId(portfolioId),
    key: getTrackedStocksKey(portfolioId),
    bucketName: String(process.env.GCS_BUCKET_PRIVATE || '').trim(),
    contentType: CONTENT_TYPE,
    cacheControl: CACHE_CONTROL,
    keyspace: KEYSPACE,
  }
}

function resolveVercelToken(override) {
  const token = String(override || '').trim() || getPrivateBlobToken()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for tracked-stocks reads/writes')
  }
  return token
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
      `[tracked-stocks-store] GCS version token must be a numeric generation; received "${versionToken}"`
    )
  }

  return generation
}

function serializePayload(payload) {
  return JSON.stringify(payload, null, 2)
}

function hashPayload(payload) {
  return sha256(stableJsonStringify(payload))
}

function hashVersion(versionToken) {
  return versionToken ? sha256(versionToken) : null
}

function createVersionConflictError(key, error) {
  const conflict = new Error(`[tracked-stocks-store] version conflict for ${key}`)
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

function classifyShadowRead(primaryResult, shadowResult, { primary, shadow }) {
  if (!primaryResult && !shadowResult) {
    return {
      matches: true,
      result: 'match',
      primaryHash: null,
      shadowHash: null,
      primaryVersionHash: null,
      shadowVersionHash: null,
      versionComparable: primary === shadow,
      versionResult: 'both-missing',
    }
  }

  if (!primaryResult && shadowResult) {
    return {
      matches: false,
      result: 'primary-miss-shadow-hit',
      primaryHash: null,
      shadowHash: hashPayload(shadowResult.payload),
      primaryVersionHash: null,
      shadowVersionHash: hashVersion(shadowResult.versionToken),
      versionComparable: primary === shadow,
      versionResult: shadowResult.versionToken ? 'shadow-only' : 'shadow-version-missing',
    }
  }

  if (primaryResult && !shadowResult) {
    return {
      matches: false,
      result: 'shadow-miss',
      primaryHash: hashPayload(primaryResult.payload),
      shadowHash: null,
      primaryVersionHash: hashVersion(primaryResult.versionToken),
      shadowVersionHash: null,
      versionComparable: primary === shadow,
      versionResult: primaryResult.versionToken ? 'primary-only' : 'primary-version-missing',
    }
  }

  const primaryHash = hashPayload(primaryResult.payload)
  const shadowHash = hashPayload(shadowResult.payload)
  const primaryVersionHash = hashVersion(primaryResult.versionToken)
  const shadowVersionHash = hashVersion(shadowResult.versionToken)
  const versionComparable = primary === shadow

  if (primaryHash !== shadowHash) {
    return {
      matches: false,
      result: 'mismatch',
      primaryHash,
      shadowHash,
      primaryVersionHash,
      shadowVersionHash,
      versionComparable,
      versionResult: 'payload-mismatch',
    }
  }

  if (!primaryVersionHash || !shadowVersionHash) {
    return {
      matches: false,
      result: 'version-missing',
      primaryHash,
      shadowHash,
      primaryVersionHash,
      shadowVersionHash,
      versionComparable,
      versionResult: 'missing',
    }
  }

  if (versionComparable && primaryVersionHash !== shadowVersionHash) {
    return {
      matches: false,
      result: 'version-mismatch',
      primaryHash,
      shadowHash,
      primaryVersionHash,
      shadowVersionHash,
      versionComparable,
      versionResult: 'mismatch',
    }
  }

  return {
    matches: true,
    result: 'match',
    primaryHash,
    shadowHash,
    primaryVersionHash,
    shadowVersionHash,
    versionComparable,
    versionResult: versionComparable ? 'match' : 'cross-backend-not-compared',
  }
}

const defaultVercelBackend = {
  async read(descriptor, { token, headImpl = head, fetchImpl = fetch, origin } = {}) {
    const resolvedToken = resolveVercelToken(token)

    try {
      const blob = await headImpl(descriptor.key, {
        token: resolvedToken,
        access: 'private',
      })
      const pathname = extractBlobPathname(blob?.pathname || blob?.url) || descriptor.key
      const payload = await fetchSignedBlobJson(pathname, { origin, fetchImpl })

      return {
        payload,
        versionToken: normalizeVersionToken(blob?.etag),
      }
    } catch (error) {
      if (error?.name === 'BlobNotFoundError') return null
      throw error
    }
  },

  async readVersion(descriptor, { token, headImpl = head } = {}) {
    const resolvedToken = resolveVercelToken(token)

    try {
      const blob = await headImpl(descriptor.key, {
        token: resolvedToken,
        access: 'private',
      })
      return normalizeVersionToken(blob?.etag)
    } catch (error) {
      if (error?.name === 'BlobNotFoundError') return null
      throw error
    }
  },

  async write(descriptor, payload, expectedVersionToken, { token, putImpl = put } = {}) {
    const resolvedToken = resolveVercelToken(token)
    const normalizedExpectedVersion = normalizeVersionToken(expectedVersionToken)
    const writeOptions = {
      token: resolvedToken,
      addRandomSuffix: false,
      access: 'private',
      contentType: descriptor.contentType,
    }

    if (normalizedExpectedVersion) {
      writeOptions.allowOverwrite = true
      writeOptions.ifMatch = normalizedExpectedVersion
    }

    try {
      await putImpl(descriptor.key, serializePayload(payload), writeOptions)
      return {
        payload,
        versionToken: null,
      }
    } catch (error) {
      if (isVercelVersionConflict(error)) {
        throw createVersionConflictError(descriptor.key, error)
      }
      throw error
    }
  },
}

const defaultGcsBackend = {
  async read(descriptor, { gcsReadWithVersionImpl = gcsReadWithVersion } = {}) {
    if (!descriptor.bucketName) {
      throw new Error('GCS_BUCKET_PRIVATE is required for tracked-stocks reads')
    }

    const result = await gcsReadWithVersionImpl(descriptor.bucketName, descriptor.key)
    if (!result) return null

    return {
      payload: JSON.parse(bufferToUtf8(result.body)),
      versionToken: normalizeVersionToken(result.generation),
    }
  },

  async readVersion(descriptor, { gcsHeadImpl = gcsHead } = {}) {
    if (!descriptor.bucketName) {
      throw new Error('GCS_BUCKET_PRIVATE is required for tracked-stocks reads')
    }

    const result = await gcsHeadImpl(descriptor.bucketName, descriptor.key)
    return normalizeVersionToken(result?.generation)
  },

  async write(
    descriptor,
    payload,
    expectedVersionToken,
    { gcsWriteIfGenerationImpl = gcsWriteIfGeneration } = {}
  ) {
    if (!descriptor.bucketName) {
      throw new Error('GCS_BUCKET_PRIVATE is required for tracked-stocks writes')
    }

    try {
      const result = await gcsWriteIfGenerationImpl(
        descriptor.bucketName,
        descriptor.key,
        serializePayload(payload),
        parseGcsGeneration(expectedVersionToken),
        {
          contentType: descriptor.contentType,
          cacheControl: descriptor.cacheControl,
          public: false,
        }
      )

      return {
        payload,
        versionToken: normalizeVersionToken(result?.generation),
      }
    } catch (error) {
      if (error?.code === 'PRECONDITION_FAILED') {
        throw createVersionConflictError(descriptor.key, error)
      }
      throw error
    }
  },
}

function getBackend(name, overrides = {}) {
  if (name === 'gcs') return overrides.gcsBackend || defaultGcsBackend
  return overrides.vercelBackend || defaultVercelBackend
}

async function appendDivergenceForShadowWrite(
  descriptor,
  payload,
  primary,
  shadow,
  shadowVersionToken,
  error,
  options
) {
  const logger = options.logger || console

  try {
    await appendStorageDivergenceMetric(
      {
        keyspace: descriptor.keyspace,
        portfolioId: descriptor.portfolioId,
        key: descriptor.key,
        primary,
        shadow,
        op: 'write',
        result:
          error?.code === 'VERSION_CONFLICT' ? 'shadow-version-conflict' : 'shadow-write-failed',
        payloadHash: hashPayload(payload),
        shadowVersionHash: hashVersion(shadowVersionToken),
      },
      options
    )
  } catch (metricError) {
    logger.warn?.(
      `[tracked-stocks-store] failed to append divergence metric for ${descriptor.key}:`,
      metricError
    )
  }
}

export function getTrackedStocksStorageMode(override) {
  const envPolicy = resolveStoragePolicy()
  if (override == null) return envPolicy

  if (typeof override === 'string') {
    return normalizeStoragePolicy(
      {
        ...envPolicy,
        primary: override,
      },
      { source: 'override' }
    )
  }

  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    throw new Error('[tracked-stocks-store] override must be an object or string')
  }

  const hasOverride = (key) => Object.prototype.hasOwnProperty.call(override, key)

  return normalizeStoragePolicy(
    {
      primary: hasOverride('primary') ? override.primary : envPolicy.primary,
      shadowRead: hasOverride('shadowRead') ? override.shadowRead : envPolicy.shadowRead,
      shadowWrite: hasOverride('shadowWrite') ? override.shadowWrite : envPolicy.shadowWrite,
    },
    { source: 'override' }
  )
}

async function readShadowVersionToken(shadowBackend, descriptor, options) {
  const shadowResult =
    typeof shadowBackend.readVersion === 'function'
      ? await shadowBackend.readVersion(descriptor, options)
      : (await shadowBackend.read(descriptor, options))?.versionToken || null

  return normalizeVersionToken(shadowResult)
}

export async function readTrackedStocks(portfolioId, options = {}) {
  const descriptor = resolveDescriptor(portfolioId)
  const policy = resolveStoragePolicy(options)
  const { primary, shadow } = resolvePrimaryAndShadow(policy, 'read')
  const logger = options.logger || console
  const scheduleBackgroundTask = options.scheduleBackgroundTask || defaultScheduleBackgroundTask

  const primaryBackend = getBackend(primary, options)
  const shadowBackend = shadow ? getBackend(shadow, options) : null
  const shadowReadPromise = shadowBackend
    ? shadowBackend.read(descriptor, options).catch((error) => ({ shadowReadError: error }))
    : null

  const primaryResult = await primaryBackend.read(descriptor, options)
  if (!shadowReadPromise) return primaryResult

  scheduleBackgroundTask(async () => {
    try {
      const shadowOutcome = await shadowReadPromise
      if (shadowOutcome?.shadowReadError) {
        logger.warn?.(
          `[tracked-stocks-store] shadow read failed for ${descriptor.key} (${primary} primary -> ${shadow} shadow):`,
          shadowOutcome.shadowReadError
        )
        return
      }

      const comparison = classifyShadowRead(primaryResult, shadowOutcome, { primary, shadow })

      try {
        await appendStorageDivergenceMetric(
          {
            keyspace: descriptor.keyspace,
            portfolioId: descriptor.portfolioId,
            key: descriptor.key,
            primary,
            shadow,
            op: 'read',
            result: comparison.result,
            primaryHash: comparison.primaryHash,
            shadowHash: comparison.shadowHash,
            primaryVersionHash: comparison.primaryVersionHash,
            shadowVersionHash: comparison.shadowVersionHash,
            versionComparable: comparison.versionComparable,
            versionResult: comparison.versionResult,
          },
          options
        )
      } catch (error) {
        logger.warn?.(
          `[tracked-stocks-store] failed to append divergence metric for ${descriptor.key}:`,
          error
        )
      }

      if (!comparison.matches) {
        logger.warn?.(
          `[tracked-stocks-store] shadow read divergence for ${descriptor.key}: payload ${primary}=${comparison.primaryHash || 'miss'} ${shadow}=${comparison.shadowHash || 'miss'} version=${comparison.versionResult}`
        )
      }
    } catch (error) {
      logger.warn?.(
        `[tracked-stocks-store] shadow read compare failed for ${descriptor.key}:`,
        error
      )
    }
  })

  return primaryResult
}

export async function writeTrackedStocksIfVersion(
  portfolioId,
  payload,
  expectedVersionToken,
  options = {}
) {
  const descriptor = resolveDescriptor(portfolioId)
  const policy = resolveStoragePolicy(options)
  const { primary, shadow } = resolvePrimaryAndShadow(policy, 'write')
  const logger = options.logger || console
  const scheduleBackgroundTask = options.scheduleBackgroundTask || defaultScheduleBackgroundTask

  const primaryBackend = getBackend(primary, options)
  const primaryResult = await primaryBackend.write(
    descriptor,
    payload,
    expectedVersionToken,
    options
  )

  if (!shadow) return primaryResult

  scheduleBackgroundTask(async () => {
    const shadowBackend = getBackend(shadow, options)
    let shadowVersionToken = null

    try {
      shadowVersionToken = await readShadowVersionToken(shadowBackend, descriptor, options)
      await shadowBackend.write(descriptor, payload, shadowVersionToken, options)
    } catch (error) {
      if (error?.code === 'VERSION_CONFLICT') {
        try {
          shadowVersionToken = await readShadowVersionToken(shadowBackend, descriptor, options)
          await shadowBackend.write(descriptor, payload, shadowVersionToken, options)
          return
        } catch (retryError) {
          error = retryError
        }
      }

      logger.warn?.(
        `[tracked-stocks-store] shadow write failed for ${descriptor.key} (${primary} primary -> ${shadow} shadow):`,
        error
      )
      await appendDivergenceForShadowWrite(
        descriptor,
        payload,
        primary,
        shadow,
        shadowVersionToken,
        error,
        options
      )
    }
  })

  return primaryResult
}
