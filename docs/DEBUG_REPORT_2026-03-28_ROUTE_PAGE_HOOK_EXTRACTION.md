# Route Page Hook Extraction

Date: 2026-03-28  
Owner: Codex

## Summary

This pass moved the remaining page-local route wiring out of `src/pages/*` and into dedicated `useRoute*Page` hooks, so the route shell is closer to a true runtime entry instead of a second monolith.

## What changed

- Added dedicated route page hooks:
  - `src/hooks/useRouteHoldingsPage.js`
  - `src/hooks/useRouteWatchlistPage.js`
  - `src/hooks/useRouteEventsPage.js`
  - `src/hooks/useRouteNewsPage.js`
  - `src/hooks/useRouteDailyPage.js`
  - `src/hooks/useRouteResearchPage.js`
  - `src/hooks/useRouteTradePage.js`
  - `src/hooks/useRouteLogPage.js`
  - `src/hooks/useRouteOverviewPage.js`
- Slimmed `src/pages/*` so pages now mostly do `const panelProps = useRoute*Page(); return <Panel {...panelProps} />`
- Removed the old `WatchlistPage` prompt-driven add/edit path; route watchlist now uses the existing modal editor flow through `WatchlistPanel`
- Fixed a real route-shell bug in `TradePage`: it previously passed the whole `MEMO_Q` object into `TradePanel`; now `useRouteTradePage` passes the correct per-trade memo question array
- Added object URL cleanup in `useRouteTradePage` to avoid leaking preview blobs during repeated screenshot uploads

## New route-level coverage

Added `tests/routes/routePages.actions.test.jsx`:

- watchlist modal add flow persists to `pf-*-watchlist-v1`
- news review completion persists back to `pf-*-news-events-v1`

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run check:fast-refresh`

All passed on 2026-03-28.
