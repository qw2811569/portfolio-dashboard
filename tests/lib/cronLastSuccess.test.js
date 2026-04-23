import { describe, expect, it, vi } from 'vitest'
import {
  countElapsedCalendarDays,
  markCronFailure,
  writeLastSuccessMarker,
} from '../../src/lib/cronLastSuccess.js'

describe('src/lib/cronLastSuccess.js', () => {
  it('counts elapsed calendar days in Taipei market time', () => {
    expect(countElapsedCalendarDays('2026-04-20T19:10:00.000Z', '2026-04-22T03:10:00.000Z')).toBe(1)
  })

  it('writes a daily cadence marker using calendar-day lateness', async () => {
    const putImpl = vi.fn(async () => undefined)

    const payload = await writeLastSuccessMarker('daily-snapshot', {
      token: 'blob-token',
      now: new Date('2026-04-24T03:00:00+08:00'),
      expectedCadence: 'daily',
      maxDayGap: 1,
      previousMarker: {
        lastSuccessAt: '2026-04-22T03:00:00+08:00',
      },
      putImpl,
      access: 'private',
      logger: { warn: vi.fn() },
    })

    expect(payload).toMatchObject({
      job: 'daily-snapshot',
      expectedCadence: 'daily',
      lastAttemptStatus: 'success',
      lateness: {
        late: true,
        elapsedDays: 2,
      },
    })
    expect(putImpl).toHaveBeenCalledWith(
      'last-success-daily-snapshot.json',
      expect.any(String),
      expect.objectContaining({
        token: 'blob-token',
        access: 'private',
      })
    )
  })

  it('preserves the previous success timestamp when marking a failed attempt', async () => {
    const getImpl = vi.fn(async () => ({
      stream: new Response(
        JSON.stringify({
          job: 'daily-snapshot',
          lastSuccessAt: '2026-04-24T03:00:00.000+08:00',
        })
      ).body,
    }))
    const putImpl = vi.fn(async () => undefined)

    const payload = await markCronFailure('daily-snapshot', {
      token: 'blob-token',
      now: new Date('2026-04-25T03:00:00+08:00'),
      expectedCadence: 'daily',
      access: 'private',
      getImpl,
      putImpl,
      logger: { warn: vi.fn() },
      error: new Error('blob write failed'),
    })

    expect(payload).toMatchObject({
      job: 'daily-snapshot',
      lastSuccessAt: '2026-04-24T03:00:00.000+08:00',
      lastAttemptStatus: 'failed',
      error: 'blob write failed',
    })
  })
})
