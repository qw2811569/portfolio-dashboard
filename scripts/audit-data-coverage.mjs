import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { list } from '@vercel/blob'

import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'
import { isSkippedInstrumentType, loadTrackedStocks } from '../api/cron/collect-target-prices.js'
import { isCronTargetUsable } from '../src/lib/dataAdapters/cronTargetsAdapter.js'

const AUDIT_THRESHOLD = 0.8
const TARGET_PRICE_PREFIX = 'target-prices/'
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

function getSnapshotCoverage(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { state: 'missing', stale: false, reportCount: 0, aggregate: null, updatedAt: null }
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
      aggregate,
      updatedAt,
    }
  }

  if (aggregate) {
    return {
      state: 'aggregate-only',
      stale,
      reportCount: 0,
      aggregate,
      updatedAt,
    }
  }

  return { state: 'missing', stale: false, reportCount: 0, aggregate: null, updatedAt }
}

async function readSnapshotMap(trackedStocks, token) {
  const snapshotMap = new Map()

  for (const stock of trackedStocks) {
    const code = String(stock?.code || '').trim()
    if (!code) continue

    const { blobs } = await list({ prefix: `${TARGET_PRICE_PREFIX}${code}.json`, limit: 1, token })
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

function renderMarkdownReport({ now, trackedSource, summary, rows, threshold = AUDIT_THRESHOLD }) {
  const generatedAt = new Date(now).toISOString()
  const reportRows = rows
    .map(
      (row) =>
        `| ${row.code} | ${row.name} | ${row.coverageState} | ${row.reportCount} | ${row.stale ? 'yes' : 'no'} | ${row.updatedAt || '-'} |`
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
    `- Total coverage: ${summary.covered}/${summary.total} (${toPercent(summary.coverageRate)})`,
    `- Firm-level coverage: ${summary.firmCovered}/${summary.total} (${toPercent(summary.firmCoverageRate)})`,
    `- Aggregate-only coverage: ${summary.aggregateOnly}/${summary.total} (${toPercent(summary.aggregateCoverageRate)})`,
    `- Missing coverage: ${summary.missing}/${summary.total} (${toPercent(summary.missingCoverageRate)})`,
    `- Stale snapshots: ${summary.stale}/${summary.total} (${toPercent(summary.staleRate)})`,
    `- Threshold: total coverage >= ${toPercent(threshold)}`,
    `- Gate: ${summary.coverageRate >= threshold ? 'PASS' : 'FAIL'}`,
    '',
    '## Stocks',
    '',
    '| Code | Name | Coverage | Reports | Stale | Updated At |',
    '| --- | --- | --- | ---: | --- | --- |',
    reportRows,
    '',
  ].join('\n')
}

function appendCoverageAlert({ now, trackedSource, summary, threshold = AUDIT_THRESHOLD }) {
  mkdirSync(path.dirname(ALERTS_PATH), { recursive: true })
  const payload = {
    type: 'data-coverage-alert',
    source: 'audit-data-coverage',
    createdAt: new Date(now).toISOString(),
    metric: 'target-price-coverage',
    threshold,
    actual: Number(summary.coverageRate.toFixed(4)),
    trackedSource,
    summary: {
      total: summary.total,
      covered: summary.covered,
      firmCovered: summary.firmCovered,
      aggregateOnly: summary.aggregateOnly,
      missing: summary.missing,
      stale: summary.stale,
    },
  }

  appendFileSync(ALERTS_PATH, `${JSON.stringify(payload)}\n`, 'utf8')
}

export async function auditDataCoverage({ now = new Date(), threshold = AUDIT_THRESHOLD } = {}) {
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
  const snapshotMap = await readSnapshotMap(eligibleStocks, token)

  const rows = eligibleStocks
    .map((stock) => {
      const snapshot = snapshotMap.get(stock.code) || null
      const coverage = getSnapshotCoverage(snapshot)
      return {
        code: stock.code,
        name: stock.name,
        coverageState: coverage.state,
        reportCount: coverage.reportCount,
        stale: coverage.stale,
        updatedAt: coverage.updatedAt,
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code, 'en'))

  const total = rows.length
  const firmCovered = rows.filter((row) => row.coverageState === 'firm').length
  const aggregateOnly = rows.filter((row) => row.coverageState === 'aggregate-only').length
  const covered = firmCovered + aggregateOnly
  const missing = rows.filter((row) => row.coverageState === 'missing').length
  const stale = rows.filter((row) => row.stale).length
  const safeTotal = total || 1
  const summary = {
    total,
    covered,
    firmCovered,
    aggregateOnly,
    missing,
    stale,
    coverageRate: covered / safeTotal,
    firmCoverageRate: firmCovered / safeTotal,
    aggregateCoverageRate: aggregateOnly / safeTotal,
    missingCoverageRate: missing / safeTotal,
    staleRate: stale / safeTotal,
  }

  mkdirSync(STATUS_DIR, { recursive: true })
  const reportPath = path.join(STATUS_DIR, `data-coverage-${toMarketDate(now)}.md`)
  writeFileSync(
    reportPath,
    renderMarkdownReport({ now, trackedSource, summary, rows, threshold }),
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
          ok: result.summary.coverageRate >= AUDIT_THRESHOLD,
          trackedSource: result.trackedSource,
          summary: result.summary,
          reportPath: result.reportPath,
        },
        null,
        2
      )
    )

    if (result.summary.coverageRate < AUDIT_THRESHOLD) {
      appendCoverageAlert({
        now: new Date(),
        trackedSource: result.trackedSource,
        summary: result.summary,
      })
      process.exitCode = 1
    }
  } catch (error) {
    console.error(error?.message || error)
    process.exitCode = 1
  }
}
