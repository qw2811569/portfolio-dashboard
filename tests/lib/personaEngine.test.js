import { describe, it, expect } from 'vitest'
import {
  PERSONAS,
  selectPersona,
  scoreScalper,
  scoreSwing,
  scoreTrend,
  scoreValue,
  scoreByPersona,
  formatPersonaContext,
} from '../../src/lib/personaEngine.js'

describe('PERSONAS', () => {
  it('defines 4 personas with required fields', () => {
    const ids = Object.keys(PERSONAS)
    expect(ids).toEqual(['scalper', 'swing', 'trend', 'value'])

    for (const persona of Object.values(PERSONAS)) {
      expect(persona).toHaveProperty('id')
      expect(persona).toHaveProperty('label')
      expect(persona).toHaveProperty('horizon')
      expect(persona).toHaveProperty('horizonDays')
      expect(persona).toHaveProperty('knowledgeWeights')
      expect(persona).toHaveProperty('promptPrefix')
      expect(persona).toHaveProperty('scoringFactors')
    }
  })

  it('knowledge weights sum to ~1.0 for each persona', () => {
    for (const persona of Object.values(PERSONAS)) {
      const sum = Object.values(persona.knowledgeWeights).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1.0, 1)
    }
  })
})

describe('selectPersona', () => {
  it('returns scalper for warrants (6-digit code)', () => {
    expect(selectPersona({ code: '080585' })).toBe(PERSONAS.scalper)
  })

  it('returns scalper for warrant strategy', () => {
    expect(selectPersona({ strategy: '權證短打' })).toBe(PERSONAS.scalper)
  })

  it('returns scalper for warrant name containing 購/售', () => {
    expect(selectPersona({ name: '台達電購01' })).toBe(PERSONAS.scalper)
    expect(selectPersona({ name: '台達電售02' })).toBe(PERSONAS.scalper)
  })

  it('returns value for ETF codes', () => {
    expect(selectPersona({ code: '00637L' })).toBe(PERSONAS.value)
    expect(selectPersona({ strategy: 'ETF指數' })).toBe(PERSONAS.value)
  })

  it('returns swing for event-driven strategy', () => {
    expect(selectPersona({ strategy: '事件驅動' })).toBe(PERSONAS.swing)
  })

  it('maps period to correct persona', () => {
    expect(selectPersona({ period: '短期' })).toBe(PERSONAS.swing)
    expect(selectPersona({ period: '中期' })).toBe(PERSONAS.trend)
    expect(selectPersona({ period: '長期' })).toBe(PERSONAS.value)
    expect(selectPersona({ period: '中長期' })).toBe(PERSONAS.trend)
  })

  it('returns trend for growth/cyclical strategy', () => {
    expect(selectPersona({ strategy: '成長股' })).toBe(PERSONAS.trend)
    expect(selectPersona({ strategy: '景氣循環' })).toBe(PERSONAS.trend)
  })

  it('returns swing for turnaround/value strategy', () => {
    expect(selectPersona({ strategy: '轉機股' })).toBe(PERSONAS.swing)
  })

  it('defaults to trend when no match', () => {
    expect(selectPersona({})).toBe(PERSONAS.trend)
    expect(selectPersona()).toBe(PERSONAS.trend)
  })
})

describe('scoreScalper', () => {
  it('scores positive for volume spike + breakout', () => {
    const result = scoreScalper({ volumeRatio: 2.5, priceVs5dHigh: 1 })
    expect(result.score).toBeGreaterThan(0)
    expect(result.reasons).toContain('暴量 2.5x')
    expect(result.reasons).toContain('突破5日高')
  })

  it('penalizes warrants near expiry', () => {
    const result = scoreScalper({ daysToExpiry: 10 })
    expect(result.score).toBe(-3)
    expect(result.reasons).toContain('距到期<14天，時間衰減致命')
  })

  it('penalizes low delta', () => {
    const result = scoreScalper({ delta: 0.2 })
    expect(result.score).toBe(-2)
    expect(result.reasons).toContain('Delta太低，時間衰減致命')
  })

  it('returns correct verdict thresholds', () => {
    expect(
      scoreScalper({ volumeRatio: 3, priceVs5dHigh: 1, delta: 0.6, foreignShort5d: 1 }).verdict
    ).toBe('做多')
    expect(scoreScalper({ daysToExpiry: 5 }).verdict).toBe('做空')
    expect(scoreScalper({}).verdict).toBe('不碰')
  })
})

describe('scoreSwing', () => {
  it('scores institutional streak', () => {
    const result = scoreSwing({ institutionalStreakDays: 5 })
    expect(result.score).toBe(2)
    expect(result.reasons[0]).toContain('法人連買')
  })

  it('detects retail knife-catching', () => {
    const result = scoreSwing({ marginDelta: 100, priceChange: -3 })
    expect(result.score).toBe(-2)
    expect(result.reasons).toContain('融資增+股價跌=散戶接刀')
  })
})

describe('scoreTrend', () => {
  it('scores strong revenue growth', () => {
    const result = scoreTrend({ revenueYoY: 25 })
    expect(result.score).toBeGreaterThanOrEqual(2)
  })

  it('scores institutional consensus buy', () => {
    const result = scoreTrend({ foreignBuy: 1000, trustBuy: 500 })
    expect(result.reasons).toContain('外資+投信同買')
  })

  it('penalizes high PER', () => {
    const result = scoreTrend({ per: 40 })
    expect(result.reasons).toContain('PER偏高')
  })
})

describe('scoreValue', () => {
  it('scores high ROE + low PBR combo', () => {
    const result = scoreValue({ roe: 18, pbr: 1.2 })
    expect(result.score).toBeGreaterThanOrEqual(4)
    expect(result.reasons).toContain('PBR低估+ROE佳')
  })

  it('penalizes high debt', () => {
    const result = scoreValue({ debtRatio: 70 })
    expect(result.reasons).toContain('負債比過高')
  })

  it('rewards dividend stability', () => {
    const result = scoreValue({ dividendYears: 10 })
    expect(result.reasons).toContain('連續配息')
  })
})

describe('scoreByPersona', () => {
  it('dispatches to correct scoring function', () => {
    const scalperResult = scoreByPersona(PERSONAS.scalper, { volumeRatio: 2.5 })
    expect(scalperResult.reasons).toContain('暴量 2.5x')

    const valueResult = scoreByPersona(PERSONAS.value, { roe: 20 })
    expect(valueResult.reasons[0]).toContain('ROE')
  })

  it('falls back to trend for unknown persona', () => {
    const result = scoreByPersona({ id: 'unknown' }, { revenueYoY: 25 })
    expect(result.reasons).toContain('營收YoY強勁')
  })
})

describe('formatPersonaContext', () => {
  it('groups holdings by persona', () => {
    const holdings = [
      { code: '2308', meta: { strategy: '成長股', period: '中期' } },
      { code: '080585', meta: { strategy: '權證短打' } },
      { code: '00637L', meta: { strategy: 'ETF指數' } },
    ]
    const result = formatPersonaContext(holdings)
    expect(result).toContain('持股人格分組')
    expect(result).toContain('短線客')
    expect(result).toContain('價值者')
  })

  it('returns empty string for empty input', () => {
    expect(formatPersonaContext([])).toBe('')
    expect(formatPersonaContext(null)).toBe('')
  })
})
