import { createSingletonStore } from './singleton-store.js'

const TARGET_PRICES_PREFIX = 'target-prices'

function normalizeCode(code) {
  const normalized = String(code || '').trim()
  if (!normalized) throw new Error('[target-prices-store] code is required')
  return normalized
}

export function getTargetPriceSnapshotKey(code) {
  return `${TARGET_PRICES_PREFIX}/${normalizeCode(code)}.json`
}

export const targetPricesStore = createSingletonStore({
  keyspaceId: 'target_prices.singleton',
  loggerPrefix: 'target-prices-store',
  envPrefix: 'TARGET_PRICES',
  access: 'private',
  bucketClass: 'private',
  contentType: 'application/json',
  cacheControl: 'no-store',
  format: 'json',
  readMethod: 'get',
  useCache: false,
  vercelKey: ({ code }) => getTargetPriceSnapshotKey(code),
})

export async function readTargetPriceSnapshot(code, options = {}) {
  return targetPricesStore.read({ code }, options)
}

export async function writeTargetPriceSnapshot(code, payload, options = {}) {
  return targetPricesStore.write({ code }, payload, options)
}
