// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResearchPanel } from '../../src/components/research/ResearchPanel.jsx'

function buildProps(overrides = {}) {
  return {
    holdings: [],
    researching: false,
    researchTarget: '',
    reportRefreshing: false,
    reportRefreshStatus: '',
    dataRefreshRows: [],
    researchResults: null,
    researchHistory: [],
    enrichingResearchCode: null,
    proposalActionId: null,
    proposalActionType: null,
    STOCK_META: {},
    IND_COLOR: {},
    operatingContext: null,
    onEvolve: vi.fn(),
    onRefresh: vi.fn(),
    onResearch: vi.fn(),
    onEnrich: vi.fn(),
    onApplyProposal: vi.fn(),
    onDiscardProposal: vi.fn(),
    onSelectHistory: vi.fn(),
    ...overrides,
  }
}

describe('components/ResearchPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // The empty-state hint lives in a div mixed with <br/> and a second text node,
  // so RTL's exact-match getByText fails. Use container.textContent instead.
  const EMPTY_HINT = '點擊上方按鈕開始第一次深度研究'

  it('shows the first-research hint when there is nothing to show yet', () => {
    const { container } = render(<ResearchPanel {...buildProps()} />)
    expect(container.textContent).toContain(EMPTY_HINT)
  })

  it('hides the first-research hint once researchResults exists', () => {
    const results = {
      timestamp: 1,
      summary: 'AI 深度研究摘要',
      stocks: [],
    }
    const { container } = render(<ResearchPanel {...buildProps({ researchResults: results })} />)
    expect(container.textContent).not.toContain(EMPTY_HINT)
  })

  it('hides the first-research hint if history has entries even without live results', () => {
    const history = [{ timestamp: 100, summary: 'old run', stocks: [] }]
    const { container } = render(<ResearchPanel {...buildProps({ researchHistory: history })} />)
    expect(container.textContent).not.toContain(EMPTY_HINT)
  })

  it('hides the first-research hint while researching is in progress', () => {
    const { container } = render(
      <ResearchPanel {...buildProps({ researching: true, researchTarget: '2330' })} />
    )
    expect(container.textContent).not.toContain(EMPTY_HINT)
  })
})
