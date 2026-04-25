import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { list, put } from '@vercel/blob'
import { buildInternalAuthHeaders } from '../../api/_lib/auth-middleware.js'
import { getPrivateBlobToken } from '../../api/_lib/blob-tokens.js'
import { writeDailyEventsSnapshot } from '../../api/_lib/daily-events-store.js'
import { loadLocalEnvIfPresent } from '../../api/_lib/local-env.js'
import { markCronFailure, markCronSuccess } from '../../src/lib/cronLastSuccess.js'
import { INIT_HOLDINGS } from '../../src/seedData.js'
import { INIT_HOLDINGS_JINLIANCHENG } from '../../src/seedDataJinliancheng.js'

const DEFAULT_API_ORIGIN = 'http://127.0.0.1:3000'
const DEFAULT_RANGE_DAYS = 45
const JOB_NAME = 'tw-events-worker'
const PORTFOLIOS = Object.freeze([
  { key: 'me', label: '我', holdings: INIT_HOLDINGS },
  { key: '7865', label: '金聯成', holdings: INIT_HOLDINGS_JINLIANCHENG },
])

function resolveApiOrigin() {
  return (
    String(process.env.TW_EVENTS_API_ORIGIN || '').trim() ||
    String(process.env.MORNING_NOTE_API_ORIGIN || '').trim() ||
    String(process.env.INTERNAL_API_ORIGIN || '').trim() ||
    DEFAULT_API_ORIGIN
  ).replace(/\/$/, '')
}

function extractHoldingCodes(holdings = []) {
  return Array.from(
    new Set(
      (Array.isArray(holdings) ? holdings : [])
        .map((item) => String(item?.code || '').trim().match(/\d{4,6}[A-Z]?L?/i)?.[0] || '')
        .filter(Boolean)
    )
  )
}

function buildDedupeKey(event = {}) {
  return [
    String(event?.id || '').trim(),
    String(event?.date || '').trim(),
    String(event?.eventType || event?.type || '').trim(),
    String(event?.title || '').trim(),
    (Array.isArray(event?.stocks) ? event.stocks : []).join(','),
  ]
    .filter(Boolean)
    .join('|')
}

function dedupeEvents(events = []) {
  const seen = new Set()
  const rows = []
  for (const event of Array.isArray(events) ? events : []) {
    const key = buildDedupeKey(event)
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push(event)
  }
  return rows.sort((left, right) => String(left?.date || '').localeCompare(String(right?.date || '')))
}

export async function buildTwEventsSnapshot({
  origin = resolveApiOrigin(),
  rangeDays = DEFAULT_RANGE_DAYS,
  fetchImpl = fetch,
} = {}) {
  const portfolioSnapshots = []

  for (const portfolio of PORTFOLIOS) {
    const codes = extractHoldingCodes(portfolio.holdings)
    const url = new URL('/api/event-calendar', origin)
    url.searchParams.set('range', String(rangeDays))
    if (codes.length > 0) {
      url.searchParams.set('codes', codes.join(','))
    }

    const response = await fetchImpl(url, {
      headers: buildInternalAuthHeaders({ Accept: 'application/json' }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || `event-calendar failed for ${portfolio.key} (${response.status})`)
    }

    const events = Array.isArray(payload?.events) ? payload.events : []
    portfolioSnapshots.push({
      key: portfolio.key,
      label: portfolio.label,
      holdingCodes: codes,
      eventCount: events.length,
      events,
    })
  }

  const events = dedupeEvents(portfolioSnapshots.flatMap((portfolio) => portfolio.events || []))
  const generatedAt = new Date().toISOString()

  return {
    generatedAt,
    lookaheadDays: rangeDays,
    source: 'tw-events-worker',
    portfolios: portfolioSnapshots,
    stats: {
      portfolioCount: portfolioSnapshots.length,
      totalEvents: events.length,
    },
    events,
  }
}

export async function runTwEventsWorker({
  fetchImpl = fetch,
  listImpl = list,
  putImpl = put,
  logger = console,
} = {}) {
  loadLocalEnvIfPresent()

  const token = getPrivateBlobToken()
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN or PUB_BLOB_READ_WRITE_TOKEN is required')
  }

  const snapshot = await buildTwEventsSnapshot({
    fetchImpl,
  })

  await writeDailyEventsSnapshot(snapshot, {
    token,
    putImpl,
  })

  await markCronSuccess(JOB_NAME, {
    token,
    listImpl,
    putImpl,
    logger,
  })

  logger.info?.(
    `[tw-events-worker] wrote ${snapshot.stats.totalEvents} events across ${snapshot.stats.portfolioCount} portfolios`
  )

  return snapshot
}

async function main() {
  try {
    await runTwEventsWorker()
  } catch (error) {
    const token = getPrivateBlobToken()
    if (token) {
      await markCronFailure(JOB_NAME, error, {
        token,
        listImpl: list,
        putImpl: put,
        logger: console,
      }).catch(() => {})
    }
    console.error('[tw-events-worker] fatal error:', error)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main()
}
