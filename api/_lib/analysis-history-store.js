import path from 'node:path'

import { createFlatDataPathResolver, createHybridStore } from './hybrid-store.js'

export const ANALYSIS_HISTORY_PREFIX = 'analysis-history/'
export const ANALYSIS_HISTORY_INDEX_KEY = 'analysis-history-index.json'

function normalizeKey(key) {
  return String(key || '').trim()
}

function resolveDataPath(key = '') {
  return createFlatDataPathResolver(path.join(process.cwd(), 'data'))(key)
}

function normalizeReportDate(date) {
  const normalized = String(date || '').trim()
  if (!normalized) throw new Error('[analysis-history-store] date is required')
  return normalized
}

function normalizeReportId(id) {
  const normalized = String(id || '').trim()
  if (!normalized) throw new Error('[analysis-history-store] id is required')
  return normalized
}

export function getAnalysisHistoryKey(reportOrDate, reportId) {
  if (reportOrDate && typeof reportOrDate === 'object' && !Array.isArray(reportOrDate)) {
    return getAnalysisHistoryKey(reportOrDate.date, reportOrDate.id)
  }

  return `${ANALYSIS_HISTORY_PREFIX}${normalizeReportDate(reportOrDate)}-${normalizeReportId(reportId)}.json`
}

export const analysisHistoryStore = createHybridStore({
  keyspaceId: 'analysis_history',
  loggerPrefix: 'analysis-history-store',
  envPrefix: 'ANALYSIS_HISTORY',
  localPath: (key) => resolveDataPath(normalizeKey(key)),
  vercelKey: (key) => normalizeKey(key),
  gcsKey: (key) => normalizeKey(key),
  bucketClass: 'private',
  authoritySource: 'local',
  promoteOnFallback: true,
})

export async function readAnalysisHistoryObject(key, options = {}) {
  return analysisHistoryStore.read(normalizeKey(key), options)
}

export async function writeAnalysisHistoryObject(key, payload, options = {}) {
  return analysisHistoryStore.write(normalizeKey(key), payload, options)
}

export async function deleteAnalysisHistoryObject(key, options = {}) {
  return analysisHistoryStore.delete(normalizeKey(key), options)
}

export async function listAnalysisHistoryObjects(prefix = ANALYSIS_HISTORY_PREFIX, options = {}) {
  return analysisHistoryStore.list(normalizeKey(prefix), options)
}

export async function readAnalysisHistoryIndex(options = {}) {
  return readAnalysisHistoryObject(ANALYSIS_HISTORY_INDEX_KEY, options)
}

export async function writeAnalysisHistoryIndex(payload, options = {}) {
  return writeAnalysisHistoryObject(ANALYSIS_HISTORY_INDEX_KEY, payload, options)
}

export async function readAnalysisHistoryRecord(reportOrDate, reportId, options = {}) {
  return readAnalysisHistoryObject(getAnalysisHistoryKey(reportOrDate, reportId), options)
}

export async function writeAnalysisHistoryRecord(reportOrDate, reportId, payload, options = {}) {
  const key =
    reportOrDate && typeof reportOrDate === 'object' && !Array.isArray(reportOrDate)
      ? getAnalysisHistoryKey(reportOrDate)
      : getAnalysisHistoryKey(reportOrDate, reportId)

  const body =
    reportOrDate && typeof reportOrDate === 'object' && !Array.isArray(reportOrDate)
      ? reportOrDate
      : payload

  return writeAnalysisHistoryObject(key, body, options)
}

export async function deleteAnalysisHistoryRecord(reportOrDate, reportId, options = {}) {
  return deleteAnalysisHistoryObject(getAnalysisHistoryKey(reportOrDate, reportId), options)
}
