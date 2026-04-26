# Codex Execute Report · R10 BG Role Split + Dark Mode Plumbing

Date: 2026-04-26
Branch: `main`

## Summary

Implemented the confirmed C+E direction:

- Added semantic surface roles: `appBg`, `surface`, `surfaceMuted`, `paper`, `raised`, `darkPanel`.
- Added light theme CSS variable contract and `<html data-theme="light">`.
- Rebound app-facing aliases away from large warm-paper surfaces:
  - `C.bg/C.shell -> appBg`
  - `C.card/C.cardBg/C.cardBlue/C.cardAmber/C.cardOlive/C.cardRose -> surface`
  - `C.cardHover/C.subtleElev -> surfaceMuted`
  - `C.subtle -> surface`
- Retuned specified page and primitive components toward white app background, cool gray surfaces, raised floaters, paper-only holdings table rows, and retained dark Today Focus panel.
- Fixed small-text contrast by removing raw `iron` as a component text color on light surfaces.

## Commits Pushed

1. `53c1cba` Add light surface theme roles
2. `9499484` Rebind app surfaces to light roles
3. `d80a5c1` Retune overview surfaces
4. `55a637d` Retune holdings paper surfaces
5. `13c35da` Retune daily report surfaces
6. `525594c` Retune event news research surfaces
7. `ea9dce9` Retune workflow list surfaces
8. `8dd0030` Retune common surface primitives
9. `b2398bf` Fix muted text contrast on light surfaces

## Verification

- `npm run test:run`: 222 files passed, 1311 tests passed.
- `npm run lint`: 0 errors, 2 pre-existing warnings:
  - `src/components/Header.jsx:707` unused `mobileActionsRow`
  - `src/components/common/AnimatedNumber.jsx:58` unused `_value`
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Build entry hash: `index-CfFLQrJZ.js`.
- `rg -n "color: C\\.iron|color: TOKENS\\.iron" src/components --glob '*.jsx'`: 0 matches.
- `rg -n "background:" src/components --glob '*.jsx' | rg '#[0-9A-Fa-f]{3,8}'`: 0 matches.
- CSS variable usage count for `--app-bg|--surface|--paper`: 4.

## Screenshots

Ran the requested visual audit against the default VM target:

```bash
npx playwright test tests/e2e/visual-audit.spec.mjs --project=chromium
```

Result: 14/14 passed.

The VM target was still serving old asset hash `index-B1vV0KIq.js`, while local build produced `index-CfFLQrJZ.js`, so I also reran the same 14-shot audit against local Vite:

```bash
AUDIT_BASE_URL=http://127.0.0.1:3002/ npx playwright test tests/e2e/visual-audit.spec.mjs --project=chromium
```

Result: 14/14 passed.

Screenshots were written by the existing spec to:

```text
.tmp/r156-full-execute/round4/screenshots/
```

Visual read: app background is now white/cool-gray, major panels sit on `surface/raised`, holdings rows keep the tactile `paper` feel, and the dark Today Focus panel remains the weight anchor. This is materially closer to inspiration 02/06 for the app ground while retaining mockup-01 paper character in holdings/news/report content areas.

## Notes

- No Vercel deploy was run.
- No `@vercel/blob` import was added.
- No dark palette was implemented; only the light theme contract/plumbing was added for R12.
- No motion behavior was changed.
