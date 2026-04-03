import { describe, expect, it } from 'vitest'
import { findHistoricalAnalogs } from '../../src/lib/brainRuntime.js'

describe('lib/brainRuntime historical analogs', () => {
  it('returns top related historical analogs by sector/event/outcome cues', () => {
    const analogs = findHistoricalAnalogs(
      { code: '2330', name: '台積電', sector: '半導體' },
      {
        eventType: 'conference',
        title: '台積電法說會',
        thesis: '半導體 AI 趨勢延續',
        outcomePattern: 'positive',
      }
    )

    expect(analogs.length).toBeGreaterThan(0)
    expect(analogs[0]).toEqual(
      expect.objectContaining({
        code: expect.any(String),
        name: expect.any(String),
        thesis: expect.any(String),
      })
    )
  })
})
