// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewsAnalysisPanel, NewsFeedSection } from '../../src/components/news/NewsPanel.jsx'

const originalMatchMedia = window.matchMedia

function mockMatchMedia(matches) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

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
    description: '供應鏈認為第二季需求升溫，屬於偏正向 headline。',
    link: 'https://example.com/news/1',
    pubDate: '2026-04-12T10:30:00Z',
    source: '經濟日報',
    relatedStocks: [{ code: '2330', name: '台積電' }],
  },
  {
    title: '聯發科5G晶片出貨成長',
    description: '市場等待更多數字確認，因此先視為中性偏正向。',
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
    if (typeof originalMatchMedia === 'function') {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
      return
    }

    delete window.matchMedia
  })

  it('shows the empty-state welcome card when newsEvents is empty and no holdingCodes', () => {
    render(<NewsAnalysisPanel {...buildProps()} />)

    expect(screen.getByText('今天市場在說什麼')).toBeInTheDocument()
    expect(screen.getByText('→ 前往收盤分析')).toBeInTheDocument()
  })

  it('fires onNavigateDaily when the empty-state CTA is clicked', () => {
    const onNavigateDaily = vi.fn()
    render(<NewsAnalysisPanel {...buildProps({ onNavigateDaily })} />)

    fireEvent.click(screen.getByText('→ 前往收盤分析'))
    expect(onNavigateDaily).toHaveBeenCalledTimes(1)
  })

  it('keeps the welcome card when only event records exist but no holdingCodes are provided', () => {
    const events = [{ id: 1, title: '台積電調漲資本支出', status: 'tracking', recordType: 'event' }]
    render(<NewsAnalysisPanel {...buildProps({ newsEvents: events })} />)

    expect(screen.getByText('今天市場在說什麼')).toBeInTheDocument()
  })

  it('treats missing newsEvents (undefined) as empty and still shows welcome when no holdingCodes', () => {
    render(<NewsAnalysisPanel {...buildProps({ newsEvents: undefined })} />)

    expect(screen.getByText('今天市場在說什麼')).toBeInTheDocument()
  })

  it('hides empty-state when holdingCodes provided (news feed section will render)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: MOCK_NEWS_ITEMS }),
    })

    await act(async () => {
      render(<NewsAnalysisPanel {...buildProps({ holdingCodes: ['2330', '2454'] })} />)
    })

    expect(screen.queryByText('→ 前往收盤分析')).not.toBeInTheDocument()
  })
})

describe('components/NewsFeedSection', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    if (typeof originalMatchMedia === 'function') {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
      return
    }

    delete window.matchMedia
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
    expect(screen.getAllByText('經濟日報').length).toBeGreaterThan(0)
    expect(screen.getAllByText('工商時報').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2330 台積電/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2454 聯發科/).length).toBeGreaterThan(0)
    expect(screen.getByText(/2 則相關新聞/)).toBeInTheDocument()
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

  it('falls back to preview content when items array is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    })

    await act(async () => {
      render(<NewsFeedSection holdingCodes={['2330']} />)
    })

    await waitFor(() => {
      expect(screen.getByText('這些新聞跟你組合有關')).toBeInTheDocument()
    })
    expect(screen.getByText(/2 則相關新聞|1 則相關新聞/)).toBeInTheDocument()
  })

  it('shows loading state during fetch', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(new Promise(() => {}))

    render(<NewsFeedSection holdingCodes={['2330']} />)

    expect(screen.getByText('新聞脈絡整理中')).toBeInTheDocument()
    expect(document.querySelector('[data-skeleton]')).toBeTruthy()
  })

  it('shows fallback notice when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'))

    await act(async () => {
      render(<NewsFeedSection holdingCodes={['2330']} />)
    })

    await waitFor(() => {
      expect(screen.getByText('服務暫時不穩 · 正在重試')).toBeInTheDocument()
      expect(screen.getByText('新聞源暫時打不開，以下先顯示目前可讀版本。')).toBeInTheDocument()
    })
  })

  it('removes the preview fallback debug label from the mobile error notice', async () => {
    mockMatchMedia(true)
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'))

    await act(async () => {
      render(<NewsFeedSection holdingCodes={['2330']} />)
    })

    await waitFor(() => {
      expect(
        screen.getByText('新聞源暫時打不開，先用目前可讀版本撐住畫面，不擋住你先讀重點。')
      ).toBeInTheDocument()
    })

    expect(screen.queryByText('preview fallback')).not.toBeInTheDocument()
  })

  it('keeps headline counters aligned with the filtered news cards', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: '2330 台積電' }))

    expect(screen.getByText('1 則相關新聞')).toBeInTheDocument()
    expect(screen.getByText('未讀 1 則')).toBeInTheDocument()
    expect(screen.getByText('台積電法說會釋出樂觀展望')).toBeInTheDocument()
    expect(screen.queryByText('聯發科5G晶片出貨成長')).not.toBeInTheDocument()
  })

  it('renders nothing when holdingCodes is empty', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { container } = render(<NewsFeedSection holdingCodes={[]} />)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe('')
  })

  it('news cards render impact badges and the daily handoff button', async () => {
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

    expect(screen.getAllByText(/→ 判讀影響/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/利多/).length).toBeGreaterThan(0)
  })

  it('uses the mobile single-column branch and keeps filters collapsed by default on <=768px', async () => {
    mockMatchMedia(true)
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

    expect(screen.getByTestId('news-layout')).toHaveStyle({
      gridTemplateColumns: 'minmax(0, 1fr)',
    })
    expect(screen.getByTestId('news-hero-grid')).toHaveStyle({
      gridTemplateColumns: 'minmax(0, 1fr)',
    })
    expect(screen.getByTestId('news-hero-title')).toHaveStyle({
      fontSize: 'clamp(20px, 5vw, 28px)',
    })
    expect(screen.getAllByTestId('news-article-main')[0]).toHaveStyle({ minWidth: '0' })
    expect(screen.getAllByTestId('news-article-rail')[0]).toHaveStyle({ width: '100%' })
    expect(screen.getByTestId('news-side-notes')).toHaveStyle({ position: 'static' })
    expect(screen.getByTestId('news-filter-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('news-filter-summary')).toHaveTextContent(
      '預設：全部來源 / 全部影響 / 全部持股'
    )
    expect(screen.queryByTestId('news-side-notes-body')).not.toBeInTheDocument()
  })

  it('expands mobile filters when the toggle is pressed', async () => {
    mockMatchMedia(true)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: MOCK_NEWS_ITEMS }),
    })

    await act(async () => {
      render(<NewsFeedSection holdingCodes={['2330', '2454']} />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('news-filter-toggle')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('news-filter-toggle'))

    expect(screen.getByTestId('news-filter-toggle')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('news-side-notes-body')).toBeInTheDocument()
    expect(screen.getByText('來源篩選')).toBeInTheDocument()
    expect(screen.getByText('影響篩選')).toBeInTheDocument()
    expect(screen.getByTestId('news-filter-ticker-select')).toBeInTheDocument()
  })

  it('renders a compact mobile error heads-up and retry action on fetch failure', async () => {
    mockMatchMedia(true)
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'))

    await act(async () => {
      render(<NewsFeedSection holdingCodes={['2330']} />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('news-mobile-error-notice')).toBeInTheDocument()
    })

    expect(screen.queryByText('preview fallback')).not.toBeInTheDocument()
    expect(screen.getByText('新聞源暫時打不開，先用目前可讀版本撐住畫面，不擋住你先讀重點。')).toBeInTheDocument()
    expect(screen.getByText('再試一次')).toBeInTheDocument()
  })
})
