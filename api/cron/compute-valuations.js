import { list, put } from '@vercel/blob'
import { getPrivateBlobToken } from '../_lib/blob-tokens.js'
import { loadLocalEnvIfPresent } from '../_lib/local-env.js'
import { markCronSuccess } from '../../src/lib/cronLastSuccess.js'
import { fetchHistoricalPerBandValuation } from '../../src/lib/dataAdapters/finmindValuationAdapter.js'
import {
  isAuthorized,
  isSkippedInstrumentType,
  loadTrackedStocks,
  resolveRequestOrigin,
} from './collect-target-prices.js'

const VALUATION_PREFIX = 'valuation'
const PROCESSING_PAUSE_MS = 150

function getBlobToken() {
  return getPrivateBlobToken()
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function putValuationSnapshot(
  code,
  snapshot,
  { token = getBlobToken(), putImpl = put } = {}
) {
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for valuation writes')
  }

  await putImpl(`${VALUATION_PREFIX}/${code}.json`, JSON.stringify(snapshot, null, 2), {
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    access: 'private',
    contentType: 'application/json',
  })
}

export async function collectValuationSnapshots({
  trackedStocks = [],
  now = new Date(),
  pauseMs = PROCESSING_PAUSE_MS,
  sleepFn = sleep,
  computeSnapshot = (code, options) => fetchHistoricalPerBandValuation(code, options),
  writeSnapshot = (code, snapshot) => putValuationSnapshot(code, snapshot),
  logger = console,
} = {}) {
  const eligibleStocks = (Array.isArray(trackedStocks) ? trackedStocks : []).filter(
    (stock) => !isSkippedInstrumentType(stock.type)
  )
  const summary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: (Array.isArray(trackedStocks) ? trackedStocks : []).length - eligibleStocks.length,
  }

  for (const stock of eligibleStocks) {
    summary.processed += 1
    logger.info(
      `[compute-valuations] ${summary.processed}/${eligibleStocks.length} start ${stock.code} ${stock.name}`
    )

    try {
      const snapshot = await computeSnapshot(stock.code, { now, forceFresh: true })
      await writeSnapshot(stock.code, snapshot)
      summary.succeeded += 1
      logger.info(
        `[compute-valuations] ${stock.code} saved method=${snapshot.method} samples=${snapshot.sampleSize} confidence=${snapshot.confidence}`
      )
    } catch (error) {
      summary.failed += 1
      logger.error(`[compute-valuations] ${stock.code} failed:`, error)
    }

    if (summary.processed < eligibleStocks.length && pauseMs > 0) {
      await sleepFn(pauseMs)
    }
  }

  return summary
}

export default async function handler(req, res) {
  loadLocalEnvIfPresent()

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const origin = resolveRequestOrigin(req)
    const { trackedStocks } = await loadTrackedStocks({ logger: console, origin })
    const summary = await collectValuationSnapshots({
      trackedStocks,
      logger: console,
    })

    await markCronSuccess('compute-valuations', {
      token: getBlobToken(),
      access: 'private',
      listImpl: list,
      putImpl: put,
      logger: console,
    })

    return res.status(200).json(summary)
  } catch (error) {
    console.error('[compute-valuations] handler failed:', error)
    return res.status(500).json({ error: error?.message || 'compute valuations failed' })
  }
}
