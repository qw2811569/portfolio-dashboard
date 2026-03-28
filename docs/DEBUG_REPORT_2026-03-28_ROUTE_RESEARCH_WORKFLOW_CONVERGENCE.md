# DEBUG REPORT 2026-03-28 Route Research Workflow Convergence

## Summary

This pass converged the route-shell research flow onto the shared `useResearchWorkflow()` path so `src/App.jsx` and `src/pages/ResearchPage.jsx` no longer maintain separate research orchestration logic.

## What changed

- `src/hooks/useRouteResearchPage.js`
  - Removed the route-only inline `useRunResearch()` mutation flow.
  - Now delegates `onResearch` / `onEvolve` to `src/hooks/useResearchWorkflow.js`.
  - Keeps only route-local glue for:
    - local `researchResults`
    - dossier enrichment mutation
    - report refresh mutation

- `src/hooks/useResearchWorkflow.js`
  - Added `defaultRunResearchRequest()` with `res.ok` handling.
  - Added optional `notifySaved()` adapter so route shell can reuse the workflow with `flashSaved()`.
  - Fixed a real bug: `researchTarget` now resets in `finally`, so the UI does not stay stuck on an old target label after completion/failure.

- `src/hooks/useRoutePortfolioRuntime.js`
  - Added persistent `setStrategyBrain()` to route outlet context.
  - Upgraded `flashSaved(message, timeout)` so shared workflows can control message duration.
  - This lets route-shell `onEvolve` persist `newBrain` back into route runtime storage instead of staying page-local.

- `src/components/research/ResearchPanel.jsx`
  - Fixed `h` shadowing in `StockResearchButtons()`.
  - This was a real runtime bug revealed by the new route research integration test.

## Tests

- Added route research integration coverage to `tests/routes/routePages.actions.test.jsx`.
- Verified:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:run`
  - `npm run build`
  - `npm run check:fast-refresh`

## Current state

- Route research and main runtime research now share one orchestration hook.
- Route shell can persist `researchHistory` and `strategyBrain` updates from shared research flow.
- Full test baseline is now `14 files / 81 tests`.
