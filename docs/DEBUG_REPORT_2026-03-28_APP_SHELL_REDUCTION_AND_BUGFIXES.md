# Debug Report 2026-03-28: App Shell Reduction And Bugfixes

## Scope

This pass continued the `src/App.jsx` shell reduction and bug sweep with three goals:

1. Move remaining dossier/report/backup orchestration out of `App.jsx`
2. Fix real regressions exposed by stricter lint and full-suite tests
3. Keep the current runtime (`src/main.jsx -> src/App.jsx`) healthy while making the file easier to reason about

## New boundaries

- `src/hooks/usePortfolioDossierActions.js`
  - owns `updateTargetPrice`
  - owns `updateAlert`
  - owns `upsertTargetReport`
  - owns `upsertFundamentalsEntry`

- `src/hooks/useReportRefreshWorkflow.js`
  - owns `refreshAnalystReports`
  - owns `enrichResearchToDossier`
  - owns `reportRefreshing / reportRefreshStatus / enrichingResearchCode`

- `src/hooks/useLocalBackupWorkflow.js`
  - owns local backup export/import
  - owns `backupFileInputRef`

- `src/hooks/useEventLifecycleSync.js`
  - owns the event status/price-history synchronization effect that used to live inline in `App.jsx`

- `src/hooks/useAppConfirmationDialog.js`
  - owns app-level confirm dialog state and promise-based request/resolve flow

- `src/lib/reportRefreshRuntime.js`
  - owns structured research extraction plan shaping
  - owns analyst report batch merge helpers
  - owns report refresh meta merge helpers

## Real bugs fixed

- `Events` tab filtering was incorrectly reading seed `NEWS_EVENTS` instead of live `newsEvents` state. It now uses runtime state.
- `saved` toast messages could clear each other early because old timeouts were not cancelled. `flashSaved()` now clears the previous timer before scheduling a new one.
- `App.jsx` had multiple render-phase `ref.current` reads/writes that now fail stricter lint. These were moved to effects or replaced with existing state (`portfolioSwitching`) where appropriate.
- `tradePanel.dialogs.test.jsx` was flaky under full-suite load because it sat on the default per-test timeout boundary. The test now uses an explicit timeout.

## Result

- `src/App.jsx` reduced from `1693` lines to `1198` lines in this reduction sequence
- `App.jsx` is now closer to an orchestration shell:
  - state wiring
  - hook composition
  - panel rendering
  - minimal inline UI helpers only

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run check:fast-refresh`
- `npm run healthcheck`
- `npm run smoke:ui`

All passed on 2026-03-28.

## Next best candidates if further slimming is needed

- extract weekly-report clipboard flow into a tiny hook/runtime pair
- move app-level transient UI state (`saved`, confirm dialog, maybe tab-local helpers) into smaller UI hooks
- continue converging route shell workflows onto the same shared hooks where it is low-risk
