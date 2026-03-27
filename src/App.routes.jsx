/**
 * App.jsx - Phase 2 Refactored Version
 * 
 * Main application component with routing
 * 
 * Architecture:
 * - Routes: React Router for navigation
 * - State: Zustand stores for global state
 * - API: TanStack Query for server state
 * - UI: Component-based structure
 */

import { createElement as h } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { C } from "./theme.js";
import { OverviewPage } from "./pages/OverviewPage.jsx";
import { PortfolioLayout } from "./pages/PortfolioLayout.jsx";
import {
  HoldingsPage,
  WatchlistPage,
  EventsPage,
  DailyPage,
  ResearchPage,
  TradePage,
  LogPage,
  NewsPage,
} from "./pages/index.js";

function App() {
  return h(Routes, null,
    // Root redirect
    h(Route, { path: "/", element: h(Navigate, { to: "/portfolio/me/holdings" }) }),
    
    // Overview page
    h(Route, { path: "/overview", element: h(OverviewPage) }),
    
    // Portfolio pages
    h(Route, { path: "/portfolio/:portfolioId", element: h(PortfolioLayout),
      children: [
        h(Route, { index: true, element: h(Navigate, { to: "holdings" }) }),
        h(Route, { path: "holdings", element: h(HoldingsPage) }),
        h(Route, { path: "watchlist", element: h(WatchlistPage) }),
        h(Route, { path: "events", element: h(EventsPage) }),
        h(Route, { path: "news", element: h(NewsPage) }),
        h(Route, { path: "daily", element: h(DailyPage) }),
        h(Route, { path: "research", element: h(ResearchPage) }),
        h(Route, { path: "trade", element: h(TradePage) }),
        h(Route, { path: "log", element: h(LogPage) }),
      ]
    }),
    
    // 404 redirect
    h(Route, { path: "*", element: h(Navigate, { to: "/portfolio/me/holdings" }) })
  );
}

export default App;
