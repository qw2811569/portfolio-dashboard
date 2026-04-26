// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OperatingContextCard } from '../../src/components/common/OperatingContextCard.jsx'

function buildContext(overrides = {}) {
  return {
    portfolioLabel: '我的組合',
    holdingsCount: 5,
    nextActionLabel: '先把今天的節奏排好',
    nextActionReason: '持股、事件與最新結論可以一起對照。',
    ...overrides,
  }
}

describe('components/OperatingContextCard', () => {
  it('adds unit context to the attention badge in the default variant', () => {
    render(
      <OperatingContextCard
        context={{
          ...buildContext({ attentionCount: 10 }),
          attentionSummary: '提醒條件 4 檔 / 事件待驗證 2 檔',
        }}
      />
    )

    expect(screen.getByText('需注意 10 檔 · 提醒條件 4 檔 / 事件待驗證 2 檔')).toBeInTheDocument()
  })

  it('adds unit context to the attention badge in the home variant', () => {
    render(
      <OperatingContextCard
        variant="home"
        context={buildContext({
          headline: '今天先把節奏排好',
          latestInsightSummary: '先看需要補齊的資料，再看 thesis 變化。',
          attentionCount: 3,
          attentionSummary: '走勢轉弱 3 檔',
        })}
      />
    )

    expect(screen.getByText('需注意 3 檔 · 走勢轉弱 3 檔')).toBeInTheDocument()
  })

  it('renders portfolio and holdings chips with neutral surfaces plus one active dot', () => {
    render(<OperatingContextCard context={buildContext({ portfolioLabel: '小奎主要投資' })} />)

    const activeChip = screen.getByTestId('operating-context-active-chip')
    const holdingChip = screen.getByText('持股 5 檔')

    expect(activeChip).toHaveTextContent('●小奎主要投資')
    expect(activeChip.style.background).toBe('rgba(47, 50, 50, 0.03)')
    expect(activeChip.style.color).toBe('rgb(47, 50, 50)')
    expect(holdingChip.style.background).toBe('rgba(47, 50, 50, 0.03)')
    expect(holdingChip.style.color).toBe('rgb(47, 50, 50)')
  })
})
