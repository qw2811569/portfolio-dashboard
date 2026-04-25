import { createPrefixStore } from './prefix-store.js'

const SNAPSHOT_PORTFOLIO_STATE_PREFIX = 'snapshot/portfolio-state'
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDate(date) {
  const normalized = String(date || '').trim()
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error('[snapshot-portfolio-state-store] date must be YYYY-MM-DD')
  }
  return normalized
}

function normalizePortfolioId(portfolioId) {
  const normalized = String(portfolioId || '').trim()
  if (!normalized) {
    throw new Error('[snapshot-portfolio-state-store] portfolioId is required')
  }
  return normalized
}

function normalizeRelativePath(relativePath) {
  const normalized = String(relativePath || '')
    .trim()
    .replace(/^\/+/, '')
  if (!normalized) {
    throw new Error('[snapshot-portfolio-state-store] relativePath is required')
  }
  return normalized
}

export function getSnapshotPortfolioStatePrefix(date) {
  const normalizedDate = normalizeDate(date)
  return `${SNAPSHOT_PORTFOLIO_STATE_PREFIX}/${normalizedDate}/`
}

export function getSnapshotPortfolioStatePortfolioPrefix(date, portfolioId) {
  return `${getSnapshotPortfolioStatePrefix(date)}${normalizePortfolioId(portfolioId)}/`
}

export function getSnapshotPortfolioStateObjectKey(date, portfolioId, relativePath) {
  return `${getSnapshotPortfolioStatePortfolioPrefix(date, portfolioId)}${normalizeRelativePath(relativePath)}`
}

export const snapshotPortfolioStateStore = createPrefixStore({
  keyspaceId: 'snapshot.portfolio_state',
  loggerPrefix: 'snapshot-portfolio-state-store',
  envPrefix: 'SNAPSHOT_PORTFOLIO_STATE',
  bucketClass: 'private',
  access: 'private',
  vercelPrefix: `${SNAPSHOT_PORTFOLIO_STATE_PREFIX}/`,
  gcsPrefix: `${SNAPSHOT_PORTFOLIO_STATE_PREFIX}/`,
  contentType: 'application/json',
  cacheControl: 'no-store',
  format: 'json',
  useCache: false,
  metadataKey(item) {
    return item?.uploadedAt || ''
  },
})

export async function listSnapshotPortfolioStateObjects(params = {}, options = {}) {
  return snapshotPortfolioStateStore.list(params, options)
}

export async function readSnapshotPortfolioStateObject(key, options = {}) {
  return snapshotPortfolioStateStore.read(key, options)
}

export async function writeSnapshotPortfolioStateObject(key, payload, options = {}) {
  return snapshotPortfolioStateStore.write(key, payload, options)
}

export async function deleteSnapshotPortfolioStateObjects(keys, options = {}) {
  return snapshotPortfolioStateStore.deleteMany(keys, options)
}
