import { readLastSuccess, writeLastSuccess } from '../../api/_lib/last-success-store.js'
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
    listImpl,
    getImpl,
    logger = console,
    access,
    readLastSuccessImpl = readLastSuccess,
  } = {}
) {
  const key = getLastSuccessBlobKey(job)

  try {
    return await readLastSuccessImpl(job, null, {
      token,
      fetchImpl,
      listImpl,
      getImpl,
      accessOverride: access,
      logger,
    })
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
    putImpl,
    logger = console,
    access,
    writeLastSuccessImpl = writeLastSuccess,
  } = {}
) {
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

  await writeLastSuccessImpl(job, null, payload, {
    token,
    putImpl,
    accessOverride: access,
    logger,
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
    listImpl,
    getImpl,
    putImpl,
    logger = console,
    access,
    readLastSuccessImpl = readLastSuccess,
    writeLastSuccessImpl = writeLastSuccess,
  } = {}
) {
  const previousMarker = await readLastSuccessMarker(job, {
    token,
    fetchImpl,
    listImpl,
    getImpl,
    logger,
    access,
    readLastSuccessImpl,
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
    writeLastSuccessImpl,
  })
}

function normalizeFailureOptions(errorOrOptions = {}, maybeOptions = undefined) {
  if (maybeOptions || errorOrOptions instanceof Error) {
    return {
      ...(maybeOptions || {}),
      error:
        maybeOptions?.error ||
        (errorOrOptions instanceof Error ? errorOrOptions : maybeOptions?.error) ||
        null,
    }
  }

  return errorOrOptions || {}
}

export async function markCronFailure(job, errorOrOptions = {}, maybeOptions = undefined) {
  const {
    token,
    now = new Date(),
    expectedCadence = 'weekday-daily',
    maxWeekdayGap = DEFAULT_WEEKDAY_SUCCESS_GAP,
    maxDayGap = DEFAULT_CALENDAR_SUCCESS_GAP,
    fetchImpl = fetch,
    listImpl,
    getImpl,
    putImpl,
    logger = console,
    access,
    error = null,
    readLastSuccessImpl = readLastSuccess,
    writeLastSuccessImpl = writeLastSuccess,
  } = normalizeFailureOptions(errorOrOptions, maybeOptions)

  const previousMarker = await readLastSuccessMarker(job, {
    token,
    fetchImpl,
    listImpl,
    getImpl,
    logger,
    access,
    readLastSuccessImpl,
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

  await writeLastSuccessImpl(job, null, payload, {
    token,
    putImpl,
    accessOverride: access,
    logger,
  })

  return payload
}
