/**
 * Route-shell scaffold for a future page-based migration.
 *
 * Important:
 * - This file is not the current production runtime entry.
 * - The stable runtime remains `src/main.jsx -> src/App.jsx`.
 * - Do not point `main.jsx` here until state/handlers/derived data in `src/pages/*`
 *   are fully wired to real runtime sources.
 */

import { createElement as h, lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, Navigate } from 'react-router-dom'
import { DEFAULT_PORTFOLIO_ROUTE } from './constants.js'
import { PortfolioLayout } from './pages/PortfolioLayout.jsx'

// Lazy load pages — each page becomes its own chunk
const OverviewPage = lazy(() => import('./pages/OverviewPage.jsx'))
const HoldingsPage = lazy(() => import('./pages/HoldingsPage.jsx'))
const WatchlistPage = lazy(() => import('./pages/WatchlistPage.jsx'))
const EventsPage = lazy(() => import('./pages/EventsPage.jsx'))
const NewsPage = lazy(() => import('./pages/NewsPage.jsx'))
const DailyPage = lazy(() => import('./pages/DailyPage.jsx'))
const ResearchPage = lazy(() => import('./pages/ResearchPage.jsx'))
const TradePage = lazy(() => import('./pages/TradePage.jsx'))
const LogPage = lazy(() => import('./pages/LogPage.jsx'))

const routeQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

const Loading = () =>
  h('div', { style: { color: '#8a9a97', padding: 24, fontSize: 13 } }, '載入中...')

function App() {
  return (
    <QueryClientProvider client={routeQueryClient}>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to={DEFAULT_PORTFOLIO_ROUTE} />} />

          {/* Overview page */}
          <Route path="/overview" element={<OverviewPage />} />

          {/* Portfolio pages */}
          <Route path="/portfolio/:portfolioId" element={<PortfolioLayout />}>
            <Route index element={<Navigate to="holdings" />} />
            <Route path="holdings" element={<HoldingsPage />} />
            <Route path="watchlist" element={<WatchlistPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route path="daily" element={<DailyPage />} />
            <Route path="research" element={<ResearchPage />} />
            <Route path="trade" element={<TradePage />} />
            <Route path="log" element={<LogPage />} />
          </Route>

          {/* 404 redirect */}
          <Route path="*" element={<Navigate to={DEFAULT_PORTFOLIO_ROUTE} />} />
        </Routes>
      </Suspense>
    </QueryClientProvider>
  )
}

export default App
