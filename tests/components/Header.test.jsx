import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Header from '../../src/components/Header.jsx'

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
    cloudSync: true,
    saved: '',
    refreshPrices: vi.fn(),
    refreshing: false,
    copyWeeklyReport: vi.fn(),
    downloadWeeklyReportMarkdown: vi.fn(),
    downloadWeeklyReportHtml: vi.fn(),
    exportLocalBackup: vi.fn(),
    backupFileInputRef: { current: null },
    importLocalBackup: vi.fn(),
    priceSyncStatusTone: '#7fd4ff',
    priceSyncStatusLabel: '同步完成',
    activePriceSyncAt: null,
    lastUpdate: null,
    pc: (value) => (value >= 0 ? '#0f0' : '#f00'),
    displayedTotalPnl: 12,
    displayedRetPct: 1.5,
    activePortfolioId: 'me',
    switchPortfolio: vi.fn(),
    ready: true,
    portfolioSwitching: false,
    portfolioSummaries: [],
    createPortfolio: vi.fn(),
    viewMode: 'portfolio',
    exitOverview: vi.fn(),
    openOverview: vi.fn(),
    showPortfolioManager: false,
    setShowPortfolioManager: vi.fn(),
    renamePortfolio: vi.fn(),
    deletePortfolio: vi.fn(),
    OWNER_PORTFOLIO_ID: 'me',
    overviewTotalValue: 100,
    portfolioNotes: {},
    setPortfolioNotes: vi.fn(),
    PORTFOLIO_VIEW_MODE: 'portfolio',
    OVERVIEW_VIEW_MODE: 'overview',
    urgentCount: 0,
    todayAlertSummary: '',
    TABS: [
      { k: 'holdings', label: '持倉' },
      { k: 'research', label: '深度研究' },
    ],
    tab: 'holdings',
    setTab: vi.fn(),
    workflowCue: null,
    portfolioEditor: null,
    portfolioDeleteDialog: null,
    ...overrides,
  }
}

describe('components/Header.jsx', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: vi.fn(),
    })
    if (typeof originalMatchMedia === 'function') {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    }
  })

  it('renders a data-refresh notice toggle and only navigates through setTab', () => {
    const setTab = vi.fn()
    const refreshPrices = vi.fn()
    const onRefresh = vi.fn()

    render(
      <Header
        {...buildProps({
          setTab,
          refreshPrices,
          workflowCue: {
            kind: 'data-refresh',
            label: '資料補齊中',
            reason: '公開報告與財報資料仍需刷新。',
            count: 1,
            items: [{ code: '2330', name: '台積電', targetLabel: '最新目標價仍在更新中' }],
            targetTab: 'research',
            actionLabel: '前往補資料',
            onRefresh,
          },
        })}
      />
    )

    expect(screen.queryByTestId('header-notice-drawer')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('header-notice-toggle'))

    expect(screen.getByTestId('header-notice-drawer')).toBeInTheDocument()
    expect(screen.getByText('資料補齊提醒')).toBeInTheDocument()
    expect(screen.getByText('台積電 (2330)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('前往補資料'))

    expect(setTab).toHaveBeenCalledWith('research')
    expect(window.scrollTo).toHaveBeenCalled()
    expect(refreshPrices).not.toHaveBeenCalled()
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('omits the workflow cue when none is provided', () => {
    render(<Header {...buildProps()} />)

    expect(screen.queryByTestId('header-notice-toggle')).not.toBeInTheDocument()
  })

  it('renders weekly export controls and wires each action button', () => {
    const copyWeeklyReport = vi.fn()
    const downloadWeeklyReportMarkdown = vi.fn()
    const downloadWeeklyReportHtml = vi.fn()

    render(
      <Header
        {...buildProps({
          copyWeeklyReport,
          downloadWeeklyReportMarkdown,
          downloadWeeklyReportHtml,
        })}
      />
    )

    fireEvent.click(screen.getByTestId('weekly-export-copy'))
    fireEvent.click(screen.getByTestId('weekly-export-md'))
    fireEvent.click(screen.getByTestId('weekly-export-html'))

    expect(copyWeeklyReport).toHaveBeenCalledTimes(1)
    expect(downloadWeeklyReportMarkdown).toHaveBeenCalledTimes(1)
    expect(downloadWeeklyReportHtml).toHaveBeenCalledTimes(1)
  })

  it('folds secondary mobile header actions into an overflow drawer', () => {
    mockMatchMedia(true)

    render(<Header {...buildProps()} />)

    expect(screen.queryByTestId('weekly-export-copy')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('header-mobile-overflow-toggle'))

    expect(screen.getByTestId('header-mobile-actions-drawer')).toBeInTheDocument()
    expect(screen.getByTestId('weekly-export-copy')).toBeInTheDocument()
    expect(screen.getByTestId('weekly-export-md')).toBeInTheDocument()
    expect(screen.getByTestId('weekly-export-html')).toBeInTheDocument()
  })

  it('compresses mobile tabs and reveals hidden ones from the more drawer', () => {
    mockMatchMedia(true)
    const setTab = vi.fn()

    render(
      <Header
        {...buildProps({
          setTab,
          TABS: [
            { k: 'dashboard', label: '看板' },
            { k: 'overview', label: '全組合' },
            { k: 'holdings', label: '持倉' },
            { k: 'watchlist', label: '觀察股' },
            { k: 'events', label: '事件追蹤' },
            { k: 'news', label: '新聞聚合' },
            { k: 'daily', label: '收盤分析' },
            { k: 'research', label: '深度研究' },
          ],
          tab: 'dashboard',
        })}
      />
    )

    expect(screen.getByTestId('mobile-tabs-more-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-tabs-drawer')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('mobile-tabs-more-toggle'))
    fireEvent.click(screen.getByTestId('tab-research'))

    expect(setTab).toHaveBeenCalledWith('research')
  })
})
