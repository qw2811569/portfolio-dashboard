/**
 * Cron-collected target price adapter.
 *
 * Fetches analyst target-price snapshots written by the daily cron pipeline
 * (`api/cron/collect-target-prices.js`) via the read endpoint (`api/target-prices.js`).
 *
 * Snapshot shape (from `buildTargetPriceSnapshot`):
 *   {
 *     code, name, type, collectedAt, fetchedAt, totalFound, newCount,
 *     targets: { reports: [{ firm, target, date }], updatedAt, source },
 *     analystReports: { items, fetchedAt }
 *   }
 */

const CRON_TARGET_MAX_AGE_DAYS = 30

export async function fetchCronTargets(code) {
  const res = await fetch(`/api/target-prices?code=${encodeURIComponent(code)}`)
  if (!res.ok) return null
  const snapshot = await res.json()
  if (!snapshot?.targets?.reports?.length) return null
  return snapshot
}

export function isCronTargetUsable(
  snapshot,
  { now = new Date(), maxAgeDays = CRON_TARGET_MAX_AGE_DAYS } = {}
) {
  if (!snapshot?.targets?.updatedAt) return false
  const updatedAt = new Date(snapshot.targets.updatedAt)
  if (Number.isNaN(updatedAt.getTime())) return false
  const ageDays = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  return ageDays <= maxAgeDays
}
