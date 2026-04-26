import { createSingletonStore } from './singleton-store.js'

const BENCHMARK_SNAPSHOT_PREFIX = 'snapshot/benchmark'
const BENCHMARK_SNAPSHOT_KEY_PATTERN = /^snapshot\/benchmark\/\d{4}-\d{2}-\d{2}\.json$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDate(date) {
  const normalized = String(date || '').trim()
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error('[benchmark-snapshot-store] date must be YYYY-MM-DD')
  }
  return normalized
}

export function getBenchmarkSnapshotStoreKey(date) {
  return `${BENCHMARK_SNAPSHOT_PREFIX}/${normalizeDate(date)}.json`
}

export const benchmarkSnapshotStore = createSingletonStore({
  keyspaceId: 'snapshot.benchmark',
  loggerPrefix: 'benchmark-snapshot-store',
  envPrefix: 'BENCHMARK_SNAPSHOTS',
  access: 'private',
  bucketClass: 'private',
  contentType: 'application/json',
  cacheControl: 'no-store',
  format: 'json',
  readMethod: 'get',
  useCache: false,
  vercelKey: ({ date }) => getBenchmarkSnapshotStoreKey(date),
  resolveListDescriptor: () => ({
    keyspace: 'snapshot.benchmark',
    key: BENCHMARK_SNAPSHOT_PREFIX,
    prefix: BENCHMARK_SNAPSHOT_PREFIX,
    access: 'private',
    bucketClass: 'private',
    matcher: BENCHMARK_SNAPSHOT_KEY_PATTERN,
  }),
})

export async function readBenchmarkSnapshot(date, options = {}) {
  return benchmarkSnapshotStore.read({ date }, options)
}

export async function writeBenchmarkSnapshotStore(date, payload, options = {}) {
  return benchmarkSnapshotStore.write({ date }, payload, options)
}

export async function listBenchmarkSnapshotKeys(options = {}) {
  const items = await benchmarkSnapshotStore.list({}, options)
  return items.map((item) => item.key)
}
