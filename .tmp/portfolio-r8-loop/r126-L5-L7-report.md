# R126 · L5-L7 sixth wave report · 2026-04-18 21:53:01 CST

## T04 Post-close ritual mode + tomorrow-action card
- changes: `src/hooks/usePostCloseSilentSync.js` · `src/hooks/useDailyAnalysisWorkflow.js` · `src/lib/dailyAnalysisRuntime.js` · `src/lib/reportUtils.js` · `src/components/reports/DailyReportPanel.jsx` · related tests
- outcome:
  - post-close silent sync now runs as a once-per-day ritual path per portfolio and carries explicit ritual metadata
  - daily analysis now extracts `明日觀察與操作建議` into a structured tomorrow-action card
  - daily panel surfaces `收盤後儀式模式` and renders the tomorrow-action card above the summary card
- verify:
  - `tests/hooks/usePostCloseSilentSync.test.jsx` · `tests/hooks/useDailyAnalysisWorkflow.test.jsx` → PASS
  - shared `npm run build` → PASS
- status: DONE

## T22 Weekly export narrative + insider section
- changes: `src/hooks/useAppRuntimeWorkflows.js` · `src/hooks/useAppRuntimeComposer.workflowArgs.js` · `src/hooks/useWeeklyReportClipboard.js` · `src/lib/promptTemplateCatalog.js` · `src/components/reports/DailyReportPanel.jsx` · `tests/lib/promptTemplateCatalog.test.js`
- outcome:
  - weekly clipboard export now knows the active portfolio and emits a `Weekly Narrative` block
  - insider-scoped portfolios now append `Insider Compliance Notes` with fact-only / no-trade-instruction guardrails
  - daily panel adds a visible export note so the new narrative / insider payload is discoverable from the close-analysis surface
- verify:
  - `rg -q "weekly|clipboard|insider" src/hooks/useWeeklyReportClipboard.js src/components/reports/DailyReportPanel.jsx` → PASS
  - shared `npm run build` → PASS
- status: DONE

## T72a Minimal legal/docs pack
- changes: `docs/release/internal-beta-checklist.md`
- outcome:
  - internal beta checklist now records disclaimer / privacy / residency / audit expectations
  - remaining manual gates `T64` / `Q06` are explicitly left blocked in the release checklist
- verify:
  - `test -f docs/release/internal-beta-checklist.md && rg -q "disclaimer|privacy|residency|audit" docs` → PASS
- status: DONE

## Q05 RBAC manual verification script + evidence checklist
- changes: `docs/runbooks/rbac-manual-verification.md`
- outcome:
  - runbook now covers admin / user / 403 / per-portfolio checks plus evidence capture
  - pass/fail matrix is explicit enough for manual signoff instead of ad-hoc browser checks
- verify:
  - `test -f docs/runbooks/rbac-manual-verification.md && rg -q "admin|403|portfolio" docs/runbooks/rbac-manual-verification.md` → PASS
- status: DONE

## Q07 WCAG AA smoke pack
- changes: `docs/qa/accessibility-checklist.md` · `tests/components/accessibilitySmoke.test.jsx`
- outcome:
  - accessibility checklist now tracks keyboard / contrast / screen reader expectations
  - a lightweight automatic smoke test now guards the daily panel's primary accessible labels and actions
- verify:
  - `test -f docs/qa/accessibility-checklist.md && rg -q "keyboard|contrast|screen reader" docs/qa/accessibility-checklist.md` → PASS
  - `tests/components/accessibilitySmoke.test.jsx` → PASS
  - shared `npm run build` → PASS
- status: DONE

## Q12 Corrupt-file / schema-drift / oversized backup tests
- changes: `src/hooks/useLocalBackupWorkflow.js` · `tests/hooks/usePortfolioPersistence.test.jsx` · `tests/hooks/usePortfolioSnapshotRuntime.test.jsx` · `tests/api/portfolio-snapshots.test.js`
- outcome:
  - backup import now reports corrupt JSON with the canonical `backupInvalidJson` message instead of raw parser noise
  - new tests cover oversized backup rejection, corrupt backup JSON, schema-drifted snapshot normalization, schemaVersion drift, and corrupt snapshot payloads
- verify:
  - `tests/hooks/usePortfolioPersistence.test.jsx` · `tests/hooks/usePortfolioSnapshotRuntime.test.jsx` · `tests/api/portfolio-snapshots.test.js` → PASS
  - `rg -q "schemaVersion|oversized|corrupt" tests src` → PASS
- status: DONE

## Manual Items Left Blocked
- `T64` restore drill / rollback / MDD recovery: blocked · awaiting user manual run (`M-U2`)
- `Q06` cross-browser matrix with real iOS Safari: blocked · awaiting real-device evidence (`M-U3`)

## Combined Verify
- `npx vitest run tests/hooks/usePostCloseSilentSync.test.jsx tests/hooks/useDailyAnalysisWorkflow.test.jsx` → `7/7` tests passed
- `npx vitest run tests/hooks/usePortfolioPersistence.test.jsx tests/hooks/usePortfolioSnapshotRuntime.test.jsx tests/api/portfolio-snapshots.test.js` → `33/33` tests passed
- extended safety net:
  - `npx vitest run tests/lib/dailyAnalysisRuntime.test.js tests/lib/promptTemplateCatalog.test.js tests/components/AppPanels.contexts.test.jsx tests/components/accessibilitySmoke.test.jsx` → PASS
- `npm run build` → PASS

## Sync / Progress
- done synced:
  - `T04` · `T22` · `T72a` · `Q05` · `Q07` · `Q12`
- blocked synced:
  - `r126-T64` → `blocked`
  - `r126-Q06` → `blocked`
- progress after mark:
  - ship-before `25/30`
  - ETA `3d`
