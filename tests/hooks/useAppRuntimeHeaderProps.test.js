import { describe, expect, it, vi } from 'vitest'
import { useAppRuntimeHeaderProps } from '../../src/hooks/useAppRuntimeHeaderProps.js'

describe('hooks/useAppRuntimeHeaderProps', () => {
  it('composes header props with generated portfolio tabs', () => {
    const headerProps = useAppRuntimeHeaderProps({
      theme: { C: { bg: '#fff' }, pc: vi.fn() },
      sync: {
        cloudSync: true,
        saved: 'ok',
        refreshPrices: vi.fn(),
        refreshing: false,
        copyWeeklyReport: vi.fn(),
        exportLocalBackup: vi.fn(),
        backupFileInputRef: { current: null },
        importLocalBackup: vi.fn(),
        priceSyncStatusTone: 'ok',
        priceSyncStatusLabel: '同步',
        activePriceSyncAt: null,
        lastUpdate: null,
      },
      pnl: { displayedTotalPnl: 12, displayedRetPct: 1.5 },
      portfolio: {
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
      },
      overview: { overviewTotalValue: 200 },
      notes: { portfolioNotes: {}, setPortfolioNotes: vi.fn() },
      tabs: {
        urgentCount: 1,
        todayAlertSummary: '有提醒',
        analyzing: false,
        researching: false,
        tab: 'holdings',
        setTab: vi.fn(),
      },
      dialogs: { portfolioEditor: null, portfolioDeleteDialog: null },
      constants: {
        OWNER_PORTFOLIO_ID: 'me',
        PORTFOLIO_VIEW_MODE: 'portfolio',
        OVERVIEW_VIEW_MODE: 'overview',
      },
    })

    expect(Array.isArray(headerProps.TABS)).toBe(true)
    expect(headerProps.TABS.length).toBeGreaterThan(0)
    expect(headerProps.cloudSync).toBe(true)
    expect(headerProps.saved).toBe('ok')
  })
})
