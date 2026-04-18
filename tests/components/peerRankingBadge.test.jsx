// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PeerRankingBadge } from '../../src/components/holdings/PeerRankingBadge.jsx'

describe('components/PeerRankingBadge', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders industry and market relative-strength chips for semiconductor stocks', () => {
    render(
      <PeerRankingBadge
        holding={{ code: '2330', name: '台積電', industry: '半導體', changePct: 1.2 }}
      />
    )

    expect(screen.getByText('領先 0.4% (vs 半導體)')).toBeInTheDocument()
    expect(screen.getByText('領先 0.7% (vs 大盤)')).toBeInTheDocument()
  })

  it('does not render when the holding lacks daily change data', () => {
    const { container } = render(
      <PeerRankingBadge holding={{ code: '2330', industry: '半導體' }} />
    )
    expect(container.textContent).toBe('')
  })
})
