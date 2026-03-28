# Current Work

Last updated: 2026-03-28 21:54

## Objective

Task A / B 已有穩定基線。當前收斂重點轉為把 `src/App.jsx` 剩餘 orchestration 周邊 helper 持續外移，並維持 Fast Refresh、panel-scoped ErrorBoundary 與本地驗證鏈一致。

## Active slices

- `Codex`：最終策略邏輯、schema、rule lifecycle、prompt 契約、驗收
- `Gemini CLI`：公開資料、新聞 / 法說 / 公告 / 目標價報導的 citations 與 freshness 蒐集
- `Qwen Code`：低風險 UI / helper / parsing / test patch
- `AnythingLLM`：PDF / 研究文件 / 歷史材料整理與對照

固定角色與能力邊界見：

- [ai-collaboration-channel.md](/Users/chenkuichen/APP/test/docs/status/ai-collaboration-channel.md)

## Files in play

- `src/App.jsx`
- `src/lib/eventUtils.js`
- `src/lib/portfolioUtils.js`
- `src/components/ErrorBoundary.jsx`
- `src/main.jsx`
- `scripts/healthcheck.sh`
- `api/research.js`
- `docs/superpowers/plans/2026-03-25-strategy-brain-v2-llm-routing-plan.md`
- `docs/status/current-work.md`
- `GEMINI.md`
- `scripts/launch-gemini.sh`
- `scripts/launch-gemini-research-scout.sh`
- `CLAUDE.md`
- `QWEN.md`

## Latest checkpoint

- `2026-03-28 21:54` Codex：新增 [src/lib/appShellRuntime.js](/Users/chenkuichen/APP/test/src/lib/appShellRuntime.js) 與 [src/components/AppPanels.jsx](/Users/chenkuichen/APP/test/src/components/AppPanels.jsx)，把 `live portfolio snapshot` 欄位清單與 tab panel render skeleton 從 [src/App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 收成單一 source of truth
- `2026-03-28 21:54` Codex：`flushCurrentPortfolio()` 與 `useLocalBackupWorkflow()` 現在共用 `buildLivePortfolioSnapshot()`；`newsEvents` fallback 與 event filter 也已集中到 `appShellRuntime`
- `2026-03-28 21:54` Codex：新增測試 [appShellRuntime.test.js](/Users/chenkuichen/APP/test/tests/lib/appShellRuntime.test.js)，並通過 `npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`、`npm run healthcheck`、`npm run smoke:ui`；全量測試提升到 `22 files / 97 tests`
- `2026-03-28 21:54` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_APP_PANELS_AND_SNAPSHOT_DEDUP.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_APP_PANELS_AND_SNAPSHOT_DEDUP.md)；`src/App.jsx` 進一步降到約 `1111` 行
- `2026-03-28 21:40` Codex：新增 [useSavedToast.js](/Users/chenkuichen/APP/test/src/hooks/useSavedToast.js)、[useAppShellUiState.js](/Users/chenkuichen/APP/test/src/hooks/useAppShellUiState.js)、[useCanonicalLocalhostRedirect.js](/Users/chenkuichen/APP/test/src/hooks/useCanonicalLocalhostRedirect.js)，把 `saved toast timer`、localhost canonical redirect 與 app-local transient UI state 從 [App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 再抽出去
- `2026-03-28 21:40` Codex：`usePortfolioManagement.js`、`usePortfolioPersistence.js`、`useRoutePortfolioRuntime.js` 現在都優先走 shared `notifySaved / flashSaved` 管線，修掉多來源 `setTimeout` 互踩導致新提示被舊 timer 提前清掉的 bug
- `2026-03-28 21:40` Codex：新增 hook tests [useSavedToast.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/useSavedToast.test.jsx) 與 [useAppShellUiState.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/useAppShellUiState.test.jsx)；[App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 再降到約 `1158` 行
- `2026-03-28 21:40` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`、`npm run healthcheck`、`npm run smoke:ui` 全綠；全量測試提升到 `21 files / 95 tests`
- `2026-03-28 21:31` Codex：新增 [useWatchlistActions.js](/Users/chenkuichen/APP/test/src/hooks/useWatchlistActions.js) 與 [useTransientUiActions.js](/Users/chenkuichen/APP/test/src/hooks/useTransientUiActions.js)，把 `watchlist upsert/delete`、`cancelReview`、`updateReversal` 從 [App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 再抽薄一層
- `2026-03-28 21:31` Codex：route shell 的 [useRoutePortfolioRuntime.js](/Users/chenkuichen/APP/test/src/hooks/useRoutePortfolioRuntime.js) 也已接上同一套 action hooks，修掉主 runtime 與 route shell 在 `watchlist shape` 與 `reversal.updatedAt` 上不一致的 bug
- `2026-03-28 21:31` Codex：`src/App.jsx` 進一步降到約 `1177` 行；`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`、`npm run healthcheck`、`npm run smoke:ui` 全綠
- `2026-03-28 21:27` Codex：`weekly report clipboard` 已從 [App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 抽成 [useWeeklyReportClipboard.js](/Users/chenkuichen/APP/test/src/hooks/useWeeklyReportClipboard.js)，`App.jsx` 不再直接內嵌週報組裝與剪貼簿 fallback 流程
- `2026-03-28 21:27` Codex：重新驗證 `npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`、`npm run healthcheck`、`npm run smoke:ui` 全綠
- `2026-03-28 21:18` Codex：`src/App.jsx` 繼續收斂為 orchestration shell，新增 [usePortfolioDossierActions.js](/Users/chenkuichen/APP/test/src/hooks/usePortfolioDossierActions.js)、[useReportRefreshWorkflow.js](/Users/chenkuichen/APP/test/src/hooks/useReportRefreshWorkflow.js)、[useLocalBackupWorkflow.js](/Users/chenkuichen/APP/test/src/hooks/useLocalBackupWorkflow.js)、[useEventLifecycleSync.js](/Users/chenkuichen/APP/test/src/hooks/useEventLifecycleSync.js)、[useAppConfirmationDialog.js](/Users/chenkuichen/APP/test/src/hooks/useAppConfirmationDialog.js)
- `2026-03-28 21:18` Codex：新增 [reportRefreshRuntime.js](/Users/chenkuichen/APP/test/src/lib/reportRefreshRuntime.js) 與 [reportRefreshRuntime.test.js](/Users/chenkuichen/APP/test/tests/lib/reportRefreshRuntime.test.js)，把 analyst report merge / meta merge / structured research extract plan 純邏輯抽離出來
- `2026-03-28 21:18` Codex：修掉 `Events` tab 還在吃 seed `NEWS_EVENTS` 的真 bug、`flashSaved()` timeout 互踩問題，以及 `App.jsx` render-phase refs lint blocker；`tradePanel.dialogs.test.jsx` 也補了 flake timeout
- `2026-03-28 21:18` Codex：`src/App.jsx` 已降到約 `1198` 行；`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`、`npm run healthcheck`、`npm run smoke:ui` 全綠
- `2026-03-28 21:18` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_APP_SHELL_REDUCTION_AND_BUGFIXES.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_APP_SHELL_REDUCTION_AND_BUGFIXES.md)
- `2026-03-28 18:11` Codex：route shell 的 research flow 已從 `useRunResearch()` inline mutation 收斂到共享 [useResearchWorkflow.js](/Users/chenkuichen/APP/test/src/hooks/useResearchWorkflow.js)，[useRouteResearchPage.js](/Users/chenkuichen/APP/test/src/hooks/useRouteResearchPage.js) 現在只負責 route-specific panel state 與 report refresh / enrich glue
- `2026-03-28 18:11` Codex：`useRoutePortfolioRuntime.js` 已補 `setStrategyBrain()` 與可帶 timeout 的 `flashSaved()`，因此 route shell 的 `onEvolve` 也能把 `newBrain` 正確落回 route runtime storage
- `2026-03-28 18:11` Codex：順手修掉 [ResearchPanel.jsx](/Users/chenkuichen/APP/test/src/components/research/ResearchPanel.jsx) 的 `h` shadowing bug；新增 route research integration coverage 到 [routePages.actions.test.jsx](/Users/chenkuichen/APP/test/tests/routes/routePages.actions.test.jsx)
- `2026-03-28 18:11` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `14 files / 81 tests`
- `2026-03-28 17:49` Codex：`runResearch()` 已從 [App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 抽成 [useResearchWorkflow.js](/Users/chenkuichen/APP/test/src/hooks/useResearchWorkflow.js)，`App.jsx` 只保留 research state 與 panel 接線
- `2026-03-28 17:49` Codex：新增 [researchRuntime.js](/Users/chenkuichen/APP/test/src/lib/researchRuntime.js)，現在負責 research stock snapshot、dossier 組裝、request body、主結果抽取與 history merge
- `2026-03-28 17:49` Codex：新增測試 [researchRuntime.test.js](/Users/chenkuichen/APP/test/tests/lib/researchRuntime.test.js)；`npm run lint`、`npm run typecheck`、`npm run build` 與該測試通過
- `2026-03-28 17:35` Codex：`runDailyAnalysis` 已從 [App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 收斂到 [useDailyAnalysisWorkflow.js](/Users/chenkuichen/APP/test/src/hooks/useDailyAnalysisWorkflow.js)，並再往下抽出 [dailyAnalysisRuntime.js](/Users/chenkuichen/APP/test/src/lib/dailyAnalysisRuntime.js)
- `2026-03-28 17:35` Codex：`dailyAnalysisRuntime` 現在負責 daily snapshot、事件關聯、盲測評分、前次回顧區塊與 prompt payload builder；新增測試 [dailyAnalysisRuntime.test.js](/Users/chenkuichen/APP/test/tests/lib/dailyAnalysisRuntime.test.js)
- `2026-03-28 17:35` Codex：補回 `brainRuntime` 的相容 exports `enforceTaiwanHardGatesOnBrainAudit()` / `appendBrainValidationCases()`，並清掉 [App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 那批已死亡的 brain imports，`npm run lint` 現在無 warning
- `2026-03-28 17:35` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `13 files / 77 tests`
- `2026-03-28 16:26` Codex：交易上傳新增批次預覽摘要與 OCR 低信心警示；在寫入前會先顯示成交筆數、買賣分布、估計成交金額、涉及標的，並標出模型低信心與逐筆欄位異常
- `2026-03-28 16:26` Codex：`src/lib/tradeParseUtils.js` 新增 `summarizeTradeBatch()` 與 `assessTradeParseQuality()`，`TradePanel` 已接上這兩條 helper
- `2026-03-28 16:26` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `12 files / 72 tests`
- `2026-03-28 13:59` Codex：`Header.jsx` 已移除 portfolio 專用自製 modal，create / rename / delete 全部統一收斂到 [Dialogs.jsx](/Users/chenkuichen/APP/test/src/components/common/Dialogs.jsx)
- `2026-03-28 13:59` Codex：新增共享 hook [useTradeCaptureRuntime.js](/Users/chenkuichen/APP/test/src/hooks/useTradeCaptureRuntime.js) 與 helper [tradeParseUtils.js](/Users/chenkuichen/APP/test/src/lib/tradeParseUtils.js)，主 runtime 與 route shell 的交易截圖流程已收斂成同一條 runtime
- `2026-03-28 13:59` Codex：上傳成交現在支援多圖佇列、補登成交日期、同批多筆交易寫入與混合買賣 memo；不再只寫 `parsed.trades[0]`
- `2026-03-28 13:59` Codex：新增測試 [tradeParseUtils.test.js](/Users/chenkuichen/APP/test/tests/lib/tradeParseUtils.test.js)，並通過 `npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`；全量測試提升到 `12 files / 71 tests`
- `2026-03-28 13:59` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_DIALOG_PRIMITIVES_AND_TRADE_CAPTURE.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_DIALOG_PRIMITIVES_AND_TRADE_CAPTURE.md)
- `2026-03-28 13:36` Codex：完成 `src/` legacy browser dialogs sweep，新增 [Dialogs.jsx](/Users/chenkuichen/APP/test/src/components/common/Dialogs.jsx)，把 `TradePanel` / `WatchlistPanel` / `App.jsx` 剩餘 `prompt()` / `confirm()` / `alert()` 全部收掉
- `2026-03-28 13:36` Codex：新增測試 [tradePanel.dialogs.test.jsx](/Users/chenkuichen/APP/test/tests/components/tradePanel.dialogs.test.jsx)，並確認 `rg -n "prompt\\(|confirm\\(|alert\\(" src` 為空
- `2026-03-28 13:36` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_LEGACY_BROWSER_DIALOGS_SWEEP.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_LEGACY_BROWSER_DIALOGS_SWEEP.md)
- `2026-03-28 13:36` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `11 files / 68 tests`
- `2026-03-28 13:29` Codex：`usePortfolioManagement.js` 已移除主 runtime 的 `window.prompt()` / `window.confirm()`，create / rename / delete 現在與 route shell 共用 `Header` dialog 邊界
- `2026-03-28 13:29` Codex：`Header.jsx` 已完整支援 shared `portfolioEditor` + `portfolioDeleteDialog`；`App.jsx` 與 `useRoutePortfolioRuntime.js` 都已接上
- `2026-03-28 13:29` Codex：`tests/routes/routePages.actions.test.jsx` 已新增 delete dialog coverage；route actions 現在覆蓋 create / rename / delete / watchlist add / news review
- `2026-03-28 13:29` Codex：交接報告 [DEBUG_REPORT_2026-03-28_ROUTE_PORTFOLIO_MODAL_EDITOR.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_ROUTE_PORTFOLIO_MODAL_EDITOR.md) 已更新為 shared dialogs 完成態
- `2026-03-28 13:29` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `10 files / 67 tests`
- `2026-03-28 13:28` Codex：`useRoutePortfolioRuntime.js` 已移除 route-shell `window.prompt()` 的 create / rename 流程，改成受控 modal editor state
- `2026-03-28 13:28` Codex：`Header.jsx` 已支援可選的 `portfolioEditor` modal props；route shell 透過這條邊界處理 portfolio create / rename，並保持對穩定主 runtime 的 callback fallback 相容
- `2026-03-28 13:28` Codex：`tests/routes/routePages.actions.test.jsx` 已新增 portfolio create / rename modal tests，並明確驗證 `window.prompt()` 未被呼叫
- `2026-03-28 13:28` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_ROUTE_PORTFOLIO_MODAL_EDITOR.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_ROUTE_PORTFOLIO_MODAL_EDITOR.md)
- `2026-03-28 13:28` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `10 files / 66 tests`
- `2026-03-28 13:11` Codex：完成第二批 route page hook extraction，新增 [useRouteHoldingsPage.js](/Users/chenkuichen/APP/test/src/hooks/useRouteHoldingsPage.js)、[useRouteWatchlistPage.js](/Users/chenkuichen/APP/test/src/hooks/useRouteWatchlistPage.js)、[useRouteDailyPage.js](/Users/chenkuichen/APP/test/src/hooks/useRouteDailyPage.js)、[useRouteResearchPage.js](/Users/chenkuichen/APP/test/src/hooks/useRouteResearchPage.js)、[useRouteTradePage.js](/Users/chenkuichen/APP/test/src/hooks/useRouteTradePage.js) 等 route page hooks
- `2026-03-28 13:11` Codex：`src/pages/*` 現在多數只剩 render panel + call hook；`WatchlistPage` 已移除 `prompt()` 路徑，`TradePage` route shell 也修正為傳入正確的 memo question array
- `2026-03-28 13:11` Codex：`src/App.routes.jsx` 已補 route-local `QueryClientProvider`，route shell 進一步接近可替代 `src/App.jsx` 的入口條件
- `2026-03-28 13:11` Codex：新增 route integration tests [routePages.actions.test.jsx](/Users/chenkuichen/APP/test/tests/routes/routePages.actions.test.jsx)，覆蓋 watchlist modal add 與 news review persistence
- `2026-03-28 13:11` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_ROUTE_PAGE_HOOK_EXTRACTION.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_ROUTE_PAGE_HOOK_EXTRACTION.md)
- `2026-03-28 13:11` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `10 files / 64 tests`
- `2026-03-28 05:31` Codex：新增 [useRoutePortfolioRuntime.js](/Users/chenkuichen/APP/test/src/hooks/useRoutePortfolioRuntime.js)，`PortfolioLayout.jsx` 已退回薄容器，只負責 render `Header + Outlet`
- `2026-03-28 05:31` Codex：新增 route integration tests [portfolioLayout.routes.test.jsx](/Users/chenkuichen/APP/test/tests/routes/portfolioLayout.routes.test.jsx)，覆蓋 route context hydrate/persist 與 header tab 導航
- `2026-03-28 05:31` Codex：補齊 `canRunPostClosePriceSync` 在 `datetime.js` / `market.js` 的相容邊界，修回全量測試綠燈
- `2026-03-28 05:31` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_ROUTE_RUNTIME_HOOK_AND_TESTS.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_ROUTE_RUNTIME_HOOK_AND_TESTS.md)
- `2026-03-28 05:31` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過
- `2026-03-28 05:16` Codex：完成 route runtime 第一批接線，新增 [routeRuntime.js](/Users/chenkuichen/APP/test/src/lib/routeRuntime.js) 與 [usePortfolioRouteContext.js](/Users/chenkuichen/APP/test/src/pages/usePortfolioRouteContext.js)
- `2026-03-28 05:16` Codex：`PortfolioLayout` 已改為讀取真實 localStorage / market snapshot，並把持久化 action 透過 `Outlet context` 傳給 route pages
- `2026-03-28 05:16` Codex：`Holdings / Watchlist / Events / News / Daily / Research / Trade / Log / Overview` 頁面已移除第一批 placeholder state / fake handler，改吃 route runtime
- `2026-03-28 05:16` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_ROUTE_RUNTIME_FIRST_TRANCHE.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_ROUTE_RUNTIME_FIRST_TRANCHE.md)
- `2026-03-28 05:16` Codex：`npm run lint`、`npm run typecheck`、`npm run build` 通過
- `2026-03-28 04:34` Codex：確認 `src/main.jsx` 曾被切到 `App.routes.jsx`，但 route shell 仍是 scaffold；已收回穩定 runtime 入口為 `src/main.jsx -> src/App.jsx`
- `2026-03-28 04:34` Codex：新增 `src/lib/navigationTabs.js`，將 `Header` tabs 設定從 `App.jsx` / `PortfolioLayout.jsx` 收斂成共享 builder
- `2026-03-28 04:34` Codex：`Header` 現在對缺少 `TABS` 有安全 fallback；`PortfolioLayout.jsx` 也移除對 `A` / `alpha` 的冗餘 props 傳遞
- `2026-03-28 04:34` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_RUNTIME_ENTRY_TAB_ALIGNMENT.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_RUNTIME_ENTRY_TAB_ALIGNMENT.md)
- `2026-03-28 04:01` Codex：救回一輪半套 helper refactor，已修正 `src/App.jsx` 因 duplicate helper/import 造成的 parse failure
- `2026-03-28 04:01` Codex：`src/lib/market.js`、`src/lib/portfolioUtils.js`、`src/lib/datetime.js` 已從 placeholder / 遺漏 export 狀態恢復成可用的 canonical helper module
- `2026-03-28 04:01` Codex：`src/App.jsx` 已重新改成吃 `lib` helper，檔案從約 `3525` 行降到 `3159` 行
- `2026-03-28 04:01` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_HELPER_EXTRACTION_RECOVERY.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_HELPER_EXTRACTION_RECOVERY.md)
- `2026-03-28 04:01` Codex：`npm run lint`、`npm run typecheck`、`npm run check:fast-refresh`、`npm run build` 通過
- `2026-03-28 03:24` Codex：完成 `src/lib/eventUtils.js`、`src/lib/portfolioUtils.js` 實用化並回收 `src/App.jsx` 內 event / review / storage helper
- `2026-03-28 03:24` Codex：`src/main.jsx` 已移除 whole-app ErrorBoundary；`src/App.jsx` 改為對 Header 與各主要 panel 採 panel-scoped `ErrorBoundary`
- `2026-03-28 03:24` Codex：`scripts/healthcheck.sh` 已再清一輪不必要字串插值，並保留前端資源與 Vite log 檢查
- `2026-03-28 03:24` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_EVENT_STORAGE_BOUNDARY_EXTRACTION.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_EVENT_STORAGE_BOUNDARY_EXTRACTION.md)
- `2026-03-28 03:24` Codex：`npm run check:fast-refresh`、`npm run lint`、`npm run build` 通過

- `2026-03-28 03:02` Codex：完成 `src/lib/reportUtils.js` 與 `src/lib/dossierUtils.js` 實作化，`App.jsx` 已改用這兩個 utility module
- `2026-03-28 03:02` Codex：`src/hooks/useReports.js` 已從錯誤的 `./utils.js` 改接 `../lib/reportUtils.js`
- `2026-03-28 03:02` Codex：新增交接報告 [DEBUG_REPORT_2026-03-28_DOSSIER_REPORT_UTILS_EXTRACTION.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_DOSSIER_REPORT_UTILS_EXTRACTION.md)
- `2026-03-28 03:02` Codex：`npm run check:fast-refresh`、`npm run lint`、`npm run build` 通過
- `2026-03-28 02:18` Codex：確認 `.tmp/vercel-dev.log` 中 `BACKUP_GLOBAL_KEYS` Fast Refresh invalidation 屬歷史事件；最新 `App.jsx` 事件已回到正常 `hmr update`
- `2026-03-28 02:18` Codex：新增 [DEBUG_REPORT_2026-03-28_FAST_REFRESH_BOUNDARY_CONVERGENCE.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-28_FAST_REFRESH_BOUNDARY_CONVERGENCE.md)，說明這輪不是單純口頭確認，而是把 `App.jsx` / `constants.js` 邊界再收斂一層
- `2026-03-28 02:18` Codex：新增 `src/lib/watchlistUtils.js`，並將 `App.jsx` 內重複的 constants / watchlist normalize 收回 `src/constants.js` 與 `src/lib/*`
- `2026-03-28 02:18` Codex：`npm run check:fast-refresh`、`npm run lint`、`npm run build` 再次通過
- `2026-03-28 01:28` Codex：新增 `jsconfig.json`，把 JS/JSX workspace 專案邊界收斂到 `src`、`tests`、`api`、`scripts`
- `2026-03-28 01:28` Codex：`.vscode/settings.json` 進一步排除 `.tmp` / `dist`，並關閉 `typescript` automatic type acquisition 以降低背景索引與記憶體噪音
- `2026-03-28 01:28` Codex：重新驗證 `npm run lint`、`npm run build` 均通過，確認記憶體優化沒有破壞當前基線
- `2026-03-28 01:15` Codex：確認高記憶體主因偏向 VS Code renderer / webview 疊加，不是單一 app runtime 失控
- `2026-03-28 01:15` Codex：已將大型 `App.jsx` 歷史快照移出 `src/` 到 `.archive/source-snapshots/`，降低 IDE / watcher / 搜尋索引壓力
- `2026-03-28 01:15` Codex：新增 `.vscode/settings.json` 與 `vite.config.js` ignore 規則，避免 archive / backup files 再進活躍 watcher
- `2026-03-28 01:15` Codex：新增報告 [PERFORMANCE_REPORT_2026-03-28_MEMORY_PRESSURE_REDUCTION.md](/Users/chenkuichen/APP/test/docs/PERFORMANCE_REPORT_2026-03-28_MEMORY_PRESSURE_REDUCTION.md)
- `2026-03-28 00:05` Codex：`runtimeLogger` 已加入 remote sink registry、queue、flush 與 sampling；可同時接 analytics HTTP sink 與 Sentry bridge sink
- `2026-03-28 00:05` Codex：新增 `/api/telemetry`，可接收批次 client diagnostics 並保留最近 200 筆
- `2026-03-28 00:05` Codex：新增測試 [runtimeLogger.test.js](/Users/chenkuichen/APP/test/tests/lib/runtimeLogger.test.js)，覆蓋 sessionStorage、本地 queue、analytics sink、Sentry sink
- `2026-03-28 00:05` Codex：新增報告 [OPTIMIZATION_REPORT_2026-03-28_REMOTE_DIAGNOSTICS_ADAPTERS.md](/Users/chenkuichen/APP/test/docs/OPTIMIZATION_REPORT_2026-03-28_REMOTE_DIAGNOSTICS_ADAPTERS.md)
- `2026-03-27 22:30` Codex：`runtimeLogger` 已接上 `web-vitals@5.2.0` attribution build，CLS / FCP / INP / LCP / TTFB 會寫入 `pf-runtime-diagnostics-v1`
- `2026-03-27 22:30` Codex：`main.jsx` 改為只呼叫 `bootstrapRuntimeDiagnostics()`；window error、unhandled rejection、error boundary、web-vitals 共用同一個 adapter
- `2026-03-27 22:30` Codex：新增報告 [OPTIMIZATION_REPORT_2026-03-27_WEB_VITALS_RUNTIME_ADAPTER.md](/Users/chenkuichen/APP/test/docs/OPTIMIZATION_REPORT_2026-03-27_WEB_VITALS_RUNTIME_ADAPTER.md)
- `2026-03-27 22:10` Codex：新增 `npm run check:fast-refresh`，將 `src/App.jsx` default-only export 規則工具化，避免 Fast Refresh invalidation 回歸
- `2026-03-27 22:10` Codex：`scripts/healthcheck.sh` 已補檢 `/index.html`、`/@vite/client`、`/src/main.jsx` 與首頁 linked assets，不再只看 port 與 API
- `2026-03-27 22:10` Codex：新增本地 structured runtime diagnostics，`main.jsx` 全域錯誤與 `ErrorBoundary` 都會寫入 `sessionStorage["pf-runtime-diagnostics-v1"]`
- `2026-03-27 22:10` Codex：新增報告 [OPTIMIZATION_REPORT_2026-03-27_FAST_REFRESH_HEALTHCHECK_DIAGNOSTICS.md](/Users/chenkuichen/APP/test/docs/OPTIMIZATION_REPORT_2026-03-27_FAST_REFRESH_HEALTHCHECK_DIAGNOSTICS.md)
- `2026-03-27 21:45` Codex：已修正 `src/App.jsx` Fast Refresh invalidation 根因，移除所有 named exports，保留 default export `App`
- `2026-03-27 21:45` Codex：`scripts/healthcheck.sh` 改為看最新一筆 `App.jsx` Vite 事件，不再被舊 invalidation 記錄誤導
- `2026-03-27 21:45` Codex：新增交接報告 [DEBUG_REPORT_2026-03-27_FAST_REFRESH_FIX.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-27_FAST_REFRESH_FIX.md)
- `2026-03-27 21:30` Codex：依建議完成新一輪優化落地，新增 TypeScript baseline `tsconfig.json + src/lib/holdingMath.ts`
- `2026-03-27 21:30` Codex：`verify:local` 已納入 `npm run typecheck`；全量測試提升到 `7 files / 56 tests`
- `2026-03-27 21:30` Codex：`scripts/healthcheck.sh` 已能回報 Vite log signal 與 HMR invalidation 警告
- `2026-03-27 21:30` Codex：新增報告 [OPTIMIZATION_REPORT_2026-03-27_TESTS_TS_HEALTHCHECK.md](/Users/chenkuichen/APP/test/docs/OPTIMIZATION_REPORT_2026-03-27_TESTS_TS_HEALTHCHECK.md)
- `2026-03-27 21:16` Codex：第三層 debug 完成；已補 `holdingDossiers` rebuild 差異測試與 malformed payload defensive tests
- `2026-03-27 21:16` Codex：`usePortfolioPersistence` / `usePortfolioBootstrap` 已加入 array-shape guard，避免錯誤 payload 汙染 state/persistence
- `2026-03-27 21:16` Codex：hook tests 提升到 `2 files / 12 tests`，全量測試提升到 `7 files / 55 tests`，`npm run verify:local` 再次通過
- `2026-03-27 21:16` Codex：第三層交接報告已落地 [DEBUG_REPORT_2026-03-27_LAYER3_EDGE_CASES.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-27_LAYER3_EDGE_CASES.md)
- `2026-03-27 21:07` Codex：已補完第二層剩餘三條線 `bootstrap cooldown branch`、`research TTL pull`、`cloud save failure / cleanup timer`
- `2026-03-27 21:07` Codex：hook tests 擴充到 `2 files / 8 tests`，全量測試提升到 `7 files / 51 tests`
- `2026-03-27 21:07` Codex：`npm run lint`、`npm run test:run`、`npm run verify:local` 再次全通過；layer-2 報告已更新為完成態
- `2026-03-27 20:45` Codex：第二層 debug 完成；新增 hook 級測試 [usePortfolioBootstrap.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/usePortfolioBootstrap.test.jsx) 與 [usePortfolioPersistence.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/usePortfolioPersistence.test.jsx)
- `2026-03-27 20:45` Codex：目前測試總數提升到 `7 files / 47 tests`，`npm run test:run`、`npm run lint`、`npm run verify:local` 全部通過
- `2026-03-27 20:45` Codex：第二層交接報告已落地 [DEBUG_REPORT_2026-03-27_LAYER2_HOOKS.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-27_LAYER2_HOOKS.md)
- `2026-03-27 20:40` Codex：完成全面 debug sweep；`npm run lint`、`npm run test:run`、`npm run build`、`npm run healthcheck`、`npm run smoke:ui`、`npm run verify:local` 全部通過
- `2026-03-27 20:40` Codex：確認本輪未發現新的 runtime blocker；主要修正為把 `verify:local` 升級成真正完整驗證鏈，納入 lint + tests
- `2026-03-27 20:40` Codex：新增交接報告 [DEBUG_REPORT_2026-03-27_FULL_SWEEP.md](/Users/chenkuichen/APP/test/docs/DEBUG_REPORT_2026-03-27_FULL_SWEEP.md)，供後續 AI 直接接手

- `2026-03-26` Codex：已移除 repo 內 `Claude local over Ollama` 入口、任務與驗證鏈；後續只保留 `Codex / Gemini / Qwen / AnythingLLM` 作為有效工具鏈
- `2026-03-26` Codex：文件中若仍出現 `James / Curie / Claude local`，視為歷史紀錄，不再作為目前分工

- `16:20` Codex：已建立固定多 AI 協作通道 [ai-collaboration-channel.md](/Users/chenkuichen/APP/test/docs/superpowers/status/ai-collaboration-channel.md)
- `16:21` James：回報其最適合擔任高風險 state/storage/sync/migration review 與最終技術裁決輔助
- `16:22` Curie：回報其最適合擔任 truth-layer / validation / freshness / Taiwan-market guardrails 的 final reviewer

- `16:02` Codex：完成 `validationScore / staleness / evidenceRefs` 的 rule normalization 與 fallback 推導
- `16:04` Codex：策略大腦 UI 改為顯示驗證分、狀態與證據來源
- `16:06` Codex：收盤分析 / 復盤 / cleanup / research 的 brain JSON 契約已同步
- `16:08` Codex：`npm run build` 通過；`api/research.js` import 檢查通過
- `16:15` Claude helper：確認可可靠承接 Task B 的 prompt-spec 草稿、JSON contract 草稿、台股 guardrails 草稿，但不應負責最終 rule lifecycle 與 schema
- `16:16` Coordination helper：確認便宜模型適合摘要 / 抽取 / 分群 / 草稿；Codex 保留 truth、persistence、final judgment、client-facing correctness
- `16:25` Idle optimization sweep：共識排序為
  1. 先做「舊規則驗證優先」的收盤分析流程
  2. 再補「證據鏈 + 新鮮度」
  3. 最後強化「台股節奏判斷層」
- `16:27` Idle optimization sweep：便宜模型在空檔時應只交
  - findings
  - refresh queues
  - candidate checklists
  - prompt / wording 草稿
    最終是否採納仍由 Codex 決定
- `16:41` Curie：補齊「台股歷史相似案例驗證」的高信號差異清單，明確區分規則失準 vs 個股 / 流動性 / 市場節奏差異
- `16:49` Codex：策略規則 schema 已擴充 `appliesTo / marketRegime / catalystWindow / contextRequired / invalidationSignals / historicalAnalogs`
- `16:53` Codex：收盤分析與 fallback / review / cleanup prompt 已加入歷史相似案例要求；策略大腦 UI 已能顯示歷史相似案例與失效訊號
- `16:58` James：建議歷史驗證細節不要直接塞進 `strategyBrain` 主體，下一步應新增獨立 `brain-validation-v1` casebook，rule 本體只保留驗證摘要
- `17:02` Codex：已重新驗證 `npm run build` 與 `api/research.js` import，Task B 目前可運行
- `17:14` Codex：新增獨立 `brain-validation-v1` storage / state / autosave，先 local-only 落地
- `17:17` Codex：已接上 rule-based fingerprint / analog scoring / daily analysis 自動累積 casebook
- `17:20` Codex：策略大腦 UI 已能顯示 casebook 歷史驗證摘要；`npm run build`、`api/research.js` import 再次通過
- `17:21` checkpoint meeting：暫不需要新 skill；當前最大缺口改為「事件復盤 / 真實 outcome 回寫 casebook」，以及月營收 / 法說 / 目標價節奏的台股特化補強
- `17:42` Codex：完成 Gemini CLI 官方可行性確認；共識為「只加入公開資料 research scout，不碰最終真值層」
- `17:49` Codex：已安裝 `Gemini CLI 0.35.0`
- `17:57` Codex：新增 repo-local `GEMINI.md` 與兩條啟動腳本，並補進 VSCode tasks
- `18:04` James + Curie：同意 Gemini 最佳位置是外部 research scout；不適合直接定 fundamentals / targets / strategyBrain
- `13:52` Codex：確認 Gemini CLI 已是 `0.35.0`，不是版本太舊；`gemini-3.1-pro` 目前在此 key / 路徑下不可用，`gemini-2.5-pro` free-tier quota 為 0
- `13:54` Codex：實測 `gemini-3-flash-preview` 與 `gemini-3.1-flash-lite-preview` 可用，已將 repo 預設 Gemini 模型切到 `gemini-3-flash-preview`
- `14:01` Codex：Task B 核心安全閥已落地：新增 `brainRuleKey`、`formatBrainRulesForValidationPrompt`、`ensureBrainAuditCoverage`、`mergeBrainWithAuditLifecycle`
- `14:02` Codex：`runDailyAnalysis()` 解析 `BRAIN_UPDATE` 後不再直接覆蓋 brain，改為先補 audit coverage，再做 deterministic rule lifecycle merge
- `14:03` Codex：Task B prompt 已加入 ruleId / 全覆蓋要求，以及台股四類驗證門檻（月營收節奏、法說/財報/事件窗口、目標價/報告 freshness、題材輪動）
- `14:04` Curie：確認最值得硬性要求的台股驗證訊號為月營收 cadence、事件窗口、報告 freshness、族群輪動，不足時應優先進 staleRules
- `14:04` James：提醒 merge 必須避免 partial output 洗掉舊規則，並要求 rule identity、stale vs invalidated、evidenceCount 累積與 checklist drift 一起處理
- `14:05` Codex：`npm run build` 通過；`api/research.js` import 通過
- `14:14` Gemini CLI：已對 submitReview -> brain-validation-v1 提供台股高信號建議，重點包括月營收/法說/財報/目標價 freshness、個股差異 vs 規則失準、以及 time-travel / 重複事件檢查
- `14:18` James：指出 review 路徑若直接套用 daily analysis 的 `ensureBrainAuditCoverage()`，會把不相關規則錯標為 stale；review 只應覆蓋本次事件相關規則
- `14:19` Curie：指出事件復盤不應只看方向對錯，必須把月營收 / 法說 / 財報 / 族群輪動 / 目標價 freshness 一起做 verdict
- `14:23` Codex：`submitReview()` 已改成回傳 review audit buckets，並走 `ensureBrainAuditCoverage(... dossiers)` + `attachEvidenceRefsToBrainAudit()` + `mergeBrainWithAuditLifecycle()`
- `14:24` Codex：`submitReview()` 成功後已正式 append `sourceType: "eventReview"` 到 `brain-validation-v1`，讓真實復盤 outcome 累積進 casebook
- `14:25` Codex：新增 `createFallbackValidationDossier()`、`buildEventReviewDossiers()`、`buildEventReviewEvidenceRefs()`，避免事件股票不在目前持倉時完全失去 validation writeback
- `14:26` Codex：順手修正 holding dossier 仍吃舊 `holding.value/pnl/pct` 的割裂問題，統一改用現算公式
- `14:27` Codex：`npm run build` 再次通過；Claude local / Qwen local 已啟動嘗試 review，但在本機 Ollama 上非互動輸出明顯較慢，暫不作為阻塞主線
- `14:34` 使用者回報：持倉總市值直接變 0；主線切換為高優先 debug
- `14:39` James：指出市值歸零主因是 `price*qty` 現算邏輯缺少 holdings fallback，且 cloud/import/raw holdings 缺少統一 normalizer
- `14:40` Gemini CLI：提醒下一輪系統掃描應補 MOPS / TWSE / 除權息 / 零股 / 交易成本等真值層
- `14:42` Codex：新增 `resolveHoldingPrice()`，缺 `price` 時先回退到 `stored price`，再回推 `value/qty`
- `14:43` Codex：owner 雲端 holdings 補缺改成先 `applyMarketQuotesToHoldings()` 正規化後再進 state / localStorage，避免 raw cloud holdings 直接把總市值打成 0
- `14:45` Codex：`npm run build` 再次通過；下一步改做「全系統 bug / 優化計畫審核」，暫不直接開新大 scope
- `14:49` James：確認 holdings integrity 最小完整方案為 persistence sanitize + import sanitize + repair migration + 所有 setHoldings 出口收斂
- `14:52` Curie：Phase 2/3 最佳順序是先做台股 hard gates，再做 per-stock review outcome，最後才重寫 matched/mismatched dimensions
- `14:55` Gemini CLI：補充真值層優先序應包含 MOPS/TWSE/TPEX、除權息、零股、交易成本與異常值熔斷
- `15:00` Codex：`savePortfolioData()` / `loadPortfolioData()` 已對 `holdings-v2` 強制 sanitize；`importLocalBackup()` 已在寫入前正規化所有 holdings key
- `15:02` Codex：schema 升到 v3，新增 `repairPersistedHoldingsIfNeeded()`，讓舊的 zero-value holdings 在啟動時做一次性修復
- `15:04` Codex：`submitMemo()`、`runDailyAnalysis()`、overview duplicate holdings、投組健檢、Top5、持股卡等聚合 UI 已統一改用同一套 holdings 即時計算
- `15:06` Codex：新增 holdings `integrityIssue` 與頁面提示，若缺可用價格會明講而不是靜默算 0
- `15:08` Codex：Phase 2 第一段已落地，新增 `buildTaiwanValidationSignals()`，dossier / daily analysis / research prompt 已開始帶入月營收、法說、財報、目標價/報告的台股驗證門檻
- `15:18` Codex：已補 canonical local host，之後本地一律以 `http://127.0.0.1:3002` 為準，避免 `localhost` 與 `127.0.0.1` 分裂成不同 localStorage
- `15:21` Codex：header 已顯示收盤價同步狀態與 market date；report refresh 候選排序改成使用即時計算市值，不再吃舊 `holding.value`
- `15:29` Codex：台股 hard gates 已正式接進 daily / review verdict，`validatedRules / invalidatedRules` 若缺 fresh 月營收、法說、財報、目標價/報告支撐，會自動降回 `staleRules`
- `15:31` Codex：多股票事件已新增 `stockOutcomes`，結案復盤後會逐檔記錄方向、漲跌幅、是否支持原 thesis
- `15:34` Codex：`brain-validation-v1` case 已正式回填 `matchedDimensions / mismatchedDimensions`，策略大腦 UI 也開始顯示最近案例的相似 / 差異維度
- `15:37` Codex：已建立 `docs/evals/program.md`、`evals/cases/*`、`scripts/eval_brain.mjs`，開始採用 autoresearch 風格的固定案例回放
- `15:38` Codex：`node scripts/eval_brain.mjs` 初版結果 `3/3 passed · avg 100`
- `15:40` Codex：`npm run build` 通過，最新 bundle `dist/assets/index-CvLP7CgH.js`
- `17:34` Codex：Gemini CLI 不穩的主因已定位為舊 Node (`/usr/local/bin/node v15.7.0`)；wrapper 現已強制切到 `~/.nvm/versions/node/v24.13.1/bin/node`
- `17:36` Codex：Gemini 預設 general model 改為 `gemini-2.5-flash`，scout model 改為 `gemini-3.1-flash-lite-preview`；`gemini-3-flash-preview` 保留為可選但不再作預設
- `17:38` Codex：新增 `scripts/gemini-healthcheck.sh` 與 VSCode 任務 `Gemini CLI: Healthcheck`
- `17:40` Gemini CLI：已用 `gemini-2.5-flash` / `gemini-3.1-flash-lite-preview` 成功回覆 repo 內角色、自身限制與最適合負責的公開資料工作
- `17:47` Codex：已驗證 Qwen CLI `--help` 可正常啟動；Qwen 現況定位為「可用但偏慢的 local low-risk worker」
- `17:49` Codex：已驗證 Claude Local over Ollama 可正常啟動並回報版本；目前定位為「互動式 drafting assistant」，暫不作 headless 主線 worker
- `17:52` Codex：新增外部 LLM 共享交接通道 [coordination/llm-bus/board.md](/Users/chenkuichen/APP/test/coordination/llm-bus/board.md)
- `18:02` 使用者要求把 Qwen 與 Claude local 都升到 `qwen3-coder:30b`；舊 `qwen3:14b` 已移除，正在拉新模型
- `20:45` Codex：電腦重開後已重新執行升級流程；`qwen3:14b` 確認移除，`qwen3-coder:30b` 與 `nomic-embed-text` 留存
- `20:48` Codex：`launchctl setenv OLLAMA_CONTEXT_LENGTH 65536 && brew services restart ollama` 完成；Ollama 已重啟
- `20:55` Codex：Qwen / Claude local / Gemini wrapper 與 VSCode tasks 全部重新指向當前模型與健康檢查腳本
- `21:08` Codex：新增三方實測腳本 [validate-local-llm-stack.sh](/Users/chenkuichen/APP/test/scripts/validate-local-llm-stack.sh)
- `21:12` Gemini：research lane 實測命中 `429 RESOURCE_EXHAUSTED`，CLI 本身正常，但今日 API quota 不足
- `21:13` Qwen：`qwen3-coder:30b` headless low-risk patch 測試在 240 秒內未產出結果
- `21:14` Claude local：`qwen3-coder:30b` 後端啟動正常，但 headless guardrail 測試在 240 秒內未產出結果
- `21:18` checkpoint meeting：分工降級為
  - `Gemini`：quota 可用時做 external research scout
  - `Qwen`：低頻、bounded、最好互動式的小 patch helper
  - 高風險主線由 `Codex` 承擔

## Next actions

- Task B 分工：
  - `Codex`：已完成 validated / stale / invalidated / candidate 的 merge 契約與 review-driven validation；下一步補強多股票事件與 casebook 解釋力
  - `Gemini CLI`：quota 可用時補近期公開來源、法說 / 公告 / 目標價報導與 citations
  - `Qwen Code`：低頻、bounded 的 parsing / UI / test 機械實作
- 新增歷史驗證主線：
  - `AnythingLLM`：整理相似個股案例與文件證據
  - `Codex`：定義哪些差異屬於規則失準，哪些只是情境不同
- 若主線暫時卡住或正在等驗證，自動做一次 optimization sweep：
  - 問其他模型哪裡還能優化
  - 只收具體、低噪音、可驗證的建議
  - 由 Codex 決定是否納入下一輪
- 每次準備對用戶做階段性回報前，先做一次 checkpoint meeting：
  - 讓各模型先回報哪裡仍薄弱
  - 檢查是否漏掉台股特有節奏 / 風險
  - 判斷是否需要新 skill / 新工具
  - 判斷是否需要上網補一手策略 / 市場參考
  - 最後只保留「立即採納 / 暫緩 / 拒絕」三類決議
- optimization sweep 優先檢查：
  - strategyBrain 規則是否重複 / 空泛 / 缺少 exit logic
  - holding dossier 哪些欄位 stale / missing
  - 收盤分析是否出現無證據支撐的句子
  - 台股節奏詞彙與 guardrail 是否不足
  - UI 是否隱藏了 matched rules / freshness / evidence
- 補 `evidenceRefs` 的實際產生流程，不只支援 schema
- 補 `historicalAnalogs` 的實際產生流程，不只支援 schema
- 繼續把台股事件節奏特化欄位做實：月營收 / 法說 / 財報 / 目標價更新窗口的 hard gate enforcement
- 評估是否為策略大腦補單元測試
- 下一段優先檢查：
  - 使用者 reload 後確認 0 市值是否已恢復；若仍有問題，優先檢查 unrecoverable `integrityIssue: missing-price` 的個股名單
  - 台股真值層下一步要補 MOPS / TWSE / TPEX / 除權息 / 零股 / 交易成本
  - 把 `eval_brain` 案例擴到真實台股月營收 / 法說 / 題材輪動情境，不只 3 個 smoke cases
- Qwen 若要進穩定協作，需要把非互動本地模型路由再調順
- 若再次驗證外部 LLM，先看 [coordination/llm-bus/runs/20260325-210859](/Users/chenkuichen/APP/test/coordination/llm-bus/runs/20260325-210859) 的實測結果，不可把已配置能力誤報成穩定主線能力

## Stop-in-5-min fallback

- 先完成當前 edit batch，不再開新 scope
- 至少更新一次這份檔案的 `Latest checkpoint`
- 明確寫下：
  - 已完成的檔案
  - 尚未完成的下一個函式 / 區塊
  - 下一步最直接的指令或檔案位置
- 若有 delegated slice，標明：
  - 哪個模型已交稿
  - 哪個模型待 review
  - 哪個 slice 被 Codex 收回

## Blockers / assumptions

- 目前 `validationScore` 與 `staleness` 仍以 fallback 推導為主，真正精準化要靠 Task B 之後的規則驗證流程
- `evidenceRefs` schema 已就位，但實際自動回填來源還要再補
- `historicalAnalogs` schema 已就位，但還沒有正式的相似案例檢索 / 比對器；目前先由 AI 在現有 dossier 與歷史脈絡內產出草稿
- `brain-validation-v1` 現在已支援 review-driven 的真實 outcome 標記，但多股票事件仍是單一 outcome 顆粒度
- 必須維持舊版 localStorage brain 資料相容，不能要求使用者重置資料
- 台股分析屬高難度任務：便宜模型只能做摘要、抽取、分群、草稿；最終判斷與客戶/策略影響仍由 Codex 決定
- 台股分析不可只看持倉欄位，後續 Task B / Task D 必須把市場機制、法人 / 題材 / 月營收 / 法說節奏一起納入
