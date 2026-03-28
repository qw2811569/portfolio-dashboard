import { describe, it, expect } from 'vitest'
import { buildThesisScorecardContext } from '../../src/lib/dossierUtils.js'

describe('buildThesisScorecardContext', () => {
  it('builds scorecard text from a full thesis', () => {
    const thesis = {
      statement: 'AI demand drives CoWoS',
      direction: 'long',
      conviction: 'high',
      pillars: [
        { id: 'p1', text: '月營收成長 >20%', status: 'on_track', trend: 'up' },
        { id: 'p2', text: 'CoWoS產能擴張', status: 'watch', trend: 'stable' },
      ],
      risks: [
        { id: 'r1', text: 'NVIDIA轉單', triggered: false },
        { id: 'r2', text: '月營收轉負', triggered: true },
      ],
      targetPrice: 2200,
      stopLoss: 1650,
    }

    const text = buildThesisScorecardContext(thesis)
    expect(text).toContain('AI demand drives CoWoS')
    expect(text).toContain('high')
    expect(text).toContain('月營收成長 >20%')
    expect(text).toContain('on_track')
    expect(text).toContain('watch')
    expect(text).toContain('NVIDIA轉單')
    expect(text).toContain('月營收轉負')
    expect(text).toContain('TRIGGERED')
    expect(text).toContain('2200')
    expect(text).toContain('1650')
  })

  it('returns empty string for null thesis', () => {
    expect(buildThesisScorecardContext(null)).toBe('')
    expect(buildThesisScorecardContext(undefined)).toBe('')
  })

  it('handles thesis with no pillars or risks', () => {
    const thesis = {
      statement: 'Simple thesis',
      conviction: 'low',
      pillars: [],
      risks: [],
    }
    const text = buildThesisScorecardContext(thesis)
    expect(text).toContain('Simple thesis')
    expect(text).toContain('low')
  })

  it('falls back to reason when statement is empty', () => {
    const thesis = {
      statement: '',
      reason: 'Legacy reason text',
      conviction: 'medium',
      pillars: [],
      risks: [],
    }
    const text = buildThesisScorecardContext(thesis)
    expect(text).toContain('Legacy reason text')
  })
})
