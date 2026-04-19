import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the external module-level imports
vi.mock('../../src/lib/dataAdapters/finmindAdapter.js', () => ({
  fetchStockDossierData: vi.fn(async () => null),
}))

vi.mock('../../src/lib/dataAdapters/cronTargetsAdapter.js', () => ({
  fetchCronTargets: vi.fn(async () => null),
  isCronTargetUsable: vi.fn(() => false),
}))

vi.mock('../../src/lib/reportRefreshRuntime.js', () => ({
  buildReportRefreshCandidates: vi.fn(() => []),
}))

import { usePortfolioDerivedData } from '../../src/hooks/usePortfolioDerivedData.js'
import { buildReportRefreshCandidates } from '../../src/lib/reportRefreshRuntime.js'
import { fetchStockDossierData } from '../../src/lib/dataAdapters/finmindAdapter.js'
import {
  fetchCronTargets,
  isCronTargetUsable,
} from '../../src/lib/dataAdapters/cronTargetsAdapter.js'

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
  theses: [],
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

  describe('thesis canonicalization', () => {
    it('hydrates thesis onto normalized holding dossiers when storage payload is missing it', () => {
      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [{ code: '2330', name: '台積電', qty: 1000, cost: 550, price: 600 }],
            holdingDossiers: [{ code: '2330', name: '台積電', freshness: {} }],
            theses: [
              {
                id: 'thesis-2330',
                stockId: '2330',
                statement: 'AI 需求延續，先進製程稼動率維持高檔。',
                pillars: [{ id: 'p-1', text: 'CoWoS 擴產', status: 'on_track' }],
              },
            ],
          })
        )
      )

      expect(result.current.dossierByCode.get('2330')?.thesis).toMatchObject({
        stockId: '2330',
        statement: 'AI 需求延續，先進製程稼動率維持高檔。',
      })
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

    it('skips ETF and warrant dossiers from dataRefreshRows even when freshness is missing', () => {
      const holdingDossiers = [
        {
          code: '0050',
          name: '元大台灣50',
          position: { code: '0050', name: '元大台灣50', type: 'ETF' },
          freshness: { targets: 'missing', fundamentals: 'missing' },
        },
        {
          code: '053848',
          name: '亞翔凱基5B購',
          position: { code: '053848', name: '亞翔凱基5B購', type: '權證' },
          freshness: { targets: 'stale', fundamentals: 'missing' },
        },
        {
          code: '2330',
          name: '台積電',
          position: { code: '2330', name: '台積電', type: '股票' },
          freshness: { targets: 'missing', fundamentals: 'stale' },
        },
      ]

      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [
              { code: '0050', name: '元大台灣50', type: 'ETF', qty: 1000, cost: 100, price: 105 },
              {
                code: '053848',
                name: '亞翔凱基5B購',
                type: '權證',
                qty: 8000,
                cost: 1.8,
                price: 2.2,
              },
              { code: '2330', name: '台積電', type: '股票', qty: 100, cost: 900, price: 950 },
            ],
            watchlist: [],
            holdingDossiers,
          })
        )
      )

      expect(result.current.dataRefreshRows).toHaveLength(1)
      expect(result.current.dataRefreshRows.map((row) => row.code)).toEqual(['2330'])
    })
  })

  describe('FinMind enrichment flows into dataRefreshRows', () => {
    it('adds a PER-band derived target to a holding without seed targets after enrichment', async () => {
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
        financials: [{ date: '2025-12-31', EPS: 40, Revenue: 1000000, GrossProfit: 500000 }],
        balanceSheet: [{ date: '2025-12-31', Equity: 1500000 }],
        valuation: [
          { date: '2026-03-01', per: 15 },
          { date: '2026-02-01', per: 18 },
          { date: '2026-01-01', per: 20 },
          { date: '2025-12-01', per: 22 },
          { date: '2025-11-01', per: 25 },
        ],
      })

      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [{ code: '2330', name: '台積電', qty: 100, cost: 500, price: 600 }],
            watchlist: [],
          })
        )
      )

      // Initial render — no seeded targets for 2330, so freshness.targets is missing
      // and severity is 4 (targets 2 + fundamentals 2)
      const initialRow = result.current.dataRefreshRows.find((r) => r.code === '2330')
      expect(initialRow).toBeDefined()
      expect(initialRow.targetStatus).toBe('missing')

      // After enrichment, the PER-band mapper should populate dossier.targets
      // and freshness.targets should be fresh (synthesized today). Combined
      // with the fundamentals fix, severity drops to 0 and the row exits
      // the backlog entirely.
      await waitFor(
        () => {
          const row = result.current.dataRefreshRows.find((r) => r.code === '2330')
          expect(row).toBeUndefined()
        },
        { timeout: 2000 }
      )

      const enrichedDossier = result.current.dossierByCode.get('2330')
      expect(enrichedDossier.targets.length).toBeGreaterThan(0)
      expect(enrichedDossier.targets[0].firm).toMatch(/歷史PE/)
      expect(enrichedDossier.freshness.targets).toBe('fresh')
    })

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

  describe('cron target-price pipeline integration', () => {
    const finmindFixture = {
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
      financials: [{ date: '2025-12-31', EPS: 40, Revenue: 1000000, GrossProfit: 500000 }],
      balanceSheet: [{ date: '2025-12-31', Equity: 1500000 }],
      valuation: [
        { date: '2026-03-01', per: 15 },
        { date: '2026-02-01', per: 18 },
        { date: '2026-01-01', per: 20 },
        { date: '2025-12-01', per: 22 },
        { date: '2025-11-01', per: 25 },
      ],
    }

    it('prefers fresh cron analyst targets over PER-band when both are available', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const cronSnapshot = {
        code: '2330',
        name: '台積電',
        collectedAt: twoDaysAgo.toISOString(),
        targets: {
          reports: [{ firm: '元大', target: 1200, date: '2026/04/10' }],
          updatedAt: twoDaysAgo.toISOString(),
          source: 'analyst-reports',
        },
      }

      fetchStockDossierData.mockResolvedValue(finmindFixture)
      fetchCronTargets.mockResolvedValue(cronSnapshot)
      isCronTargetUsable.mockReturnValue(true)

      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [{ code: '2330', name: '台積電', qty: 100, cost: 500, price: 600 }],
            watchlist: [],
          })
        )
      )

      await waitFor(
        () => {
          const dossier = result.current.dossierByCode.get('2330')
          expect(dossier.targets).toBeDefined()
          expect(dossier.targets.length).toBeGreaterThan(0)
          // Cron analyst target should win, not PER-band
          expect(dossier.targets[0].firm).toBe('元大')
        },
        { timeout: 2000 }
      )
    })

    it('promotes aggregate-only cron snapshots into labeled consensus targets', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const aggregateCronSnapshot = {
        code: '2330',
        name: '台積電',
        collectedAt: twoDaysAgo.toISOString(),
        targets: {
          reports: [],
          aggregate: {
            medianTarget: 1700,
            meanTarget: 1650,
            min: 1500,
            max: 2000,
            firmsCount: 7,
            numEst: 7,
            rateDate: '2026-04-07',
          },
          updatedAt: twoDaysAgo.toISOString(),
          source: 'cnyes',
        },
      }

      fetchStockDossierData.mockResolvedValue(finmindFixture)
      fetchCronTargets.mockResolvedValue(aggregateCronSnapshot)
      isCronTargetUsable.mockReturnValue(true)

      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [{ code: '2330', name: '台積電', qty: 100, cost: 500, price: 600 }],
            watchlist: [],
          })
        )
      )

      await waitFor(
        () => {
          const dossier = result.current.dossierByCode.get('2330')
          expect(dossier.targets).toBeDefined()
          expect(dossier.targets).toEqual([
            expect.objectContaining({
              firm: 'Cnyes 共識',
              target: 1700,
              targetType: 'aggregate',
            }),
          ])
          expect(dossier.targetAggregate).toMatchObject({
            medianTarget: 1700,
            firmsCount: 7,
          })
          expect(dossier.targetSource).toBe('cnyes')
        },
        { timeout: 2000 }
      )
    })

    it('falls back to PER-band when cron targets are stale (>30 days)', async () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
      const staleCronSnapshot = {
        code: '2330',
        name: '台積電',
        collectedAt: fortyDaysAgo.toISOString(),
        targets: {
          reports: [{ firm: '元大', target: 1200, date: '2026/03/03' }],
          updatedAt: fortyDaysAgo.toISOString(),
          source: 'analyst-reports',
        },
      }

      fetchStockDossierData.mockResolvedValue(finmindFixture)
      fetchCronTargets.mockResolvedValue(staleCronSnapshot)
      isCronTargetUsable.mockReturnValue(false)

      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [{ code: '2330', name: '台積電', qty: 100, cost: 500, price: 600 }],
            watchlist: [],
          })
        )
      )

      await waitFor(
        () => {
          const dossier = result.current.dossierByCode.get('2330')
          expect(dossier.targets).toBeDefined()
          expect(dossier.targets.length).toBeGreaterThan(0)
          // Should be PER-band, not cron
          expect(dossier.targets[0].firm).toMatch(/歷史PE/)
        },
        { timeout: 2000 }
      )
    })

    it('falls back to PER-band when cron targets fetch returns null', async () => {
      fetchStockDossierData.mockResolvedValue(finmindFixture)
      fetchCronTargets.mockResolvedValue(null)
      isCronTargetUsable.mockReturnValue(false)

      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [{ code: '2330', name: '台積電', qty: 100, cost: 500, price: 600 }],
            watchlist: [],
          })
        )
      )

      await waitFor(
        () => {
          const dossier = result.current.dossierByCode.get('2330')
          expect(dossier.targets).toBeDefined()
          expect(dossier.targets.length).toBeGreaterThan(0)
          expect(dossier.targets[0].firm).toMatch(/歷史PE/)
        },
        { timeout: 2000 }
      )
    })
  })

  describe('warrant → underlying stock target mapping', () => {
    it('uses underlying stock PER-band targets for a warrant holding', async () => {
      // FinMind returns null for the warrant code but valid data for underlyingCode
      fetchStockDossierData.mockImplementation(async (code) => {
        if (code === '6139') {
          return {
            revenue: [
              {
                date: '2026-03-31',
                revenueMonth: 3,
                revenueYear: 2026,
                revenue: 500000,
                revenueYoY: 8,
                revenueMoM: 1,
              },
            ],
            financials: [{ date: '2025-12-31', EPS: 12, Revenue: 500000, GrossProfit: 200000 }],
            balanceSheet: [{ date: '2025-12-31', Equity: 800000 }],
            valuation: [
              { date: '2026-03-01', per: 10 },
              { date: '2026-02-01', per: 12 },
              { date: '2026-01-01', per: 14 },
              { date: '2025-12-01', per: 16 },
            ],
          }
        }
        return null
      })
      fetchCronTargets.mockResolvedValue(null)
      isCronTargetUsable.mockReturnValue(false)

      const { result } = renderHook(() =>
        usePortfolioDerivedData(
          defaultProps({
            holdings: [
              {
                code: '053848',
                name: '亞翔凱基5B購',
                qty: 8000,
                cost: 1.81,
                price: 2.23,
                type: '權證',
              },
            ],
            watchlist: [],
            constants: {
              ...stubConstants(),
              STOCK_META: {
                '053848': { strategy: '權證', underlying: '亞翔', underlyingCode: '6139' },
              },
            },
          })
        )
      )

      await waitFor(
        () => {
          const dossier = result.current.dossierByCode.get('053848')
          expect(dossier.targets).toBeDefined()
          expect(dossier.targets.length).toBeGreaterThan(0)
          // Should have PER-band targets derived from the underlying stock
          expect(dossier.targets[0].firm).toMatch(/歷史PE/)
          expect(dossier.underlyingCode).toBe('6139')
          expect(dossier.underlyingName).toBe('亞翔')
        },
        { timeout: 2000 }
      )
    })
  })

  describe('stale enrichment invalidation — dossiersToUse updates when D changes', () => {
    it('updates dossiersToUse when holdings data changes after enrichment resolves', async () => {
      // Setup: FinMind enrichment returns data so enrichedDossiers gets populated
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
        financials: [{ date: '2025-12-31', EPS: 40, Revenue: 1000000, GrossProfit: 500000 }],
        balanceSheet: [{ date: '2025-12-31', Equity: 1500000 }],
        valuation: [
          { date: '2026-03-01', per: 15 },
          { date: '2026-02-01', per: 18 },
          { date: '2026-01-01', per: 20 },
          { date: '2025-12-01', per: 22 },
          { date: '2025-11-01', per: 25 },
        ],
      })

      const helpers = stubHelpers()
      // buildHoldingDossiers propagates position data from holdings so we can
      // detect when dossiersToUse reflects fresh vs stale position values.
      helpers.buildHoldingDossiers = vi.fn(({ holdings }) =>
        (holdings || []).map((item) => ({
          code: item.code,
          name: item.name,
          position: { qty: item.qty, cost: item.cost, price: item.price },
          freshness: {},
        }))
      )
      // getHoldingMarketValue uses position.price * position.qty
      helpers.getHoldingMarketValue = vi.fn(
        (pos) => (Number(pos?.price) || 0) * (Number(pos?.qty) || 0)
      )

      const initialHoldings = [
        { code: '2330', name: '台積電', qty: 1000, cost: 550, price: 600 },
        { code: '2382', name: '廣達', qty: 500, cost: 1400, price: 1500 },
      ]

      const props = defaultProps({
        holdings: initialHoldings,
        watchlist: [],
        helpers,
      })

      const { result, rerender } = renderHook(
        (currentProps) => usePortfolioDerivedData(currentProps),
        { initialProps: props }
      )

      // Wait for enrichment to complete — enrichedDossiers gets populated
      await waitFor(
        () => {
          const dossier = result.current.dossierByCode.get('2330')
          expect(dossier.finmind).toBeTruthy()
        },
        { timeout: 2000 }
      )

      // Record the position data from dossiersToUse at this point
      const dossierBefore = result.current.dossierByCode.get('2330')
      expect(dossierBefore.position.price).toBe(600)

      // Now simulate a market price change: 2330 price goes from 600 to 700.
      // The codes stay the same, so codesToEnrichKey does NOT change, and the
      // enrichment effect does NOT re-fire. The bug was that enrichedBase would
      // still hold the stale enrichedDossiers (with price=600) instead of
      // reflecting the fresh D (with price=700).
      const updatedHoldings = [
        { code: '2330', name: '台積電', qty: 1000, cost: 550, price: 700 },
        { code: '2382', name: '廣達', qty: 500, cost: 1400, price: 1600 },
      ]

      rerender({
        ...props,
        holdings: updatedHoldings,
      })

      // dossiersToUse should reflect the new price from D, merged with the
      // cached finmind enrichment data
      const dossierAfter = result.current.dossierByCode.get('2330')
      expect(dossierAfter.position.price).toBe(700)
      // Enrichment should still be intact
      expect(dossierAfter.finmind).toBeTruthy()

      // Also verify the other holding updated
      const dossier2382 = result.current.dossierByCode.get('2382')
      expect(dossier2382.position.price).toBe(1600)
    })

    it('updates classification ranking when market values change', async () => {
      fetchStockDossierData.mockResolvedValue(null)

      const helpers = stubHelpers()
      helpers.buildHoldingDossiers = vi.fn(({ holdings }) =>
        (holdings || []).map((item) => ({
          code: item.code,
          name: item.name,
          position: { qty: item.qty, cost: item.cost, price: item.price },
          freshness: {},
        }))
      )
      helpers.getHoldingMarketValue = vi.fn(
        (pos) => (Number(pos?.price) || 0) * (Number(pos?.qty) || 0)
      )

      // With 2 holdings, rank 1 = pct 0.5 → 衛星, rank 2 = pct 1.0 → 戰術.
      // Initially 2330 is rank 1 (higher value), 2382 is rank 2.
      const initialHoldings = [
        { code: '2330', name: '台積電', qty: 1000, cost: 550, price: 600 },
        { code: '2382', name: '廣達', qty: 500, cost: 100, price: 100 },
      ]

      const props = defaultProps({
        holdings: initialHoldings,
        watchlist: [],
        helpers,
      })

      const { result, rerender } = renderHook(
        (currentProps) => usePortfolioDerivedData(currentProps),
        { initialProps: props }
      )

      // 2330 is rank 1 (value=600k) → 衛星, 2382 is rank 2 (value=50k) → 戰術
      expect(result.current.dossierByCode.get('2330').classification.position.value).toBe('衛星')
      expect(result.current.dossierByCode.get('2382').classification.position.value).toBe('戰術')

      // Swap rankings: make 2382 the highest value holding
      const swappedHoldings = [
        { code: '2330', name: '台積電', qty: 1000, cost: 550, price: 10 },
        { code: '2382', name: '廣達', qty: 500, cost: 100, price: 10000 },
      ]

      rerender({
        ...props,
        holdings: swappedHoldings,
      })

      // After swap: 2382 becomes rank 1 → 衛星, 2330 becomes rank 2 → 戰術
      expect(result.current.dossierByCode.get('2382').classification.position.value).toBe('衛星')
      expect(result.current.dossierByCode.get('2330').classification.position.value).toBe('戰術')
    })

    it('preserves finmind enrichment while base dossier fields update', async () => {
      const finmindData = {
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
        financials: [{ date: '2025-12-31', EPS: 40, Revenue: 1000000, GrossProfit: 500000 }],
        balanceSheet: [{ date: '2025-12-31', Equity: 1500000 }],
      }
      fetchStockDossierData.mockResolvedValue(finmindData)

      const helpers = stubHelpers()
      helpers.buildHoldingDossiers = vi.fn(({ holdings }) =>
        (holdings || []).map((item) => ({
          code: item.code,
          name: item.name,
          position: { qty: item.qty, cost: item.cost, price: item.price },
          freshness: {},
          customField: item.customField || 'initial',
        }))
      )
      helpers.getHoldingMarketValue = vi.fn(
        (pos) => (Number(pos?.price) || 0) * (Number(pos?.qty) || 0)
      )

      const props = defaultProps({
        holdings: [
          { code: '2330', name: '台積電', qty: 1000, cost: 550, price: 600, customField: 'v1' },
        ],
        watchlist: [],
        helpers,
      })

      const { result, rerender } = renderHook(
        (currentProps) => usePortfolioDerivedData(currentProps),
        { initialProps: props }
      )

      // Wait for enrichment
      await waitFor(
        () => {
          expect(result.current.dossierByCode.get('2330').finmind).toBeTruthy()
        },
        { timeout: 2000 }
      )

      // Re-render with changed base data
      rerender({
        ...props,
        holdings: [
          { code: '2330', name: '台積電', qty: 1000, cost: 550, price: 800, customField: 'v2' },
        ],
      })

      const dossier = result.current.dossierByCode.get('2330')
      // Base fields from D should be fresh
      expect(dossier.position.price).toBe(800)
      expect(dossier.customField).toBe('v2')
      // Enrichment data should still be present
      expect(dossier.finmind).toBeTruthy()
      expect(dossier.finmind.revenue).toBeDefined()
      expect(dossier.fundamentals).toBeDefined()
    })
  })
})
