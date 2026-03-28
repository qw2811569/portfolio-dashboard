# OPTIMIZATION REPORT 2026-03-27: Fast Refresh, Healthcheck, Diagnostics

## done

- 將 `src/App.jsx` 的 Fast Refresh 約束變成可執行檢查：新增 `npm run check:fast-refresh`
- `verify:local` 現在會先跑 Fast Refresh 邊界檢查，再跑 lint / typecheck / tests / build / healthcheck / UI smoke
- `scripts/healthcheck.sh` 新增前端資源檢查，會驗證 `/index.html`、`/@vite/client`、`/src/main.jsx` 和首頁 linked assets
- 新增 `src/lib/runtimeLogger.js` 作為前端結構化錯誤收集基線
- `src/main.jsx` 的 `window.error` / `unhandledrejection` 與 `src/components/ErrorBoundary.jsx` 現在都會走同一套 diagnostics sink

## changed files

- `package.json`
- `scripts/check-fast-refresh-boundaries.mjs`
- `scripts/healthcheck.sh`
- `src/lib/runtimeLogger.js`
- `src/main.jsx`
- `src/components/ErrorBoundary.jsx`
- `docs/AI_COLLABORATION_GUIDE.md`
- `docs/superpowers/status/current-work.md`

## why this matters

- Fast Refresh 問題不能只靠 log 肉眼巡檢，否則之後很容易被無意間把 helper / constants 又塞回 `App.jsx`
- port 通了不代表前端 entry 與 Vite client 真能載入；healthcheck 若不查資源，容易出現假綠燈
- 現在 repo 的前端錯誤多半散在 `console.error`；先收斂成本地 structured diagnostics，之後不管接 Sentry、LogRocket 或 Web Vitals，都有共同入口

## monitoring recommendation

目前先不直接接第三方 SaaS，而是採兩段式：

1. 先用 `src/lib/runtimeLogger.js` 收斂前端 runtime diagnostics
2. 等到 production 監控需求更明確，再在同一入口掛：
   - Sentry：錯誤追蹤與 stack aggregation
   - LogRocket：session replay
   - Web Vitals：載入 / 互動性能指標

這樣可以先拿到一致的 debug 訊號，又不會在本地開發階段過早綁死第三方 SDK。

## verification

- `npm run check:fast-refresh`
- `npm run lint`
- `npm run verify:local`

## risks

- `check:fast-refresh` 目前只守 `src/App.jsx` 這個最高風險入口；若未來還有其他 component entry 承擔 mixed exports，需要把清單擴充
- `sessionStorage["pf-runtime-diagnostics-v1"]` 是本地開發診斷資料，不可誤當持久化業務資料

## next best step

- 若要再強化監控，下一步最值得補的是 `web-vitals` 收集與 `runtimeLogger` adapter 介面
- 若未來 route shell 真成為正式入口，記得把新的 root boundary 一起納入 `check-fast-refresh-boundaries.mjs`
