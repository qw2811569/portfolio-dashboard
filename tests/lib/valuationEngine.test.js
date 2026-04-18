import { describe, expect, it } from 'vitest'

import {
  computeHistoricalPerBand,
  resolveValuationBandPosition,
} from '../../src/lib/valuationEngine.js'

function buildPerHistory(values) {
  return values.map((per, index) => ({
    date: `2026-${String((index % 12) + 1).padStart(2, '0')}-01`,
    per,
  }))
}

describe('lib/valuationEngine', () => {
  it('computes percentile bands from 60 monthly PER samples', () => {
    const result = computeHistoricalPerBand('7865', {
      perHistory: buildPerHistory(Array.from({ length: 60 }, (_, index) => index + 10)),
      epsTTM: 2,
    })

    expect(result).toMatchObject({
      method: 'historical-per-band',
      lowerBound: 43.6,
      midPoint: 79,
      upperBound: 114.4,
      perLow: 21.8,
      perMid: 39.5,
      perHigh: 57.2,
      sampleSize: 60,
      confidence: 'high',
    })
  })

  it('returns eps-negative when EPS_TTM is negative', () => {
    const result = computeHistoricalPerBand('2489', {
      perHistory: buildPerHistory(Array.from({ length: 60 }, (_, index) => index + 5)),
      epsTTM: -1.2,
    })

    expect(result).toMatchObject({
      method: 'eps-negative',
      lowerBound: null,
      midPoint: null,
      upperBound: null,
      sampleSize: 60,
    })
  })

  it('returns insufficient-data when PER sample count is below 24', () => {
    const result = computeHistoricalPerBand('4562', {
      perHistory: buildPerHistory(Array.from({ length: 23 }, (_, index) => index + 10)),
      epsTTM: 1.5,
    })

    expect(result).toMatchObject({
      method: 'insufficient-data',
      sampleSize: 23,
      confidence: 'low',
    })
  })

  it('keeps EPS 0 but trims PER outliers above 500', () => {
    const result = computeHistoricalPerBand('8074', {
      perHistory: buildPerHistory([600, ...Array.from({ length: 24 }, (_, index) => index + 10)]),
      epsTTM: 0,
    })

    expect(result).toMatchObject({
      method: 'historical-per-band',
      lowerBound: 0,
      midPoint: 0,
      upperBound: 0,
      sampleSize: 24,
      confidence: 'low',
    })
    expect(result.perHigh).toBeLessThan(500)
  })

  it('classifies current price against the computed band', () => {
    const valuation = computeHistoricalPerBand('7865', {
      perHistory: buildPerHistory(Array.from({ length: 60 }, (_, index) => index + 10)),
      epsTTM: 2,
    })

    expect(resolveValuationBandPosition(30, valuation)).toBe('below')
    expect(resolveValuationBandPosition(80, valuation)).toBe('within')
    expect(resolveValuationBandPosition(150, valuation)).toBe('above')
  })

  it('returns null position when valuation has no usable band', () => {
    const valuation = computeHistoricalPerBand('7865', {
      perHistory: [],
      epsTTM: null,
    })

    expect(resolveValuationBandPosition(50, valuation)).toBeNull()
  })
})
