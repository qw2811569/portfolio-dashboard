# Debug Report: Event / Storage Extraction and Error Boundary Scope

Date: 2026-03-28  
Owner: Codex

## Summary

This round continued the `src/App.jsx` monolith reduction by extracting the remaining event / review / storage helper logic into dedicated utility modules, then narrowing runtime error boundaries from a whole-app wrapper to panel-scoped boundaries.

## What changed

- `src/lib/eventUtils.js`
  - Became the canonical home for event normalization, review defaults, slash-date parsing, stock outcome calculation, and review evidence refs.
- `src/lib/portfolioUtils.js`
  - Became the canonical home for portfolio registry normalization, localStorage helpers, backup import/export helpers, migration helpers, and backup collection helpers.
- `src/App.jsx`
  - Removed the remaining local copies of event / review / storage helpers and now imports them from `eventUtils` / `portfolioUtils`.
  - Added panel-scoped `ErrorBoundary` wrappers around `Header` and each major tab panel.
- `src/main.jsx`
  - Removed the root-level whole-app `ErrorBoundary` wrapper.
- `src/components/ErrorBoundary.jsx`
  - Expanded to support `scope`, `title`, `description`, and scoped diagnostics metadata.
- `scripts/healthcheck.sh`
  - Cleaned up redundant shell string interpolation while preserving the current frontend resource and Vite log checks.

## Architecture impact

- `App.jsx` is now more clearly an orchestration shell.
- Reusable event logic should go to `src/lib/eventUtils.js`, not back into `App.jsx`.
- Reusable portfolio storage / backup logic should go to `src/lib/portfolioUtils.js`, not back into `App.jsx`.
- Error handling is now localized: a single panel failure should not collapse the whole workspace UI.

## Verification

- `npm run check:fast-refresh`
- `npm run lint`
- `npm run build`

All passed after resolving barrel export namespace conflicts during the refactor.

## Follow-up guardrails

- Do not re-export helper functions from `src/App.jsx`.
- Prefer direct imports from `src/lib/eventUtils.js` and `src/lib/portfolioUtils.js` instead of recreating local helpers.
- Keep `src/main.jsx` focused on bootstrapping only; panel boundaries belong closer to the UI slices they protect.
