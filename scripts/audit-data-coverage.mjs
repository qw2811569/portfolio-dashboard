import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { list } from '@vercel/blob'

import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'
import { isSkippedInstrumentType, loadTrackedStocks } from '../api/cron/collect-target-prices.js'
import { isCronTargetUsable } from '../src/lib/dataAdapters/cronTargetsAdapter.js'

const TARGET_PRICE_THRESHOLD = 0.8
const VALUATION_THRESHOLD = 0.95
const TARGET_PRICE_PREFIX = 'target-prices/'
const VALUATION_PREFIX = 'valuation/'
const STATUS_DIR = path.resolve('docs/status')
const ALERTS_PATH = path.resolve('coordination/llm-bus/alerts.jsonl')

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

async function readSnapshotMap(trackedStocks, token, prefix) {
  const snapshotMap = new Map()

  for (const stock of trackedStocks) {
    const code = String(stock?.code || '').trim()
    if (!code) continue

    const { blobs } = await list({ prefix: `${prefix}${code}.json`, limit: 1, token })
    if (!Array.isArray(blobs) || blobs.length === 0) {
      snapshotMap.set(code, null)
      continue
    }

    const response = await fetch(blobs[0].url)
    if (!response.ok) {
      snapshotMap.set(code, null)
      continue
    }

    try {
      snapshotMap.set(code, await response.json())
    } catch {
      snapshotMap.set(code, null)
    }
  }

  return snapshotMap
}

function renderMarkdownReport({
  now,
  trackedSource,
  summary,
  rows,
  targetThreshold = TARGET_PRICE_THRESHOLD,
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
    '',
    '## Summary',
    '',
    `- Eligible stocks: ${summary.total}`,
    `- Target-price coverage: ${summary.target.covered}/${summary.total} (${toPercent(summary.target.coverageRate)})`,
    `- Target-price firm-level: ${summary.target.firmCovered}/${summary.total} (${toPercent(summary.target.firmCoverageRate)})`,
    `- Target-price aggregate-only: ${summary.target.aggregateOnly}/${summary.total} (${toPercent(summary.target.aggregateCoverageRate)})`,
    `- Target-price missing: ${summary.target.missing}/${summary.total} (${toPercent(summary.target.missingCoverageRate)})`,
    `- Target-price stale: ${summary.target.stale}/${summary.total} (${toPercent(summary.target.staleRate)})`,
    `- Valuation coverage: ${summary.valuation.covered}/${summary.total} (${toPercent(summary.valuation.coverageRate)})`,
    `- Valuation historical band: ${summary.valuation.historicalPerBand}/${summary.total} (${toPercent(summary.valuation.historicalPerBandRate)})`,
    `- Valuation EPS negative: ${summary.valuation.epsNegative}/${summary.total} (${toPercent(summary.valuation.epsNegativeRate)})`,
    `- Valuation insufficient data: ${summary.valuation.insufficientData}/${summary.total} (${toPercent(summary.valuation.insufficientDataRate)})`,
    `- Valuation missing: ${summary.valuation.missing}/${summary.total} (${toPercent(summary.valuation.missingCoverageRate)})`,
    `- Target gate: coverage >= ${toPercent(targetThreshold)} => ${summary.target.coverageRate >= targetThreshold ? 'PASS' : 'FAIL'}`,
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
  targetThreshold = TARGET_PRICE_THRESHOLD,
  valuationThreshold = VALUATION_THRESHOLD,
} = {}) {
  loadLocalEnvIfPresent()

  const token = String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
  if (!token) {
    throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for audit-data-coverage')
  }

  const { trackedStocks, source: trackedSource } = await loadTrackedStocks({
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

  const summary = {
    total,
    target,
    valuation,
    passed: target.coverageRate >= targetThreshold && valuation.coverageRate >= valuationThreshold,
  }

  mkdirSync(STATUS_DIR, { recursive: true })
  const reportPath = path.join(STATUS_DIR, `data-coverage-${toMarketDate(now)}.md`)
  writeFileSync(
    reportPath,
    renderMarkdownReport({
      now,
      trackedSource,
      summary,
      rows,
      targetThreshold,
      valuationThreshold,
    }),
    'utf8'
  )

  return { trackedSource, summary, rows, reportPath }
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
          summary: result.summary,
          reportPath: result.reportPath,
        },
        null,
        2
      )
    )

    if (result.summary.target.coverageRate < TARGET_PRICE_THRESHOLD) {
      appendCoverageAlert({
        now: new Date(),
        trackedSource: result.trackedSource,
        metric: 'target-price-coverage',
        threshold: TARGET_PRICE_THRESHOLD,
        actual: result.summary.target.coverageRate,
        summary: {
          total: result.summary.total,
          covered: result.summary.target.covered,
          firmCovered: result.summary.target.firmCovered,
          aggregateOnly: result.summary.target.aggregateOnly,
          missing: result.summary.target.missing,
          stale: result.summary.target.stale,
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
  } catch (error) {
    console.error(error?.message || error)
    process.exitCode = 1
  }
}
