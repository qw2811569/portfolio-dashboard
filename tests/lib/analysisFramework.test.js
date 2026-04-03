import { describe, expect, it } from 'vitest'
import {
  formatFrameworkSections,
  selectAnalysisFramework,
} from '../../src/lib/analysisFramework.js'

describe('lib/analysisFramework', () => {
  it('selects framework by strategy', () => {
    expect(selectAnalysisFramework({ strategy: '權證' })).toMatchObject({ mode: 'event-driven' })
    expect(selectAnalysisFramework({ strategy: '景氣循環' })).toMatchObject({ mode: 'cyclical' })
    expect(selectAnalysisFramework({ strategy: '成長股' })).toMatchObject({ mode: 'compounder' })
    expect(selectAnalysisFramework({ strategy: 'ETF/指數' })).toMatchObject({ mode: 'income' })
  })

  it('falls back to event-driven when recent events are dense', () => {
    const framework = selectAnalysisFramework({}, {}, [
      { title: '台積電法說會', type: 'conference' },
    ])
    expect(framework.mode).toBe('event-driven')
  })

  it('formats framework sections into prompt-friendly text', () => {
    const framework = selectAnalysisFramework({ strategy: '景氣循環' })
    const text = formatFrameworkSections(framework, {
      stockMeta: { period: '中', industry: 'PCB/材料', leader: '龍頭' },
      fundamentals: { revenueYoY: 12.5 },
      targets: [{ target: 180 }],
      events: [{ title: '法說會' }],
    })

    expect(text).toContain('分析框架：cyclical')
    expect(text).toContain('營收拐點')
    expect(text).toContain('產業位階')
  })
})
