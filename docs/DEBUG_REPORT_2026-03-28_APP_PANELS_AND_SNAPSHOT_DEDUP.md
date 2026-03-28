# App Shell 去重報告

最後更新：2026-03-28

## 本輪目標

把 `src/App.jsx` 裡仍殘留的兩塊組裝層重複收斂：

- portfolio snapshot 欄位清單重複
- tab panel render skeleton 重複

## 已完成

### 1. snapshot 欄位清單收斂

新增：

- [src/lib/appShellRuntime.js](/Users/chenkuichen/APP/test/src/lib/appShellRuntime.js)

目前由這個 module 提供：

- `buildLivePortfolioSnapshot()`
- `resolveRuntimeNewsEvents()`
- `filterEventsByType()`

因此 [src/App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 原本兩份重複的 live snapshot 欄位清單，現在已收成單一 source of truth，供：

- `flushCurrentPortfolio()`
- `useLocalBackupWorkflow()` 的 `liveSnapshot`

共用。

### 2. tab panel render skeleton 收斂

新增：

- [src/components/AppPanels.jsx](/Users/chenkuichen/APP/test/src/components/AppPanels.jsx)

現在 `App` 不再自己堆八段：

- `viewMode !== OVERVIEW_VIEW_MODE && tab === "..."`
- `ErrorBoundary`
- `Panel props`

改由 `AppPanels` 內的 panel registry 管理 active panel render。

## 這輪修掉的維護風險

- 新增 portfolio persisted field 時，不再需要同時手改兩份 snapshot 欄位清單
- `newsEvents || NEWS_EVENTS` fallback 不再散落在多個位置
- panel 邊界與 `ErrorBoundary` wrapper 不再在 `App.jsx` 重複展開

## 結果

- [src/App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 降到約 `1111` 行
- 全量測試提升到 `22 files / 97 tests`

## 驗證

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run check:fast-refresh`
- `npm run healthcheck`
- `npm run smoke:ui`

全部通過。
