import { list, put } from '@vercel/blob'
import { getTaipeiClock } from './datetime.js'

const DEFAULT_WEEKDAY_SUCCESS_GAP = 1

export function getLastSuccessBlobKey(job) {
  return `last-success-${String(job || '').trim()}.json`
}

function parseMarketDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

export function countElapsedWeekdays(fromValue, toValue) {
  const from = new Date(fromValue)
  const to = new Date(toValue)
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from.getTime() >= to.getTime()
  ) {
    return 0
  }

  const fromMarketDate = parseMarketDate(getTaipeiClock(from).marketDate)
  const toMarketDate = parseMarketDate(getTaipeiClock(to).marketDate)
  if (!fromMarketDate || !toMarketDate || fromMarketDate.getTime() >= toMarketDate.getTime()) {
    return 0
  }

  const cursor = new Date(fromMarketDate.getTime())
  let elapsedWeekdays = 0

  while (cursor.getTime() < toMarketDate.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) elapsedWeekdays += 1
  }

  return elapsedWeekdays
}

export async function readLastSuccessMarker(
  job,
  { token, fetchImpl = fetch, listImpl = list, logger = console } = {}
) {
  if (!token) return null

  const key = getLastSuccessBlobKey(job)
  try {
    const { blobs } = await listImpl({ prefix: key, limit: 1, token })
    if (!Array.isArray(blobs) || blobs.length === 0) return null

    const response = await fetchImpl(blobs[0].url)
    if (!response.ok) {
      throw new Error(`marker read failed (${response.status})`)
    }

    return await response.json()
  } catch (error) {
    logger.warn(`[cron-monitor] failed to read ${key}:`, error)
    return null
  }
}

export async function writeLastSuccessMarker(
  job,
  {
    token,
    now = new Date(),
    maxWeekdayGap = DEFAULT_WEEKDAY_SUCCESS_GAP,
    previousMarker = null,
    putImpl = put,
    logger = console,
  } = {}
) {
  if (!token) {
    throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for last-success writes')
  }

  const previousSuccessAt = String(previousMarker?.lastSuccessAt || '').trim()
  const elapsedWeekdays = previousSuccessAt ? countElapsedWeekdays(previousSuccessAt, now) : 0
  const late = elapsedWeekdays > maxWeekdayGap

  if (late) {
    logger.warn(
      `[cron-monitor] lateness alert for ${job}: ${elapsedWeekdays} weekday gaps since ${previousSuccessAt}`
    )
  }

  const payload = {
    job,
    lastSuccessAt: now.toISOString(),
    expectedCadence: 'weekday-daily',
    maxWeekdayGap,
    lateness: {
      late,
      elapsedWeekdays,
      previousSuccessAt: previousSuccessAt || null,
    },
  }

  await putImpl(getLastSuccessBlobKey(job), JSON.stringify(payload, null, 2), {
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    access: 'public',
    contentType: 'application/json',
  })

  return payload
}

export async function markCronSuccess(
  job,
  {
    token,
    now = new Date(),
    fetchImpl = fetch,
    listImpl = list,
    putImpl = put,
    logger = console,
  } = {}
) {
  const previousMarker = await readLastSuccessMarker(job, { token, fetchImpl, listImpl, logger })
  return writeLastSuccessMarker(job, {
    token,
    now,
    previousMarker,
    putImpl,
    logger,
  })
}
