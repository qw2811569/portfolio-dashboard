import {
  ANALYSIS_HISTORY_INDEX_KEY,
  ANALYSIS_HISTORY_PREFIX,
  deleteAnalysisHistoryObject,
  getAnalysisHistoryKey,
  listAnalysisHistoryObjects,
  readAnalysisHistoryIndex,
  readAnalysisHistoryObject,
  writeAnalysisHistoryIndex,
  writeAnalysisHistoryRecord,
} from './analysis-history-store.js'

const ANALYSIS_HISTORY_LIMIT = 30

export { ANALYSIS_HISTORY_INDEX_KEY, ANALYSIS_HISTORY_PREFIX, getAnalysisHistoryKey }

export function normalizeHistoryReports(reports) {
  const byDate = new Map()
  ;(Array.isArray(reports) ? reports : []).forEach((report) => {
    if (!report || typeof report !== 'object') return
    const key = report.date ? `date:${report.date}` : `id:${report.id}`
    const prev = byDate.get(key)
    const reportId = Number(report.id) || 0
    const prevId = Number(prev?.id) || 0
    if (!prev || reportId >= prevId) {
      byDate.set(key, report)
    }
  })
  return Array.from(byDate.values())
    .sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0))
    .slice(0, ANALYSIS_HISTORY_LIMIT)
}

export async function readNormalizedAnalysisHistoryIndex(options = {}) {
  const cached = (await readAnalysisHistoryIndex(options)) || []
  if (!Array.isArray(cached) || cached.length === 0) return []

  const normalized = normalizeHistoryReports(cached)
  if (normalized.length !== cached.length) {
    await writeAnalysisHistoryIndex(normalized, options)
  }
  return normalized
}

export async function readRecentAnalysisHistory(options = {}) {
  const cached = await readNormalizedAnalysisHistoryIndex(options)
  if (cached.length > 0) return cached

  const items = await listAnalysisHistoryObjects(ANALYSIS_HISTORY_PREFIX, options)
  if (items.length === 0) return []

  const history = []
  for (const item of items
    .slice()
    .sort(
      (left, right) =>
        new Date(right?.uploadedAt || 0).getTime() - new Date(left?.uploadedAt || 0).getTime()
    )
    .slice(0, ANALYSIS_HISTORY_LIMIT)) {
    const report = await readAnalysisHistoryObject(item.key, options)
    if (report) history.push(report)
  }

  const normalized = normalizeHistoryReports(history)
  if (normalized.length > 0) {
    await writeAnalysisHistoryIndex(normalized, options)
  }
  return normalized
}

export async function updateAnalysisHistoryIndex(report, options = {}) {
  const current = (await readAnalysisHistoryIndex(options)) || []
  const next = normalizeHistoryReports([report, ...current])
  await writeAnalysisHistoryIndex(next, options)
  return next
}

export async function deleteAnalysisHistoryReportsByDate(date, keepId, options = {}) {
  if (!date) return []

  const current = (await readAnalysisHistoryIndex(options)) || []
  const sameDateReports = current.filter((item) => item?.date === date && item?.id !== keepId)

  for (const report of sameDateReports) {
    await deleteAnalysisHistoryObject(getAnalysisHistoryKey(report), options)
  }

  return sameDateReports
}

export async function deleteStoredAnalysisHistoryReport(report, options = {}) {
  if (!report?.id || !report?.date) return []

  const current = (await readAnalysisHistoryIndex(options)) || []
  const next = current.filter((item) => item.id !== report.id)

  await deleteAnalysisHistoryObject(getAnalysisHistoryKey(report), options)
  await writeAnalysisHistoryIndex(next, options)

  return next
}

export async function saveAnalysisHistoryReport(report, options = {}) {
  await deleteAnalysisHistoryReportsByDate(report?.date, report?.id, options)
  await writeAnalysisHistoryRecord(report, null, null, options)
  await updateAnalysisHistoryIndex(report, options)
}
