import {
  createSingletonStore,
  DEFAULT_PRIMARY_STORE,
  normalizeStoragePolicy,
  parsePrimaryStore,
  parseShadowToggle,
} from './singleton-store.js'

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

function warnOnce(logger, key, message) {
  if (warnedMessages.has(key)) return
  warnedMessages.add(key)
  logger.warn?.(message)
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
      format: 'text',
      bucketClass,
      bucketName: getBucketName(bucketClass),
      contentType: 'text/plain; charset=utf-8',
      cacheControl: 'no-store',
      readMethod: 'get',
      useCache: false,
    }
  }

  return {
    scope: normalizedScope,
    date: null,
    access,
    keyspace: access === 'public' ? 'ops.last_success_public' : 'ops.last_success_private',
    key: `last-success-${normalizedScope}.json`,
    format: 'json',
    bucketClass: access,
    bucketName: getBucketName(access),
    contentType: 'application/json',
    cacheControl: access === 'public' ? 'public, max-age=0, must-revalidate' : 'no-store',
    readMethod: access === 'public' ? 'list-fetch' : 'get',
    useCache: access === 'private' ? false : undefined,
  }
}

function resolveStoragePolicy(descriptor, options = {}) {
  const logger = options.logger || console

  if (options.storagePolicyOverride) {
    return normalizeStoragePolicy(options.storagePolicyOverride, {
      source: 'options.storagePolicyOverride',
      fallback: DEFAULT_PRIMARY_STORE,
      loggerPrefix: 'last-success-store',
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
        loggerPrefix: 'last-success-store',
      }
    ),
    shadowRead: parseShadowToggle(process.env.STORAGE_SHADOW_READ_OPS_LAST_SUCCESS, {
      envName: 'STORAGE_SHADOW_READ_OPS_LAST_SUCCESS',
      fallback: false,
      loggerPrefix: 'last-success-store',
    }),
    shadowWrite: parseShadowToggle(process.env.STORAGE_SHADOW_WRITE_OPS_LAST_SUCCESS, {
      envName: 'STORAGE_SHADOW_WRITE_OPS_LAST_SUCCESS',
      fallback: false,
      loggerPrefix: 'last-success-store',
    }),
  }
}

const lastSuccessStore = createSingletonStore({
  keyspaceId: 'ops.last_success',
  loggerPrefix: 'last-success-store',
  resolveDescriptor: ({ scope, date, accessOverride }) =>
    resolveScopeDescriptor(scope, date, accessOverride),
  resolveStoragePolicy,
})

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
  return lastSuccessStore.read(
    {
      scope,
      date,
      accessOverride: options.accessOverride,
    },
    options
  )
}

export async function writeLastSuccess(scope, date, payload, options = {}) {
  return lastSuccessStore.write(
    {
      scope,
      date,
      accessOverride: options.accessOverride,
    },
    payload,
    options
  )
}
