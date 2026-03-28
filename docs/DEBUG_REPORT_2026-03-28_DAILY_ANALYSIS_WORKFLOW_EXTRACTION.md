# DEBUG REPORT: Daily Analysis Workflow Extraction

Date: 2026-03-28
Owner: Codex

## What changed

- Added `src/lib/dailyAnalysisRuntime.js`
- Moved the pure daily-analysis builders out of `src/hooks/useDailyAnalysisWorkflow.js`
- Kept `src/hooks/useDailyAnalysisWorkflow.js` as the async orchestration boundary
- Cleaned `src/App.jsx` brainRuntime imports so the file no longer carries dead validation helpers
- Restored missing `brainRuntime` compatibility exports required by the current runtime:
  - `enforceTaiwanHardGatesOnBrainAudit()`
  - `appendBrainValidationCases()`
  - `findTopBrainAnalogMatches()`
  - `createBrainValidationCase()`

## New runtime boundary

- `src/App.jsx`
  - owns state and wiring
- `src/hooks/useDailyAnalysisWorkflow.js`
  - owns the async daily-analysis workflow and state transitions
- `src/lib/dailyAnalysisRuntime.js`
  - owns pure snapshot builders, event correlation, blind prediction scoring, reusable prompt payload builders, and report shaping

## Why this matters

- `App.jsx` is smaller and less coupled to the daily-analysis prompt contract
- the biggest prompt strings are no longer embedded inside the hook
- the daily-analysis pure logic is now directly testable without spinning up React state
- `brainRuntime` build compatibility is restored, so `vite build` is green again

## Validation

- `npm run lint`
- `npm run typecheck`
- `npx vitest run tests/lib/dailyAnalysisRuntime.test.js`
- `npm run test:run`
- `npm run build`
- `npm run check:fast-refresh`

## Follow-up

- next best extraction target is `runResearch` into a matching workflow hook
- after that, consider moving the remaining inline JSON-block parsing in `useDailyAnalysisWorkflow.js` into small parser helpers if the contract is stable
