# Debug Report: Helper Extraction Recovery

Date: 2026-03-28  
Owner: Codex

## Context

An in-progress refactor left `src/App.jsx` in a half-extracted state:

- `App.jsx` imported holdings helpers that were still defined locally, causing duplicate identifier parse failures.
- `src/lib/market.js` and `src/lib/portfolioUtils.js` had been partially overwritten with placeholder implementations.
- `src/utils.js` still expected exports that the refactor had temporarily removed from shared lib modules.

## Fixes applied

- Restored `src/lib/market.js` as the canonical source for:
  - market cache normalization
  - persisted quote loading
  - post-close sync gating
  - cached quote lookup
  - TWSE price extraction helpers
- Restored `src/lib/portfolioUtils.js` as the canonical source for:
  - portfolio registry normalization
  - localStorage helpers
  - backup import/export helpers
  - legacy migration helpers
  - holdings repair helpers
  - bootstrap helpers for seeded portfolio / registry / snapshot loading
- Restored `src/lib/datetime.js` exports that compatibility layers still depend on:
  - `parseStoredDate`
  - `parseFlexibleDate`
  - `todayStorageDate`
  - `formatDateToStorageDate`
  - formatting helpers such as `formatDateTW`, `formatDateTime`, `getRelativeTime`
- Removed the duplicated local date / market / holdings helper block from `src/App.jsx`
- Rewired `src/App.jsx` to import these helpers from `src/lib/*`
- Fixed `src/utils.js` compatibility re-export so `fetchJsonWithTimeout` comes from `src/lib/utils.js`
- Widened `tsconfig.json` include scope from only `src/lib/**/*.ts` to `src/**/*.ts` and `src/**/*.tsx`
- Unified `scripts/healthcheck.sh` string interpolation style to `${variable}`

## Result

- `src/App.jsx` shrank from about 3525 lines to 3159 lines
- `App.jsx` is again acting more like an orchestration shell instead of duplicating lib logic
- The compatibility layer in `src/utils.js` is back in a consistent state

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run check:fast-refresh`
- `npm run build`

All passed.
