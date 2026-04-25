import { createSingletonStore } from './singleton-store.js'

const VALUATION_PREFIX = 'valuation'

function normalizeCode(code) {
  const normalized = String(code || '').trim()
  if (!normalized) throw new Error('[valuation-store] code is required')
  return normalized
}

export function getValuationSnapshotKey(code) {
  return `${VALUATION_PREFIX}/${normalizeCode(code)}.json`
}

export const valuationStore = createSingletonStore({
  keyspaceId: 'valuation.singleton',
  loggerPrefix: 'valuation-store',
  envPrefix: 'VALUATION',
  access: 'private',
  bucketClass: 'private',
  contentType: 'application/json',
  cacheControl: 'no-store',
  format: 'json',
  readMethod: 'get',
  useCache: false,
  vercelKey: ({ code }) => getValuationSnapshotKey(code),
})

export async function readValuationSnapshot(code, options = {}) {
  return valuationStore.read({ code }, options)
}

export async function writeValuationSnapshot(code, payload, options = {}) {
  return valuationStore.write({ code }, payload, options)
}
