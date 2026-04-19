import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { get } from '@vercel/blob'

import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'
import { isSkippedInstrumentType, loadTrackedStocks } from '../api/cron/collect-target-prices.js'
import { isCronTargetUsable } from '../src/lib/dataAdapters/cronTargetsAdapter.js'

const TARGET_PRICE_THRESHOLD = 0.8
const FALLBACK_TARGET_PRICE_THRESHOLD = 0.75
const VALUATION_THRESHOLD = 0.95
const TRACKED_STOCKS_LIVE_SYNC_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const TARGET_PRICE_PREFIX = 'target-prices/'
const VALUATION_PREFIX = 'valuation/'
const STATUS_DIR = path.resolve('docs/status')
const ALERTS_PATH = path.resolve('coordination/llm-bus/alerts.jsonl')
const FALLBACK_TRACKED_SOURCES = new Set([
  'seedData-fallback',
  'snapshot-derived',
  'legacy-global-blob',
])

function toPercent(value) {
  return `${(value * 100).toFixed(1)}%`
}

function toMarketDate(value = new Date()) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolveTargetThreshold(trackedSource, explicitThreshold) {
  if (Number.isFinite(explicitThreshold) && explicitThreshold > 0 && explicitThreshold <= 1) {
    return explicitThreshold
  }

  if (FALLBACK_TRACKED_SOURCES.has(trackedSource)) {
    return FALLBACK_TARGET_PRICE_THRESHOLD
  }

  return TARGET_PRICE_THRESHOLD
}

function readAggregate(snapshot) {
  if (
    snapshot?.targets?.aggregate &&
    typeof snapshot.targets.aggregate === 'object' &&
    !Array.isArray(snapshot.targets.aggregate)
  ) {
    return snapshot.targets.aggregate
  }

  const aggregateItem = Array.isArray(snapshot?.analystReports?.items)
    ? snapshot.analystReports.items.find(
        (item) =>
          item?.source === 'cnyes_aggregate' ||
          item?.source === 'cmoney_aggregate' ||
          item?.targetType === 'aggregate'
      )
    : null

  if (
    aggregateItem?.aggregate &&
    typeof aggregateItem.aggregate === 'object' &&
    !Array.isArray(aggregateItem.aggregate)
  ) {
    return aggregateItem.aggregate
  }

  return aggregateItem ? { source: aggregateItem.source || 'aggregate' } : null
}

function getTargetCoverage(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { state: 'missing', stale: false, reportCount: 0, updatedAt: null }
  }

  const reports = Array.isArray(snapshot?.targets?.reports) ? snapshot.targets.reports : []
  const aggregate = readAggregate(snapshot)
  const updatedAt = snapshot?.targets?.updatedAt || snapshot?.collectedAt || null
  const stale = isCronTargetUsable(
    {
      targets: {
        updatedAt,
      },
    },
    { now: new Date() }
  )
    ? false
    : Boolean(updatedAt)

  if (reports.length > 0) {
    return {
      state: 'firm',
      stale,
      reportCount: reports.length,
      updatedAt,
    }
  }

  if (aggregate) {
    return {
      state: 'aggregate-only',
      stale,
      reportCount: 0,
      updatedAt,
    }
  }

  return { state: 'missing', stale: false, reportCount: 0, updatedAt }
}

function getValuationCoverage(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { state: 'missing', covered: false, updatedAt: null }
  }

  const method = String(snapshot?.method || '').trim()
  const updatedAt = String(snapshot?.computedAt || '').trim() || null

  if (method === 'historical-per-band') {
    return { state: 'historical-per-band', covered: true, updatedAt }
  }

  if (method === 'eps-negative') {
    return { state: 'eps-negative', covered: true, updatedAt }
  }

  if (method === 'insufficient-data') {
    return { state: 'insufficient-data', covered: true, updatedAt }
  }

  return { state: 'missing', covered: false, updatedAt }
}

function evaluateTrackedStocksGate({ trackedSource, trackedLastSyncedAt, now = new Date() }) {
  if (trackedSource === 'live-sync') {
    const syncedAt = Date.parse(String(trackedLastSyncedAt || ''))
    if (!Number.isFinite(syncedAt)) {
      return {
        fail: true,
        status: 'FAIL',
        reason: 'live-sync missing last-synced timestamp',
      }
    }

    const ageMs = Math.max(0, new Date(now).getTime() - syncedAt)
    if (ageMs > TRACKED_STOCKS_LIVE_SYNC_MAX_AGE_MS) {
      return {
        fail: true,
        status: 'FAIL',
        reason: `live-sync older than ${Math.round(TRACKED_STOCKS_LIVE_SYNC_MAX_AGE_MS / (24 * 60 * 60 * 1000))} days`,
      }
    }

    return {
      fail: false,
      status: 'PASS',
      reason: 'live-sync within freshness window',
    }
  }

  if (trackedSource === 'seedData-fallback') {
    return { fail: false, status: 'WARN', reason: 'using seedData fallback' }
  }

  if (trackedSource === 'snapshot-derived') {
    return { fail: false, status: 'WARN', reason: 'using snapshot-derived fallback' }
  }

  if (trackedSource === 'legacy-global-blob') {
    return { fail: false, status: 'WARN', reason: 'using legacy global tracked-stocks blob' }
  }

  return { fail: false, status: 'PASS', reason: 'tracked stocks source not gated' }
}

function evaluateTargetGate({
  coverageRate,
  targetThreshold,
  referenceCoverageRate,
  referenceThreshold,
}) {
  if (coverageRate >= targetThreshold) {
    return { status: 'PASS', fail: false, reason: 'target coverage threshold met' }
  }

  if (referenceCoverageRate >= referenceThreshold) {
    return {
      status: 'WARN',
      fail: false,
      reason: 'valuation fallback covers target gaps',
    }
  }

  return {
    status: 'FAIL',
    fail: true,
    reason: 'target coverage below threshold and fallback coverage is insufficient',
  }
}

async function readSnapshotMap(trackedStocks, token, prefix) {
  const snapshotMap = new Map()

  for (const stock of trackedStocks) {
    const code = String(stock?.code || '').trim()
    if (!code) continue

    const blobResult = await get(`${prefix}${code}.json`, {
      access: 'private',
      token,
      useCache: false,
    })
    if (!blobResult) {
      snapshotMap.set(code, null)
      continue
    }

    try {
      snapshotMap.set(code, await new Response(blobResult.stream).json())
    } catch {
      snapshotMap.set(code, null)
    }
  }

  return snapshotMap
}

function renderMarkdownReport({
  now,
  trackedSource,
  trackedLastSyncedAt,
  summary,
  rows,
  targetThreshold,
  valuationThreshold = VALUATION_THRESHOLD,
}) {
  const generatedAt = new Date(now).toISOString()
  const reportRows = rows
    .map(
      (row) =>
        `| ${row.code} | ${row.name} | ${row.targetCoverageState} | ${row.targetReportCount} | ${row.targetStale ? 'yes' : 'no'} | ${row.valuationState} | ${row.targetUpdatedAt || '-'} | ${row.valuationUpdatedAt || '-'} |`
    )
    .join('\n')

  return [
    `# Data Coverage Audit ${toMarketDate(now)}`,
    '',
    `Generated at: ${generatedAt}`,
    `Tracked source: ${trackedSource}`,
    `Tracked last synced: ${trackedLastSyncedAt || '-'}`,
    '',
    '## Summary',
    '',
    `- Eligible stocks: ${summary.total}`,
    `- Target-price coverage: ${summary.target.covered}/${summary.total} (${toPercent(summary.target.coverageRate)})`,
    `- Target-price firm-level: ${summary.target.firmCovered}/${summary.total} (${toPercent(summary.target.firmCoverageRate)})`,
    `- Target-price aggregate-only: ${summary.target.aggregateOnly}/${summary.total} (${toPercent(summary.target.aggregateCoverageRate)})`,
    `- Target-price missing: ${summary.target.missing}/${summary.total} (${toPercent(summary.target.missingCoverageRate)})`,
    `- Target-price stale: ${summary.target.stale}/${summary.total} (${toPercent(summary.target.staleRate)})`,
    `- Price-reference coverage: ${summary.reference.covered}/${summary.total} (${toPercent(summary.reference.coverageRate)})`,
    `- Price-reference both target+valuation: ${summary.reference.both}/${summary.total} (${toPercent(summary.reference.bothRate)})`,
    `- Price-reference target-only: ${summary.reference.targetOnly}/${summary.total} (${toPercent(summary.reference.targetOnlyRate)})`,
    `- Price-reference valuation-only: ${summary.reference.valuationOnly}/${summary.total} (${toPercent(summary.reference.valuationOnlyRate)})`,
    `- Price-reference missing both: ${summary.reference.missing}/${summary.total} (${toPercent(summary.reference.missingCoverageRate)})`,
    `- Valuation coverage: ${summary.valuation.covered}/${summary.total} (${toPercent(summary.valuation.coverageRate)})`,
    `- Valuation historical band: ${summary.valuation.historicalPerBand}/${summary.total} (${toPercent(summary.valuation.historicalPerBandRate)})`,
    `- Valuation EPS negative: ${summary.valuation.epsNegative}/${summary.total} (${toPercent(summary.valuation.epsNegativeRate)})`,
    `- Valuation insufficient data: ${summary.valuation.insufficientData}/${summary.total} (${toPercent(summary.valuation.insufficientDataRate)})`,
    `- Valuation missing: ${summary.valuation.missing}/${summary.total} (${toPercent(summary.valuation.missingCoverageRate)})`,
    `- Tracked source gate: ${summary.tracked.status} (${summary.tracked.reason})`,
    `- Target gate: coverage >= ${toPercent(targetThreshold)} => ${summary.targetGate.status} (${summary.targetGate.reason})`,
    `- Reference gate: coverage >= ${toPercent(valuationThreshold)} => ${summary.reference.coverageRate >= valuationThreshold ? 'PASS' : 'FAIL'}`,
    `- Valuation gate: coverage >= ${toPercent(valuationThreshold)} => ${summary.valuation.coverageRate >= valuationThreshold ? 'PASS' : 'FAIL'}`,
    `- Overall gate: ${summary.passed ? 'PASS' : 'FAIL'}`,
    '',
    '## Stocks',
    '',
    '| Code | Name | Target Coverage | Reports | Target Stale | Valuation | Target Updated At | Valuation Updated At |',
    '| --- | --- | --- | ---: | --- | --- | --- | --- |',
    reportRows,
    '',
  ].join('\n')
}

function appendCoverageAlert({ now, trackedSource, metric, threshold, actual, summary }) {
  mkdirSync(path.dirname(ALERTS_PATH), { recursive: true })
  const payload = {
    type: 'data-coverage-alert',
    source: 'audit-data-coverage',
    createdAt: new Date(now).toISOString(),
    metric,
    threshold,
    actual: Number(actual.toFixed(4)),
    trackedSource,
    summary,
  }

  appendFileSync(ALERTS_PATH, `${JSON.stringify(payload)}\n`, 'utf8')
}

export async function auditDataCoverage({
  now = new Date(),
  targetThreshold,
  valuationThreshold = VALUATION_THRESHOLD,
} = {}) {
  loadLocalEnvIfPresent()

  const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for audit-data-coverage')
  }

  const {
    trackedStocks,
    source: trackedSource,
    lastSyncedAt: trackedLastSyncedAt,
  } = await loadTrackedStocks({
    token,
    logger: { info() {}, warn() {}, error() {} },
  })
  const eligibleStocks = trackedStocks.filter((stock) => !isSkippedInstrumentType(stock.type))
  const [targetSnapshotMap, valuationSnapshotMap] = await Promise.all([
    readSnapshotMap(eligibleStocks, token, TARGET_PRICE_PREFIX),
    readSnapshotMap(eligibleStocks, token, VALUATION_PREFIX),
  ])

  const rows = eligibleStocks
    .map((stock) => {
      const targetCoverage = getTargetCoverage(targetSnapshotMap.get(stock.code) || null)
      const valuationCoverage = getValuationCoverage(valuationSnapshotMap.get(stock.code) || null)

      return {
        code: stock.code,
        name: stock.name,
        targetCoverageState: targetCoverage.state,
        targetReportCount: targetCoverage.reportCount,
        targetStale: targetCoverage.stale,
        targetUpdatedAt: targetCoverage.updatedAt,
        valuationState: valuationCoverage.state,
        valuationUpdatedAt: valuationCoverage.updatedAt,
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code, 'en'))

  const total = rows.length
  const safeTotal = total || 1

  const target = {
    firmCovered: rows.filter((row) => row.targetCoverageState === 'firm').length,
    aggregateOnly: rows.filter((row) => row.targetCoverageState === 'aggregate-only').length,
    missing: rows.filter((row) => row.targetCoverageState === 'missing').length,
    stale: rows.filter((row) => row.targetStale).length,
  }
  target.covered = target.firmCovered + target.aggregateOnly
  target.coverageRate = target.covered / safeTotal
  target.firmCoverageRate = target.firmCovered / safeTotal
  target.aggregateCoverageRate = target.aggregateOnly / safeTotal
  target.missingCoverageRate = target.missing / safeTotal
  target.staleRate = target.stale / safeTotal

  const valuation = {
    historicalPerBand: rows.filter((row) => row.valuationState === 'historical-per-band').length,
    epsNegative: rows.filter((row) => row.valuationState === 'eps-negative').length,
    insufficientData: rows.filter((row) => row.valuationState === 'insufficient-data').length,
    missing: rows.filter((row) => row.valuationState === 'missing').length,
  }
  valuation.covered =
    valuation.historicalPerBand + valuation.epsNegative + valuation.insufficientData
  valuation.coverageRate = valuation.covered / safeTotal
  valuation.historicalPerBandRate = valuation.historicalPerBand / safeTotal
  valuation.epsNegativeRate = valuation.epsNegative / safeTotal
  valuation.insufficientDataRate = valuation.insufficientData / safeTotal
  valuation.missingCoverageRate = valuation.missing / safeTotal
  const reference = {
    both: rows.filter(
      (row) => row.targetCoverageState !== 'missing' && row.valuationState !== 'missing'
    ).length,
    targetOnly: rows.filter(
      (row) => row.targetCoverageState !== 'missing' && row.valuationState === 'missing'
    ).length,
    valuationOnly: rows.filter(
      (row) => row.targetCoverageState === 'missing' && row.valuationState !== 'missing'
    ).length,
    missing: rows.filter(
      (row) => row.targetCoverageState === 'missing' && row.valuationState === 'missing'
    ).length,
  }
  reference.covered = reference.both + reference.targetOnly + reference.valuationOnly
  reference.coverageRate = reference.covered / safeTotal
  reference.bothRate = reference.both / safeTotal
  reference.targetOnlyRate = reference.targetOnly / safeTotal
  reference.valuationOnlyRate = reference.valuationOnly / safeTotal
  reference.missingCoverageRate = reference.missing / safeTotal
  const tracked = evaluateTrackedStocksGate({
    trackedSource,
    trackedLastSyncedAt,
    now,
  })
  const effectiveTargetThreshold = resolveTargetThreshold(trackedSource, targetThreshold)
  const targetGate = evaluateTargetGate({
    coverageRate: target.coverageRate,
    targetThreshold: effectiveTargetThreshold,
    referenceCoverageRate: reference.coverageRate,
    referenceThreshold: valuationThreshold,
  })

  const summary = {
    total,
    target,
    reference,
    valuation,
    tracked: {
      source: trackedSource,
      lastSyncedAt: trackedLastSyncedAt,
      status: tracked.status,
      reason: tracked.reason,
    },
    targetGate,
    passed:
      reference.coverageRate >= valuationThreshold &&
      valuation.coverageRate >= valuationThreshold &&
      !targetGate.fail &&
      !tracked.fail,
  }

  mkdirSync(STATUS_DIR, { recursive: true })
  const reportPath = path.join(STATUS_DIR, `data-coverage-${toMarketDate(now)}.md`)
  writeFileSync(
    reportPath,
    renderMarkdownReport({
      now,
      trackedSource,
      trackedLastSyncedAt,
      summary,
      rows,
      targetThreshold: effectiveTargetThreshold,
      valuationThreshold,
    }),
    'utf8'
  )

  return {
    trackedSource,
    trackedLastSyncedAt,
    summary,
    rows,
    reportPath,
    targetThreshold: effectiveTargetThreshold,
    valuationThreshold,
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  try {
    const result = await auditDataCoverage()
    console.log(
      JSON.stringify(
        {
          ok: result.summary.passed,
          trackedSource: result.trackedSource,
          trackedLastSyncedAt: result.trackedLastSyncedAt,
          targetThreshold: result.targetThreshold,
          valuationThreshold: result.valuationThreshold,
          summary: result.summary,
          reportPath: result.reportPath,
        },
        null,
        2
      )
    )

    if (result.summary.target.coverageRate < result.targetThreshold) {
      appendCoverageAlert({
        now: new Date(),
        trackedSource: result.trackedSource,
        metric: 'target-price-coverage',
        threshold: result.targetThreshold,
        actual: result.summary.target.coverageRate,
        summary: {
          gateStatus: result.summary.targetGate.status,
          gateReason: result.summary.targetGate.reason,
          total: result.summary.total,
          covered: result.summary.target.covered,
          firmCovered: result.summary.target.firmCovered,
          aggregateOnly: result.summary.target.aggregateOnly,
          missing: result.summary.target.missing,
          stale: result.summary.target.stale,
        },
      })
      if (result.summary.targetGate.fail) {
        process.exitCode = 1
      }
    }

    if (result.summary.reference.coverageRate < result.valuationThreshold) {
      appendCoverageAlert({
        now: new Date(),
        trackedSource: result.trackedSource,
        metric: 'price-reference-coverage',
        threshold: result.valuationThreshold,
        actual: result.summary.reference.coverageRate,
        summary: {
          total: result.summary.total,
          covered: result.summary.reference.covered,
          both: result.summary.reference.both,
          targetOnly: result.summary.reference.targetOnly,
          valuationOnly: result.summary.reference.valuationOnly,
          missing: result.summary.reference.missing,
        },
      })
      process.exitCode = 1
    }

    if (result.summary.valuation.coverageRate < VALUATION_THRESHOLD) {
      appendCoverageAlert({
        now: new Date(),
        trackedSource: result.trackedSource,
        metric: 'valuation-coverage',
        threshold: VALUATION_THRESHOLD,
        actual: result.summary.valuation.coverageRate,
        summary: {
          total: result.summary.total,
          covered: result.summary.valuation.covered,
          historicalPerBand: result.summary.valuation.historicalPerBand,
          epsNegative: result.summary.valuation.epsNegative,
          insufficientData: result.summary.valuation.insufficientData,
          missing: result.summary.valuation.missing,
        },
      })
      process.exitCode = 1
    }

    if (result.summary.tracked.status === 'FAIL') {
      appendCoverageAlert({
        now: new Date(),
        trackedSource: result.trackedSource,
        metric: 'tracked-stocks-live-sync-freshness',
        threshold: TRACKED_STOCKS_LIVE_SYNC_MAX_AGE_MS,
        actual: 1,
        summary: {
          source: result.trackedSource,
          lastSyncedAt: result.trackedLastSyncedAt,
          reason: result.summary.tracked.reason,
        },
      })
      process.exitCode = 1
    }
  } catch (error) {
    console.error(error?.message || error)
    process.exitCode = 1
  }
}
