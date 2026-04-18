import { describe, expect, it } from 'vitest'
import {
  PEER_RANKING_THRESHOLD_PCT,
  calculateRelativeStrength,
  getPeerRankingForHolding,
} from '../../src/lib/peerRanking.js'

describe('lib/peerRanking', () => {
  it('classifies leader when stock beats industry and market beyond threshold', () => {
    expect(
      calculateRelativeStrength({
        stockChangePct: 1.2,
        industryAvgPct: 0.8,
        marketIndexPct: 0.5,
      })
    ).toEqual(
      expect.objectContaining({
        vsIndustry: 0.4,
        vsMarket: 0.7,
        rank: 'leader',
        label: '領先 0.4% (vs 產業) · 領先 0.7% (vs 大盤)',
      })
    )
  })

  it('classifies laggard when stock trails industry and market beyond threshold', () => {
    expect(
      calculateRelativeStrength({
        stockChangePct: -1.1,
        industryAvgPct: -0.4,
        marketIndexPct: 0.2,
      })
    ).toEqual(
      expect.objectContaining({
        vsIndustry: -0.7,
        vsMarket: -1.3,
        rank: 'laggard',
      })
    )
  })

  it('classifies neutral when relative moves are mixed', () => {
    expect(
      calculateRelativeStrength({
        stockChangePct: 0.6,
        industryAvgPct: 0.1,
        marketIndexPct: 0.5,
      })
    ).toEqual(
      expect.objectContaining({
        vsIndustry: 0.5,
        vsMarket: 0.1,
        rank: 'neutral',
      })
    )
  })

  it('handles missing industry benchmark and still compares against market', () => {
    expect(
      calculateRelativeStrength({
        stockChangePct: 1.0,
        industryAvgPct: null,
        marketIndexPct: 0.3,
      })
    ).toEqual(
      expect.objectContaining({
        vsIndustry: null,
        vsMarket: 0.7,
        rank: 'leader',
        label: '領先 0.7% (vs 大盤)',
      })
    )
  })

  it('handles missing benchmark data without fabricating a comparison', () => {
    expect(
      calculateRelativeStrength({
        stockChangePct: 1.0,
        industryAvgPct: null,
        marketIndexPct: null,
      })
    ).toEqual(
      expect.objectContaining({
        vsIndustry: null,
        vsMarket: null,
        rank: 'neutral',
        label: '今日 +1.0%，缺少可比較 benchmark',
      })
    )
  })

  it('treats the threshold boundary as directional', () => {
    const result = calculateRelativeStrength({
      stockChangePct: 0.8,
      industryAvgPct: 0.8 - PEER_RANKING_THRESHOLD_PCT,
      marketIndexPct: 0.8 - PEER_RANKING_THRESHOLD_PCT,
    })

    expect(result.vsIndustry).toBe(PEER_RANKING_THRESHOLD_PCT)
    expect(result.vsMarket).toBe(PEER_RANKING_THRESHOLD_PCT)
    expect(result.rank).toBe('leader')
  })

  it('maps semiconductor holdings to the stub 0052 benchmark', () => {
    expect(
      getPeerRankingForHolding({
        code: '2330',
        name: '台積電',
        industry: '半導體',
        changePct: 1.2,
      })
    ).toEqual(
      expect.objectContaining({
        industryLabel: '半導體',
        industryBenchmarkCode: '0052',
        marketBenchmarkCode: '0050',
        vsIndustry: 0.4,
        vsMarket: 0.7,
      })
    )
  })
})
