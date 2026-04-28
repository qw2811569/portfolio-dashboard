// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import {
  ACTIVE_PORTFOLIO_KEY,
  MARKET_PRICE_CACHE_KEY,
  MARKET_PRICE_SYNC_KEY,
  OWNER_PORTFOLIO_ID,
  PORTFOLIOS_KEY,
  PORTFOLIO_VIEW_MODE,
  VIEW_MODE_KEY,
} from '../../src/constants.js'
import { useBrainStore } from '../../src/stores/brainStore.js'
import { PortfolioLayout } from '../../src/pages/PortfolioLayout.jsx'
import { EventsPage } from '../../src/pages/EventsPage.jsx'
import { HoldingsPage } from '../../src/pages/HoldingsPage.jsx'
import { WatchlistPage } from '../../src/pages/WatchlistPage.jsx'
import { usePortfolioRouteContext } from '../../src/pages/usePortfolioRouteContext.js'

const ROUTE_LAYOUT_TIMEOUT = 20000

function createStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]))

  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value))
    }),
    removeItem: vi.fn((key) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    key: vi.fn((index) => Array.from(store.keys())[index] || null),
    get length() {
      return store.size
    },
  }
}

function installStorage(seed = {}) {
  const mock = createStorageMock(seed)
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  })
  return mock
}

function createSeedStorage() {
  return {
    [PORTFOLIOS_KEY]: [
      { id: OWNER_PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-03-28' },
    ],
    [ACTIVE_PORTFOLIO_KEY]: OWNER_PORTFOLIO_ID,
    [VIEW_MODE_KEY]: PORTFOLIO_VIEW_MODE,
    [MARKET_PRICE_CACHE_KEY]: {
      marketDate: '2026-03-28',
      syncedAt: '2026-03-28T13:35:00.000Z',
      prices: {
        2330: { price: 950, changePct: 2.1 },
        2454: { price: 1250, changePct: 1.2 },
      },
    },
    [MARKET_PRICE_SYNC_KEY]: {
      status: 'success',
      syncedAt: '2026-03-28T13:35:00.000Z',
      marketDate: '2026-03-28',
    },
    [`pf-${OWNER_PORTFOLIO_ID}-holdings-v2`]: [
      {
        code: '2330',
        name: '台積電',
        qty: 10,
        cost: 900,
        price: 950,
        type: '股票',
        alert: '⚡ 法說留意',
      },
    ],
    [`pf-${OWNER_PORTFOLIO_ID}-watchlist-v1`]: [
      {
        code: '2454',
        name: '聯發科',
        price: 1250,
        target: 1500,
        status: '觀察中',
        catalyst: '法說',
        note: '關注 AI ASIC',
      },
    ],
    [`pf-${OWNER_PORTFOLIO_ID}-news-events-v1`]: [
      {
        id: 'evt-1',
        type: '法說',
        title: '聯發科法說',
        detail: '觀察 AI ASIC 接單',
        stocks: ['2454 聯發科'],
        date: '2026/03/28',
        eventDate: '2026-03-28',
        pred: 'up',
        predReason: '產品週期上行',
        status: 'pending',
      },
    ],
    [`pf-${OWNER_PORTFOLIO_ID}-notes-v1`]: {
      riskProfile: '',
      preferences: '',
      customNotes: '',
    },
  }
}

function RouteProbe() {
  const { portfolioId, holdings, portfolioNotes, setPortfolioNotes } = usePortfolioRouteContext()

  return (
    <div>
      <div data-testid="portfolio-id">{portfolioId}</div>
      <div data-testid="holding-count">{holdings.length}</div>
      <div data-testid="risk-profile">{portfolioNotes.riskProfile || 'empty'}</div>
      <button onClick={() => setPortfolioNotes((prev) => ({ ...prev, riskProfile: '成長型' }))}>
        save-note
      </button>
    </div>
  )
}

describe('routes/PortfolioLayout', () => {
  beforeEach(() => {
    installStorage(createSeedStorage())
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    useBrainStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it(
    'hydrates outlet context from runtime snapshot and persists note updates',
    async () => {
      render(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/probe`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="probe" element={<RouteProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByTestId('portfolio-id')).toHaveTextContent(OWNER_PORTFOLIO_ID)
      expect(screen.getByTestId('holding-count')).toHaveTextContent('1')
      expect(screen.getByTestId('risk-profile')).toHaveTextContent('empty')

      fireEvent.click(screen.getByRole('button', { name: 'save-note' }))

      await waitFor(() => {
        expect(screen.getByTestId('risk-profile')).toHaveTextContent('成長型')
      })

      expect(JSON.parse(localStorage.getItem(`pf-${OWNER_PORTFOLIO_ID}-notes-v1`))).toMatchObject({
        riskProfile: '成長型',
      })
    },
    ROUTE_LAYOUT_TIMEOUT
  )

  it(
    'marks the route shell as migration-only for developers and browser tracing',
    async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      render(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/probe`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="probe" element={<RouteProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByTestId('route-shell-root')).toHaveAttribute('data-route-shell', 'true')
      expect(screen.getByTestId('route-shell-root')).toHaveAttribute(
        'data-route-shell-limited',
        'true'
      )
      expect(screen.queryByTestId('route-shell-notice')).toBeNull()

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('migration-only runtime'))
      })
    },
    ROUTE_LAYOUT_TIMEOUT
  )

  it(
    'navigates between holdings and watchlist routes through header tabs',
    async () => {
      render(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/holdings`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="holdings" element={<HoldingsPage />} />
              <Route path="watchlist" element={<WatchlistPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('投組健檢')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '觀察股' }))

      expect(await screen.findByText('焦點觀察')).toBeInTheDocument()
      expect(screen.getByText('聯發科 2454')).toBeInTheDocument()
    },
    ROUTE_LAYOUT_TIMEOUT
  )

  it(
    'respects an explicit empty news-events array as true-empty (HE-1: no seed mask)',
    async () => {
      const storage = createSeedStorage()
      storage[`pf-${OWNER_PORTFOLIO_ID}-news-events-v1`] = []
      installStorage(storage)

      render(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/events`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="events" element={<EventsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      await screen.findByTestId('portfolio-select')
      expect(screen.queryByText('台燿 Q4財報法說會')).toBeNull()
    },
    ROUTE_LAYOUT_TIMEOUT
  )

  it(
    'syncs close prices from TWSE when route header refresh is clicked',
    async () => {
      const storage = createSeedStorage()
      delete storage[MARKET_PRICE_CACHE_KEY]
      delete storage[MARKET_PRICE_SYNC_KEY]
      installStorage(storage)

      globalThis.fetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('/api/twse')) {
          return {
            ok: true,
            json: async () => ({
              msgArray: [
                { c: '2330', d: '20260331', z: '960', y: '950' },
                { c: '2454', d: '20260331', z: '1260', y: '1250' },
              ],
            }),
          }
        }
        throw new Error(`unexpected fetch: ${url}`)
      })

      render(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/holdings`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="holdings" element={<HoldingsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      fireEvent.click(screen.getByRole('button', { name: /收盤價/ }))

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled()
        expect(screen.getByText(/已同步/)).toBeInTheDocument()
      })

      const persistedCache = JSON.parse(localStorage.getItem(MARKET_PRICE_CACHE_KEY))
      const persistedSync = JSON.parse(localStorage.getItem(MARKET_PRICE_SYNC_KEY))
      expect(persistedCache.prices['2330'].price).toBe(960)
      expect(persistedSync.status).toBe('success')
    },
    ROUTE_LAYOUT_TIMEOUT
  )
})
