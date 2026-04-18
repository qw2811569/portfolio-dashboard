import {
  buildTargetPriceSnapshot,
  isSkippedInstrumentType,
  loadTrackedStocks,
  putTargetPriceSnapshot,
  sleep,
} from '../api/cron/collect-target-prices.js'
import { buildInternalAuthHeaders } from '../api/_lib/auth-middleware.js'
import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'

const DEFAULT_BASE_URL = 'http://127.0.0.1:3002'
const DEFAULT_PAUSE_MS = 250

function parseCliArgs(argv = process.argv.slice(2)) {
  const options = {}

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length).trim()
      continue
    }

    if (arg.startsWith('--pause-ms=')) {
      options.pauseMs = arg.slice('--pause-ms='.length).trim()
    }
  }

  return options
}

function printHelp() {
  console.log(`Usage:
  node scripts/backfill-target-prices.mjs [--base-url=http://127.0.0.1:3002] [--pause-ms=250]

Env:
  TARGET_PRICE_BASE_URL   Override API origin
  APP_BASE_URL            Fallback API origin
  BACKFILL_PAUSE_MS       Pause between stocks in milliseconds
  BLOB_READ_WRITE_TOKEN   Required for Blob writes`)
}

function resolveBaseUrl(cliBaseUrl = '') {
  const candidates = [
    cliBaseUrl,
    process.env.TARGET_PRICE_BASE_URL,
    process.env.APP_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return candidates[0] || DEFAULT_BASE_URL
}

async function readJsonSafely(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function fetchAnalystReports(baseUrl, stock) {
  const response = await fetch(new URL('/api/analyst-reports', baseUrl), {
    method: 'POST',
    headers: buildInternalAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      code: stock.code,
      name: stock.name,
    }),
  })

  const payload = await readJsonSafely(response)
  if (!response.ok) {
    throw new Error(
      payload?.detail || payload?.error || `analyst-reports failed (${response.status})`
    )
  }

  return payload || {}
}

async function main() {
  loadLocalEnvIfPresent()
  const cliOptions = parseCliArgs()
  if (cliOptions.help) {
    printHelp()
    return
  }

  const baseUrl = resolveBaseUrl(cliOptions.baseUrl)
  const pauseMs = Math.max(
    0,
    Number(cliOptions.pauseMs || process.env.BACKFILL_PAUSE_MS) || DEFAULT_PAUSE_MS
  )
  const { trackedStocks, source } = await loadTrackedStocks({ logger: console })
  const summary = { processed: 0, succeeded: 0, failed: 0, skipped: 0 }
  const eligibleCount = trackedStocks.filter((stock) => !isSkippedInstrumentType(stock.type)).length

  console.log(`[backfill-target-prices] source=${source} baseUrl=${baseUrl} pauseMs=${pauseMs}`)

  for (const stock of trackedStocks) {
    if (isSkippedInstrumentType(stock.type)) {
      summary.skipped += 1
      console.log(
        `[backfill-target-prices] skipped ${stock.code} ${stock.name} (${stock.type || 'unknown'})`
      )
      continue
    }

    summary.processed += 1
    console.log(
      `[backfill-target-prices] ${summary.processed}/${eligibleCount} start ${stock.code} ${stock.name}`
    )

    try {
      const analystPayload = await fetchAnalystReports(baseUrl, stock)
      const snapshot = buildTargetPriceSnapshot({ stock, analystPayload })
      await putTargetPriceSnapshot(stock.code, snapshot)
      summary.succeeded += 1
      console.log(
        `[backfill-target-prices] ${stock.code} saved (${snapshot.targets.reports.length} targets, ${snapshot.analystReports.items.length} items, source=${snapshot.targets.source}, coverage=${snapshot.targets.coverageState})`
      )
    } catch (error) {
      summary.failed += 1
      console.error(
        `[backfill-target-prices] ${stock.code} failed: ${error?.message || String(error)}`
      )
    }

    if (summary.processed < eligibleCount && pauseMs > 0) {
      await sleep(pauseMs)
    }
  }

  console.log(`[backfill-target-prices] summary ${JSON.stringify(summary)}`)
}

main().catch((error) => {
  console.error(`[backfill-target-prices] fatal: ${error?.message || String(error)}`)
  process.exitCode = 1
})
