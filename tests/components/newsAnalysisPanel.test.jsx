// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewsAnalysisPanel, NewsFeedSection } from '../../src/components/news/NewsPanel.jsx'

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
    holdingCodes: [],
    ...overrides,
  }
}

const MOCK_NEWS_ITEMS = [
  {
    title: '台積電法說會釋出樂觀展望',
    link: 'https://example.com/news/1',
    pubDate: '2026-04-12T10:30:00Z',
    source: '經濟日報',
    relatedStocks: [{ code: '2330', name: '台積電' }],
  },
  {
    title: '聯發科5G晶片出貨成長',
    link: 'https://example.com/news/2',
    pubDate: '2026-04-11T08:00:00Z',
    source: '工商時報',
    relatedStocks: [{ code: '2454', name: '聯發科' }],
  },
]

describe('components/NewsAnalysisPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows the empty-state welcome card when newsEvents is empty and no holdingCodes', () => {
    render(<NewsAnalysisPanel {...buildProps()} />)

    expect(screen.getByText('情報脈絡')).toBeInTheDocument()
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

    expect(screen.queryByText('情報脈絡')).not.toBeInTheDocument()
  })

  it('treats missing newsEvents (undefined) as empty and still shows welcome when no holdingCodes', () => {
    render(<NewsAnalysisPanel {...buildProps({ newsEvents: undefined })} />)

    expect(screen.getByText('情報脈絡')).toBeInTheDocument()
  })

  it('hides empty-state when holdingCodes provided (news feed section will render)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: MOCK_NEWS_ITEMS }),
    })

    await act(async () => {
      render(<NewsAnalysisPanel {...buildProps({ holdingCodes: ['2330', '2454'] })} />)
    })

    expect(screen.queryByText('🔍 前往收盤分析')).not.toBeInTheDocument()
  })
})

describe('components/NewsFeedSection', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('fetches news and renders cards with title, source, and stock chips', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: MOCK_NEWS_ITEMS }),
    })

    await act(async () => {
      render(<NewsFeedSection holdingCodes={['2330', '2454']} />)
    })

    await waitFor(() => {
      expect(screen.getByText('台積電法說會釋出樂觀展望')).toBeInTheDocument()
    })

    expect(screen.getByText('聯發科5G晶片出貨成長')).toBeInTheDocument()
    expect(screen.getByText('經濟日報')).toBeInTheDocument()
    expect(screen.getByText('工商時報')).toBeInTheDocument()
    expect(screen.getByText('台積電')).toBeInTheDocument()
    expect(screen.getByText('聯發科')).toBeInTheDocument()
    expect(screen.getByText(/新聞脈絡 \(2\)/)).toBeInTheDocument()
  })

  it('calls /api/news-feed with codes and days=3', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    })

    await act(async () => {
      render(<NewsFeedSection holdingCodes={['2330', '2454']} />)
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const url = fetchSpy.mock.calls[0][0]
    expect(url).toContain('/api/news-feed')
    expect(url).toContain('codes=')
    expect(url).toContain('days=3')
  })

  it('renders nothing when items array is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    })

    const { container } = await act(async () => {
      return render(<NewsFeedSection holdingCodes={['2330']} />)
    })

    expect(container.innerHTML).toBe('')
  })

  it('shows loading state during fetch', () => {
    let resolvePromise
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve
      })
    )

    render(<NewsFeedSection holdingCodes={['2330']} />)

    expect(screen.getByText('載入新聞中...')).toBeInTheDocument()
  })

  it('shows error message when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'))

    await act(async () => {
      render(<NewsFeedSection holdingCodes={['2330']} />)
    })

    await waitFor(() => {
      expect(screen.getByText(/新聞載入失敗/)).toBeInTheDocument()
    })
  })

  it('renders nothing when holdingCodes is empty', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { container } = render(<NewsFeedSection holdingCodes={[]} />)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe('')
  })

  it('news cards do not have direction arrows or impact styling', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: MOCK_NEWS_ITEMS }),
    })

    await act(async () => {
      render(<NewsFeedSection holdingCodes={['2330']} />)
    })

    await waitFor(() => {
      expect(screen.getByText('台積電法說會釋出樂觀展望')).toBeInTheDocument()
    })

    // No impact labels should appear (利多/利空/中性)
    expect(screen.queryByText(/利多/)).not.toBeInTheDocument()
    expect(screen.queryByText(/利空/)).not.toBeInTheDocument()
    expect(screen.queryByText(/中性/)).not.toBeInTheDocument()
  })
})
