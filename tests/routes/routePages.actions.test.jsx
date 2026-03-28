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
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it(
    'persists watchlist additions through modal flow without prompt()',
    async () => {
      const promptSpy = vi.spyOn(window, 'prompt')

      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/watchlist`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="watchlist" element={<WatchlistPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      fireEvent.click(screen.getByRole('button', { name: /新增觀察股/ }))
      fireEvent.change(screen.getByLabelText('代碼'), { target: { value: '2303' } })
      fireEvent.change(screen.getByLabelText('名稱'), { target: { value: '聯電' } })
      fireEvent.change(screen.getByLabelText('狀態'), { target: { value: '追蹤中' } })
      fireEvent.change(screen.getByLabelText('補充備註'), {
        target: { value: '等待成熟製程報價回升' },
      })
      fireEvent.click(screen.getByRole('button', { name: '加入觀察' }))

      expect(promptSpy).not.toHaveBeenCalled()
      expect(await screen.findByText('聯電')).toBeInTheDocument()

      await waitFor(() => {
        const watchlist = JSON.parse(localStorage.getItem(`pf-${OWNER_PORTFOLIO_ID}-watchlist-v1`))
        expect(watchlist).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: '2303',
              name: '聯電',
              status: '追蹤中',
              note: '等待成熟製程報價回升',
            }),
          ])
        )
      })
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'creates a portfolio through header modal without prompt()',
    async () => {
      const promptSpy = vi.spyOn(window, 'prompt')

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

      fireEvent.click(screen.getByRole('button', { name: /新組合/ }))
      expect(screen.getByRole('dialog', { name: '建立新組合' })).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('組合名稱'), {
        target: { value: '測試新組合' },
      })
      fireEvent.click(screen.getByRole('button', { name: '建立組合' }))

      expect(promptSpy).not.toHaveBeenCalled()

      await waitFor(() => {
        const portfolios = JSON.parse(localStorage.getItem(PORTFOLIOS_KEY))
        expect(portfolios).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: '測試新組合' })])
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveTextContent('測試新組合')
      })
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'renames a portfolio through header modal without prompt()',
    async () => {
      const promptSpy = vi.spyOn(window, 'prompt')

      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/holdings`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="holdings" element={<HoldingsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      fireEvent.click(screen.getByRole('button', { name: '管理組合' }))
      fireEvent.click(screen.getByRole('button', { name: '改名' }))
      expect(screen.getByRole('dialog', { name: '重新命名組合' })).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('組合名稱'), {
        target: { value: '主策略帳戶' },
      })
      fireEvent.click(screen.getByRole('button', { name: '儲存新名稱' }))

      expect(promptSpy).not.toHaveBeenCalled()

      await waitFor(() => {
        const portfolios = JSON.parse(localStorage.getItem(PORTFOLIOS_KEY))
        expect(portfolios).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: OWNER_PORTFOLIO_ID, name: '主策略帳戶' }),
          ])
        )
      })

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveTextContent('主策略帳戶')
      })
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'deletes a non-owner portfolio through header dialog without confirm()',
    async () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
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

      fireEvent.click(screen.getByRole('button', { name: '管理組合' }))
      fireEvent.click(screen.getAllByRole('button', { name: '刪除' })[0])
      expect(screen.getByRole('dialog', { name: '刪除組合' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '確認刪除' }))

      expect(confirmSpy).not.toHaveBeenCalled()

      await waitFor(() => {
        const portfolios = JSON.parse(localStorage.getItem(PORTFOLIOS_KEY))
        expect(portfolios).toEqual([
          expect.objectContaining({ id: OWNER_PORTFOLIO_ID, name: '我' }),
        ])
      })

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toHaveTextContent('成長策略')
      })
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'persists news review completion back into route runtime storage',
    async () => {
      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/news`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="news" element={<NewsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      fireEvent.click(screen.getByRole('button', { name: '復盤' }))
      fireEvent.change(screen.getByPlaceholderText('實際漲跌幅、關鍵原因...'), {
        target: { value: '法說後 AI ASIC 指引上修，市場反應正向' },
      })
      fireEvent.change(screen.getByPlaceholderText('這筆事件教會了我們什麼？'), {
        target: { value: '事件前卡位有效，但仍要補券商共識更新' },
      })
      fireEvent.click(screen.getByRole('button', { name: '完成復盤' }))

      await waitFor(() => {
        const events = JSON.parse(localStorage.getItem(`pf-${OWNER_PORTFOLIO_ID}-news-events-v1`))
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'evt-1',
              status: 'closed',
              actualNote: '法說後 AI ASIC 指引上修，市場反應正向',
              lessons: '事件前卡位有效，但仍要補券商共識更新',
            }),
          ])
        )
      })
    },
    ROUTE_ACTION_TIMEOUT
  )

  it(
    'reuses shared research workflow and persists route research history',
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

      renderRoute(
        <MemoryRouter initialEntries={[`/portfolio/${OWNER_PORTFOLIO_ID}/research`]}>
          <Routes>
            <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
              <Route path="research" element={<ResearchPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      fireEvent.click(screen.getByRole('button', { name: '台積電' }))

      await waitFor(() => {
        const history = JSON.parse(
          localStorage.getItem(`pf-${OWNER_PORTFOLIO_ID}-research-history-v1`)
        )
        expect(history).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: '2330',
              title: '台積電研究',
            }),
          ])
        )
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/research',
        expect.objectContaining({
          method: 'POST',
        })
      )
      expect(screen.queryByText('研究中...')).not.toBeInTheDocument()
    },
    ROUTE_ACTION_TIMEOUT
  )
})
