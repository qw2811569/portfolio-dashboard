# OPTIMIZATION REPORT 2026-03-28: Remote Diagnostics Adapters

## done

- `src/lib/runtimeLogger.js` 已升級成可插拔 remote monitoring pipeline
- 新增 remote sink registry、debounced queue、batch flush、pagehide/visibilitychange flush
- 內建兩種 adapter：
  - analytics HTTP sink
  - Sentry bridge sink
- 新增 `/api/telemetry`，可接收 `capture-diagnostics` 批次 payload
- 新增 `runtimeLogger` 單元測試，覆蓋 local sink、analytics sink、Sentry sink

## changed files

- `src/lib/runtimeLogger.js`
- `api/telemetry.js`
- `tests/lib/runtimeLogger.test.js`
- `docs/AI_COLLABORATION_GUIDE.md`
- `docs/superpowers/status/current-work.md`
- `package-lock.json`

## remote config

可用 `window.__PORTFOLIO_RUNTIME_MONITORING__` 在 app boot 前啟用：

```js
window.__PORTFOLIO_RUNTIME_MONITORING__ = {
  sampleRate: 1,
  analytics: {
    enabled: true,
    endpoint: '/api/telemetry',
  },
  sentry: {
    enabled: true,
    useGlobal: true,
    captureWebVitals: true,
    tags: { app: 'portfolio-dashboard' },
  },
  queue: {
    flushIntervalMs: 3000,
    batchSize: 10,
  },
}
```

也可改用 Vite env：

- `VITE_RUNTIME_ANALYTICS_ENABLED=true`
- `VITE_RUNTIME_ANALYTICS_ENDPOINT=/api/telemetry`
- `VITE_RUNTIME_SENTRY_ENABLED=true`
- `VITE_RUNTIME_DIAGNOSTICS_SAMPLE_RATE=1`

## payload shape

analytics sink 會送：

```json
{
  "action": "capture-diagnostics",
  "data": {
    "source": "client-runtime",
    "entries": []
  }
}
```

`/api/telemetry` 會保留最近 200 筆 diagnostics，`GET /api/telemetry?action=recent` 可讀最近 50 筆。

## why this matters

- 現在這條監控鏈已經不是 local-only demo，而是可以真實上報的 pipeline
- 之後要接 Sentry SDK 或自家 analytics，不需要再修改 `ErrorBoundary`、`main.jsx` 或 `web-vitals` 呼叫點
- queue + flush 讓一般互動不會每筆都立刻打網路，`pagehide`/`visibilitychange` 又能盡量減少資料遺失

## verification

- `npm run lint`
- `npm run test:run`
- `npm run verify:local`

## next best step

- 若進入正式 production 監控，下一步最值得補的是：
  - route / portfolio / user session dimension
  - analytics sampling policy
  - Sentry release/environment tags
