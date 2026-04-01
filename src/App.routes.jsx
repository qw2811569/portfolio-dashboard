/**
 * Route-shell scaffold for a future page-based migration.
 *
 * Important:
 * - This file is not the current production runtime entry.
 * - The stable runtime remains `src/main.jsx -> src/App.jsx`.
 * - Do not point `main.jsx` here until state/handlers/derived data in `src/pages/*`
 *   are fully wired to real runtime sources.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Routes, Route, Navigate } from 'react-router-dom'
import { DEFAULT_PORTFOLIO_ROUTE } from './constants.js'
import { OverviewPage } from './pages/OverviewPage.jsx'
import { PortfolioLayout } from './pages/PortfolioLayout.jsx'
import {
  HoldingsPage,
  WatchlistPage,
  EventsPage,
  DailyPage,
  ResearchPage,
  TradePage,
  LogPage,
  NewsPage,
} from './pages/index.js'

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

function App() {
  return (
    <QueryClientProvider client={routeQueryClient}>
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
    </QueryClientProvider>
  )
}

export default App
