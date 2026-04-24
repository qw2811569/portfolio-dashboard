import { get, list } from '@vercel/blob'
import { getPrivateBlobToken } from './blob-tokens.js'
import { extractBlobPathname } from './signed-url.js'

const SNAPSHOT_LOCAL_STORAGE_PREFIX = 'snapshot/localStorage-checkpoint/'

function getBlobToken() {
  return getPrivateBlobToken()
}

function extractSnapshotDate(pathname = '') {
  const match = /^snapshot\/localStorage-checkpoint\/(\d{4}-\d{2}-\d{2})\.json$/.exec(
    String(pathname || '').trim()
  )
  return match ? match[1] : ''
}

async function listAllBlobs(prefix, { token = getBlobToken(), listImpl = list } = {}) {
  if (!token) return []

  const blobs = []
  let cursor = null

  do {
    const page = await listImpl({
      prefix,
      token,
      cursor: cursor || undefined,
      limit: 1000,
    })
    blobs.push(...(Array.isArray(page?.blobs) ? page.blobs : []))
    cursor = page?.cursor || null
  } while (cursor)

  return blobs
}

async function readBlobJson(pathname, { token = getBlobToken(), getImpl = get } = {}) {
  if (!token || !pathname) return null

  try {
    const blobResult = await getImpl(pathname, {
      access: 'private',
      token,
      useCache: false,
    })
    if (!blobResult?.stream) return null
    return new Response(blobResult.stream).json()
  } catch (error) {
    if (error?.name === 'BlobNotFoundError') return null
    throw error
  }
}

function readStorageObject(payload = {}) {
  const storage =
    payload?.storage && typeof payload.storage === 'object' && !Array.isArray(payload.storage)
      ? payload.storage
      : null
  return storage || {}
}

function dedupePortfolioIds(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

function readPortfolioIds(storage = {}) {
  const declared = Array.isArray(storage?.['pf-portfolios-v1']) ? storage['pf-portfolios-v1'] : []
  const fromDeclared = declared.map((portfolio) => portfolio?.id)
  const fromKeys = Object.keys(storage)
    .map((key) => {
      const matched = /^pf-([^/]+)-(?:holding-dossiers-v1|targets-v1|fundamentals-v1)$/.exec(key)
      return matched ? matched[1] : ''
    })
    .filter(Boolean)

  return dedupePortfolioIds([...fromDeclared, ...fromKeys])
}

function readPortfolioField(storage = {}, portfolioId = '', suffix = '') {
  return storage[`pf-${portfolioId}-${suffix}`]
}

function readFallbackRecordFromStorage(storage = {}, code = '') {
  const normalizedCode = String(code || '').trim()
  if (!normalizedCode) return null

  for (const portfolioId of readPortfolioIds(storage)) {
    const holdingDossiers = Array.isArray(
      readPortfolioField(storage, portfolioId, 'holding-dossiers-v1')
    )
      ? readPortfolioField(storage, portfolioId, 'holding-dossiers-v1')
      : []
    const dossier =
      holdingDossiers.find((item) => String(item?.code || '').trim() === normalizedCode) || null

    const fundamentalsStore = readPortfolioField(storage, portfolioId, 'fundamentals-v1')
    const targetsStore = readPortfolioField(storage, portfolioId, 'targets-v1')

    const fundamentals =
      fundamentalsStore &&
      typeof fundamentalsStore === 'object' &&
      !Array.isArray(fundamentalsStore) &&
      fundamentalsStore[normalizedCode]
        ? fundamentalsStore[normalizedCode]
        : dossier?.fundamentals || null

    const targetsEntry =
      targetsStore && typeof targetsStore === 'object' && !Array.isArray(targetsStore)
        ? targetsStore[normalizedCode] || null
        : null

    if (!dossier && !fundamentals && !targetsEntry) continue

    return {
      portfolioId,
      dossier,
      fundamentals,
      targetsEntry,
    }
  }

  return null
}

function toMillis(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const parsed = Date.parse(text.replace(/\//g, '-'))
  return Number.isFinite(parsed) ? parsed : null
}

function pickLatestTimestamp(values = []) {
  let latestValue = null
  let latestMs = -Infinity

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = String(value || '').trim()
    if (!normalized) continue
    const ms = toMillis(normalized)
    if (ms == null) {
      if (!latestValue) latestValue = normalized
      continue
    }
    if (ms >= latestMs) {
      latestMs = ms
      latestValue = normalized
    }
  }

  return latestValue || null
}

function getLatestTargetDate(record = {}) {
  const dossierTargets = Array.isArray(record?.dossier?.targets) ? record.dossier.targets : []
  const entryTargets = Array.isArray(record?.targetsEntry?.reports)
    ? record.targetsEntry.reports
    : []
  return pickLatestTimestamp(
    [...dossierTargets, ...entryTargets].map((item) => String(item?.date || '').trim())
  )
}

function pickFallbackUpdatedAt(record = {}, snapshotDate = '', exportedAt = '') {
  return pickLatestTimestamp([
    record?.dossier?.fundamentals?.updatedAt,
    record?.fundamentals?.updatedAt,
    record?.targetsEntry?.updatedAt,
    getLatestTargetDate(record),
    record?.dossier?.updatedAt,
    exportedAt,
    snapshotDate ? `${snapshotDate}T00:00:00.000+08:00` : '',
  ])
}

export async function readLatestFinMindSnapshotFallback(
  code,
  { token = getBlobToken(), listImpl = list, getImpl = get } = {}
) {
  const normalizedCode = String(code || '').trim()
  if (!normalizedCode || !token) return null

  const blobs = await listAllBlobs(SNAPSHOT_LOCAL_STORAGE_PREFIX, { token, listImpl })
  const latest = blobs
    .map((blob) => {
      const pathname = extractBlobPathname(blob?.pathname || blob?.url)
      const snapshotDate = extractSnapshotDate(pathname)
      if (!pathname || !snapshotDate) return null
      return { pathname, snapshotDate, uploadedAt: String(blob?.uploadedAt || '').trim() || null }
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.snapshotDate.localeCompare(right.snapshotDate) ||
        String(left.uploadedAt || '').localeCompare(String(right.uploadedAt || ''))
    )
    .at(-1)

  if (!latest?.pathname) return null

  const payload = await readBlobJson(latest.pathname, { token, getImpl })
  const storage = readStorageObject(payload)
  const record = readFallbackRecordFromStorage(storage, normalizedCode)
  if (!record) return null

  const exportedAt = String(payload?.exportedAt || '').trim() || null

  return {
    code: normalizedCode,
    snapshotDate: latest.snapshotDate,
    snapshotPath: latest.pathname,
    uploadedAt: latest.uploadedAt,
    exportedAt,
    updatedAt: pickFallbackUpdatedAt(record, latest.snapshotDate, exportedAt),
    ...record,
  }
}
