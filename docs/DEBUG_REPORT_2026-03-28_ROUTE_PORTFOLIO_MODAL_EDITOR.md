# Shared Portfolio Dialogs

Date: 2026-03-28  
Owner: Codex

## Summary

Both the route runtime and the stable main runtime now use the same Header-driven portfolio dialogs for create / rename / delete.

`src/hooks/useRoutePortfolioRuntime.js` and `src/hooks/usePortfolioManagement.js` now manage controlled dialog state, and `src/components/Header.jsx` renders the shared create / rename modal plus delete confirmation dialog.

## What changed

- `src/hooks/useRoutePortfolioRuntime.js`
  - removed `window.prompt()` from route-shell `createPortfolio()` and `renamePortfolio()`
  - removed `window.confirm()` from route-shell `deletePortfolio()`
  - added controlled state for:
    - open / close
    - mode (`create` / `rename`)
    - name draft
    - target portfolio
    - submitting state
  - exposed shared dialog controls to `Header` through `headerProps.portfolioEditor` and `headerProps.portfolioDeleteDialog`
- `src/hooks/usePortfolioManagement.js`
  - stable main runtime now exposes the same `portfolioEditor` and `portfolioDeleteDialog` shape as route runtime
  - removed legacy `window.prompt()` and `window.confirm()` usage from this hook
- `src/components/Header.jsx`
  - added `PortfolioEditorModal`
  - added `PortfolioDeleteModal`
  - top-level `＋ 新組合` now opens the modal when `portfolioEditor.openCreate` is provided
  - portfolio manager `改名` now opens the modal when `portfolioEditor.openRename` is provided
  - portfolio manager `刪除` now opens the confirmation dialog when `portfolioDeleteDialog.open` is provided
  - remains backward-compatible: if dialog props are not passed, Header still falls back to the callback shape
- `src/App.jsx`
  - stable runtime now passes `portfolioEditor` and `portfolioDeleteDialog` down to Header

## Tests added

Extended `tests/routes/routePages.actions.test.jsx` with:

- route-shell portfolio creation through header modal
- route-shell portfolio rename through header modal
- route-shell portfolio deletion through header confirmation dialog

The route tests now assert:

- `window.prompt()` is not called for create / rename
- `window.confirm()` is not called for delete

## Current boundary

- route shell: create / rename / delete is dialog-based
- stable main runtime: create / rename / delete now uses the same shared Header dialog contract
- the remaining `confirm()` usage in the repo is outside this shared portfolio manager slice

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run check:fast-refresh`

All passed on 2026-03-28.
