import path from 'node:path'

import { getTelemetryBlobToken } from './blob-tokens.js'
import { createFlatDataPathResolver, createHybridStore } from './hybrid-store.js'

export const TELEMETRY_KEY = 'telemetry-events.json'

function resolveDataPath(key = '') {
  return createFlatDataPathResolver(path.join(process.cwd(), 'data'))(key)
}

export const telemetryStore = createHybridStore({
  keyspaceId: 'telemetry',
  loggerPrefix: 'telemetry-store',
  envPrefix: 'TELEMETRY',
  localPath: (key) => resolveDataPath(String(key || '').trim()),
  vercelKey: (key) => String(key || '').trim(),
  gcsKey: (key) => String(key || '').trim(),
  bucketClass: 'public',
  authoritySource: 'local',
  promoteOnFallback: true,
  getVercelToken: getTelemetryBlobToken,
})

export async function readTelemetry(options = {}) {
  return telemetryStore.read(TELEMETRY_KEY, options)
}

export async function writeTelemetry(payload, options = {}) {
  return telemetryStore.write(TELEMETRY_KEY, payload, options)
}

export async function deleteTelemetry(options = {}) {
  return telemetryStore.delete(TELEMETRY_KEY, options)
}
