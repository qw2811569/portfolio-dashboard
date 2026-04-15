// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import { useReportsStore } from '../../src/stores/reportsStore.js'
import { PortfolioLayout } from '../../src/pages/PortfolioLayout.jsx'
import { HoldingsPage } from '../../src/pages/HoldingsPage.jsx'
import { NewsPage } from '../../src/pages/NewsPage.jsx'
import { ResearchPage } from '../../src/pages/ResearchPage.jsx'
import { WatchlistPage } from '../../src/pages/WatchlistPage.jsx'

const ROUTE_ACTION_TIMEOUT = 20000

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

function createSeedStorage({ portfolios = null } = {}) {
  const basePortfolios = portfolios || [
    { id: OWNER_PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-03-28' },
  ]
  return {
    [PORTFOLIOS_KEY]: basePortfolios,
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

function renderRoute(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, staleTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('routes/page actions', () => {
  beforeEach(() => {
    installStorage(createSeedStorage())
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    useBrainStore.getState().reset()
    useReportsStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it(
    'blocks watchlist additions through modal flow without prompt()',
    async () => {
      const promptSpy = vi.spyOn(window, 'prompt')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/watchlist`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="watchlist" element={<WatchlistPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      localStorage.setItem.mockClear()
      warnSpy.mockClear()

      fireEvent.click(screen.getByRole('button', { name: /新增觀察股/ }))
      fireEvent.change(screen.getByLabelText('代碼'), { target: { value: '2303' } })
      fireEvent.change(screen.getByLabelText('名稱'), { target: { value: '聯電' } })
      fireEvent.change(screen.getByLabelText('狀態'), { target: { value: '追蹤中' } })
      fireEvent.change(screen.getByLabelText('補充備註'), {
        target: { value: '等待成熟製程報價回升' },
      })
      fireEvent.click(screen.getByRole('button', { name: '加入觀察' }))

      expect(promptSpy).not.toHaveBeenCalled()
      expect(screen.queryByText('聯電')).not.toBeInTheDocument()
      expect(localStorage.setItem).not.toHaveBeenCalled()
      expect(JSON.parse(localStorage.getItem(`pf-${OWNER_PORTFOLIO_ID}-watchlist-v1`))).toEqual([
        expect.objectContaining({
          code: '2454',
          name: '聯發科',
        }),
      ])
      if (process.env.NODE_ENV !== 'production') {
        expect(warnSpy).toHaveBeenCalledWith(
          '[route-shell] write blocked: upsertWatchlist. Use the canonical AppShell to mutate data.'
        )
      }
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'blocks route header modal from creating a portfolio',
    async () => {
      const promptSpy = vi.spyOn(window, 'prompt')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/holdings`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="holdings" element={<HoldingsPage />} />
              <Route path="watchlist" element={<WatchlistPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      localStorage.setItem.mockClear()
      warnSpy.mockClear()

      fireEvent.click(screen.getByRole('button', { name: /新組合/ }))
      expect(screen.getByRole('dialog', { name: '建立新組合' })).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('組合名稱'), {
        target: { value: '測試新組合' },
      })
      fireEvent.click(screen.getByRole('button', { name: '建立組合' }))

      expect(promptSpy).not.toHaveBeenCalled()

      await waitFor(() => {
        if (process.env.NODE_ENV !== 'production') {
          expect(warnSpy).toHaveBeenCalledWith(
            '[route-shell] write blocked: createPortfolio. Use the canonical AppShell to mutate data.'
          )
        }
      })

      expect(localStorage.setItem.mock.calls.filter(([key]) => key === PORTFOLIOS_KEY)).toEqual([])
      expect(JSON.parse(localStorage.getItem(PORTFOLIOS_KEY))).toEqual([
        expect.objectContaining({ id: OWNER_PORTFOLIO_ID, name: '我' }),
      ])
      expect(screen.getByRole('combobox')).not.toHaveTextContent('測試新組合')
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'blocks route header modal from renaming a portfolio',
    async () => {
      const promptSpy = vi.spyOn(window, 'prompt')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/holdings`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="holdings" element={<HoldingsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      localStorage.setItem.mockClear()
      warnSpy.mockClear()

      fireEvent.click(screen.getByRole('button', { name: '管理組合' }))
      fireEvent.click(screen.getByRole('button', { name: '改名' }))
      expect(screen.getByRole('dialog', { name: '重新命名組合' })).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('組合名稱'), {
        target: { value: '主策略帳戶' },
      })
      fireEvent.click(screen.getByRole('button', { name: '儲存新名稱' }))

      expect(promptSpy).not.toHaveBeenCalled()

      await waitFor(() => {
        if (process.env.NODE_ENV !== 'production') {
          expect(warnSpy).toHaveBeenCalledWith(
            '[route-shell] write blocked: renamePortfolio. Use the canonical AppShell to mutate data.'
          )
        }
      })

      expect(localStorage.setItem.mock.calls.filter(([key]) => key === PORTFOLIOS_KEY)).toEqual([])
      expect(JSON.parse(localStorage.getItem(PORTFOLIOS_KEY))).toEqual([
        expect.objectContaining({ id: OWNER_PORTFOLIO_ID, name: '我' }),
      ])
      expect(screen.getByRole('combobox')).toHaveTextContent('我')
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'blocks route header dialog from deleting a non-owner portfolio',
    async () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      installStorage(
        createSeedStorage({
          portfolios: [
            { id: OWNER_PORTFOLIO_ID, name: '我', isOwner: true, createdAt: '2026-03-28' },
            { id: 'p-growth', name: '成長策略', isOwner: false, createdAt: '2026-03-28' },
          ],
        })
      )

      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/holdings`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="holdings" element={<HoldingsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      localStorage.setItem.mockClear()
      localStorage.removeItem.mockClear()
      warnSpy.mockClear()

      fireEvent.click(screen.getByRole('button', { name: '管理組合' }))
      fireEvent.click(screen.getAllByRole('button', { name: '刪除' })[0])
      expect(screen.getByRole('dialog', { name: '刪除組合' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '確認刪除' }))

      expect(confirmSpy).not.toHaveBeenCalled()

      await waitFor(() => {
        if (process.env.NODE_ENV !== 'production') {
          expect(warnSpy).toHaveBeenCalledWith(
            '[route-shell] write blocked: deletePortfolio. Use the canonical AppShell to mutate data.'
          )
        }
      })

      expect(localStorage.setItem.mock.calls.filter(([key]) => key === PORTFOLIOS_KEY)).toEqual([])
      expect(localStorage.removeItem).not.toHaveBeenCalled()
      expect(JSON.parse(localStorage.getItem(PORTFOLIOS_KEY))).toEqual([
        expect.objectContaining({ id: OWNER_PORTFOLIO_ID, name: '我' }),
        expect.objectContaining({ id: 'p-growth', name: '成長策略' }),
      ])
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'news route no longer exposes review actions or writes route runtime storage',
    async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/news`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="news" element={<NewsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      localStorage.setItem.mockClear()
      warnSpy.mockClear()

      expect(screen.queryByRole('button', { name: '復盤' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '完成復盤' })).not.toBeInTheDocument()

      expect(localStorage.setItem).not.toHaveBeenCalled()
      expect(JSON.parse(localStorage.getItem(`pf-${OWNER_PORTFOLIO_ID}-news-events-v1`))).toEqual([
        expect.objectContaining({
          id: 'evt-1',
          status: 'pending',
        }),
      ])
      expect(warnSpy).not.toHaveBeenCalled()
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'blocks route research from persisting route-local history',
    async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              code: '2330',
              name: '台積電',
              title: '台積電研究',
              summary: '先進製程動能延續',
              timestamp: 1711600000000,
            },
          ],
        }),
      })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/research`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="research" element={<ResearchPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      localStorage.setItem.mockClear()
      warnSpy.mockClear()

      fireEvent.click(screen.getByRole('button', { name: '台積電' }))

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(localStorage.setItem).not.toHaveBeenCalled()
      expect(JSON.parse(localStorage.getItem(`pf-${OWNER_PORTFOLIO_ID}-research-history-v1`))).toBe(
        null
      )
      expect(useReportsStore.getState().researchResults).toBeNull()
      expect(useReportsStore.getState().researchHistory).toEqual([])
      expect(screen.queryByText('研究中...')).not.toBeInTheDocument()
      if (process.env.NODE_ENV !== 'production') {
        expect(warnSpy).toHaveBeenCalledWith(
          '[route-shell] write blocked: runResearch. Use the canonical AppShell to mutate data.'
        )
      }
    },
    ROUTE_ACTION_TIMEOUT
  )
})
