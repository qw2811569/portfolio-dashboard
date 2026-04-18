# R123 · L2 third wave report · 2026-04-18 20:29:26 CST

## T30 monthly revenue announced-month semantics
- changes: `api/finmind.js:1` · `src/lib/dataAdapters/finmindFundamentalsMapper.js:1`
- verify: `npx vitest run tests/api/finmind.test.js tests/lib/finmindFundamentalsMapper.test.js` → `19/19` passed
- status: DONE

## T31 quarter / H1 / H2 standalone semantics
- changes: `src/lib/finmindPeriodUtils.js:1` · `tests/api/finmind.test.js:1` · `tests/lib/finmindFundamentalsMapper.test.js:1`
- verify: `npx vitest run tests/api/finmind.test.js tests/lib/finmindFundamentalsMapper.test.js` → `19/19` passed
- status: DONE

## T57 backup import allowlist / schema / confirm
- changes: `src/hooks/useLocalBackupWorkflow.js:1` · `src/lib/appMessages.js:1` · `tests/hooks/usePortfolioPersistence.test.jsx:1`
- verify: `npx vitest run tests/hooks/usePortfolioPersistence.test.jsx tests/hooks/usePortfolioSnapshotRuntime.test.jsx` → `12/12` passed · `rg -q "schemaVersion|confirm" src api tests`
- status: DONE

## T60 cron last-success markers + lateness alerts
- changes: `src/lib/cronLastSuccess.js:1` · `api/cron/collect-target-prices.js:1` · `api/cron/collect-news.js:1` · `api/cron/collect-daily-events.js:1`
- verify: `npx vitest run tests/vercel-config.test.js tests/api/collect-target-prices.test.js tests/api/collectNews.test.js` → `12/12` passed · `rg -q "last-success|lateness" api scripts src`
- status: DONE

## M15 shared stale badge primitive
- changes: `src/components/common/StaleBadge.jsx:1` · `src/components/holdings/HoldingsTable.jsx:1` · `src/components/overview/OverviewPanel.jsx:1` · `src/components/events/EventsPanel.jsx:1` · `src/components/reports/DailyReportPanel.jsx:1`
- verify: `test -f src/components/common/StaleBadge.jsx && npx vitest run tests/components/holdingsPanel.test.jsx tests/components/AppPanels.contexts.test.jsx tests/hooks/usePortfolioDerivedData.test.jsx` → `48/48` passed
- status: DONE

## T66 GitHub CI workflow + verify local gate
- changes: `.github/workflows/ci.yml:1` · `tests/api/research-type-awareness.test.js:1`
- verify: `npm run verify:local` → GREEN · `860/860` tests passed · build passed · `healthcheck` passed · `smoke:ui` passed
- note: CI workflow now installs Playwright Chromium, starts local dev server on `127.0.0.1:3002`, waits for readiness, then runs `npm run verify:local`
- status: DONE

## progress.json 更新後
- shipBefore done: `13/30`
- completionPct: `43.52%`
- etaDaysToShipBefore: `14`

## note
- all 6 auto items completed without rollback
- progress.json + agent bridge `r123-T30/T31/T57/T60/M15/T66` synced to VM
