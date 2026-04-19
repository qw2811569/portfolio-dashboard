import { describe, expect, it } from 'vitest'
import { displayPortfolioName } from '../../src/lib/portfolioDisplay.js'

describe('displayPortfolioName', () => {
  it('maps known portfolio aliases to human labels', () => {
    expect(displayPortfolioName({ id: 'me' })).toBe('小奎主要投資')
    expect(displayPortfolioName({ name: '我' })).toBe('小奎主要投資')
    expect(displayPortfolioName({ id: 'ajoe734' })).toBe('小奎主要投資')
    expect(displayPortfolioName({ name: '金聯成' })).toBe('金聯成組合')
    expect(displayPortfolioName({ id: 'jinliancheng' })).toBe('金聯成組合')
  })

  it('prefers a human label over the raw id when both exist', () => {
    expect(displayPortfolioName({ id: 'P-MO4WQZ7G', name: '金聯成' })).toBe('金聯成組合')
    expect(displayPortfolioName({ id: 'user-ajoe734', name: '小奎主要投資' })).toBe('小奎主要投資')
  })

  it('never returns internal portfolio ids or debug templates', () => {
    expect(displayPortfolioName({ id: 'P-MO4WQZ7G' })).toBe('投組')
    expect(displayPortfolioName({ id: 'pf_internal_123' })).toBe('投組')
    expect(displayPortfolioName({ id: 'portfolio_hidden_456' })).toBe('投組')
    expect(displayPortfolioName({ id: 'user-secret-789' })).toBe('投組')
    expect(displayPortfolioName({ displayName: '組合 P-MO4WQZ7G' })).toBe('投組')
  })
})
