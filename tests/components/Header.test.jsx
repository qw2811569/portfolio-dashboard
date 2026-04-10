import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Header from '../../src/components/Header.jsx'

function buildProps(overrides = {}) {
  return {
    cloudSync: true,
    saved: '',
    refreshPrices: vi.fn(),
    refreshing: false,
    copyWeeklyReport: vi.fn(),
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
    TABS: [{ k: 'holdings', label: '持倉' }, { k: 'research', label: '深度研究' }],
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
  })

  it('renders a workflow cue and only navigates through setTab', () => {
    const setTab = vi.fn()
    const refreshPrices = vi.fn()

    render(
      <Header
        {...buildProps({
          setTab,
          refreshPrices,
          workflowCue: {
            label: '先補齊資料，再做深度研究',
            reason: '公開報告與財報資料仍需刷新。',
            targetTab: 'research',
            actionLabel: '前往補資料',
          },
        })}
      />
    )

    expect(screen.getByText('WORKFLOW CUE')).toBeInTheDocument()
    expect(screen.getByText('先補齊資料，再做深度研究')).toBeInTheDocument()

    fireEvent.click(screen.getByText('前往補資料'))

    expect(setTab).toHaveBeenCalledWith('research')
    expect(window.scrollTo).toHaveBeenCalled()
    expect(refreshPrices).not.toHaveBeenCalled()
  })

  it('omits the workflow cue when none is provided', () => {
    render(<Header {...buildProps()} />)

    expect(screen.queryByText('WORKFLOW CUE')).not.toBeInTheDocument()
  })
})
