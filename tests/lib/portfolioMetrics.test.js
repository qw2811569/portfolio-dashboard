import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  calculateAnnualizedReturn,
  calculateAnnualizedReturnFromHoldings,
  calculateMaxDrawdown,
} from '../../src/lib/portfolioMetrics.js'

describe('lib/portfolioMetrics.js annualized return', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates positive annualized return for long holding periods', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T00:00:00Z'))

    const result = calculateAnnualizedReturn({
      cost: 100000,
      value: 118300,
      firstPurchaseDate: '2025-04-16',
      now: new Date(),
    })

    expect(result.status).toBe('ok')
    expect(result.holdingDays).toBeCloseTo(365, 3)
    expect(result.annualizedReturn).toBeCloseTo(0.183, 3)
  })

  it('returns insufficient period when holding days are under 30', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T00:00:00Z'))

    const result = calculateAnnualizedReturn({
      cost: 100000,
      value: 103000,
      firstPurchaseDate: '2026-04-01',
      now: new Date(),
    })

    expect(result.status).toBe('insufficient_period')
    expect(result.annualizedReturn).toBeNull()
    expect(result.holdingDays).toBeCloseTo(15, 3)
  })

  it('calculates negative annualized return for losing positions', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T00:00:00Z'))

    const result = calculateAnnualizedReturn({
      cost: 100000,
      value: 70000,
      firstPurchaseDate: '2025-04-16',
      now: new Date(),
    })

    expect(result.status).toBe('ok')
    expect(result.annualizedReturn).toBeCloseTo(-0.3, 3)
  })

  it('aggregates holdings using totalCost and earliest firstPurchaseDate', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T00:00:00Z'))

    const result = calculateAnnualizedReturnFromHoldings(
      [
        { totalCost: 60000, value: 72000, firstPurchaseDate: '2025-04-16' },
        { totalCost: 40000, value: 36000, firstPurchaseDate: '2025-07-01' },
      ],
      { now: new Date() }
    )

    expect(result.status).toBe('ok')
    expect(result.holdingDays).toBeCloseTo(365, 3)
    expect(result.annualizedReturn).toBeCloseTo(0.08, 3)
  })

  it('returns invalid cost when cost basis is zero', () => {
    const result = calculateAnnualizedReturn({
      cost: 0,
      value: 100000,
      firstPurchaseDate: '2025-04-16',
      now: new Date('2026-04-16T00:00:00Z'),
    })

    expect(result.status).toBe('invalid_cost')
    expect(result.annualizedReturn).toBeNull()
  })

  it('supports zero value as a full loss after sufficient holding time', () => {
    const result = calculateAnnualizedReturn({
      cost: 100000,
      value: 0,
      firstPurchaseDate: '2025-04-16',
      now: new Date('2026-04-16T00:00:00Z'),
    })

    expect(result.status).toBe('ok')
    expect(result.annualizedReturn).toBe(-1)
  })

  it('treats one-day holdings as insufficient period', () => {
    const result = calculateAnnualizedReturn({
      cost: 100000,
      value: 101000,
      firstPurchaseDate: '2026-04-15',
      now: new Date('2026-04-16T00:00:00Z'),
    })

    expect(result.status).toBe('insufficient_period')
    expect(result.holdingDays).toBeCloseTo(1, 3)
  })
})

describe('lib/portfolioMetrics.js max drawdown', () => {
  it('calculates max drawdown from a historical value series', () => {
    const result = calculateMaxDrawdown([
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-15', value: 120 },
      { date: '2026-02-01', value: 90 },
      { date: '2026-02-15', value: 110 },
    ])

    expect(result.status).toBe('ok')
    expect(result.maxDrawdown).toBeCloseTo(0.25, 5)
    expect(result.peakValue).toBe(120)
    expect(result.troughValue).toBe(90)
  })

  it('returns needs history when no snapshots are available', () => {
    const result = calculateMaxDrawdown()

    expect(result.status).toBe('needs_history')
    expect(result.maxDrawdown).toBeNull()
  })
})
