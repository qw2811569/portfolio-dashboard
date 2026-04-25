import { describe, expect, it } from 'vitest'
import {
  applyHoldingsFilterStateToSearchParams,
  buildHoldingsFilterModel,
  createDefaultHoldingsFilterState,
  deriveRetailIntent,
  filterHoldingsByChipState,
  normalizeHoldingsFilterState,
  readHoldingsFilterStateFromSearch,
} from '../../src/lib/holdingsFilters.js'

describe('lib/holdingsFilters', () => {
  it('derives urgent retail intent and KB-driven risk tags from concentration plus stop-loss pressure', () => {
    const result = deriveRetailIntent(
      { code: '2308', name: '台達電', qty: 1, cost: 100, price: 89 },
      {
        weightsByCode: new Map([['2308', 0.24]]),
        sectorWeights: new Map([['AI/伺服器', 0.52]]),
        eventContextByCode: new Map(),
      },
      {
        code: '2308',
        stockMeta: { industry: 'AI/伺服器', strategy: '成長股', themes: ['AI'] },
        thesis: {
          pillars: [{ id: 'p1', label: 'AI 電源', status: 'on_track' }],
        },
        freshness: { fundamentals: 'fresh', targets: 'fresh' },
      }
    )

    expect(result.intent).toBe('需關注')
    expect(result.riskFlags).toEqual(
      expect.arrayContaining(['singleOver20', 'sectorOver40', 'nearStopLoss'])
    )
    expect(result.tags).toEqual(expect.arrayContaining(['集中度警示', '產業集中', 'AI']))
  })

  it('marks intact + profitable + fresh holdings with no nearby events as stable', () => {
    const result = deriveRetailIntent(
      { code: '3017', name: '奇鋐', qty: 1, cost: 100, price: 135 },
      {
        weightsByCode: new Map([['3017', 0.14]]),
        sectorWeights: new Map([['AI/伺服器', 0.28]]),
        eventContextByCode: new Map([
          [
            '3017',
            {
              hasUpcomingWeekEvent: false,
              hasNearbyEvent: false,
              hasMonthDividend: false,
              hasRecentNews3d: false,
            },
          ],
        ]),
      },
      {
        code: '3017',
        stockMeta: { industry: 'AI/伺服器', strategy: '成長股', themes: ['AI', '散熱'] },
        thesis: {
          pillars: [{ id: 'p1', label: '散熱主線', status: 'on_track' }],
        },
        freshness: { fundamentals: 'fresh', targets: 'fresh' },
      }
    )

    expect(result.intent).toBe('穩的')
    expect(result.riskFlags).toEqual([])
  })

  it('migrates legacy R141b filter state into the v2 intent/type schema', () => {
    const migrated = normalizeHoldingsFilterState({
      focusedPrimaryKey: 'growth',
      selectedPrimaryKeys: ['growth', 'event'],
      secondaryFilters: {
        all: ['weakened'],
        growth: ['AI/伺服器'],
        event: ['upcoming'],
      },
    })

    expect(migrated.intentKey).toBe('action')
    expect(migrated.filterGroups.type).toEqual(['growth', 'event'])
    expect(migrated.filterGroups.sector).toEqual(['AI/伺服器'])
    expect(migrated.filterGroups.eventWindow).toEqual(['weekEvent'])
    expect(migrated.selectedPrimaryKeys).toEqual(['growth', 'event'])
  })

  it('keeps legacy all-pillars selections at the v2 all-intent instead of collapsing to attention', () => {
    const migrated = normalizeHoldingsFilterState({
      focusedPrimaryKey: 'all',
      selectedPrimaryKeys: [],
      secondaryFilters: {
        all: ['broken', 'weakened', 'intact'],
        growth: [],
        event: [],
      },
    })

    expect(migrated.intentKey).toBe('all')
    expect(migrated.filterGroups).toEqual({
      sector: [],
      type: [],
      eventWindow: [],
      pnl: [],
      risk: [],
    })
  })

  it('filters holdings with intent + secondary AND search working together', () => {
    const holdings = [
      { code: '2308', name: '台達電', qty: 1, cost: 100, price: 120, value: 120, type: '股票' },
      { code: '3017', name: '奇鋐', qty: 1, cost: 100, price: 96, value: 96, type: '股票' },
      { code: '00637L', name: '滬深300正2', qty: 1, cost: 20, price: 20, value: 20, type: 'ETF' },
    ]
    const holdingDossiers = [
      {
        code: '2308',
        stockMeta: { industry: 'AI/伺服器', strategy: '成長股', themes: ['AI'] },
        thesis: { statement: 'AI 電源與液冷主線', pillars: [{ status: 'on_track' }] },
        freshness: { fundamentals: 'fresh', targets: 'fresh' },
      },
      {
        code: '3017',
        stockMeta: { industry: 'AI/伺服器', strategy: '成長股', themes: ['AI', '散熱'] },
        thesis: { statement: '散熱仍看主線', pillars: [{ status: 'watch' }] },
        freshness: { fundamentals: 'stale', targets: 'fresh' },
      },
    ]
    const filterState = normalizeHoldingsFilterState({
      version: 2,
      intentKey: 'all',
      filterGroups: {
        sector: ['AI/伺服器'],
        type: ['growth'],
        eventWindow: [],
        pnl: [],
        risk: ['stale'],
      },
    })

    const model = buildHoldingsFilterModel({
      holdings,
      holdingDossiers,
      newsEvents: [],
      state: filterState,
      searchQuery: 'AI',
    })
    const visible = filterHoldingsByChipState(model.rows, filterState, 'AI')

    expect(visible.map((item) => item.code)).toEqual(['3017'])
  })

  it('round-trips URL state while preserving unrelated params like stock', () => {
    const state = normalizeHoldingsFilterState({
      version: 2,
      intentKey: 'attention',
      filterGroups: {
        sector: ['AI/伺服器'],
        type: ['growth'],
        eventWindow: [],
        pnl: [],
        risk: ['singleOver20'],
      },
    })
    const params = applyHoldingsFilterStateToSearchParams(
      new URLSearchParams('stock=2308'),
      state,
      'AI',
      { activePortfolioId: 'me' }
    )
    const parsed = readHoldingsFilterStateFromSearch(`?${params.toString()}`, {
      activePortfolioId: 'me',
    })

    expect(params.get('stock')).toBe('2308')
    expect(params.get('holdingsPid')).toBe('me')
    expect(parsed.filterState.intentKey).toBe('attention')
    expect(parsed.filterState.filterGroups.sector).toEqual(['AI/伺服器'])
    expect(parsed.filterState.filterGroups.type).toEqual(['growth'])
    expect(parsed.filterState.filterGroups.risk).toEqual(['singleOver20'])
    expect(parsed.searchQuery).toBe('AI')
  })

  it('ignores URL filter state when it belongs to a different portfolio', () => {
    const params = new URLSearchParams(
      'holdingsPid=me&intent=attention&sector=AI%2F%E4%BC%BA%E6%9C%8D%E5%99%A8&q=AI'
    )
    const parsed = readHoldingsFilterStateFromSearch(`?${params.toString()}`, {
      activePortfolioId: '7865',
    })

    expect(parsed.hasFilterParams).toBe(false)
    expect(parsed.filterState.intentKey).toBe('all')
    expect(parsed.filterState.filterGroups.sector).toEqual([])
    expect(parsed.searchQuery).toBe('')
  })

  it('defaults to the empty v2 state when given nothing', () => {
    expect(createDefaultHoldingsFilterState()).toMatchObject({
      version: 2,
      intentKey: 'all',
      filterGroups: {
        sector: [],
        type: [],
        eventWindow: [],
        pnl: [],
        risk: [],
      },
    })
  })
})
