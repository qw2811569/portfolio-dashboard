// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewsAnalysisPanel } from '../../src/components/news/NewsPanel.jsx'

function buildProps(overrides = {}) {
  return {
    newsEvents: [],
    reviewingEvent: null,
    reviewForm: { note: '' },
    setReviewForm: vi.fn(),
    submitReview: vi.fn(),
    cancelReview: vi.fn(),
    setExpandedNews: vi.fn(),
    expandedNews: null,
    setReviewingEvent: vi.fn(),
    createDefaultReviewForm: () => ({ note: '' }),
    operatingContext: null,
    onNavigateDaily: vi.fn(),
    ...overrides,
  }
}

describe('components/NewsAnalysisPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows the empty-state welcome card when newsEvents is empty', () => {
    render(<NewsAnalysisPanel {...buildProps()} />)

    expect(screen.getByText('歡迎來到新聞事件追蹤')).toBeInTheDocument()
    expect(screen.getByText('🔍 前往收盤分析')).toBeInTheDocument()
  })

  it('fires onNavigateDaily when the empty-state CTA is clicked', () => {
    const onNavigateDaily = vi.fn()
    render(<NewsAnalysisPanel {...buildProps({ onNavigateDaily })} />)

    fireEvent.click(screen.getByText('🔍 前往收盤分析'))
    expect(onNavigateDaily).toHaveBeenCalledTimes(1)
  })

  it('hides the welcome card when there are any news events across buckets', () => {
    const events = [{ id: 1, title: '台積電調漲資本支出', status: 'tracking' }]
    render(<NewsAnalysisPanel {...buildProps({ newsEvents: events })} />)

    expect(screen.queryByText('歡迎來到新聞事件追蹤')).not.toBeInTheDocument()
  })

  it('treats missing newsEvents (undefined) as empty and still shows welcome', () => {
    render(<NewsAnalysisPanel {...buildProps({ newsEvents: undefined })} />)

    expect(screen.getByText('歡迎來到新聞事件追蹤')).toBeInTheDocument()
  })
})
