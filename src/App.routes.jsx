/**
 * Route-shell scaffold for a future page-based migration.
 *
 * Important:
 * - This file is not the current production runtime entry.
 * - The stable runtime remains `src/main.jsx -> src/App.jsx`.
 * - Do not point `main.jsx` here until state/handlers/derived data in `src/pages/*`
 *   are fully wired to real runtime sources.
 */

import { createElement as h } from 'react'
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
  return h(
    QueryClientProvider,
    { client: routeQueryClient },
    h(
      Routes,
      null,
      // Root redirect
      h(Route, { path: '/', element: h(Navigate, { to: DEFAULT_PORTFOLIO_ROUTE }) }),

      // Overview page
      h(Route, { path: '/overview', element: h(OverviewPage) }),

      // Portfolio pages
      h(Route, {
        path: '/portfolio/:portfolioId',
        element: h(PortfolioLayout),
        children: [
          h(Route, { index: true, element: h(Navigate, { to: 'holdings' }) }),
          h(Route, { path: 'holdings', element: h(HoldingsPage) }),
          h(Route, { path: 'watchlist', element: h(WatchlistPage) }),
          h(Route, { path: 'events', element: h(EventsPage) }),
          h(Route, { path: 'news', element: h(NewsPage) }),
          h(Route, { path: 'daily', element: h(DailyPage) }),
          h(Route, { path: 'research', element: h(ResearchPage) }),
          h(Route, { path: 'trade', element: h(TradePage) }),
          h(Route, { path: 'log', element: h(LogPage) }),
        ],
      }),

      // 404 redirect
      h(Route, { path: '*', element: h(Navigate, { to: DEFAULT_PORTFOLIO_ROUTE }) })
    )
  )
}

export default App
