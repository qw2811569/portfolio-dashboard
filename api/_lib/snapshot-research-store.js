import { createPrefixStore } from './prefix-store.js'

const SNAPSHOT_RESEARCH_PREFIX = 'snapshot/research'
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDate(date) {
  const normalized = String(date || '').trim()
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error('[snapshot-research-store] date must be YYYY-MM-DD')
  }
  return normalized
}

function normalizePortfolioId(portfolioId) {
  const normalized = String(portfolioId || '').trim()
  if (!normalized) {
    throw new Error('[snapshot-research-store] portfolioId is required')
  }
  return normalized
}

export function getSnapshotResearchPrefix(date) {
  const normalizedDate = normalizeDate(date)
  return `${SNAPSHOT_RESEARCH_PREFIX}/${normalizedDate}/`
}

export function getSnapshotResearchIndexKey(date) {
  return `${getSnapshotResearchPrefix(date)}research-index.json`
}

export function getSnapshotResearchPortfolioHistoryKey(date, portfolioId) {
  return `${getSnapshotResearchPrefix(date)}portfolio-${normalizePortfolioId(portfolioId)}-research-history.json`
}

export const snapshotResearchStore = createPrefixStore({
  keyspaceId: 'snapshot.research',
  loggerPrefix: 'snapshot-research-store',
  envPrefix: 'SNAPSHOT_RESEARCH',
  bucketClass: 'private',
  access: 'private',
  vercelPrefix: `${SNAPSHOT_RESEARCH_PREFIX}/`,
  gcsPrefix: `${SNAPSHOT_RESEARCH_PREFIX}/`,
  contentType: 'application/json',
  cacheControl: 'no-store',
  format: 'json',
  useCache: false,
  metadataKey(item) {
    return item?.uploadedAt || ''
  },
})

export async function listSnapshotResearchObjects(params = {}, options = {}) {
  return snapshotResearchStore.list(params, options)
}

export async function readSnapshotResearchObject(key, options = {}) {
  return snapshotResearchStore.read(key, options)
}

export async function writeSnapshotResearchObject(key, payload, options = {}) {
  return snapshotResearchStore.write(key, payload, options)
}

export async function deleteSnapshotResearchObjects(keys, options = {}) {
  return snapshotResearchStore.deleteMany(keys, options)
}
