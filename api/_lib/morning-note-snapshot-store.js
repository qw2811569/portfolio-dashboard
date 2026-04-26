import { createSingletonStore } from './singleton-store.js'

const MORNING_NOTE_SNAPSHOT_PREFIX = 'snapshot/morning-note'
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDate(date) {
  const normalized = String(date || '').trim()
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error('[morning-note-snapshot-store] date must be YYYY-MM-DD')
  }
  return normalized
}

export function getMorningNoteSnapshotStoreKey(date) {
  return `${MORNING_NOTE_SNAPSHOT_PREFIX}/${normalizeDate(date)}.json`
}

export const morningNoteSnapshotStore = createSingletonStore({
  keyspaceId: 'snapshot.morning_note',
  loggerPrefix: 'morning-note-snapshot-store',
  envPrefix: 'MORNING_NOTE',
  access: 'private',
  bucketClass: 'private',
  contentType: 'application/json',
  cacheControl: 'no-store',
  format: 'json',
  readMethod: 'get',
  useCache: false,
  vercelKey: ({ date }) => getMorningNoteSnapshotStoreKey(date),
})

export async function readMorningNoteSnapshotStore(date, options = {}) {
  return morningNoteSnapshotStore.read({ date }, options)
}

export async function writeMorningNoteSnapshotStore(date, payload, options = {}) {
  return morningNoteSnapshotStore.write({ date }, payload, options)
}
