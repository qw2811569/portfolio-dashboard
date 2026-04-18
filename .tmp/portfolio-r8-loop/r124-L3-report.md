# R124 · L3 fourth wave report · 2026-04-18 21:13:25 CST

## T32 MOPS revenue / announcement ingestion + fallback
- changes: `api/mops-announcements.js:1` · `api/mops-revenue.js:1` · `api/event-calendar.js:291` · `src/lib/dataAdapters/twsePublicAdapter.js:77` · `tests/api/mops-contracts.test.js:1`
- outcome:
  - announcement API now accepts `YYYYMMDD` / `YYYY-MM-DD` / `YYYY/MM/DD`
  - MOPS announcement parser no longer depends on fixed 4-cell rows; optional `codes=` filter added
  - announcement fallback now uses FinMind news for missing / failed per-code rows
  - monthly revenue switched to official `ajax_t05st10_ifrs` path with honest degraded payload + FinMind revenue fallback
  - TWSE public adapter now reads `revenueYoY` / `revenueMoM` correctly instead of stale `yoy` / `mom`
- verify: `npx vitest run tests/api/mops-contracts.test.js tests/api/event-calendar.test.js tests/lib/dataAdapters.test.js tests/api/finmind.test.js` → PASS
- status: DONE

## T33 Today in Markets macro / 央行 / calendar feed
- changes: `src/components/overview/DashboardPanel.jsx:1` · `tests/components/dashboardPanel.test.jsx:1`
- outcome:
  - dashboard now renders `Today in Markets`
  - source uses existing `newsEvents` auto-calendar feed and groups into `總經` / `行事曆`
  - ordering is macro-first, then nearest date
  - empty state is explicit: `市場資訊暫無更新`
- verify: `npx vitest run tests/components/dashboardPanel.test.jsx tests/api/event-calendar.test.js` → PASS
- status: DONE

## T38 Accuracy Gate enforcement
- changes: `src/lib/accuracyGate.js:1` · `api/analyze.js:1` · `api/analyst-reports.js:1` · `api/research.js:1` · `src/lib/dailyAnalysisRuntime.js:1` · `src/lib/promptTemplateCatalog.js:1`
- outcome:
  - prompt builders now append `【Accuracy Gate】` across analyze / research / analyst reports / daily runtime / event review / stress test flows
  - insider-strip remains upstream; this round enforces hard gate after normalization
- verify: `npx vitest run tests/api/analyze.test.js tests/api/analyst-reports.test.js tests/api/research.test.js tests/lib/dailyAnalysisRuntime.test.js tests/lib/promptTemplateCatalog.test.js` → PASS
- status: DONE

## T40 analysisStage t0/t1 rollout
- changes: `src/hooks/useRouteDailyPage.js:1` · `tests/hooks/useRouteDailyPage.test.jsx:1`
- outcome:
  - route-shell daily page now passes `analysisHistory` / `staleStatus` / `operatingContext` / `maybeAutoConfirmDailyReport`
  - `DailyReportPanel` route mode now has the same t0/t1 diff + auto-confirm wiring as AppShell
- verify: `npx vitest run tests/hooks/useRouteDailyPage.test.jsx tests/components/AppPanels.contexts.test.jsx tests/hooks/useDailyAnalysisWorkflow.test.jsx tests/lib/dailyReportDiff.test.js` → PASS
- status: DONE

## T49 private Blob ACL + signed URL gate
- changes: `api/_lib/signed-url.js:1` · `api/blob-read.js:1` · `api/brain.js:1` · `api/research.js:1` · `api/report.js:1` · `api/_lib/portfolio-snapshots.js:1` · `api/cron/snapshot-portfolios.js:1` · `api/portfolio-mdd.js:1` · `api/telemetry.js:1` · `tests/api/portfolio-snapshots.test.js:1`
- outcome:
  - brain / research / portfolio snapshot blobs now write `access: 'private'`
  - telemetry remains `public` per Q3
  - signed read helper + `/api/blob-read` enforce 15 min TTL and HMAC signature
  - private blob reads in brain / research / report / snapshot / MDD paths now go through signed route instead of public blob URLs
- verify: `npx vitest run tests/api/portfolio-snapshots.test.js tests/api/research.test.js` → PASS
- status: DONE

## T62 checkpoint / backup includes localStorage
- changes: `scripts/backup-to-vm.mjs:1` · `scripts/create-checkpoint.sh:1` · `ops/cron/backup-to-vm.cron:1`
- outcome:
  - new backup script validates browser localStorage export JSON, mirrors latest copy into `.tmp/localstorage-backups/`, then uploads to VM `/home/chenkuichen/portfolio-backups/YYYY-MM-DD.json`
  - checkpoint bundle now carries latest mirrored localStorage backup artifact
  - installed user crontab entry: `CRON_TZ=Asia/Taipei` + daily `03:00` backup job
- note: backup script expects a browser export file path, `PORTFOLIO_BACKUP_EXPORT`, or the latest `~/Downloads/portfolio-backup-*.json`
- verify: `crontab -l | rg "portfolio-backup-to-vm"` → installed
- status: DONE

## verify:local
- `npm run verify:local` → GREEN
- result: `126/126` test files passed · `868/868` tests passed · build passed · `healthcheck` passed · `smoke:ui` passed

## progress / sync note
- `T32/T33/T38/T40/T49/T62` 已 mark done，`r124-*` bridge tasks 已同步到 VM
- ship-before done: `19/30`
- completionPct: `65.28%`
- etaDaysToShipBefore: `9`
