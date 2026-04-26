import path from 'node:path'

import { createFlatDataPathResolver, createHybridStore } from './hybrid-store.js'

export const STRATEGY_BRAIN_KEY = 'strategy-brain.json'
export const LEGACY_EVENTS_KEY = 'events.json'
export const LEGACY_HOLDINGS_KEY = 'holdings.json'

function normalizeKey(key) {
  return String(key || '').trim()
}

function resolveDataPath(key = '') {
  return createFlatDataPathResolver(path.join(process.cwd(), 'data'))(key)
}

export const brainStore = createHybridStore({
  keyspaceId: 'brain',
  loggerPrefix: 'brain-store',
  envPrefix: 'BRAIN',
  localPath: (key) => resolveDataPath(normalizeKey(key)),
  vercelKey: (key) => normalizeKey(key),
  gcsKey: (key) => normalizeKey(key),
  bucketClass: 'private',
  authoritySource: 'local',
  promoteOnFallback: true,
})

export const portfolioEventsStore = createHybridStore({
  keyspaceId: 'portfolio_events',
  loggerPrefix: 'portfolio-events-store',
  envPrefix: 'PORTFOLIO_EVENTS',
  localPath: (key) => resolveDataPath(normalizeKey(key)),
  vercelKey: (key) => normalizeKey(key),
  gcsKey: (key) => normalizeKey(key),
  bucketClass: 'private',
  authoritySource: 'local',
  promoteOnFallback: true,
})

export const portfolioHoldingsStore = createHybridStore({
  keyspaceId: 'portfolio_holdings',
  loggerPrefix: 'portfolio-holdings-store',
  envPrefix: 'PORTFOLIO_HOLDINGS',
  localPath: (key) => resolveDataPath(normalizeKey(key)),
  vercelKey: (key) => normalizeKey(key),
  gcsKey: (key) => normalizeKey(key),
  bucketClass: 'private',
  authoritySource: 'local',
  promoteOnFallback: true,
})

function resolveLegacyStore(key) {
  const normalizedKey = normalizeKey(key)
  if (normalizedKey === LEGACY_EVENTS_KEY) return portfolioEventsStore
  if (normalizedKey === LEGACY_HOLDINGS_KEY) return portfolioHoldingsStore
  return brainStore
}

export async function readBrain(options = {}) {
  return brainStore.read(STRATEGY_BRAIN_KEY, options)
}

export async function writeBrain(payload, options = {}) {
  return brainStore.write(STRATEGY_BRAIN_KEY, payload, options)
}

export async function deleteBrain(options = {}) {
  return brainStore.delete(STRATEGY_BRAIN_KEY, options)
}

export async function readBrainObject(key, options = {}) {
  return resolveLegacyStore(key).read(normalizeKey(key), options)
}

export async function writeBrainObject(key, payload, options = {}) {
  return resolveLegacyStore(key).write(normalizeKey(key), payload, options)
}

export async function deleteBrainObject(key, options = {}) {
  return resolveLegacyStore(key).delete(normalizeKey(key), options)
}
