# Route Runtime First Tranche

日期：2026-03-28  
狀態：完成

## 這輪目標

不是直接把整個 app 切去 `App.routes.jsx`，而是先把 `src/pages/*` 裡最明顯的 placeholder state / handler 拿掉，讓 route shell 至少開始吃真實的 localStorage/runtime snapshot。

## 這輪新增

- `src/lib/routeRuntime.js`
- `src/pages/usePortfolioRouteContext.js`

## 這輪做了什麼

### 1. `PortfolioLayout` 不再只是假的 header 容器

`src/pages/PortfolioLayout.jsx` 現在會：

- 讀取真實 portfolio snapshot
- 讀取 market cache / sync 狀態
- 建立真實的 `portfolioSummaries`
- 建立 `Header` 需要的實際 metrics / tabs / notes / portfolio manager actions
- 透過 `Outlet context` 把目前組合資料與持久化 action 往子頁傳

### 2. route pages 已開始吃真資料

以下頁面已從 placeholder store / 假 handler 切到 route context 或 runtime snapshot：

- `src/pages/HoldingsPage.jsx`
- `src/pages/WatchlistPage.jsx`
- `src/pages/EventsPage.jsx`
- `src/pages/NewsPage.jsx`
- `src/pages/LogPage.jsx`
- `src/pages/DailyPage.jsx`
- `src/pages/ResearchPage.jsx`
- `src/pages/TradePage.jsx`
- `src/pages/OverviewPage.jsx`

### 3. 可持久化的 action 已落地

目前 route shell 內已可透過真實 localStorage/action 更新：

- 持倉
- watchlist
- 事件復盤
- 日報 / 分析歷史
- 研究歷史
- trade log
- portfolio notes
- 目標價 / 基本面手動更新
- portfolio create / rename / delete
- 本機 backup export / import

## 目前仍保留的限制

這一層仍不是主 runtime，請不要誤判為「路由遷移完成」。

尚未完全收斂的點：

1. `src/main.jsx -> src/App.jsx` 仍是正式主入口
2. `src/pages/PortfolioLayout.jsx` 現在雖然可用，但還偏重，下一輪值得再往 hook / lib 切
3. `WatchlistPage` 目前新增/編輯仍用 `prompt()`
4. route shell 這條線目前還沒有專屬測試
5. `DailyPage / ResearchPage / TradePage` 已接真資料，但仍屬第一階段接線，離 production-grade route runtime 還有距離

## 驗證

- `npm run lint`
- `npm run typecheck`
- `npm run build`
