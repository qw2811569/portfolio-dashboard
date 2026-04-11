import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the two external module-level imports
vi.mock('../../src/lib/dataAdapters/finmindAdapter.js', () => ({
  fetchStockDossierData: vi.fn(async () => null),
}))

vi.mock('../../src/lib/reportRefreshRuntime.js', () => ({
  buildReportRefreshCandidates: vi.fn(() => []),
}))

import { usePortfolioDerivedData } from '../../src/hooks/usePortfolioDerivedData.js'
import { buildReportRefreshCandidates } from '../../src/lib/reportRefreshRuntime.js'
import { fetchStockDossierData } from '../../src/lib/dataAdapters/finmindAdapter.js'

// ---------------------------------------------------------------------------
// Shared helpers/constants stubs
// ---------------------------------------------------------------------------

const stubHelpers = () => ({
  normalizeHoldingDossiers: vi.fn((v) => (Array.isArray(v) ? v : [])),
  buildHoldingDossiers: vi.fn(({ holdings, watchlist }) =>
    [...(holdings || []), ...(watchlist || [])].map((item) => ({
      code: item.code,
      name: item.name,
      freshness: {},
    }))
  ),
  getHoldingMarketValue: vi.fn((item) => (Number(item?.price) || 0) * (Number(item?.qty) || 0)),
  getHoldingCostBasis: vi.fn((item) => (Number(item?.cost) || 0) * (Number(item?.qty) || 0)),
  getHoldingUnrealizedPnl: vi.fn(
    (item) => ((Number(item?.price) || 0) - (Number(item?.cost) || 0)) * (Number(item?.qty) || 0)
  ),
  getHoldingReturnPct: vi.fn((item) => {
    const cost = (Number(item?.cost) || 0) * (Number(item?.qty) || 0)
    if (cost <= 0) return 0
    return (
      (((Number(item?.price) || 0) - (Number(item?.cost) || 0)) / (Number(item?.cost) || 1)) * 100
    )
  }),
  applyMarketQuotesToHoldings: vi.fn((holdings) => holdings || []),
  clonePortfolioNotes: vi.fn(() => ({ riskProfile: '', preferences: '', customNotes: '' })),
  normalizeNewsEvents: vi.fn((v) => (Array.isArray(v) ? v : [])),
  getEventStockCodes: vi.fn(() => []),
  isClosedEvent: vi.fn(() => false),
  parseFlexibleDate: vi.fn(() => null),
  todayStorageDate: vi.fn(() => '2026-04-04'),
  formatDateToStorageDate: vi.fn(() => '2026-04-04'),
  getTaipeiClock: vi.fn(() => ({
    marketDate: '2026-04-04',
    minutes: 810,
    isWeekend: false,
  })),
  parseStoredDate: vi.fn((v) => (v ? new Date(v) : null)),
  readStorageValue: vi.fn(() => null),
  pfKey: vi.fn((pid, suffix) => `pf-${pid}-${suffix}`),
  getPortfolioFallback: vi.fn(() => []),
})

const stubConstants = () => ({
  OWNER_PORTFOLIO_ID: 'me',
  PORTFOLIO_VIEW_MODE: 'portfolio',
  OVERVIEW_VIEW_MODE: 'overview',
  POST_CLOSE_SYNC_MINUTES: 815,
  RELAY_PLAN_CODES: new Set(),
  STOCK_META: {},
  C: { amber: '#f59e0b', olive: '#84cc16', textMute: '#888' },
})

const mockHoldings = [
  { code: '2330', name: '台積電', qty: 1000, cost: 550, price: 600 },
  { code: '2382', name: '廣達', qty: 500, cost: 1400, price: 1500 },
]

const defaultProps = (overrides = {}) => ({
  holdings: mockHoldings,
  watchlist: [{ code: '2454', name: '聯發科', price: 1200, target: 1400 }],
  sortBy: 'value',
  holdingDossiers: [],
  targets: {},
  fundamentals: {},
  analystReports: {},
  newsEvents: [],
  researchHistory: [],
  strategyBrain: null,
  marketPriceCache: null,
  marketPriceSync: null,
  activePortfolioId: 'me',
  portfolioSummaries: [],
  viewMode: 'portfolio',
  portfolioNotes: {},
  reportRefreshMeta: {},
  helpers: stubHelpers(),
  constants: stubConstants(),
  ...overrides,
})

describe('usePortfolioDerivedData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('smoke test — render without crash', () => {
    it('renders with full props without crashing', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      expect(result.current).toBeDefined()
    })

    it('renders with empty/null holdings without crashing', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps({ holdings: null })))
      expect(result.current).toBeDefined()
      expect(result.current.H).toEqual([])
    })

    it('renders with empty watchlist without crashing', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps({ watchlist: [] })))
      expect(result.current).toBeDefined()
      expect(result.current.W).toEqual([])
    })
  })

  describe('returned structure — all expected keys present', () => {
    it('returns all top-level keys', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      const keys = Object.keys(result.current)

      const expectedKeys = [
        'H',
        'W',
        'D',
        'dossierByCode',
        'currentNewsEvents',
        'totalVal',
        'totalCost',
        'totalPnl',
        'retPct',
        'todayMarketClock',
        'activeMarketDate',
        'activePriceSyncAt',
        'priceSyncStatusLabel',
        'priceSyncStatusTone',
        'holdingsIntegrityIssues',
        'missingTrackedQuoteCodes',
        'shouldTriggerPostCloseSelfHeal',
        'overviewPortfolios',
        'overviewTotalValue',
        'overviewTotalPnl',
        'overviewRetPct',
        'displayedTotalPnl',
        'displayedRetPct',
        'overviewDuplicateHoldings',
        'overviewPendingItems',
        'urgentCount',
        'todayAlertSummary',
        'watchlistRows',
        'watchlistFocus',
        'showRelayPlan',
        'scanRows',
        'top5',
        'winners',
        'losers',
        'attentionCount',
        'pendingCount',
        'targetUpdateCount',
        'dataRefreshRows',
        'todayRefreshKey',
        'reportRefreshCandidates',
      ]

      expectedKeys.forEach((key) => {
        expect(keys, `missing key: ${key}`).toContain(key)
      })
    })
  })

  describe('holdingDossiers (D) and dossierByCode', () => {
    it('D is an array with entries per holding+watchlist when holdingDossiers is empty', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      expect(Array.isArray(result.current.D)).toBe(true)
      // buildHoldingDossiers stub creates one entry per holding + watchlist item
      expect(result.current.D.length).toBeGreaterThanOrEqual(mockHoldings.length)
    })

    it('dossierByCode is a Map keyed by code', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      expect(result.current.dossierByCode).toBeInstanceOf(Map)
      expect(result.current.dossierByCode.has('2330')).toBe(true)
    })
  })

  describe('PnL computations', () => {
    it('computes totalVal, totalCost, totalPnl, retPct from holdings', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      // 2330: 600*1000=600000, 2382: 1500*500=750000
      expect(result.current.totalVal).toBe(600000 + 750000)
      // 2330: 550*1000=550000, 2382: 1400*500=700000
      expect(result.current.totalCost).toBe(550000 + 700000)
      expect(result.current.totalPnl).toBe(result.current.totalVal - result.current.totalCost)
      expect(result.current.retPct).toBeCloseTo(
        (result.current.totalPnl / result.current.totalCost) * 100,
        2
      )
    })

    it('retPct is 0 when totalCost is 0', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps({ holdings: [] })))
      expect(result.current.retPct).toBe(0)
    })
  })

  describe('displayedTotalPnl in portfolio vs overview mode', () => {
    it('in portfolio mode, displayedTotalPnl equals totalPnl', () => {
      const { result } = renderHook(() =>
        usePortfolioDerivedData(defaultProps({ viewMode: 'portfolio' }))
      )
      expect(result.current.displayedTotalPnl).toBe(result.current.totalPnl)
    })

    it('in overview mode, displayedTotalPnl equals overviewTotalPnl', () => {
      const { result } = renderHook(() =>
        usePortfolioDerivedData(defaultProps({ viewMode: 'overview' }))
      )
      expect(result.current.displayedTotalPnl).toBe(result.current.overviewTotalPnl)
    })
  })

  describe('scanRows structure', () => {
    it('produces one scanRow per holding', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      expect(result.current.scanRows).toHaveLength(mockHoldings.length)
    })

    it('each scanRow has expected shape', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      const row = result.current.scanRows[0]
      expect(row).toHaveProperty('h')
      expect(row).toHaveProperty('meta')
      expect(row).toHaveProperty('T')
      expect(row).toHaveProperty('relatedEvents')
      expect(row).toHaveProperty('hasPending')
      expect(row).toHaveProperty('needsAttention')
      expect(row).toHaveProperty('priority')
    })
  })

  describe('top5, winners, losers', () => {
    it('top5 is sorted by market value descending', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      expect(result.current.top5.length).toBeLessThanOrEqual(5)
      if (result.current.top5.length >= 2) {
        const helpers_ = stubHelpers()
        const v0 = helpers_.getHoldingMarketValue(result.current.top5[0])
        const v1 = helpers_.getHoldingMarketValue(result.current.top5[1])
        expect(v0).toBeGreaterThanOrEqual(v1)
      }
    })

    it('winners only includes positive PnL holdings', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      result.current.winners.forEach((item) => {
        const pnl = ((Number(item.price) || 0) - (Number(item.cost) || 0)) * (Number(item.qty) || 0)
        expect(pnl).toBeGreaterThan(0)
      })
    })
  })

  describe('watchlistRows', () => {
    it('produces watchlistRows from watchlist items', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      expect(result.current.watchlistRows).toHaveLength(1)
      expect(result.current.watchlistRows[0]).toHaveProperty('item')
      expect(result.current.watchlistRows[0]).toHaveProperty('priority')
      expect(result.current.watchlistRows[0]).toHaveProperty('upside')
    })
  })

  describe('overviewPortfolios', () => {
    it('returns empty array when portfolioSummaries is empty', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      expect(result.current.overviewPortfolios).toEqual([])
    })

    it('maps portfolioSummaries into enriched objects', () => {
      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            portfolioSummaries: [{ id: 'me', name: '我', totalValue: 100000, totalPnl: 5000 }],
          })
        )
      )
      expect(result.current.overviewPortfolios).toHaveLength(1)
      expect(result.current.overviewPortfolios[0]).toHaveProperty('holdings')
      expect(result.current.overviewPortfolios[0]).toHaveProperty('newsEvents')
      expect(result.current.overviewPortfolios[0]).toHaveProperty('pendingEvents')
    })
  })

  describe('reportRefreshCandidates delegation', () => {
    it('calls buildReportRefreshCandidates', () => {
      renderHook(() => usePortfolioDerivedData(defaultProps()))
      expect(buildReportRefreshCandidates).toHaveBeenCalled()
    })
  })

  describe('urgentCount and todayAlertSummary', () => {
    it('urgentCount is 0 when no holdings have alerts', () => {
      const { result } = renderHook(() => usePortfolioDerivedData(defaultProps()))
      expect(result.current.urgentCount).toBe(0)
      expect(result.current.todayAlertSummary).toBe('')
    })

    it('todayAlertSummary reflects alert text', () => {
      const holdingsWithAlert = [
        { code: '2330', name: '台積電', qty: 1000, cost: 550, price: 600, alert: '法說會' },
      ]
      const { result } = renderHook(() =>
        usePortfolioDerivedData(defaultProps({ holdings: holdingsWithAlert }))
      )
      expect(result.current.urgentCount).toBe(1)
      expect(result.current.todayAlertSummary).toContain('台積電')
      expect(result.current.todayAlertSummary).toContain('法說')
    })
  })

  describe('targets freshness from buildHoldingDossiers', () => {
    it('clears targets severity at initial render when holding has a recent seed report', () => {
      const now = new Date()
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '/')
      // Use the real buildHoldingDossiers (not the stub) by providing holdingDossiers
      // with freshness already computed — this simulates what the real function
      // produces when given seed target reports.
      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [{ code: '2330', name: '台積電', qty: 100, cost: 500, price: 600 }],
            watchlist: [],
            helpers: {
              ...stubHelpers(),
              buildHoldingDossiers: vi.fn(({ holdings }) =>
                holdings.map((item) => ({
                  code: item.code,
                  name: item.name,
                  targets: [{ firm: '元大', target: 700, date: recentDate }],
                  freshness: { targets: 'fresh', fundamentals: 'fresh' },
                }))
              ),
            },
          })
        )
      )

      const row = result.current.dataRefreshRows.find((r) => r.code === '2330')
      // Severity 0 means the row never made it into the backlog at all.
      expect(row).toBeUndefined()
    })
  })

  describe('FinMind enrichment flows into dataRefreshRows', () => {
    it('clears fundamentals severity on a holding after FinMind enrichment resolves', async () => {
      // Full FinMind fixture — revenue + financials + balance sheet all present.
      // Mapper should classify this as 'fresh' and set freshness.fundamentals='fresh'.
      // Use mockResolvedValue (not Once) so every enrichment effect re-run returns
      // the fixture and state converges on enriched.
      fetchStockDossierData.mockResolvedValue({
        revenue: [
          {
            date: '2026-03-31',
            revenueMonth: 3,
            revenueYear: 2026,
            revenue: 1000000,
            revenueYoY: 12.5,
            revenueMoM: -2.3,
          },
        ],
        financials: [
          {
            date: '2025-12-31',
            EPS: 8.25,
            Revenue: 850000,
            GrossProfit: 450000,
            NetIncome: 200000,
          },
        ],
        balanceSheet: [{ date: '2025-12-31', Equity: 1500000 }],
      })

      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [{ code: '2330', name: '台積電', qty: 100, cost: 500, price: 600 }],
            watchlist: [],
          })
        )
      )

      // Initial render — both targets and fundamentals are 'missing' in the raw dossier,
      // severity is 4, so the row is in the backlog.
      const initialRow = result.current.dataRefreshRows.find((r) => r.code === '2330')
      expect(initialRow).toBeDefined()
      expect(initialRow.fundamentalStatus).toBe('missing')
      expect(initialRow.severity).toBe(4)

      // Wait for the async enrichment effect to resolve and for dataRefreshRows
      // to reflect the enriched dossier. THIS IS THE REGRESSION GUARD: if
      // dataRefreshRows reads from D instead of dossiersToUse, the
      // fundamentalStatus will stay 'missing' forever even though the enrichment
      // effect correctly wrote to enrichedDossiers.
      await waitFor(
        () => {
          const row = result.current.dataRefreshRows.find((r) => r.code === '2330')
          expect(row?.fundamentalStatus).toBe('fresh')
        },
        { timeout: 2000 }
      )

      // Targets are still missing (no RSS+AI refresh in this test), so severity
      // should drop from 4 to 2 — fundamentals cleared, targets still contributing.
      const enrichedRow = result.current.dataRefreshRows.find((r) => r.code === '2330')
      expect(enrichedRow.fundamentalStatus).toBe('fresh')
      expect(enrichedRow.severity).toBe(2)
    })
  })
})
