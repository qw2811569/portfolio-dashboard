import { createPrefixStore } from './prefix-store.js'

const SNAPSHOT_BRAIN_PREFIX = 'snapshot/brain'
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDate(date) {
  const normalized = String(date || '').trim()
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error('[snapshot-brain-store] date must be YYYY-MM-DD')
  }
  return normalized
}

function normalizeRelativePath(relativePath) {
  const normalized = String(relativePath || '')
    .trim()
    .replace(/^\/+/, '')
  if (!normalized) {
    throw new Error('[snapshot-brain-store] relativePath is required')
  }
  return normalized
}

export function getSnapshotBrainPrefix(date) {
  const normalizedDate = normalizeDate(date)
  return `${SNAPSHOT_BRAIN_PREFIX}/${normalizedDate}/`
}

export function getSnapshotBrainObjectKey(date, relativePath) {
  return `${getSnapshotBrainPrefix(date)}${normalizeRelativePath(relativePath)}`
}

export const snapshotBrainStore = createPrefixStore({
  keyspaceId: 'snapshot.brain',
  loggerPrefix: 'snapshot-brain-store',
  envPrefix: 'SNAPSHOT_BRAIN',
  bucketClass: 'private',
  access: 'private',
  vercelPrefix: `${SNAPSHOT_BRAIN_PREFIX}/`,
  gcsPrefix: `${SNAPSHOT_BRAIN_PREFIX}/`,
  contentType: 'application/json',
  cacheControl: 'no-store',
  format: 'json',
  useCache: false,
  metadataKey(item) {
    return item?.uploadedAt || ''
  },
})

export async function listSnapshotBrainObjects(params = {}, options = {}) {
  return snapshotBrainStore.list(params, options)
}

export async function readSnapshotBrainObject(key, options = {}) {
  return snapshotBrainStore.read(key, options)
}

export async function writeSnapshotBrainObject(key, payload, options = {}) {
  return snapshotBrainStore.write(key, payload, options)
}

export async function deleteSnapshotBrainObjects(keys, options = {}) {
  return snapshotBrainStore.deleteMany(keys, options)
}
