# DEBUG REPORT: Research Workflow Extraction

Date: 2026-03-28
Owner: Codex

## What changed

- Added `src/hooks/useResearchWorkflow.js`
- Added `src/lib/researchRuntime.js`
- Moved `runResearch()` orchestration out of `src/App.jsx`

## New boundary

- `src/App.jsx`
  - keeps research UI state and panel wiring
- `src/hooks/useResearchWorkflow.js`
  - owns async research flow, API call, result writeback, optional dossier enrich, and brain update
- `src/lib/researchRuntime.js`
  - owns research stock snapshot building, dossier shaping, request payload assembly, primary result extraction, and history merge

## Validation

- `npm run lint`
- `npm run typecheck`
- `npx vitest run tests/lib/researchRuntime.test.js`
- `npm run build`

## Notes

- this follows the same pattern as `useDailyAnalysisWorkflow` + `dailyAnalysisRuntime`
- next clean step would be to unify route-shell research flow with `useResearchWorkflow` so `App.jsx` and `pages/*` stop drifting
