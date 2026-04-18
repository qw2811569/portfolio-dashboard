import { describe, expect, it } from 'vitest'
import {
  buildPriceDeviationBadgeMeta,
  calculatePriceDeviation,
  resolveHoldingTargetCount,
  resolveHoldingTargetPrice,
} from '../../src/lib/priceDeviation.js'

describe('lib/priceDeviation', () => {
  it('returns aligned when deviation is below 10%', () => {
    expect(
      calculatePriceDeviation({
        currentPrice: 100,
        targetPrice: 108,
        count: 3,
      })
    ).toEqual({
      deviation: 0.08,
      level: 'aligned',
      count: 3,
    })
  })

  it('returns moderate upside at 12%', () => {
    expect(
      calculatePriceDeviation({
        currentPrice: 100,
        targetPrice: 112,
        count: 2,
      })
    ).toEqual({
      deviation: 0.12,
      level: 'moderate',
      count: 2,
    })
  })

  it('returns moderate downside at 12%', () => {
    expect(
      calculatePriceDeviation({
        currentPrice: 100,
        targetPrice: 88,
        count: 4,
      })
    ).toEqual({
      deviation: -0.12,
      level: 'moderate',
      count: 4,
    })
  })

  it('returns significant upside at 25%', () => {
    expect(
      calculatePriceDeviation({
        currentPrice: 100,
        targetPrice: 125,
        count: 2,
      })
    ).toEqual({
      deviation: 0.25,
      level: 'significant',
      count: 2,
    })
  })

  it('returns significant downside at 30%', () => {
    expect(
      calculatePriceDeviation({
        currentPrice: 100,
        targetPrice: 70,
        count: 5,
      })
    ).toEqual({
      deviation: -0.3,
      level: 'significant',
      count: 5,
    })
  })

  it('returns no_consensus when count is 1', () => {
    expect(
      calculatePriceDeviation({
        currentPrice: 100,
        targetPrice: 130,
        count: 1,
      })
    ).toEqual({
      deviation: 0.3,
      level: 'no_consensus',
      count: 1,
    })
  })

  it('prefers targetMeanPrice and flexible count fields when building badge meta', () => {
    expect(resolveHoldingTargetPrice({ targetMeanPrice: 640, targetPrice: 620 })).toBe(640)
    expect(resolveHoldingTargetCount({ firmsCount: 6 })).toBe(6)

    expect(
      buildPriceDeviationBadgeMeta({
        price: 500,
        targetMeanPrice: 625,
        firmsCount: 6,
      })
    ).toMatchObject({
      level: 'significant',
      tone: 'positive-strong',
      text: '+25% 大幅低估 ⚠️',
    })
  })

  it('returns null badge meta when price deviation is aligned or missing', () => {
    expect(
      buildPriceDeviationBadgeMeta({
        price: 500,
        targetPrice: 540,
        targetPriceCount: 4,
      })
    ).toBeNull()

    expect(
      buildPriceDeviationBadgeMeta({
        price: 500,
      })
    ).toBeNull()
  })
})
