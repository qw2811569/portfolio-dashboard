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
    render(<OperatingContextCard context={buildContext({ attentionCount: 10 })} />)

    expect(screen.getByText('需留意 10 檔持股')).toBeInTheDocument()
  })

  it('adds unit context to the attention badge in the home variant', () => {
    render(
      <OperatingContextCard
        variant="home"
        context={buildContext({
          headline: '今天先把節奏排好',
          latestInsightSummary: '先看需要補齊的資料，再看 thesis 變化。',
          attentionCount: 3,
        })}
      />
    )

    expect(screen.getByText('需留意 3 檔持股')).toBeInTheDocument()
  })
})
