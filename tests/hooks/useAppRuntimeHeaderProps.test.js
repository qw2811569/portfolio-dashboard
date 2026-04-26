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
        downloadWeeklyReportMarkdown: vi.fn(),
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
        workflowCue: {
          kind: 'data-refresh',
          label: '資料補齊中',
          reason: '公開報告與財報資料仍需刷新。',
          count: 1,
          items: [{ code: '2330', name: '台積電' }],
          targetTab: 'research',
          actionLabel: '前往補資料',
        },
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
    expect(headerProps.TABS[0]).toMatchObject({ k: 'dashboard', label: '看板' })
    expect(headerProps.TABS[1]).toMatchObject({ k: 'overview', label: '全組合' })
    expect(headerProps.cloudSync).toBe(true)
    expect(headerProps.saved).toBe('ok')
    expect(headerProps.workflowCue?.targetTab).toBe('research')
    expect(typeof headerProps.downloadWeeklyReportMarkdown).toBe('function')
    expect(headerProps.downloadWeeklyReportHtml).toBeUndefined()
  })
})
