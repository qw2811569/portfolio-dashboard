import { get, list, put } from '@vercel/blob'
import { getTaipeiClock } from './datetime.js'

const DEFAULT_WEEKDAY_SUCCESS_GAP = 1
const DEFAULT_CALENDAR_SUCCESS_GAP = 1

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

export function countElapsedCalendarDays(fromValue, toValue) {
  const fromDate = new Date(fromValue)
  const toDate = new Date(toValue)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return 0

  const from = parseMarketDate(getTaipeiClock(fromDate).marketDate)
  const to = parseMarketDate(getTaipeiClock(toDate).marketDate)
  if (!from || !to || from.getTime() >= to.getTime()) return 0

  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)))
}

export async function readLastSuccessMarker(
  job,
  {
    token,
    fetchImpl = fetch,
    listImpl = list,
    getImpl = get,
    logger = console,
    access = 'public',
  } = {}
) {
  if (!token) return null

  const key = getLastSuccessBlobKey(job)
  if (access === 'private') {
    try {
      const blobResult = await getImpl(key, {
        access: 'private',
        token,
        useCache: false,
      })
      if (!blobResult) return null
      return await new Response(blobResult.stream).json()
    } catch (error) {
      if (error?.name === 'BlobNotFoundError') return null
      logger.warn(`[cron-monitor] failed to read ${key}:`, error)
      return null
    }
  }

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
    expectedCadence = 'weekday-daily',
    maxWeekdayGap = DEFAULT_WEEKDAY_SUCCESS_GAP,
    maxDayGap = DEFAULT_CALENDAR_SUCCESS_GAP,
    previousMarker = null,
    putImpl = put,
    logger = console,
    access = 'public',
  } = {}
) {
  if (!token) {
    throw new Error('blob token is required for last-success writes')
  }

  const previousSuccessAt = String(previousMarker?.lastSuccessAt || '').trim()
  const normalizedCadence =
    expectedCadence === 'daily' || expectedCadence === 'calendar-daily' ? 'daily' : 'weekday-daily'
  const elapsedWeekdays = previousSuccessAt ? countElapsedWeekdays(previousSuccessAt, now) : 0
  const elapsedDays = previousSuccessAt ? countElapsedCalendarDays(previousSuccessAt, now) : 0
  const late =
    normalizedCadence === 'daily' ? elapsedDays > maxDayGap : elapsedWeekdays > maxWeekdayGap

  if (late) {
    logger.warn(
      normalizedCadence === 'daily'
        ? `[cron-monitor] lateness alert for ${job}: ${elapsedDays} calendar-day gaps since ${previousSuccessAt}`
        : `[cron-monitor] lateness alert for ${job}: ${elapsedWeekdays} weekday gaps since ${previousSuccessAt}`
    )
  }

  const payload = {
    job,
    lastSuccessAt: now.toISOString(),
    lastAttemptAt: now.toISOString(),
    lastAttemptStatus: 'success',
    expectedCadence: normalizedCadence,
    maxWeekdayGap,
    maxDayGap,
    lateness: {
      late,
      elapsedWeekdays,
      elapsedDays,
      previousSuccessAt: previousSuccessAt || null,
    },
  }

  await putImpl(getLastSuccessBlobKey(job), JSON.stringify(payload, null, 2), {
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    access,
    contentType: 'application/json',
  })

  return payload
}

export async function markCronSuccess(
  job,
  {
    token,
    now = new Date(),
    expectedCadence = 'weekday-daily',
    maxDayGap = DEFAULT_CALENDAR_SUCCESS_GAP,
    fetchImpl = fetch,
    listImpl = list,
    getImpl = get,
    putImpl = put,
    logger = console,
    access = 'public',
  } = {}
) {
  const previousMarker = await readLastSuccessMarker(job, {
    token,
    fetchImpl,
    listImpl,
    getImpl,
    logger,
    access,
  })
  return writeLastSuccessMarker(job, {
    token,
    now,
    expectedCadence,
    previousMarker,
    maxDayGap,
    putImpl,
    logger,
    access,
  })
}

export async function markCronFailure(
  job,
  {
    token,
    now = new Date(),
    expectedCadence = 'weekday-daily',
    maxWeekdayGap = DEFAULT_WEEKDAY_SUCCESS_GAP,
    maxDayGap = DEFAULT_CALENDAR_SUCCESS_GAP,
    fetchImpl = fetch,
    listImpl = list,
    getImpl = get,
    putImpl = put,
    logger = console,
    access = 'public',
    error = null,
  } = {}
) {
  if (!token) {
    throw new Error('blob token is required for last-success writes')
  }

  const previousMarker = await readLastSuccessMarker(job, {
    token,
    fetchImpl,
    listImpl,
    getImpl,
    logger,
    access,
  })

  const previousSuccessAt = String(previousMarker?.lastSuccessAt || '').trim() || null
  const normalizedCadence =
    expectedCadence === 'daily' || expectedCadence === 'calendar-daily' ? 'daily' : 'weekday-daily'
  const elapsedWeekdays = previousSuccessAt ? countElapsedWeekdays(previousSuccessAt, now) : 0
  const elapsedDays = previousSuccessAt ? countElapsedCalendarDays(previousSuccessAt, now) : 0

  const payload = {
    job,
    lastSuccessAt: previousSuccessAt,
    lastAttemptAt: new Date(now).toISOString(),
    lastAttemptStatus: 'failed',
    expectedCadence: normalizedCadence,
    maxWeekdayGap,
    maxDayGap,
    lateness: {
      late:
        normalizedCadence === 'daily' ? elapsedDays > maxDayGap : elapsedWeekdays > maxWeekdayGap,
      elapsedWeekdays,
      elapsedDays,
      previousSuccessAt,
    },
    error: error?.message || null,
  }

  await putImpl(getLastSuccessBlobKey(job), JSON.stringify(payload, null, 2), {
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    access,
    contentType: 'application/json',
  })

  return payload
}
