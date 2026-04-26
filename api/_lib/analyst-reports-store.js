import { createSingletonStore } from './singleton-store.js'

const ANALYST_REPORTS_PREFIX = 'analyst-reports'

function normalizeCode(code) {
  const normalized = String(code || '')
    .trim()
    .toUpperCase()
  if (!normalized) throw new Error('[analyst-reports-store] code is required')
  return normalized
}

export function getAnalystReportsSnapshotKey(code) {
  return `${ANALYST_REPORTS_PREFIX}/${normalizeCode(code)}.json`
}

export const analystReportsStore = createSingletonStore({
  keyspaceId: 'report.analyst_reports',
  loggerPrefix: 'analyst-reports-store',
  envPrefix: 'ANALYST_REPORTS',
  access: 'public',
  bucketClass: 'public',
  contentType: 'application/json',
  cacheControl: 'public, max-age=0, must-revalidate',
  format: 'json',
  readMethod: 'list-fetch',
  vercelKey: ({ code }) => getAnalystReportsSnapshotKey(code),
})

export async function readAnalystReportsSnapshot(code, options = {}) {
  return analystReportsStore.read({ code }, options)
}

export async function writeAnalystReportsSnapshot(code, payload, options = {}) {
  return analystReportsStore.write({ code }, payload, options)
}
