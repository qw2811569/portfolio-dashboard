# AI 協作指南

最後更新：2026-03-28  
狀態：唯一 canonical AI 規則文件

---

## 1. 先讀順序

所有 AI 與人類接手者，先讀：

1. `docs/AI_COLLABORATION_GUIDE.md`
2. `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`
3. `docs/status/current-work.md`（只有在接手進行中的工作時）

長期角色補充在：

- `docs/status/ai-collaboration-channel.md`

但該檔不是啟動、驗證或 runtime 規則的 source of truth。

---

## 2. 這個程式在做什麼

這是一個台股投資決策工作台，不是單純看盤頁或聊天介面。

它把以下工作串成閉環：

- 持倉管理
- 觀察股管理
- 催化事件追蹤
- 收盤分析
- 深度研究
- 復盤與策略記憶沉澱

更完整說明看：

- `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`

---

## 3. 固定真相

### Runtime 入口

- 目前真正執行入口是 `src/main.jsx -> src/App.jsx`
- 不要假設 repo 已完全切到 route shell 版本
- `src/App.routes.jsx` 與 `src/pages/*` 目前仍視為 refactor scaffold，不可在未補齊真實 state / handler / derived data 前直接當成主 runtime
- 若發現 `src/main.jsx` 被改去 render `App.routes.jsx`，先視為未完成遷移，優先收回穩定 runtime，再逐段搬移
- route shell 第一批真實資料接線已落在 `src/lib/routeRuntime.js` 與 `src/pages/usePortfolioRouteContext.js`
- route shell 第二批頁面接線已收斂到 `src/hooks/useRoute*Page.js`；若要改 `Holdings / Watchlist / Events / News / Daily / Research / Trade / Log / Overview` 的 route 行為，先看對應 hook，不要再把 action assembly 塞回 `src/pages/*`
- `src/App.routes.jsx` 現在已自帶 route-local `QueryClientProvider`，因此 `Daily / Research` route hooks 所需的 TanStack Query provider 不應再由 page 自己兜底
- `src/hooks/useRoutePortfolioRuntime.js` 與 `src/hooks/usePortfolioManagement.js` 的 portfolio create / rename / delete，現在都走 `Header` 的 shared dialog props，不再在這兩個 hook 內使用 `window.prompt()` / `window.confirm()`
- `src/hooks/useRouteResearchPage.js` 的 `onResearch / onEvolve` 已改為共用 `src/hooks/useResearchWorkflow.js`；若 route shell 與主 runtime 的 research 行為不一致，先檢查這兩個 hook 的參數接線，而不是再複製一份 inline mutation
- 若任務是修 route pages 的 placeholder state / fake handler，先沿用這兩個入口，不要再回頭把假資料塞進 `src/pages/*`
- 若文件與實際程式不一致，以 repo 內目前檔案為準
- `src/App.jsx` 現在是 orchestration shell，不是 pure route shell
- `src/App.jsx` 必須維持 React Fast Refresh 相容的 export 形狀：只保留 default export `App`
- 不要再把 constants / helpers / storage utils 從 `src/App.jsx` 重新 export；若需要共用，移到 `src/lib/*`、`src/hooks/*` 或 `src/constants.js`
- 歷史快照 / backup 檔不可再放在 `src/` 活躍 source tree；請改放 `.archive/` 或 repo 外部備份
- JS/JSX workspace 專案邊界由 `jsconfig.json` 管理；新增檔案時請維持 include / exclude 收斂，不要把 `docs/`、`.tmp/`、`dist/`、`.archive/` 重新拉回活躍 JS project
- 目前主要 runtime 邊界如下：
- `src/hooks/usePortfolioManagement.js`
- `src/hooks/usePortfolioDerivedData.js`
- `src/hooks/usePortfolioBootstrap.js`
- `src/hooks/usePortfolioPersistence.js`
- `src/hooks/usePortfolioDossierActions.js`
- `src/hooks/useReportRefreshWorkflow.js`
- `src/hooks/useLocalBackupWorkflow.js`
- `src/hooks/useEventLifecycleSync.js`
- `src/hooks/useAppConfirmationDialog.js`
- `src/hooks/useWeeklyReportClipboard.js`
- `src/hooks/useWatchlistActions.js`
- `src/hooks/useTransientUiActions.js`
- `src/hooks/useSavedToast.js`
- `src/hooks/useAppShellUiState.js`
- `src/hooks/useCanonicalLocalhostRedirect.js`
- `src/hooks/useDailyAnalysisWorkflow.js`
- `src/hooks/useResearchWorkflow.js`
- `src/components/AppPanels.jsx`
- `src/lib/appShellRuntime.js`
- `src/lib/brainRuntime.js`
- `src/lib/dailyAnalysisRuntime.js`
- `src/lib/researchRuntime.js`
- `src/lib/reportRefreshRuntime.js`
- `src/lib/eventUtils.js`
- `src/lib/datetime.js`
- `src/lib/market.js`
- `src/lib/portfolioUtils.js`
- `holding dossier` 與 `report` 的 normalize / prompt builder helper，現在優先收斂在 `src/lib/dossierUtils.js` 與 `src/lib/reportUtils.js`
- `event / review / date parsing` 的純邏輯現在優先收斂在 `src/lib/eventUtils.js`
- `date / market clock / storage-date formatting` 的純邏輯現在優先收斂在 `src/lib/datetime.js`
- `market cache / post-close sync gate / quote parsing` 的純邏輯現在優先收斂在 `src/lib/market.js`
- `portfolio registry / localStorage / backup import-export` 的純邏輯現在優先收斂在 `src/lib/portfolioUtils.js`
- `daily analysis` 的 snapshot 組裝、事件關聯、盲測評分與 prompt payload builder，現在優先收斂在 `src/lib/dailyAnalysisRuntime.js`
- `research` 的 stock snapshot、research dossier、request body 與 history merge，現在優先收斂在 `src/lib/researchRuntime.js`
- 若任務是 dossier 組裝、台股 hard gate、daily/research prompt context、analysis history / analyst report normalize，先看上述兩個 utility module，不要先把 helper 塞回 `src/App.jsx`
- 若任務是 target / fundamentals / alert 寫回，先看 `src/hooks/usePortfolioDossierActions.js`
- 若任務是公開報告刷新、研究結果回寫 dossier、report refresh meta，先看 `src/hooks/useReportRefreshWorkflow.js` 與 `src/lib/reportRefreshRuntime.js`
- 若任務是本機備份匯入匯出，先看 `src/hooks/useLocalBackupWorkflow.js`
- 若任務是 app-level confirm dialog promise flow，先看 `src/hooks/useAppConfirmationDialog.js`
- 若任務是事件狀態自動從 `pending -> tracking -> closed` 與價格歷史追蹤，先看 `src/hooks/useEventLifecycleSync.js`
- 若任務是週報素材組裝與剪貼簿 fallback，先看 `src/hooks/useWeeklyReportClipboard.js`
- 若任務是 watchlist 新增 / 編輯 / 刪除，先看 `src/hooks/useWatchlistActions.js`
- 若任務是 review cancel / reversal update 這類 app-local transient UI actions，先看 `src/hooks/useTransientUiActions.js`
- 若任務是 app-level saved toast、timeout cleanup、跨 workflow 提示訊息競態，先看 `src/hooks/useSavedToast.js`
- 若任務是 `tab / scan / relay / review / research selection` 這批 app-local transient UI state，先看 `src/hooks/useAppShellUiState.js`
- 若任務是 `localhost -> 127.0.0.1` canonical redirect，先看 `src/hooks/useCanonicalLocalhostRedirect.js`
- 若任務是 `App.jsx` 的 panel render 收斂、tab -> panel registry、或 panel-scoped `ErrorBoundary` 組裝，先看 `src/components/AppPanels.jsx`
- 若任務是 `App.jsx` 的 live snapshot、event fallback/filter 這類 app-shell 級 helper，先看 `src/lib/appShellRuntime.js`
- 若任務是收盤分析流程，先看 `src/hooks/useDailyAnalysisWorkflow.js`；若是改 snapshot/prompt 純邏輯，再進 `src/lib/dailyAnalysisRuntime.js`
- 若任務是深度研究流程，先看 `src/hooks/useResearchWorkflow.js`；若是改 request body / stocks / history merge，再進 `src/lib/researchRuntime.js`
- route shell 若要支援 `newBrain` 落盤，必須走 `src/hooks/useRoutePortfolioRuntime.js` 提供的 `setStrategyBrain()`；不要只更新 page-local state
- 若任務是事件正規化、review evidence refs、portfolio backup / import / storage migration，先看 `src/lib/eventUtils.js`、`src/lib/portfolioUtils.js`
- 若任務是 boot / storage / cloud sync，先看上述 hooks，再決定是否需要動 `src/App.jsx`
- `src/main.jsx` 目前只負責 boot runtime diagnostics 與 render `App`
- `src/pages/WatchlistPage.jsx` 已不再使用 `prompt()`；route watchlist 新增/編輯應沿用 `WatchlistPanel` 的 modal editor
- `src/components/Header.jsx` 現在支援可選的 `portfolioEditor` 與 `portfolioDeleteDialog` props；route shell 與穩定主 runtime 都已接上這條 shared UI 邊界，而且底層已統一改走 `src/components/common/Dialogs.jsx`
- `src/components/common/Dialogs.jsx` 是目前 runtime 的 shared dialog 邊界；若要新增確認、刪除、文字修正類互動，優先沿用這裡，不要再引入 `window.prompt()` / `window.confirm()` / `window.alert()`
- `src/hooks/useTradeCaptureRuntime.js` 是交易截圖的 canonical runtime；若要改上傳成交、OCR 修正、補登日期、多圖佇列，先改這支 hook，不要在 `App.jsx` 與 route hook 各修一份
- `src/lib/tradeParseUtils.js` 是交易 OCR 正規化、batch 寫入、批次摘要與低信心檢查 helper；若 `src/lib` 再出現跟 trade parse / multi-trade backfill / OCR warnings 有關的紅燈，先看這裡
- 截至 2026-03-28，`rg -n "prompt\\(|confirm\\(|alert\\(" src` 應為 0；若再出現，視為 regression
- `ErrorBoundary` 目前採 panel-scoped 策略：在 `src/App.jsx` 針對 `Header` 與各主要 panel 包 boundary，而不是在 `src/main.jsx` 外層包整個 App
- `src/App.jsx` 與其他 runtime hook 不應在 render 期直接讀寫 `ref.current`；若需要同步 ref，請放進 effect 或改成現有 state / prop 流
- `saved` 提示訊息現在應優先走 shared `notifySaved / flashSaved` 管線；不要再在新 workflow 內直接手刻 `setSaved(...) + setTimeout(...)`
- 若看到 `src/lib/market.js` 或 `src/lib/portfolioUtils.js` 出現 placeholder / stub 版本，視為不完整 refactor，應優先修回 canonical helper 實作

### 本地完整模式

唯一正確啟動方式：

```bash
vercel dev
```

不要用：

- `npm run dev`
- `vite`

因為那只會啟動前端，不會帶起 repo 內 API。

### 固定網址

唯一正確網址：

```text
http://127.0.0.1:3002
```

不要改用 `localhost:3002`，否則會造成 localStorage 分裂。

---

## 4. 驗證規則

### 快速健康檢查

```bash
npm run healthcheck
```

### Fast Refresh 邊界檢查

```bash
npm run check:fast-refresh
```

### UI smoke

```bash
npm run smoke:ui
```

### 完整本地驗證

```bash
npm run verify:local
```

目前內容包含：

- `npm run check:fast-refresh`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run healthcheck`
- `npm run smoke:ui`

### 基本品質檢查

```bash
npm run lint
npm run build
```

注意：

- `HTTP 200` 不代表前端沒有白頁
- 只要有部署、本地重啟、或改到 runtime / storage / AI 主流程，就應跑 `npm run smoke:ui`
- `npm run healthcheck` 現在還會檢查 `/index.html`、`/@vite/client`、`/src/main.jsx` 與首頁連到的前端資源
- `npm run healthcheck` 也會讀 `.tmp/vercel-dev.log`，補看 Vite frontend 訊號與 HMR invalidation 警告
- 若 `healthcheck` 回報 `Latest App.jsx Vite event is healthy`，代表最近一次 `src/App.jsx` HMR 事件沒有再落入 invalidation
- 若要回報「已完整驗證」，不要只貼 `build` 或 `healthcheck`，至少要貼 `verify:local`

### Runtime diagnostics

- 前端全域錯誤、未處理 Promise 拒絕、以及 React error boundary 錯誤，現在都會統一寫到 `sessionStorage["pf-runtime-diagnostics-v1"]`
- `web-vitals` 也已接到同一個 adapter，會以 `kind: "web-vital"` 寫進同一份 diagnostics
- remote sink 現在支援兩條：
  - analytics HTTP sink：預設可對 `/api/telemetry` 批次上報
  - Sentry bridge sink：若頁面上存在 `window.Sentry`，可把 diagnostics 橋接進 Sentry
- 啟用方式：
  - 在 app boot 前設定 `window.__PORTFOLIO_RUNTIME_MONITORING__`
  - 或透過 `VITE_RUNTIME_ANALYTICS_ENABLED`、`VITE_RUNTIME_ANALYTICS_ENDPOINT`、`VITE_RUNTIME_SENTRY_ENABLED`
- 若要接第三方監控（如 Sentry / LogRocket），優先沿用 `src/lib/runtimeLogger.js`，不要再到處直接散寫 `console.error`

---

## 5. AI 分工

### Codex

- 高風險邏輯
- strategy brain 最終判定
- schema / persistence / cloud sync
- 最終整合與驗收

### Claude

- strategy brain / validation second opinion
- prompt 契約與輸出品質
- 雲端同步與 schema 風險檢查
- client-facing 報告正確性

### Qwen

- bounded implementation
- 機械式重構
- lint / test / 小型 UI cleanup
- 第一輪 code review

### Gemini

- 外部公開資料 research scout
- citations / freshness / unresolved questions
- 新聞、公告、法說、公開報導掃描

### AnythingLLM

- PDF / 文件知識庫檢索
- 歷史材料整理
- RAG 型上下文補充

---

## 6. 任務路由規則

以下工作預設由 Codex 或 Claude 主導：

- strategy brain 規則 lifecycle
- persistence / migration / import-export
- cloud sync
- 客戶版數字與結論
- 高風險 prompt 契約

以下工作適合交給 Qwen：

- 小型 patch
- 測試補齊
- UI cleanup
- 明確邊界的 helper 重構

以下工作適合交給 Gemini：

- 最新資料搜尋
- citation 蒐集
- freshness 比對

若任務需要「最新」或「精準出處」，Gemini 只負責收集，最後仍要由主線實作者決定是否採納。

---

## 7. 交接格式

所有 AI 交接時，至少用這四項：

- `done`
- `changed files`
- `risks`
- `next best step`

研究型任務額外補：

- `citations`
- `freshness`
- `unresolved_questions`

---

## 8. 歷史文件處理方式

以下檔案現在都只是短版角色卡或歷史入口，不再各自維護完整規則：

- `claude.md`
- `QWEN.md`
- `GEMINI.md`
- `docs/HANDBOOK_FOR_AI_AGENTS.md`

若任何舊文件提到：

- `App.routes.jsx` 才是主入口
- `App.jsx` 已只剩很小的 route shell
- 可以用 `npm run dev` 代表完整本地模式

都視為歷史資訊，不是目前真相。
