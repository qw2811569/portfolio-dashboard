# Route Runtime Hook And Tests

日期：2026-03-28  
狀態：完成

## 這輪做了什麼

### 1. `PortfolioLayout` 再切薄一層

- 新增 `src/hooks/useRoutePortfolioRuntime.js`
- `src/pages/PortfolioLayout.jsx` 現在只保留：
  - render `Header`
  - render `Outlet`
  - 從 hook 取得 `headerProps` 與 `outletContext`

這代表 route shell 的主要 orchestration 已不再卡在 page component 本身。

### 2. route-level tests 已補上

新增：

- `tests/routes/portfolioLayout.routes.test.jsx`

目前覆蓋兩條關鍵路徑：

1. `PortfolioLayout` 會從 runtime snapshot hydrate `Outlet context`，且 child route 可以透過 `setPortfolioNotes()` 持久化回 localStorage
2. 從 header tab 點擊「觀察股」時，router 會從 holdings route 正常切到 watchlist route，並渲染對應頁面內容

### 3. 相容邊界順手補齊

- `canRunPostClosePriceSync` 現在回到 `src/lib/datetime.js` 作為 canonical export
- `src/lib/market.js` 保留 re-export，避免舊 import 路徑失效

## 結果

- `PortfolioLayout.jsx` 從大型 runtime page 退回成薄容器
- route runtime 現在有明確 hook 邊界
- route shell 第一次有真正的 route integration tests，不再只有 hook/lib 單元測試

## 驗證

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run check:fast-refresh`
