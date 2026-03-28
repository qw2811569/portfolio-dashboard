# OPTIMIZATION REPORT 2026-03-27: Web Vitals Runtime Adapter

## done

- 安裝 `web-vitals@5.2.0`
- `src/lib/runtimeLogger.js` 現在負責 bootstrap 全部 client-side diagnostics
- `window error`、`unhandled rejection`、`React ErrorBoundary`、`web-vitals` 都已收斂到同一個 sessionStorage sink
- `web-vitals` 使用 attribution build，會寫入：
  - `CLS`
  - `FCP`
  - `INP`
  - `LCP`
  - `TTFB`

## changed files

- `package.json`
- `package-lock.json`
- `src/lib/runtimeLogger.js`
- `src/main.jsx`
- `docs/AI_COLLABORATION_GUIDE.md`
- `docs/superpowers/status/current-work.md`

## adapter shape

- storage key: `sessionStorage["pf-runtime-diagnostics-v1"]`
- error records:
  - `kind: "window-error"`
  - `kind: "unhandled-rejection"`
  - `kind: "error-boundary"`
- performance records:
  - `kind: "web-vital"`
  - `context.metric`
  - `context.attribution`

## implementation notes

- `bootstrapRuntimeDiagnostics()` 只會註冊一次，避免 HMR 或重複初始化造成多組 listeners / observers
- `web-vitals` 透過 lazy import + `requestIdleCallback`/`setTimeout` 延後載入，遵循官方建議，不阻塞使用者主要互動
- `captureWebVitalMetric()` 不會把性能資料當成 `console.error` 狂噴，但仍會寫進 diagnostics sink，供本地 debug 與後續監控 adapter 使用

## verification

- `npm run lint`
- `npm run build`
- `npm run verify:local`

## next best step

- 若要接第三方服務，優先在 `src/lib/runtimeLogger.js` 補 adapter：
  - `sendDiagnosticToSentry(entry)`
  - `sendDiagnosticToAnalytics(entry)`
- 若要把性能監控拉到更完整，可再補 `web-vitals` 上報抽樣、route dimension、以及 portfolio/page context
