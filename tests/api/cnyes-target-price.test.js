import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchCnyesAggregate,
  normalizeCnyesAggregatePayload,
} from '../../api/_lib/cnyes-target-price.js'

describe('api/_lib/cnyes-target-price', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.useRealTimers()
  })

  it('normalizes 2330 aggregate payload with mean and consensus count', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        data: {
          symbolId: 'TWS:2330:STOCK',
          rateDate: '2026-04-13',
          feHigh: 3030,
          feLow: 1900,
          feMean: 2390.17,
          feMedian: 2352.5,
          numEst: 36,
        },
      }),
    })

    await expect(fetchCnyesAggregate('2330')).resolves.toEqual({
      source: 'cnyes',
      aggregate: {
        medianTarget: 2352.5,
        meanTarget: 2390.17,
        min: 1900,
        max: 3030,
        firmsCount: 36,
        numEst: 36,
        rateDate: '2026-04-13',
      },
      rawHtml: null,
    })
  })

  it('normalizes a single-estimate ticker', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        statusCode: 200,
        data: {
          symbolId: 'TWS:3055:STOCK',
          rateDate: '2024-05-10',
          feHigh: 50,
          feLow: 50,
          feMean: 50,
          feMedian: 50,
          numEst: 1,
        },
      }),
    })

    const result = await fetchCnyesAggregate('3055')
    expect(result.aggregate).toMatchObject({
      medianTarget: 50,
      meanTarget: 50,
      min: 50,
      max: 50,
      firmsCount: 1,
      numEst: 1,
      rateDate: '2024-05-10',
    })
  })

  it('returns no_target_data for a missing ticker', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ statusCode: 404, data: null }),
    })

    await expect(fetchCnyesAggregate('1234')).resolves.toEqual({
      source: 'cnyes',
      aggregate: null,
      reason: 'no_target_data',
    })
  })

  it('returns timeout when cnyes fetch exceeds timeoutMs', async () => {
    global.fetch.mockImplementation((_url, { signal }) => {
      expect(signal).toBeDefined()

      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('The operation was aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    })

    const promise = fetchCnyesAggregate('2330', { timeoutMs: 8000 })
    const expectation = expect(promise).resolves.toEqual({
      source: 'cnyes',
      aggregate: null,
      reason: 'timeout',
    })
    await vi.advanceTimersByTimeAsync(8000)
    await expectation
  })

  it('accepts nested payloads from targetValuation.data', () => {
    expect(
      normalizeCnyesAggregatePayload({
        data: {
          targetValuation: {
            data: {
              rateDate: '2026/04/13',
              feHigh: '100',
              feLow: '90',
              feMean: '95',
              feMedian: '96',
              numEst: 4,
            },
          },
        },
      })
    ).toEqual({
      medianTarget: 96,
      meanTarget: 95,
      min: 90,
      max: 100,
      firmsCount: 4,
      numEst: 4,
      rateDate: '2026-04-13',
    })
  })
})
