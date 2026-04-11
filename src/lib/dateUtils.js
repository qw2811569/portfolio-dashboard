/**
 * Shared date utilities for dossier freshness derivation and analysis runtime.
 *
 * Parser handles the full set of formats that live in the project data:
 *   - 'YYYY/MM/DD' (most seedData / manual entries)
 *   - 'YYYY/MM'   (month-granularity fundamentals snapshots)
 *   - 'YYYY-MM-DD' (FinMind API responses)
 *   - full ISO 8601 'YYYY-MM-DDTHH:mm:ss.sssZ'
 *   - Date instances (returned as clones so callers can mutate safely)
 *
 * Rejects:
 *   - empty / null / undefined / non-string non-Date values
 *   - malformed month (0, 13+) / malformed day (32+)
 *   - unrecognized formats (returns null — no fallback to raw `new Date()`)
 */

const SLASH_DATE_REGEX = /^(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?$/
const DASH_DATE_REGEX = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z?$/

function buildUTCDate(year, month, day) {
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

export function parseFlexibleDate(input) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null
    return new Date(input.getTime())
  }
  if (typeof input !== 'string') return null

  const trimmed = input.trim()
  if (!trimmed) return null

  const slashMatch = trimmed.match(SLASH_DATE_REGEX)
  if (slashMatch) {
    const year = Number(slashMatch[1])
    const month = Number(slashMatch[2])
    const day = slashMatch[3] ? Number(slashMatch[3]) : 1
    return buildUTCDate(year, month, day)
  }

  const dashMatch = trimmed.match(DASH_DATE_REGEX)
  if (dashMatch) {
    return buildUTCDate(Number(dashMatch[1]), Number(dashMatch[2]), Number(dashMatch[3]))
  }

  const isoMatch = trimmed.match(ISO_DATE_REGEX)
  if (isoMatch) {
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }

  return null
}

export function daysBetween(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return null
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  const msPerDay = 24 * 60 * 60 * 1000
  const diffMs = Math.abs(a.getTime() - b.getTime())
  return Math.floor(diffMs / msPerDay)
}

/**
 * Compute a freshness grade ('fresh' | 'aging' | 'stale' | 'missing') from
 * a collection of date strings / Dates. The most-recent parseable date wins.
 *
 * Thresholds (Taiwan quarterly cadence, per multi-LLM consensus):
 *   ≤30 days  → 'fresh'
 *   ≤90 days  → 'aging'
 *   ≤120 days → 'stale'
 *   >120 days → 'stale' (Codex tiebreaker: old but present stays stale)
 *   none parseable → 'missing'
 */
export function computeFreshnessGrade(dates, { now = new Date() } = {}) {
  const source = Array.isArray(dates) ? dates : []
  let mostRecent = null
  for (const candidate of source) {
    const parsed = parseFlexibleDate(candidate)
    if (!parsed) continue
    if (!mostRecent || parsed.getTime() > mostRecent.getTime()) {
      mostRecent = parsed
    }
  }
  if (!mostRecent) return 'missing'
  const ageDays = daysBetween(now, mostRecent)
  if (ageDays == null) return 'missing'
  if (ageDays <= 30) return 'fresh'
  if (ageDays <= 90) return 'aging'
  return 'stale'
}
