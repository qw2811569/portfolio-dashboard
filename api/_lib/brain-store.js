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
  return brainStore.read(normalizeKey(key), options)
}

export async function writeBrainObject(key, payload, options = {}) {
  return brainStore.write(normalizeKey(key), payload, options)
}

export async function deleteBrainObject(key, options = {}) {
  return brainStore.delete(normalizeKey(key), options)
}
