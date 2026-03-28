# DEBUG REPORT 2026-03-28: Dialog Primitives And Trade Capture

## Summary

This sweep converged two UX/runtime boundaries:

1. `Header.jsx` no longer ships its own portfolio-specific modal implementation.
2. Trade screenshot upload no longer assumes "single image, single trade, today = trade date".

The result is a more consistent dialog boundary, a safer screenshot ingestion flow, and one shared runtime path for both the stable `App.jsx` entry and the route shell.

## What Changed

### 1. Header dialogs now use shared primitives

- `src/components/Header.jsx` now renders portfolio create/rename through `TextFieldDialog`
- `src/components/Header.jsx` now renders portfolio delete through `ConfirmDialog`
- `src/components/common/Dialogs.jsx` is now the canonical dialog layer for:
  - confirm/delete flows
  - text edit/create flows
  - OCR correction flows

This removes the last portfolio-specific custom modal implementation from `Header`.

### 2. Trade screenshot flow was rebuilt around a shared hook

New canonical pieces:

- `src/hooks/useTradeCaptureRuntime.js`
- `src/lib/tradeParseUtils.js`

Both `src/App.jsx` and `src/hooks/useRouteTradePage.js` now use the same capture runtime.

This fixes several product/runtime problems:

- multiple screenshots can now be queued in one upload session
- the user can backfill the actual trade date instead of being forced onto "today"
- parsed batches now write **every** trade into `tradeLog` instead of only `parsed.trades[0]`
- mixed buy/sell batches now use a dedicated memo question set
- OCR output is normalized before writing into holdings/log state
- after one screenshot is submitted, the next queued screenshot becomes the active item automatically

### 3. Trade panel UX changes

- `TradePanel` now supports multi-file upload
- queue state is visible in the UI
- each queued image can be selected or removed
- parsed batches expose editable `tradeDate`
- the panel makes it explicit when one screenshot will write multiple trade records
- parsed batches now show a preview summary before commit:
  - trade count
  - buy/sell distribution
  - estimated notional
  - affected stock codes
- low-confidence OCR is now surfaced before submit:
  - model-level `confidence` / `note`
  - per-row warnings for missing code / missing name / invalid qty / invalid price

New helper surface:

- `summarizeTradeBatch()` in `src/lib/tradeParseUtils.js`
- `assessTradeParseQuality()` in `src/lib/tradeParseUtils.js`

### 4. `lib` red-light cleanup path

Tooling status after this sweep:

- `npm run lint` passes
- `npm run typecheck` passes
- `npm run test:run` passes
- `npm run build` passes
- `npm run check:fast-refresh` passes

New regression-focused coverage:

- `tests/lib/tradeParseUtils.test.js`

This test locks:

- OCR payload normalization
- multi-trade log entry generation
- sequential holding application for parsed trade batches
- mixed buy/sell batch detection

## Files Changed

- `src/components/Header.jsx`
- `src/components/common/Dialogs.jsx`
- `src/components/trade/TradePanel.jsx`
- `src/hooks/useTradeCaptureRuntime.js`
- `src/hooks/useRouteTradePage.js`
- `src/lib/tradeParseUtils.js`
- `src/lib/index.js`
- `src/hooks/index.js`
- `src/constants.js`
- `src/App.jsx`
- `tests/lib/tradeParseUtils.test.js`

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run check:fast-refresh`

Final result:

- `12 files / 71 tests` passing
- Fast Refresh guard still green
- runtime dialog boundary is more uniform
- screenshot ingestion matches real backfill behavior better than before
