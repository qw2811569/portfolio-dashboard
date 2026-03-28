# Legacy Browser Dialogs Sweep

Date: 2026-03-28  
Owner: Codex

## Summary

Completed a runtime sweep for legacy browser dialogs and removed them from `src/`.

The app runtime no longer depends on `window.prompt()`, `window.confirm()`, or `window.alert()` inside the source tree.

## Inventory found before cleanup

Runtime usages found in `src/`:

- `src/components/trade/TradePanel.jsx`
  - OCR field correction used `prompt()`
- `src/components/watchlist/WatchlistPanel.jsx`
  - watchlist delete used `confirm()`
- `src/App.jsx`
  - post-close price refresh force path used `confirm()`
  - local backup import used `confirm()`
  - backup import failure used `alert()`

## What changed

- Added shared dialog components:
  - `src/components/common/Dialogs.jsx`
  - exported through `src/components/common/index.js`
- `TradePanel`
  - field correction now uses `TextFieldDialog`
- `WatchlistPanel`
  - delete confirmation now uses `ConfirmDialog`
- `App.jsx`
  - post-close refresh and backup import now use an app-level awaitable `ConfirmDialog`
  - backup import failure now reports through existing saved-status feedback instead of `alert()`

## Tests

- Added `tests/components/tradePanel.dialogs.test.jsx`
  - verifies trade field editing goes through dialog and does not call `prompt()`
- Existing route tests already cover:
  - watchlist add
  - watchlist delete dialog
  - portfolio create / rename / delete dialogs
  - news review persistence

## Final state

`rg -n "prompt\\(|confirm\\(|alert\\(" src` now returns no matches.

Legacy browser dialogs remain only in tests or intentionally outside this runtime sweep scope.

## Validation

- `rg -n "prompt\\(|confirm\\(|alert\\(" src`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run check:fast-refresh`

All passed on 2026-03-28.
