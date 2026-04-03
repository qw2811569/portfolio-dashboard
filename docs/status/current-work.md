# Current Work

Last updated: 2026-04-03 12:23

## Management preferences

- 對使用者回報請用白話，少用 coding 術語。
- 回報重點聚焦：目前目標、專案架構是否落地、流程是否順、是否還有 bug。
- 決策與整體邏輯複查由小奎 + Claude 主導，再分派給 Codex / Qwen / Gemini。
- 成本意識：Claude/API 分析昂貴，正式測試前先盡量用低成本方式把流程理順。
- 不要為了內部討論過度消耗 token，結論要短、清楚、可執行。

## Start here

- 第一入口：`docs/status/PROJECT_ENTRY.md`
- canonical 細節狀態：`docs/status/current-work.md`

## Working loop

- 小奎負責持續派工與節奏控制。
- Codex / Qwen 完成工作後，必須把成果寫回各自文件與 `docs/status/current-work.md`。
- 回報格式優先用：`done` / `changed files` / `risks` / `next best step`。
- 若卡住、驗證失敗、或無法繼續，需立即用 `blocker` 寫回 `docs/status/current-work.md`。
- repo 內已有既有機制：`AI_NAME=<Name> bash scripts/ai-status.sh done|blocker|handover "訊息"`，會自動更新 `current-work.md` 與 AI 狀態。
- Claude 不主動接機械作業；Claude 在下一輪負責閱讀最新回報、做整體判斷、決定下一步。

## Objective

目前主線目標：**把專案核心主流程做成可交付狀態——架構落地、流程閉環、明顯 bug 收斂。**

優先順序：

1. 先確認核心流程真的跑順（持倉 / 事件 / FinMind → 分析 / 研究 → 策略更新 → 前台顯示）
2. 再做正式驗收與 smoke，區分「本地已完成」和「已可交付」
3. 最後再收斂剩餘零散 bug 與次要整理

## Active slices

- `小奎 + Claude`：主導決策、整體邏輯複查、透過 OpenClaw ACP 調度
- `Codex`：工程師 — 修 bug、寫邏輯、改 API，不做測試
- `Qwen`：QA 測試員 — 跑 build/lint/test、production API 測試、寫 bug 回報（不修 bug）
- `Gemini CLI`：暫停（API 限流）
- `OpenClaw`：Telegram 調度員，ACP 原生管理所有 AI agent

固定角色與能力邊界見：

- `docs/AI_COLLABORATION_GUIDE.md`

## Files in play

- `src/App.jsx`
- `src/lib/eventUtils.js`
- `src/lib/portfolioUtils.js`
- `src/lib/knowledgeBase.js` — 知識庫檢索+策略映射（Claude 最近修改）
- `src/lib/knowledge-base/` — 7 分類 600 條（Claude 最近完成）
- `src/lib/dossierUtils.js` — dossier 組裝，串接知識庫 context
- `src/seedData.js` — STOCK_META 策略定義
- `tests/lib/knowledge-base.test.js` — 25 個 KB 測試（Claude 新增）
- `src/components/ErrorBoundary.jsx`
- `src/main.jsx`
- `scripts/healthcheck.sh`
- `scripts/kb-experiment.sh` — autoresearch-style 實驗量測（Claude 新增）
- `api/research.js` — candidate brain proposal 主流程（Codex 進行中）
- `src/hooks/useResearchWorkflow.js` — research proposal 契約與提示訊息（Codex 進行中）
- `src/components/research/ResearchPanel.jsx` — evolve UI 文案同步 proposal 語意（Codex 進行中）
- `docs/AI_COLLABORATION_GUIDE.md` — §7 知識庫分工已更新
- `docs/superpowers/kb-experiment-results.tsv` — 實驗帳本
- `docs/status/current-work.md`
- `CLAUDE.md`
- `QWEN.md`
- `GEMINI.md`

## 當前任務（主線收斂）

任務詳情仍可參考各 LLM 的 .md 檔，但本輪以主線為準，不再分散擴張。

目前只盯 3 件事：

1. **架構落地**：核心主流程的真相版本要清楚，文件與實際狀態一致
2. **流程閉環**：持倉 / 事件 / FinMind → 分析 / 研究 → 策略更新 → 前台顯示，要真的串通
3. **明顯 bug 收斂**：先收斂會破壞主流程或讓使用者誤判系統沒反應的問題

## Latest checkpoint

- `2026-04-03 12:23` Codex：完成 Batch A Decision Layer：A1 buildKnowledgeQueryProfile + weighted knowledge retrieval；A2 新增 analysisFramework.js；A3 新增 buildColdStartDossierSummary，並逐項通過 build/vitest。
- `2026-04-03 12:17` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 12:16` Codex：Round 1 修復完成
- `2026-04-03 12:15` Codex：完成歷史回測框架：新增 scripts/backtest.sh 與 src/lib/backtestRuntime.js，支援指定日期/代碼/回數、歷史 FinMind dossier、規則式分析、未來價格評估與知識回饋，並通過 build/vitest。
- `2026-04-03 12:09` Codex：緊急前端 bug 修復完成：新用戶 fallback 不再自動載入 seed holdings/targets/watchlist；/api/brain 無資料時回空預設結構避免 500；並已通過 lint 與 vitest。
- `2026-04-03 12:04` Codex：完成 Batch 3：3A /api/parse 接 Claude Vision 並回 structured OCR JSON、補具體錯誤處理；3B OCR 目標價結果自動更新 holdings targetPrice，且已通過 build/vitest。
- `2026-04-03 11:59` Codex：完成 Batch 2：2A 收盤分析 prompt 注入台股市場訊號（營收/事件窗口/目標價 freshness/法人5日）；2B 新增 historical analogs 比對並注入 prompt，且已通過 build/vitest。
- `2026-04-03 11:51` Codex：完成 Batch 1：1A News/Analysis Panel 顯示 impact/source；1B 新增 collect-daily-events cron + CRON_SECRET + Blob put；1C knowledge evolution confidence 自動調整，並逐項通過 build/vitest 驗證。
- `2026-04-03 11:41` Codex：修復 NewsPanel duplicate key：FinMind 同股同日多則新聞改用更唯一 key（id + title + index），並完成 build/lint 驗證。
- `2026-04-03 11:22` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 11:21` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 11:20` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 11:19` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 11:17` Codex：Round 1 修復完成
- `2026-04-03 11:14` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 11:13` OpenClaw：自動閉環完成：5 輪後穩定
- `2026-04-03 11:11` Codex：Round 4 修復完成
- `2026-04-03 11:06` Codex：Round 2 修復完成
- `2026-04-03 10:57` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 10:55` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 10:50` Codex：修復 auto-evolve 列出的本地 API routing 問題：vercel dev 不再把 /api/\* 當成 vite 前端路徑；已補 install/build commands，並完成 build/lint/test 驗證。
- `2026-04-03 10:15` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 10:09` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 10:07` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 02:32` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 02:29` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 02:23` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-02 23:37` Codex：auto-evolve 修復完成
- `2026-04-02 21:05` Claude：交接：已讀第二輪模擬回報。確認『回報→整體判斷→續派』循環可運作；下一步改回真實任務，不再用模擬訊息。
- `2026-04-02 21:05` Qwen：done：完成第二輪模擬回報。changed files：docs/status/current-work.md。risks：目前為手動試跑。next best step：請 Claude 再次確認循環可持續。
- `2026-04-02 21:05` Claude：交接：已讀第一輪模擬回報。主線離可交付還差兩件事：正式驗收與前台最後閉環。下一輪應派 Codex 做驗收、Qwen 做前台閉環確認。
- `2026-04-02 21:05` Codex：done：完成第一輪模擬回報。changed files：docs/status/current-work.md。risks：目前為手動試跑。next best step：請 Claude 讀回報後判斷下一輪。- `2026-04-02 17:29` Codex：已完成 `session-handoff-2026-04-02-v2.md` 指定的 FIX-5 / FIX-6 / FIX-7，本地驗證通過。
  - done：[`api/research.js`](/api/research.js) 的全組合研究現在補上真正的 `local-fast` 4 輪流程：本地 / vercel dev 會維持「個股快掃 → 系統診斷 → 進化建議 → 候選提案」完整 4 輪，但 Round 1 改成單次 AI call 掃完整個持股清單，不再因 per-stock loop 或摘要截斷讓使用者誤以為只研究一檔；報告也新增 `roundMode` 標記。[`src/hooks/useDailyAnalysisWorkflow.js`](/src/hooks/useDailyAnalysisWorkflow.js) 與 [`src/hooks/useResearchWorkflow.js`](/src/hooks/useResearchWorkflow.js) 都補了 on-demand FinMind hydration：若 dossier 還沒帶進 7 個 prompt 關鍵 datasets，會先呼叫 `fetchStockDossierData()` 補齊，再組 prompt，避免「資料來源不足」其實只是 enrichment 還沒完成。[`src/lib/finmindPromptRuntime.js`](/src/lib/finmindPromptRuntime.js) 新增 prompt coverage helper，用來統一判斷 7 個 FinMind datasets 的覆蓋率與 hydration 行為；[`src/lib/dossierUtils.js`](/src/lib/dossierUtils.js) 也補了可開關的 FinMind summary debug。最後，[`src/hooks/useDailyAnalysisWorkflow.js`](/src/hooks/useDailyAnalysisWorkflow.js) 的 inline `BRAIN_UPDATE` 不再只接受 `rules`，只要 payload 有有效內容（例如 `candidateRules` / `lessons` / `checklists`）就會走 merge + `setStrategyBrain()`，修掉收盤分析有回 `BRAIN_UPDATE` 卻沒更新策略大腦的問題。
  - changed files：`api/research.js`、`src/hooks/useDailyAnalysisWorkflow.js`、`src/hooks/useResearchWorkflow.js`、`src/lib/dossierUtils.js`、`src/lib/finmindPromptRuntime.js`、`tests/api/research.test.js`、`tests/hooks/useResearchWorkflow.test.jsx`、`tests/hooks/useDailyAnalysisWorkflow.test.jsx`、`tests/lib/finmindPromptRuntime.test.js`
  - validation：`vitest` targeted 5 files / 19 tests 通過；targeted `eslint`（source + relevant tests）通過；`npm run build` 通過。build 仍有既有 `index` chunk >500 kB warning，但沒有新 build error。
  - risks：這輪尚未 push，也還沒跑 production smoke，所以 `local-fast` 4 輪、FinMind hydration、以及 inline brain update 都還只在本地驗過。FinMind debug log 預設不會自動噴出，要在 local 手動設 `globalThis.__DEBUG_FINMIND_PROMPT__ = true` 才會看到 7 datasets coverage。`FIX-6` 目前補的是 on-demand hydration，不是改掉整個 async enrichment 架構本體；如果後續要更省 API 次數，可以再把 dossier enrichment promise 往上提到 shared derived state。
  - next best step：等你同意後一次 push，然後用 `vercel dev` / production 各做一輪 smoke：1. `evolve`/`portfolio` 確認 4 輪內容完整；2. 收盤分析確認 prompt 內已有 FinMind coverage；3. 收盤分析回傳只有 `candidateRules/lessons` 時，策略大腦仍會即時更新。

- `2026-04-02 09:13` Qwen：閉環 UI 串接完成：(1) 事件→分析串接可視化 — DailyReportSummary 顯示「引用 X 個事件、Y 條知識庫規則、Z 筆 FinMind 數據」；(2) FinMind 數據面板 — HoldingsTable 展開區顯示三大法人/PER/融資融券數據。驗證：git commit 9c89eb9。

- `2026-04-02 08:53` Qwen：Qwen UI 任務 1-2 完成：(1) 收盤分析等待提示「正在分析，約需 30 秒...」已加入 AnalyzingState；(2) SupplyChainView 已接入持倉頁展開區。驗證：git commit 0be44de。

- `2026-04-02 16:49` Codex：第六輪 FIX-1~4 已完成第一批 API / prompt 修補，並完成本地驗證。
  - done：[`src/lib/dailyAnalysisRuntime.js`](/src/lib/dailyAnalysisRuntime.js) 的 `stripDailyAnalysisEmbeddedBlocks()` / `extractDailyEventAssessments()` / `extractDailyBrainUpdate()` 已從脆弱 regex 改成先定位 section、再抽 JSON、最後移除 block 的做法，現在可處理 `## / ### / 無標題`、`🛠 / 🧬`、有無 ```json fence 的變體。[`api/research.js`](/api/research.js) 的單股研究改成 `local-fast`與`production full` 雙模式：本地 / vercel dev 預設只跑 1 輪完整研究，production 才維持 3 輪，避免本地 30s timeout。研究 dossier prompt 也補回知識庫與 FinMind 摘要，不再只有 thesis / target / fundamentals。[`src/lib/dossierUtils.js`](/src/lib/dossierUtils.js) 則補齊 `revenue / balanceSheet / cashFlow / shareholding` 到 daily analysis 的 FinMind prompt 摘要，確認 7 個關鍵 dataset 都能進 prompt。
  - changed files：`api/research.js`、`src/lib/dailyAnalysisRuntime.js`、`src/lib/dossierUtils.js`、`tests/api/research.test.js`、`tests/lib/dailyAnalysisRuntime.test.js`、`tests/lib/dossierUtils.buildHoldingDossiers.test.js`
  - validation：`vitest` targeted 3 files / 24 tests 通過；`npm run build` 通過；targeted `eslint`（上述 6 檔）通過。程式碼 commit：`6fd8ab6 fix daily parser and local research prompt coverage`
  - risks：這輪尚未 push，也還沒做 production smoke，所以 `production 3 輪` 與新 prompt coverage 還沒在線上再驗一次；另外我早前有一筆本地 commit `eff32a2 gracefully degrade FinMind rate limits` 也還沒 push。`current-work.md` 的 checkpoint 已補，但我沒有去動 `ai-activity.json` / `ai-activity-log.json`，避免覆蓋其他 AI 的即時狀態。
  - next best step：先把 `eff32a2` 與 `6fd8ab6` 一起 push，再用 production 驗三件事：1. daily report 不再殘留 `BRAIN_UPDATE` JSON；2. research 在 production 維持 3 輪；3. FinMind prompt coverage 與 rate-limit graceful fallback 在線上都生效。

- `2026-04-02 06:12` Qwen：行事曆日期比較修復：generateFixedCalendarEvents() 改用字串比較（ISO date string）而非 Date 物件比較，避免 UTC/本地時區問題。驗證：2026-04-02 起 30 天內應有 1 個事件（4/9 3 月營收截止），FOMC/央行/財報季都在範圍外。git commit 已建立但未 push。

- `2026-04-02 07:49` Codex：visible bug 修補已 push+deploy：analyze fallback、research 空結果修正、event-calendar 事件補回
- `2026-04-02 07:46` Codex：修復三個用戶可見 bug：streaming fallback、research 空結果、event-calendar 補回 Gemini fallback
- `2026-04-02 07:50` Codex：修復三個用戶可見 bug：收盤分析 streaming fallback、深度研究空結果、行事曆事件過少。
  - done：新增 `src/lib/analyzeRequest.js`，`useDailyAnalysisWorkflow.js` 現在會先嘗試 `/api/analyze?stream=1`，若串流 fetch / SSE consumer / 空正文失敗，會自動 fallback 到非串流 `/api/analyze`，避免前端只剩 `AI 分析未產生：Load failed`。`api/research.js` 接入 `src/lib/researchRequestRuntime.js`，會正規化 legacy `target` / `mode` request，對無效 body 直接回 400，不再默默回 `results: []`；同時補上 request/prompt 摘要 log。`api/event-calendar.js` 則把 Gemini `event-calendar-*.json` fallback 接回即時 API，並將固定事件規劃視窗擴到可包含近期 FOMC / 財報季。程式碼 commit `6a7d24d` 已 push，production 手動部署 `dpl_3Xa6t8F6VMEcEMEaZmGUN3TAqZuQ` 已 ready。
  - changed files：`src/lib/analyzeRequest.js`、`src/hooks/useDailyAnalysisWorkflow.js`、`src/lib/researchRequestRuntime.js`、`api/research.js`、`src/hooks/useResearchWorkflow.js`、`api/event-calendar.js`、`tests/lib/analyzeRequest.test.js`、`tests/lib/researchRequestRuntime.test.js`、`tests/api/research.test.js`、`tests/api/event-calendar.test.js`
  - validation：`vitest` targeted 4 files / 22 tests 通過；`npm run build` 通過；`npm run lint` 無 error，仍有既有 warnings：`DailyReportPanel.jsx` console、`GeminiResearchBrowser.jsx` unused arg、`useAutoEventCalendar.js` unused `codesSet`。production smoke：`POST /api/analyze?stream=1` 回 `200 text/event-stream` 且內容含中文評論；`POST /api/research` 對空 `stocks` 現在回 `400 {"error":"深度研究缺少目標股票"}`；`GET /api/event-calendar?range=30&codes=2308,2492,3443` 已回 JSON，內容含 `2026-05-07 FOMC 利率決議` 與 Gemini 股東會事件。
  - risks：`VISIBLE-1` 的關鍵修補是前端 streaming fallback，這部分 production 仍需從實際 UI 點一次 `收盤分析` 才能完全確認瀏覽器端不再顯示 `Load failed`；`event-calendar` production 雖已恢復且不再過少，但 `finmind-news` 是否命中仍受當日新聞樣本影響
  - next best step：直接在 production UI 驗證三件事：`收盤分析` 面板、`深度研究` 單股與組合模式、`事件面板` 是否穩定顯示 fixed + gemini 事件；若都正常，再回頭清掉 `useAutoEventCalendar.js` 的既有 unused warning

- `2026-04-02 07:04` Codex：完成全面 Bug Sweep：research 500 已修，streaming/OCR/research 端到端結果已確認- `2026-04-02 07:04` Codex：完成全面 Bug Sweep，並修掉 production `research` serverless 啟動即 crash 的問題。
  - done：依照 `CODEX.md` 的 5 項 sweep 完成 production 驗證。最新 production 已是 commit `939ca51`；Vercel deployment `dpl_EYZHzhbn3jTpdrMy1JfgZmy63GfP` build 綠燈。`/api/research` 原本 bare GET 與 POST 都是 `FUNCTION_INVOCATION_FAILED`，Vercel logs 顯示根因是 Node ESM 載入 `src/lib/knowledge-base/*.json` 缺少 import attribute；已在 `src/lib/knowledgeBase.js` 與 `src/lib/knowledgeEvolutionRuntime.js` 補上 `with { type: 'json' }`，修補後 production `GET /api/research` 已恢復 `200`，`POST /api/research` 會進到真正研究流程，不再 instant crash。
  - changed files：`src/lib/knowledgeBase.js`、`src/lib/knowledgeEvolutionRuntime.js`
  - validation：`vitest`（`knowledge-base + knowledgeEvolutionRuntime`）29 tests 通過；`npm run build` 通過；`npm run lint` 無 error，仍有既有 warnings。production sweep 結果：`GET /api/twse -> 400`、`GET /api/finmind -> 400`、`GET /api/event-calendar -> 200`、`GET /api/analyze -> 405`、`GET /api/research -> 200`、`GET /api/parse -> 405`、`GET /api/analyst-reports -> 405`、`GET /api/gemini-research -> 200`。
  - risks：Vercel CLI 目前只列出 `ANTHROPIC_API_KEY` 與 `PUB_BLOB_READ_WRITE_TOKEN`，看不到 `CRON_SECRET` / `FINMIND_TOKEN`；若不是 CLI 權限視角限制，代表至少其中兩個 env 尚未配置。streaming analyze 端到端通過，SSE 有 `meta + delta + done`，且正文是中文評論不是純 JSON。OCR 對正常尺寸 PNG 端到端通過（`200`），但 1x1 極小測試圖仍會回 `500 Could not process image`，表示 parse API 對不可處理圖片還沒有 graceful degrade。`/api/research` 單股 POST 目前不再 instant crash，但 production API 仍會在約 `60.9s` 被 Vercel 打成 `504 FUNCTION_INVOCATION_TIMEOUT`；用與前端同等的 `AbortSignal.timeout(55000)` 測試時，會在 `55.01s` 收到 `TimeoutError`，代表不會無限 hang，但研究 latency 仍是紅燈。
  - next best step：優先做 research streaming / prompt 瘦身第二輪，把單股 research 壓到 55 秒內；其次補 OCR 對過小或不可處理圖片的 graceful 400/結構化錯誤；最後到 Vercel Dashboard 核對並補上 `CRON_SECRET` / `FINMIND_TOKEN`。

- `2026-04-01 22:57` Qwen：全面 Bug Sweep 完成：SWEEP-1（9 個頁面全部載入）✓、SWEEP-2（空用戶體驗）✓、SWEEP-3（行事曆 API）✓、SWEEP-5（ErrorBoundary）✓。所有檢查通過。

- `2026-04-02 06:52` Codex：追查 `Importing a module script failed` 後，將最脆弱的 panel chunk 改為穩定載入。
  - done：用 Vite manifest 對照後確認最可疑的是 `daily` / `research`，因為只有這兩個 panel 會額外依賴共享 `Md-*.js` 子 chunk。[`AppPanels.jsx`](/src/components/AppPanels.jsx) 現在把 `DailyReportPanel` 與 `ResearchPanel` 改為 eager import，不再走 lazy chunk；其餘仍保留 lazy，但新增 [`lazyPanelLoader.js`](/src/lib/lazyPanelLoader.js) 做一次性 reload 保護，當瀏覽器遇到 `Importing a module script failed` / `Failed to fetch dynamically imported module` 這類快取不一致錯誤時，會只自動重整一次避免白屏卡死。
  - changed files：`src/components/AppPanels.jsx`、`src/lib/lazyPanelLoader.js`、`tests/lib/lazyPanelLoader.test.js`
  - validation：`vitest`（`AppPanels.contexts + lazyPanelLoader`）5 tests 通過；`npm run build` 通過；`npm run lint` 無 error，仍有既有 warnings。build manifest 已確認 `src/components/reports/index.js` 與 `src/components/research/index.js` 不再出現在 entry `dynamicImports`。
  - risks：主 bundle 因把 `daily/research` 收回 entry 而增大到約 `505 kB`，重新出現 Vite chunk warning；這是用較小的首屏體積 tradeoff 換取較高的 panel 穩定性。若之後要繼續優化，可再把 markdown 依賴拆成更穩定的 shared vendor，而不是恢復成脆弱的二層 lazy import。
  - next best step：push + deploy 後，直接在 production 打開 `daily` 與 `research` panel 驗證是否不再出現 module script failed；如果還有零星案例，再把剩餘 lazy panels 的錯誤 telemetry scope 匯到 `/api/telemetry` 做精準追蹤。

- `2026-04-02 06:32` Codex：緊急 Bug 修復已 push + deploy，OCR / 收盤分析 / 深度研究三條線都已補上可見錯誤與 timeout 保護。
  - done：`api/parse.js` 現在會驗證 `base64` 是否存在，並把 OCR AI 原始回應以截斷格式記到 server log；`useTradeCaptureRuntime.js` 會把「AI 未回傳可解析 JSON / JSON 格式錯誤」轉成較具體的前端錯誤訊息，不再只顯示籠統失敗。`dailyAnalysisRuntime.js` 明確要求模型先輸出中文分析評論，再附 `EVENT_ASSESSMENTS / BRAIN_UPDATE`；若 strip 掉附錄後正文為空，會保留原始回覆，避免收盤分析整塊變空白。`useResearchWorkflow.js` 對 `/api/research` 加上 55 秒 timeout，並將 timeout / abort 對應成明確的逾時提示，避免 UI 一直轉圈沒有結果。
  - changed files：`api/parse.js`、`src/hooks/useTradeCaptureRuntime.js`、`src/lib/tradeAiResponse.js`、`src/lib/dailyAnalysisRuntime.js`、`src/hooks/useResearchWorkflow.js`、`tests/api/parse.test.js`、`tests/lib/tradeAiResponse.test.js`、`tests/lib/dailyAnalysisRuntime.test.js`、`tests/hooks/useResearchWorkflow.test.jsx`
  - validation：`vitest` targeted 4 files / 16 tests 通過；`npm run build` 通過；`npm run lint` 無 error。lint 仍有既有 warnings：`DailyReportPanel.jsx` console、`GeminiResearchBrowser.jsx` unused arg；另有目前工作樹上的 `src/constants.js` / `src/hooks/useAutoEventCalendar.js` unused warning，未納入本輪修補。
  - deploy：Git commit `2ae07e5` 已 push 到 `origin/main`；production deployment `dpl_3daaftBPsBgt2UybTkXpp772E46H` 已完成，網址仍為 `https://jiucaivoice-dashboard.vercel.app`
  - risks：尚未做 production smoke，所以 OCR 真實截圖、收盤分析 streaming 正文品質、以及深度研究 55 秒 timeout 提示目前只在本地測試覆蓋；`/api/research` 仍非 streaming，若 payload 再變大，使用者至少會看到 timeout，但不會提早收到部分結果。
  - next best step：用一張真實成交截圖驗證 OCR、用真實收盤分析 payload 驗證正文不再為空、再用 production `/api/research` 確認 55 秒 timeout 提示如預期出現。

- `2026-04-01 22:18` Qwen：緊急 Bug 修復完成：BUG-3（持倉硬編碼→空陣列 fallback）+ BUG-5（行事曆直接呼叫 event-calendar API）。驗證：git commit 372ac12。

- `2026-04-02 06:08` Codex：P7/P8 已完成並部署 production。
  - done：`/api/analyze` 已支援 streaming SSE，`api/_lib/ai-provider.js` 新增 Anthropic `stream: true` 路徑，前端 `useDailyAnalysisWorkflow.js` 現在會逐步渲染分析正文，並在串流結束後解析 `EVENT_ASSESSMENTS / BRAIN_UPDATE`。另外根據 production smoke 結果，修正 `api/event-calendar.js` 的 FinMind same-day 日期過濾 bug，避免今天的新聞因時分秒比較被排除。
  - changed files：`api/_lib/ai-provider.js`、`api/analyze.js`、`api/event-calendar.js`、`src/hooks/useDailyAnalysisWorkflow.js`、`src/lib/appMessages.js`、`src/lib/dailyAnalysisRuntime.js`、`src/lib/dossierUtils.js`、`src/lib/eventStream.js`、`tests/api/analyze.test.js`、`tests/api/event-calendar.test.js`、`tests/lib/eventStream.test.js`、`tests/lib/dailyAnalysisRuntime.test.js`
  - validation：`vitest` targeted 6 files / 20 tests 通過；後續 `event-calendar/analyze/eventStream` targeted 3 files / 13 tests 通過；`npm run build` 通過；`npm run lint` 無 error，仍有既有 2 個 warning（`DailyReportPanel.jsx` console、`GeminiResearchBrowser.jsx` unused arg）
  - deploy：Git commits `9bd48fd`（streaming analyze）與 `2a0611f`（event-calendar date filtering）皆已 push 到 `origin/main`，production 重新部署完成；inspect：`Adqfg9pfTCC1XR9tcN2GPTspEYGD`、`9RyHL9rZQ66ovPqfnm4BeAy1YSFB`
  - smoke：production `POST /api/analyze?stream=1` 首包 `0.91s`、總耗時 `7.53s`，已確認回傳 `meta + delta` 串流事件；`/api/finmind` 的 `balanceSheet / cashFlow / shareholding` 皆回傳成功；`/api/event-calendar` production 回應正常，但本次樣本未命中 `finmind-news` source
  - risks：streaming smoke 使用的是短 prompt，不是完整收盤分析 payload，所以目前能證明的是「首包很快、串流正常」，還不能直接等同先前 `60.21s` 真實 payload 已完全解除；`event-calendar` 雖已修掉 same-day bug 並有測試，但 production 樣本日仍未出現 `finmind-news` source，需再用有明確法說/股東會/除權息/財報關鍵字的當日新聞驗證一次；P9 Backer datasets 尚未開始，等待 FinMind 付費確認
  - next best step：用一組真實 daily analysis payload 在 production 重跑 streaming `/api/analyze?stream=1`，量測 `time_starttransfer` 與總完成時間；若結果穩定，再開始準備 P9 的 Backer dataset mapping skeleton

- `2026-04-01 21:58` Qwen：新一輪任務 M/N 完成：(M) SupplyChainView.jsx 供應鏈視覺化元件；(N) GeminiResearchBrowser.jsx + /api/gemini-research API。驗證：git commit 49b561d。

- `2026-04-01 21:55` Qwen：新一輪任務 K/L 完成：(K) event-calendar.test.js 已建立；(L) buildFinMindChipContext 加入資產負債表/現金流量表摘要。驗證：git commit 5d1eedb。

- `2026-04-01 21:40` Qwen：新一輪任務 H/I/J 完成：(H) 外資持股比率已存在；(I) HoldingsTable.jsx 加入主題 chips；(J) DailyReportPanel.jsx console.log → console.debug。驗證：git commit 02fd601。

- `2026-04-02 05:32` Codex：P3-P6 已完成，交接文件已補齊。
  - done：FinMind adapter 補齊 `balanceSheet / cashFlow / shareholding / dividendResult / news`；`TaiwanStockNews` 角色說明已更新為提供 Qwen 建動態事件來源。daily analysis prompt 已改成全局 `coverage_context` + budget 模式，避免每檔持股重複塞供應鏈/主題 context。Vercel cron 已改成台灣時間收盤後執行。新增 `docs/specs/streaming-analysis-design.md`，完成 streaming 路線規劃。另修復 `src/main.jsx` 在 `main` 上既有的 build blocker，讓本輪驗證可重現。
  - changed files：`api/finmind.js`、`src/lib/dataAdapters/finmindAdapter.js`、`src/lib/dataAdapters/index.js`、`src/lib/dossierUtils.js`、`src/lib/promptBudget.js`、`src/hooks/useDailyAnalysisWorkflow.js`、`src/lib/dailyAnalysisRuntime.js`、`src/main.jsx`、`vercel.json`、`tests/lib/finmindAdapter.test.js`、`tests/lib/dossierSupplyChain.test.js`、`tests/lib/promptBudget.test.js`、`tests/lib/dailyAnalysisRuntime.test.js`、`docs/specs/streaming-analysis-design.md`
  - validation：`vitest` 4 files / 17 tests 通過；`npm run build` 通過；`npm run lint` 無 error，僅剩既有 `DailyReportPanel.jsx` console warning
  - risks：本地 commit `274cac6` 已完成，但 `git push origin main` 仍被這台機器的 GitHub HTTPS 認證阻擋，尚未上遠端；repo 仍有既有 `DailyReportPanel.jsx` lint warning；工作樹裡還有其他 AI/使用者的未提交變更，我未併入這輪
  - next best step：先修復這台機器的 GitHub 認證並 push `274cac6`；push 後再視需要做 deploy / smoke test，確認遠端與這次 handoff 狀態一致

- `2026-04-01 21:24` Qwen：新一輪任務 F 完成：Gemini 產業新聞匯入 — scripts/import-gemini-news.js 腳本建立，支援 impact: positive/negative/neutral 過濾、產業趨勢/個別公司/總體經濟分類、自動事件類型判斷。驗證：git commit e17a70d。

- `2026-04-01 21:22` Qwen：新一輪任務 E 完成：動態事件行事曆 — FinMind TaiwanStockNews 作為動態事件來源（法說/股東會/除權息/財報關鍵字篩選），修正 Gemini 事件持股篩選 bug。驗證：git commit 1f2bcd1。

- `2026-04-01 21:13` Qwen：新一輪任務 A-E 完成：(A) 重複 title 清理 0 個；(B) 主題分類前端展示 buildThemeChips/buildThemeChipsText；(C) 供應鏈 competitors 展示；(D) knowledge proposal UI 已存在；(E) import-gemini-research.js 腳本建立。驗證：git commit cf89bb9。

- `2026-04-02 05:40` Claude：第二輪任務指派 — Codex P7-P9（streaming 實作+smoke test+Backer datasets 準備）、Qwen G-J（動態事件測試+外資持股展示+主題 chips UI+lint fix）、Gemini B-E（產業新聞+competitors 驗證+prompt 方法論+新 datasets 驗證）。Codex 的 git push 認證問題是最高優先。
- `2026-04-02` Claude：供應鏈圖譜大幅擴充（My-TW-Coverage repo → supplyChain.json 8→20 entries），主題分類全面填滿（themes.json 12→14 主題，15/18 持股有主題標籤），seedData STOCK_META themes 更新。新建 themeClassification.json。FinMind 完整 API 參考文件建立（docs/finmind-api-reference.md，90 datasets 完整分類）。評估 anthropics/financial-services-plugins 不適用（美股專用）。指派 Codex P3-P6、Gemini A-D、Qwen A-E 新任務。
- `2026-04-01 15:58` Codex：P0 prompt slimming for /api/analyze in progress: daily analysis now uses compact holding summaries + XML sectioned prompt + explicit maxTokens/allowThinking=false. Local measurement with real top 5 holdings reduced holding summary from 3000 chars to 1664 chars (-44.5%); brain context budget tightened to 1000 chars. Validation: vitest 4 files 47 tests pass, build pass, lint only existing 2 warnings. Next: production smoke test daily analysis latency, then knowledge proposal gate/apply flow.
- `2026-04-01 15:22` Codex：production daily-analysis 實測：使用 2026-03-23 真實 20 檔持股 payload 打 production /api/analyze，輸出已收斂為 3 檔 A 級深寫 + 其餘快照，但 latency 60.21s 仍貼近上限。P2 已接入 research evolve：新增 knowledgeEvolutionRuntime，前端會把 kb-usage-log / kb-feedback-log 帶進 research API，evolve/portfolio 研究結果現在附 knowledgeProposal（confidence adjustments candidate，不自動改寫知識庫 JSON）；daily report 也開始記錄 injectedKnowledgeIds，讓 👍/👎 feedback 能回流到具體 knowledge entry。驗證：vitest 5 files 41 tests 全過，lint 0 err 2 warnings，build 通過。

- `2026-04-01 06:54` Qwen：P4+P7 任務完成：(1) RSS 擴充：api/analyst-reports.js 已加入鉅亨網 + 經濟日報 RSS；(2) 補測試：useEvents(11 測試)+useWatchlistActions(12 測試)=23/23 通過。驗證：lint(0 err)+vitest(23 tests) 全綠。

- `2026-04-01 14:41` Codex：補完 route research 的 enrichResearchToDossier 流程：route page 改接 shared useReportRefreshWorkflow，不再依賴舊的 /api/research action；抽出 buildReportRefreshCandidates 供主 runtime 與 route 共用。另根據本地 analysis-history 範例輸出，收盤分析 system prompt 新增篇幅控制與 A 級 1-3 檔優先規則，避免把全部持股平均展開、動作不夠具體。驗證：targeted vitest 13/13 通過，lint 僅剩既有 2 warnings，build 通過。

- `2026-04-01 06:33` Qwen：P7+P4 任務完成：(1) RSS 擴充：api/analyst-reports.js 已加入鉅亨網 + 經濟日報 RSS 來源；(2) 補測試：useEvents(19 測試)+useWatchlistActions(12 測試) 已通過，共 31/31 綠燈。驗證：lint(0 err)+vitest(31 tests) 全綠。

- `2026-04-01 06:06` Qwen：FinMind 數據接入完成：dossier 已接入 FinMind 籌碼/估值/營收數據，daily analysis prompt 自動注入三大法人/PER/PBR/融資變化。驗證：lint(0 err)+vitest(25 tests) 全綠。

- `2026-04-01 14:05` Codex：FinMind 數據接入完成：dossier 已接入 FinMind 籌碼/估值/營收數據，daily analysis prompt 自動注入三大法人/PER/PBR/融資變化
- `2026-04-01 13:59` Codex：P0/P1 已 push 到 origin/main 並部署 production；Vercel deployment dpl_GdoAe29qkPBe79MB8MSpRX7BQe2x ready，正式站 https://jiucaivoice-dashboard.vercel.app 已更新；實測 POST /api/analyze 回應 9.81s 且為 valid JSON，低於 30s 目標。
- `2026-04-01 13:24` Codex：完成 P0/P1 第一輪落地，research prompt budget 與 brain proposal gate/UI 已接上。
  - P0 prompt 瘦身：新增 `src/lib/promptBudget.js`，`api/research.js` 與 `useDailyAnalysisWorkflow.js` 現在會對 holding summary 套 `3000` 字預算，超限時保留最大部位 5 檔；brain context 超過 `1500` 字時會退回 user rules + 最近 3 條 lessons
  - research API：不再把整個 strategy brain `JSON.stringify` 塞進 prompt，改成結構化摘要再走 budget；候選提案現在附 `evaluation` gate 結果，未過 gate 會標成 `blocked`
  - P1 gate/eval：新增 `src/lib/researchProposalRuntime.js` 的 `evaluateBrainProposal()`；固定 gate 已實作
    - 不可刪除 user-confirmed rules
    - 單次新增規則不可超過 3 條
    - 新增規則必須帶 `evidenceRefs`
    - 新增規則不可與現有 rules 語意重複
  - UI：`ResearchPanel` 新增候選提案狀態卡與「套用提案 / 放棄提案」按鈕；`useResearchWorkflow()` 會在套用時更新正式 strategy brain，並同步更新 research result/history 的 proposal status
  - 驗證：targeted `vitest`（6 files / 24 tests）全過；`npm run build` 全過；`npm run lint` 僅剩 repo 既有 warnings（`DailyReportPanel.jsx` console、`useAutoEventCalendar.js` unused var），本輪未新增 lint error
- `2026-04-01 00:21` Codex：補齊 route-based 入口仍殘留的收盤價 / 行事曆 / 成交 OCR 解析缺口。
  - route 收盤價：`useRoutePortfolioRuntime.js` 的 Header `⟳ 收盤價` 原本只會重讀本機快取，現在會真正打 `/api/twse`、寫回 `MARKET_PRICE_CACHE_KEY` / `MARKET_PRICE_SYNC_KEY`，並把新報價套回 route holdings
  - route 行事曆：`useRouteEventsPage.js` 現在會在 `newsEvents` 為空時回退 `NEWS_EVENTS`，不再因空 storage 讓 `/portfolio/:id/events` 整頁空白
  - 成交 OCR：新增 `src/lib/tradeAiResponse.js`，`useTradeCaptureRuntime.js` 會先抽出第一段 JSON，再交給 `normalizeTradeParseResult()`，降低 Claude 多吐敘述文字時的解析失敗率
  - 驗證：新增 route integration tests（events fallback + route header price sync）與 OCR JSON extraction tests；`vitest`（2 files / 6 tests）+ `eslint` + `build` 全過
- `2026-04-01 00:04` Codex：修掉 production 上的收盤價 / 行事曆 / 成交 OCR 三條線上故障。
  - `api/twse.js`：恢復成真正的 serverless handler，production `/api/twse` 不再 `FUNCTION_INVOCATION_FAILED`
  - `api/_lib/ai-provider.js`：Anthropic 模式優先取 `ANTHROPIC_API_KEY`，並已更新 production env key；`/api/parse` 不再回 `invalid x-api-key`
  - 事件顯示：`resolveRuntimeNewsEvents()` 改成空陣列時回退 seed events，事件卡片補 `title/detail -> label/sub` fallback，行事曆 tab 不再空白
  - 驗證：`eslint` + targeted `vitest`（4 files / 28 tests）+ build 全過；production `curl /api/twse`、`curl /api/parse`、UI smoke 全過
  - 部署：`https://jiucaivoice-dashboard.vercel.app`
- `2026-04-01 00:15` Claude：知識庫壓測 + 3 個 bug fix + 演化方案 + Qwen 交接。
  - 壓測：34 檔持股 100% 覆蓋、7/7 策略相關性、檢索穩定
  - Bug fix 1：`getRelevantKnowledge` slot-based 分配（策略 4 + rm 1），解決 rm 擠掉策略知識
  - Bug fix 2：`buildHoldingDossiers` 加入 `stockMeta` 傳遞，解決知識注入永遠拿到空物件的致命 bug
  - Bug fix 3：`usePortfolioDerivedData` + `usePortfolioPersistence` 傳入 `STOCK_META`
  - 演化方案：`docs/superpowers/specs/2026-03-31-kb-evolution-design.md`
  - Qwen 交接：QWEN.md 更新 5 項待辦
  - 測試 **45/45 files, 217/217 tests 全過**
- `2026-04-01 00:00` Claude：知識庫壓測 + 排序偏差修正 + 演化方案設計。
  - 壓測：34 檔持股 100% 覆蓋、6/7 策略相關性通過、檢索穩定
  - Bug fix：`getRelevantKnowledge` 改成 slot-based 分配（策略 4 + rm 1），解決 rm 擠掉策略知識問題
  - 演化方案：`docs/superpowers/specs/2026-03-31-kb-evolution-design.md`（三層：usage tracking → feedback signal → confidence auto-adjust）
  - 發現待處理：事件驅動的 nc 被 fa 擠掉（nc confidence 偏低）、strategy-cases 缺 confidence 欄位
  - 測試 25/25 通過
- `2026-03-31 23:55` Codex：修掉本輪高信號 bug 報告並重新部署 production。
  - 修復：補回 `3443 / 創意` 供應鏈資料，讓 `getSupplyChain()` / `buildSupplyChainContext()` 恢復正常
  - 修復：`AppPanels` context tests 改成等待 lazy-loaded panel，清掉因 `Suspense` loading fallback 造成的假性失敗
  - 驗證：targeted vitest（3 files / 15 tests）全過；全量 vitest（45 files / 216 tests）全過；production UI smoke + `curl` HTTP 200 全過
  - 部署：`https://jiucaivoice-dashboard.vercel.app`
- `2026-03-31 21:48` Codex：candidate brain proposal 第一版已部署到 production。
  - 網址：`https://jiucaivoice-dashboard.vercel.app`
  - 內容：`api/research.js` 已改為 proposal 輸出，不再自動覆蓋正式 strategy brain；research UI 同步 proposal 語意，`portfolio/evolve` report metadata 也已對齊
  - 驗證：Vercel production deploy ready + `curl` 外部可達（HTTP 200）
- `2026-03-31 21:43` Codex：`api/research.js` 開始切到 candidate brain proposal 模式，`evolve / portfolio` 研究結果不再自動覆蓋正式 strategy brain。
  - API：新增 `brainProposal` / `proposalStatus`，提案落到 `brain-proposals/*.json`，不再直接寫 `strategy-brain.json`
  - UI：`useResearchWorkflow` / `ResearchPanel` 已同步改成「提案生成、尚未套用」語意
  - 協作：`AI_COLLABORATION_GUIDE.md` 已補 proposal 契約，供 Claude / Gemini / Qwen 依同一條邊界接手
  - 驗證：eslint（6 files）+ vitest（3 files / 14 tests）+ build 全通過
- `2026-03-31 21:40` Claude：知識庫完成 600/600 + 品質優化 + 應用串接修正。
  - 內容：從 398 補齊至 600 條（產業趨勢+50、技術分析+50、策略案例+50、籌碼+30、基本面+20、消息+2）
  - 品質：action 量化率從 77%→98.7%（130 條改寫），測試門檻收緊至 5%
  - Bug fix：knowledgeBase.js 策略映射 alias 對齊 STOCK_META（ETF/指數、價值股、轉型股）
  - 工具：安裝 superpowers v5.0.6 plugin + notebooklm skill
  - 方法論：autoresearch-style 實驗帳本建立於 docs/superpowers/kb-experiment-results.tsv
  - 文件：AI_COLLABORATION_GUIDE.md §7 全面更新分工與串接路徑
  - 測試：25/25 全過，全套 211 pass / 4 fail（4 fail 預先存在、與 KB 無關）
  - **下一步交接 Codex**：`api/research.js` 改成 candidate brain proposal 模式
- `2026-03-31 10:36` Codex：本地部署完成：vercel dev 已在 127.0.0.1:3002 啟動，healthcheck 與 UI smoke 全綠（API 可用、前端標記正常）。
- `2026-03-31 03:38` Codex：優先任務再推進：新增 composeAppRuntimeHeaderInput，將 useAppRuntime 的 header wiring 再外移；workflow/header 組裝已雙收斂。驗證：eslint(2 files)+vitest(3 files/10 tests)+build+fast-refresh 全綠。
- `2026-03-31 03:35` Codex：優先任務續推：新增 composeAppRuntimeWorkflowInput，將 useAppRuntime 最大 workflow wiring 組裝外移 composer；useAppRuntime 降至 511 行。驗證：eslint(2 files)+vitest(2 files/8 tests)+build+fast-refresh 全綠。
- `2026-03-31 03:27` Codex：優先任務續推：新增 useAppRuntimeArgs（core/workflow args builder）並把 useAppRuntime 兩段大型參數牆外移；補 useAppRuntimeArgs 測試。驗證：lint+vitest(7 files/15 tests)+build+fast-refresh+healthcheck+smoke 全綠。
- `2026-03-30 23:58` Codex：優先任務續推：新增 useAppRuntimePortfolioDerivedData/useAppRuntimeHeaderProps，將衍生資料與 header props 組裝從 useAppRuntime 再拆一層；composer 補 core/workflow flatten 組裝並新增測試，lint/vitest/build/fast-refresh/healthcheck/smoke 全綠。
- `2026-03-30 23:20` Codex：優先任務續推：useAppRuntime 兩段大型參數組裝改走 composeAppRuntimeCoreLifecycleArgs/composeAppRuntimeWorkflowsArgs；修正 refs lint 風險，新增 composer flatten 測試；lint/vitest/build/fast-refresh/healthcheck/smoke 全綠。
- `2026-03-30 18:18` Codex：優先任務持續完成：新增 useAppRuntimeHelperCatalog 抽出 core/workflow helper 契約，useAppRuntime 再瘦到 556 行；補 helper catalog 測試，lint/vitest/build/fast-refresh/healthcheck/smoke 全綠。
- `2026-03-30 18:15` Codex：優先任務續推：把 useAppRuntimeCoreLifecycle/useAppRuntimeWorkflows 的 helper 參數收成 catalog bag，useAppRuntime 再降到 556 行；lint+vitest+build+fast-refresh+healthcheck+smoke 通過。
- `2026-03-30 18:00` Codex：優先任務更新：完成 useAppRuntimeCoreLifecycle 接線、修正 Vite /api 代理自迴圈；已用 vercel dev 在 127.0.0.1:3002 通過 healthcheck + smoke:ui。
- `2026-03-30 17:58` Codex：優先主線完成：useAppRuntime 接入 useAppRuntimeCoreLifecycle，runtime 再瘦 105 行；修正 Vite /api 自迴圈 proxy，避免 EMFILE。lint/vitest/fast-refresh/healthcheck 已驗證。
- `2026-03-30 13:33` Claude：知識庫致命bug修復+品質改善+dossier接線+指南手術修改完成
- `2026-03-30 13:32` Codex：主線優先任務持續完成：新增 usePostCloseSilentSync 與 useMorningNoteRuntime，useAppRuntime 進一步降到 749 行；hooks tests+fast-refresh+healthcheck 通過
- `2026-03-30 13:27` Codex：主線優先任務續推：新增 useAppRuntimeWorkflows 承接 workflow wiring（report/daily/stress/review/trade/research/backup/panels），useAppRuntime 從 963 行降到 758 行；lint+hooks tests+fast-refresh+healthcheck 通過
- `2026-03-30 13:19` Codex：第三層完成：useAppRuntime 兩段 effect（收盤自我修復同步 / research 自動刷新）已抽成 usePostCloseSelfHealSync 與 useResearchAutoRefresh，小 hook 測試已補齊
- `2026-03-30 13:15` Codex：本地部署確認：vercel dev 已固定綁定 127.0.0.1:3002，healthcheck 全綠（Server/Frontend/API）
- `2026-03-30 13:04` Codex：第二層收斂完成：useAppRuntime 的 Daily/Stress/Review/Weekly/Trade/Research/Backup/Panels 大型 args 組裝已抽到 useAppRuntimeComposer，並處理 react-hooks/refs lint 風險；lint+composer tests+fast-refresh 通過
- `2026-03-30 12:57` Codex：主線收斂：useAppRuntime 新增 composePortfolioDerivedDataInput / composeAppHeaderProps / composeAppShellFrameRuntime 與通用 helper，並補 useAppRuntimeComposer 測試；lint+fast-refresh+測試通過
- `2026-03-30 09:45` Codex：docs-site 已新增四區塊進度條：今日總結/本週進度/下一里程碑/最近進度覆蓋率，並以 runtime 自動計算百分比與筆數
- `2026-03-30 09:35` Codex：docs-site 四大區塊（最近進度/今日總結/本週進度/下一里程碑）已改為 checkpoint + ai-activity-log 混合來源；已實測可顯示 Qwen 活躍進度，不再只顯示 Codex
- `2026-03-30 04:57` Codex：已完成根本修正：新增 refresh-ai-presence 自動偵測管線，從 ~/.qwen ~/.gemini ~/.claude ~/.codex 回填 ai-activity；sync-state 與 launch-docs-site 都會自動刷新，解決『只有 Codex 狀態會上板』迴圈問題
- `2026-03-30 04:49` Codex：docs-site 新增 AI 追蹤堆疊區塊（GitLens/BlamePrompt/ai-status/launcher/live feed）並接上 state 生成器 trackingStack，刷新後可直接在 HTML 看到是否全啟用
- `2026-03-30 04:33` Codex：已導入 GitLens + BlamePrompt + ai-status/launcher 組合；VS Code 已安裝 extension、BlamePrompt CLI 與 hooks 已就緒，Qwen/Gemini launcher 會帶 AI Git identity，新增 ai-commit.sh 統一 AI commit 歸因
- `2026-03-30 04:24` Codex：docs-site 已新增 canonical live activity feed；Qwen/Gemini launcher 會自動登記 working 狀態，儀表板現可直接顯示 currentTask 與最近作業過程
- `2026-03-30 04:16` Codex：docs-site 前端已改成直接讀取 [current-work.md](/docs/status/current-work.md) 與 [ai-activity.json](/docs/status/ai-activity.json)；即使沒先重建 `state.json`，其他 AI 的 `working` 狀態與最新 checkpoint 在按下「立即刷新」後也能直接顯示
- `2026-03-30 04:16` Codex：補修 [launch-docs-site.sh](/scripts/launch-docs-site.sh) 錯誤指向 `scripts/docs-site` 的 bug，並建立 [docs-site/current-work.md](/docs-site/current-work.md) / [docs-site/ai-activity.json](/docs-site/ai-activity.json) symlink 作為前端直接讀取 canonical 狀態的入口
- `2026-03-30 04:09` Codex：已建立 [ai-activity.json](/docs/status/ai-activity.json) 作為 AI 即時工作狀態真相；[ai-status.sh](/scripts/ai-status.sh)、[ai-state.sh](/scripts/ai-state.sh)、[ai-handover.sh](/scripts/ai-handover.sh) 現在會寫入 `ai-activity` 與 `current-work.md`，再同步 docs-site，修正「只有 Codex 更新才會顯示」的問題
- `2026-03-30 04:00` Codex：docs-site 已移除自動輪詢，改成右上角「立即刷新」按鈕；同步更新 [index.html](/docs-site/index.html)、[script.js](/docs-site/script.js)、[style.css](/docs-site/style.css) 與 docs-site 指南，降低常駐輪詢對本機的干擾
- `2026-03-30 03:51` Codex：已封存舊的 `state.json` 直接寫入路徑；[ai-state.sh](/scripts/ai-state.sh) 的寫入命令已停用，[ai-status.sh](/scripts/ai-status.sh) 與 [ai-handover.sh](/scripts/ai-handover.sh) 改成相容提示，避免其他 AI 再把 docs-site 狀態寫回舊格式
- `2026-03-30 03:49` Codex：docs-site 狀態同步改為以 [current-work.md](/docs/status/current-work.md) 為唯一真相；新增 [build-docs-state.mjs](/scripts/build-docs-state.mjs)，由 [sync-state.sh](/scripts/sync-state.sh) 重新生成 [docs-site/state.json](/docs-site/state.json)
- `2026-03-30 03:49` Codex：[docs-site/script.js](/docs-site/script.js) 已補 `state.json` cache-busting / no-store；同步更新 [AI_COLLABORATION_GUIDE.md](/docs/AI_COLLABORATION_GUIDE.md)、[AI_STATE_GUIDE.md](/docs-site/AI_STATE_GUIDE.md)、[DYNAMIC_GUIDE.md](/docs-site/DYNAMIC_GUIDE.md)、[AI_GUIDE.md](/docs-site/AI_GUIDE.md)，避免其他 AI 再把 `state.json` 當獨立黑板
- `2026-03-30 03:35` Codex：補登狀態回報約定；日常進度與最新 checkpoint 一律先回寫 [current-work.md](/docs/status/current-work.md)，規則變更再同步 [AI_COLLABORATION_GUIDE.md](/docs/AI_COLLABORATION_GUIDE.md)，架構真相變更再同步 [PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md](/docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md)
- `2026-03-30 03:35` Codex：確認 [App.jsx](/src/App.jsx) 已是薄入口，目前只負責呼叫 [useAppRuntime.js](/src/hooks/useAppRuntime.js) 並 render [AppShellFrame.jsx](/src/components/AppShellFrame.jsx)；目前除 bug 應優先閱讀 `useAppRuntime.js`，不用再從 `App.jsx` 大檔進場
- `2026-03-30 03:35` Codex：最新已知完整綠燈基線仍是 `npm run verify:local` 通過，包含 `35 files / 167 tests`、`build`、`healthcheck` 與 `smoke:ui`
- `2026-03-29 20:31` Codex：新增 [useAppRuntime.js](/src/hooks/useAppRuntime.js) 與 [AppShellFrame.jsx](/src/components/AppShellFrame.jsx)，把 [App.jsx](/src/App.jsx) 的頂層 state / workflow wiring 與 render shell 正式拆開
- `2026-03-29 20:31` Codex：[App.jsx](/src/App.jsx) 現在只剩薄入口，主 runtime wiring 移到 [useAppRuntime.js](/src/hooks/useAppRuntime.js)；[AppShellFrame.test.jsx](/tests/components/AppShellFrame.test.jsx) 已補上 loading / ready render coverage
- `2026-03-29 20:20` Codex：新增 [PortfolioPanelsContext.jsx](/src/contexts/PortfolioPanelsContext.jsx) 與 [usePortfolioPanelsContextComposer.js](/src/hooks/usePortfolioPanelsContextComposer.js)，把 `App.jsx -> AppPanels` 的海量 props 收成 panel-scope data/actions contexts
- `2026-03-29 20:20` Codex：[AppPanels.jsx](/src/components/AppPanels.jsx) 現在只接 `viewMode / overviewViewMode / tab / errorBoundaryCopy`，各 panel 所需 props 改由 context 組裝；`src/App.jsx` 進一步降到約 `980` 行
- `2026-03-29 20:20` Codex：新增測試 [AppPanels.contexts.test.jsx](/tests/components/AppPanels.contexts.test.jsx)，覆蓋 log panel data context 與 daily actions context；`npm run verify:local` 通過，全量測試提升到 `34 files / 165 tests`
- `2026-03-29 19:58` Codex：新增 [useAppRuntimeComposer.js](/src/hooks/useAppRuntimeComposer.js)，把 [App.jsx](/src/App.jsx) 內 `boot/runtime wiring` 的大型 hook args object 收成 `useAppBootRuntimeComposer()`、`usePortfolioManagementComposer()`、`useAppLifecycleRuntimeComposer()`
- `2026-03-29 19:58` Codex：新增測試 [useAppRuntimeComposer.test.jsx](/tests/hooks/useAppRuntimeComposer.test.jsx)，並通過 `npm run lint`、`npx vitest run tests/hooks/useAppRuntimeComposer.test.jsx`、`npm run verify:local`
- `2026-03-29 19:58` Codex：`src/App.jsx` 進一步降到約 `1004` 行；全量驗證目前提升到 `33 files / 163 tests`，`healthcheck` 與 `smoke:ui` 維持綠燈
- `2026-03-29 03:05` Codex：新增 [useAppRuntimeSyncRefs.js](/src/hooks/useAppRuntimeSyncRefs.js)，把 [App.jsx](/src/App.jsx) 內原本分散的 `activePortfolioIdRef / viewModeRef / portfoliosRef / portfolioSetterRef / bootRuntimeRef` 同步 effect 收斂成單一 hook
- `2026-03-29 03:05` Codex：順手移除 [App.jsx](/src/App.jsx) 中未使用的 `canUseCloudRef`，避免 dead ref 誤導後續維護
- `2026-03-29 03:05` Codex：新增測試 [useAppRuntimeSyncRefs.test.jsx](/tests/hooks/useAppRuntimeSyncRefs.test.jsx)，並通過 `npm run verify:local`；全量測試提升到 `25 files / 111 tests`
- `2026-03-28 21:54` Codex：新增 [src/lib/appShellRuntime.js](/src/lib/appShellRuntime.js) 與 [src/components/AppPanels.jsx](/src/components/AppPanels.jsx)，把 `live portfolio snapshot` 欄位清單與 tab panel render skeleton 從 [src/App.jsx](/src/App.jsx) 收成單一 source of truth
- `2026-03-28 21:54` Codex：`flushCurrentPortfolio()` 與 `useLocalBackupWorkflow()` 現在共用 `buildLivePortfolioSnapshot()`；`newsEvents` fallback 與 event filter 也已集中到 `appShellRuntime`
- `2026-03-28 21:40` Codex：新增 [useSavedToast.js](/src/hooks/useSavedToast.js)、[useAppShellUiState.js](/src/hooks/useAppShellUiState.js)、[useCanonicalLocalhostRedirect.js](/src/hooks/useCanonicalLocalhostRedirect.js)，把 `saved toast timer`、localhost canonical redirect 與 app-local transient UI state 從 [App.jsx](/src/App.jsx) 再抽出去
- `2026-03-28 21:40` Codex：`usePortfolioManagement.js`、`usePortfolioPersistence.js`、`useRoutePortfolioRuntime.js` 現在都優先走 shared `notifySaved / flashSaved` 管線，修掉多來源 `setTimeout` 互踩導致新提示被舊 timer 提前清掉的 bug
- `2026-03-28 21:40` Codex：新增 hook tests [useSavedToast.test.jsx](/tests/hooks/useSavedToast.test.jsx) 與 [useAppShellUiState.test.jsx](/tests/hooks/useAppShellUiState.test.jsx)；[App.jsx](/src/App.jsx) 再降到約 `1158` 行
- `2026-03-28 21:40` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`、`npm run healthcheck`、`npm run smoke:ui` 全綠；全量測試提升到 `21 files / 95 tests`
- `2026-03-28 21:31` Codex：新增 [useWatchlistActions.js](/src/hooks/useWatchlistActions.js) 與 [useTransientUiActions.js](/src/hooks/useTransientUiActions.js)，把 `watchlist upsert/delete`、`cancelReview`、`updateReversal` 從 [App.jsx](/src/App.jsx) 再抽薄一層
- `2026-03-28 21:31` Codex：route shell 的 [useRoutePortfolioRuntime.js](/src/hooks/useRoutePortfolioRuntime.js) 也已接上同一套 action hooks，修掉主 runtime 與 route shell 在 `watchlist shape` 與 `reversal.updatedAt` 上不一致的 bug
- `2026-03-28 21:31` Codex：`src/App.jsx` 進一步降到約 `1177` 行；`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`、`npm run healthcheck`、`npm run smoke:ui` 全綠
- `2026-03-28 21:27` Codex：`weekly report clipboard` 已從 [App.jsx](/src/App.jsx) 抽成 [useWeeklyReportClipboard.js](/src/hooks/useWeeklyReportClipboard.js)，`App.jsx` 不再直接內嵌週報組裝與剪貼簿 fallback 流程
- `2026-03-28 21:27` Codex：重新驗證 `npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`、`npm run healthcheck`、`npm run smoke:ui` 全綠
- `2026-03-28 21:18` Codex：`src/App.jsx` 繼續收斂為 orchestration shell，新增 [usePortfolioDossierActions.js](/src/hooks/usePortfolioDossierActions.js)、[useReportRefreshWorkflow.js](/src/hooks/useReportRefreshWorkflow.js)、[useLocalBackupWorkflow.js](/src/hooks/useLocalBackupWorkflow.js)、[useEventLifecycleSync.js](/src/hooks/useEventLifecycleSync.js)、[useAppConfirmationDialog.js](/src/hooks/useAppConfirmationDialog.js)
- `2026-03-28 21:18` Codex：新增 [reportRefreshRuntime.js](/src/lib/reportRefreshRuntime.js) 與 [reportRefreshRuntime.test.js](/tests/lib/reportRefreshRuntime.test.js)，把 analyst report merge / meta merge / structured research extract plan 純邏輯抽離出來
- `2026-03-28 21:18` Codex：修掉 `Events` tab 還在吃 seed `NEWS_EVENTS` 的真 bug、`flashSaved()` timeout 互踩問題，以及 `App.jsx` render-phase refs lint blocker；`tradePanel.dialogs.test.jsx` 也補了 flake timeout
- `2026-03-28 21:18` Codex：`src/App.jsx` 已降到約 `1198` 行；`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`、`npm run healthcheck`、`npm run smoke:ui` 全綠
- `2026-03-28 18:11` Codex：route shell 的 research flow 已從 `useRunResearch()` inline mutation 收斂到共享 [useResearchWorkflow.js](/src/hooks/useResearchWorkflow.js)，[useRouteResearchPage.js](/src/hooks/useRouteResearchPage.js) 現在只負責 route-specific panel state 與 report refresh / enrich glue
- `2026-03-28 18:11` Codex：`useRoutePortfolioRuntime.js` 已補 `setStrategyBrain()` 與可帶 timeout 的 `flashSaved()`，因此 route shell 的 `onEvolve` 也能把 `newBrain` 正確落回 route runtime storage
- `2026-03-28 18:11` Codex：順手修掉 [ResearchPanel.jsx](/src/components/research/ResearchPanel.jsx) 的 `h` shadowing bug；新增 route research integration coverage 到 [routePages.actions.test.jsx](/tests/routes/routePages.actions.test.jsx)
- `2026-03-28 18:11` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `14 files / 81 tests`
- `2026-03-28 17:49` Codex：`runResearch()` 已從 [App.jsx](/src/App.jsx) 抽成 [useResearchWorkflow.js](/src/hooks/useResearchWorkflow.js)，`App.jsx` 只保留 research state 與 panel 接線
- `2026-03-28 17:49` Codex：新增 [researchRuntime.js](/src/lib/researchRuntime.js)，現在負責 research stock snapshot、dossier 組裝、request body、主結果抽取與 history merge
- `2026-03-28 17:49` Codex：新增測試 [researchRuntime.test.js](/tests/lib/researchRuntime.test.js)；`npm run lint`、`npm run typecheck`、`npm run build` 與該測試通過
- `2026-03-28 17:35` Codex：`runDailyAnalysis` 已從 [App.jsx](/src/App.jsx) 收斂到 [useDailyAnalysisWorkflow.js](/src/hooks/useDailyAnalysisWorkflow.js)，並再往下抽出 [dailyAnalysisRuntime.js](/src/lib/dailyAnalysisRuntime.js)
- `2026-03-28 17:35` Codex：`dailyAnalysisRuntime` 現在負責 daily snapshot、事件關聯、盲測評分、前次回顧區塊與 prompt payload builder；新增測試 [dailyAnalysisRuntime.test.js](/tests/lib/dailyAnalysisRuntime.test.js)
- `2026-03-28 17:35` Codex：補回 `brainRuntime` 的相容 exports `enforceTaiwanHardGatesOnBrainAudit()` / `appendBrainValidationCases()`，並清掉 [App.jsx](/src/App.jsx) 那批已死亡的 brain imports，`npm run lint` 現在無 warning
- `2026-03-28 17:35` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `13 files / 77 tests`
- `2026-03-28 16:26` Codex：交易上傳新增批次預覽摘要與 OCR 低信心警示；在寫入前會先顯示成交筆數、買賣分布、估計成交金額、涉及標的，並標出模型低信心與逐筆欄位異常
- `2026-03-28 16:26` Codex：`src/lib/tradeParseUtils.js` 新增 `summarizeTradeBatch()` 與 `assessTradeParseQuality()`，`TradePanel` 已接上這兩條 helper
- `2026-03-28 16:26` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `12 files / 72 tests`
- `2026-03-28 13:59` Codex：`Header.jsx` 已移除 portfolio 專用自製 modal，create / rename / delete 全部統一收斂到 [Dialogs.jsx](/src/components/common/Dialogs.jsx)
- `2026-03-28 13:59` Codex：新增共享 hook [useTradeCaptureRuntime.js](/src/hooks/useTradeCaptureRuntime.js) 與 helper [tradeParseUtils.js](/src/lib/tradeParseUtils.js)，主 runtime 與 route shell 的交易截圖流程已收斂成同一條 runtime
- `2026-03-28 13:59` Codex：上傳成交現在支援多圖佇列、補登成交日期、同批多筆交易寫入與混合買賣 memo；不再只寫 `parsed.trades[0]`
- `2026-03-28 13:59` Codex：新增測試 [tradeParseUtils.test.js](/tests/lib/tradeParseUtils.test.js)，並通過 `npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh`；全量測試提升到 `12 files / 71 tests`
- `2026-03-28 13:36` Codex：完成 `src/` legacy browser dialogs sweep，新增 [Dialogs.jsx](/src/components/common/Dialogs.jsx)，把 `TradePanel` / `WatchlistPanel` / `App.jsx` 剩餘 `prompt()` / `confirm()` / `alert()` 全部收掉
- `2026-03-28 13:36` Codex：新增測試 [tradePanel.dialogs.test.jsx](/tests/components/tradePanel.dialogs.test.jsx)，並確認 `rg -n "prompt\\(|confirm\\(|alert\\(" src` 為空
- `2026-03-28 13:36` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `11 files / 68 tests`
- `2026-03-28 13:29` Codex：`usePortfolioManagement.js` 已移除主 runtime 的 `window.prompt()` / `window.confirm()`，create / rename / delete 現在與 route shell 共用 `Header` dialog 邊界
- `2026-03-28 13:29` Codex：`Header.jsx` 已完整支援 shared `portfolioEditor` + `portfolioDeleteDialog`；`App.jsx` 與 `useRoutePortfolioRuntime.js` 都已接上
- `2026-03-28 13:29` Codex：`tests/routes/routePages.actions.test.jsx` 已新增 delete dialog coverage；route actions 現在覆蓋 create / rename / delete / watchlist add / news review
- `2026-03-28 13:29` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `10 files / 67 tests`
- `2026-03-28 13:28` Codex：`useRoutePortfolioRuntime.js` 已移除 route-shell `window.prompt()` 的 create / rename 流程，改成受控 modal editor state
- `2026-03-28 13:28` Codex：`Header.jsx` 已支援可選的 `portfolioEditor` modal props；route shell 透過這條邊界處理 portfolio create / rename，並保持對穩定主 runtime 的 callback fallback 相容
- `2026-03-28 13:28` Codex：`tests/routes/routePages.actions.test.jsx` 已新增 portfolio create / rename modal tests，並明確驗證 `window.prompt()` 未被呼叫
- `2026-03-28 13:28` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `10 files / 66 tests`
- `2026-03-28 13:11` Codex：完成第二批 route page hook extraction，新增 [useRouteHoldingsPage.js](/src/hooks/useRouteHoldingsPage.js)、[useRouteWatchlistPage.js](/src/hooks/useRouteWatchlistPage.js)、[useRouteDailyPage.js](/src/hooks/useRouteDailyPage.js)、[useRouteResearchPage.js](/src/hooks/useRouteResearchPage.js)、[useRouteTradePage.js](/src/hooks/useRouteTradePage.js) 等 route page hooks
- `2026-03-28 13:11` Codex：`src/pages/*` 現在多數只剩 render panel + call hook；`WatchlistPage` 已移除 `prompt()` 路徑，`TradePage` route shell 也修正為傳入正確的 memo question array
- `2026-03-28 13:11` Codex：`src/App.routes.jsx` 已補 route-local `QueryClientProvider`，route shell 進一步接近可替代 `src/App.jsx` 的入口條件
- `2026-03-28 13:11` Codex：新增 route integration tests [routePages.actions.test.jsx](/tests/routes/routePages.actions.test.jsx)，覆蓋 watchlist modal add 與 news review persistence
- `2026-03-28 13:11` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過；全量測試提升到 `10 files / 64 tests`
- `2026-03-28 05:31` Codex：新增 [useRoutePortfolioRuntime.js](/src/hooks/useRoutePortfolioRuntime.js)，`PortfolioLayout.jsx` 已退回薄容器，只負責 render `Header + Outlet`
- `2026-03-28 05:31` Codex：新增 route integration tests [portfolioLayout.routes.test.jsx](/tests/routes/portfolioLayout.routes.test.jsx)，覆蓋 route context hydrate/persist 與 header tab 導航
- `2026-03-28 05:31` Codex：補齊 `canRunPostClosePriceSync` 在 `datetime.js` / `market.js` 的相容邊界，修回全量測試綠燈
- `2026-03-28 05:31` Codex：`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build`、`npm run check:fast-refresh` 通過
- `2026-03-28 05:16` Codex：完成 route runtime 第一批接線，新增 [routeRuntime.js](/src/lib/routeRuntime.js) 與 [usePortfolioRouteContext.js](/src/pages/usePortfolioRouteContext.js)
- `2026-03-28 05:16` Codex：`PortfolioLayout` 已改為讀取真實 localStorage / market snapshot，並把持久化 action 透過 `Outlet context` 傳給 route pages
- `2026-03-28 05:16` Codex：`Holdings / Watchlist / Events / News / Daily / Research / Trade / Log / Overview` 頁面已移除第一批 placeholder state / fake handler，改吃 route runtime
- `2026-03-28 05:16` Codex：`npm run lint`、`npm run typecheck`、`npm run build` 通過
- `2026-03-28 04:34` Codex：確認 `src/main.jsx` 曾被切到 `App.routes.jsx`，但 route shell 仍是 scaffold；已收回穩定 runtime 入口為 `src/main.jsx -> src/App.jsx`
- `2026-03-28 04:34` Codex：新增 `src/lib/navigationTabs.js`，將 `Header` tabs 設定從 `App.jsx` / `PortfolioLayout.jsx` 收斂成共享 builder
- `2026-03-28 04:34` Codex：`Header` 現在對缺少 `TABS` 有安全 fallback；`PortfolioLayout.jsx` 也移除對 `A` / `alpha` 的冗餘 props 傳遞
- `2026-03-28 04:01` Codex：救回一輪半套 helper refactor，已修正 `src/App.jsx` 因 duplicate helper/import 造成的 parse failure
- `2026-03-28 04:01` Codex：`src/lib/market.js`、`src/lib/portfolioUtils.js`、`src/lib/datetime.js` 已從 placeholder / 遺漏 export 狀態恢復成可用的 canonical helper module
- `2026-03-28 04:01` Codex：`src/App.jsx` 已重新改成吃 `lib` helper，檔案從約 `3525` 行降到 `3159` 行
- `2026-03-28 04:01` Codex：`npm run lint`、`npm run typecheck`、`npm run check:fast-refresh`、`npm run build` 通過
- `2026-03-28 03:24` Codex：完成 `src/lib/eventUtils.js`、`src/lib/portfolioUtils.js` 實用化並回收 `src/App.jsx` 內 event / review / storage helper
- `2026-03-28 03:24` Codex：`src/main.jsx` 已移除 whole-app ErrorBoundary；`src/App.jsx` 改為對 Header 與各主要 panel 採 panel-scoped `ErrorBoundary`
- `2026-03-28 03:24` Codex：`scripts/healthcheck.sh` 已再清一輪不必要字串插值，並保留前端資源與 Vite log 檢查
- `2026-03-28 03:24` Codex：`npm run check:fast-refresh`、`npm run lint`、`npm run build` 通過

- `2026-03-28 03:02` Codex：完成 `src/lib/reportUtils.js` 與 `src/lib/dossierUtils.js` 實作化，`App.jsx` 已改用這兩個 utility module
- `2026-03-28 03:02` Codex：`src/hooks/useReports.js` 已從錯誤的 `./utils.js` 改接 `../lib/reportUtils.js`
- `2026-03-28 03:02` Codex：`npm run check:fast-refresh`、`npm run lint`、`npm run build` 通過
- `2026-03-28 02:18` Codex：確認 `.tmp/vercel-dev.log` 中 `BACKUP_GLOBAL_KEYS` Fast Refresh invalidation 屬歷史事件；最新 `App.jsx` 事件已回到正常 `hmr update`
- `2026-03-28 02:18` Codex：新增 `src/lib/watchlistUtils.js`，並將 `App.jsx` 內重複的 constants / watchlist normalize 收回 `src/constants.js` 與 `src/lib/*`
- `2026-03-28 02:18` Codex：`npm run check:fast-refresh`、`npm run lint`、`npm run build` 再次通過
- `2026-03-28 01:28` Codex：新增 `jsconfig.json`，把 JS/JSX workspace 專案邊界收斂到 `src`、`tests`、`api`、`scripts`
- `2026-03-28 01:28` Codex：`.vscode/settings.json` 進一步排除 `.tmp` / `dist`，並關閉 `typescript` automatic type acquisition 以降低背景索引與記憶體噪音
- `2026-03-28 01:28` Codex：重新驗證 `npm run lint`、`npm run build` 均通過，確認記憶體優化沒有破壞當前基線
- `2026-03-28 01:15` Codex：確認高記憶體主因偏向 VS Code renderer / webview 疊加，不是單一 app runtime 失控
- `2026-03-28 01:15` Codex：已將大型 `App.jsx` 歷史快照移出 `src/` 到 `.archive/source-snapshots/`，降低 IDE / watcher / 搜尋索引壓力
- `2026-03-28 01:15` Codex：新增 `.vscode/settings.json` 與 `vite.config.js` ignore 規則，避免 archive / backup files 再進活躍 watcher
- `2026-03-28 01:15` Codex：新增報告 `PERFORMANCE_REPORT_2026-03-28_MEMORY_PRESSURE_REDUCTION.md`
- `2026-03-28 00:05` Codex：`runtimeLogger` 已加入 remote sink registry、queue、flush 與 sampling；可同時接 analytics HTTP sink 與 Sentry bridge sink
- `2026-03-28 00:05` Codex：新增 `/api/telemetry`，可接收批次 client diagnostics 並保留最近 200 筆
- `2026-03-28 00:05` Codex：新增測試 [runtimeLogger.test.js](/tests/lib/runtimeLogger.test.js)，覆蓋 sessionStorage、本地 queue、analytics sink、Sentry sink
- `2026-03-28 00:05` Codex：新增報告 `OPTIMIZATION_REPORT_2026-03-28_REMOTE_DIAGNOSTICS_ADAPTERS.md`
- `2026-03-27 22:30` Codex：`runtimeLogger` 已接上 `web-vitals@5.2.0` attribution build，CLS / FCP / INP / LCP / TTFB 會寫入 `pf-runtime-diagnostics-v1`
- `2026-03-27 22:30` Codex：`main.jsx` 改為只呼叫 `bootstrapRuntimeDiagnostics()`；window error、unhandled rejection、error boundary、web-vitals 共用同一個 adapter
- `2026-03-27 22:30` Codex：新增報告 `OPTIMIZATION_REPORT_2026-03-27_WEB_VITALS_RUNTIME_ADAPTER.md`
- `2026-03-27 22:10` Codex：新增 `npm run check:fast-refresh`，將 `src/App.jsx` default-only export 規則工具化，避免 Fast Refresh invalidation 回歸
- `2026-03-27 22:10` Codex：`scripts/healthcheck.sh` 已補檢 `/index.html`、`/@vite/client`、`/src/main.jsx` 與首頁 linked assets，不再只看 port 與 API
- `2026-03-27 22:10` Codex：新增本地 structured runtime diagnostics，`main.jsx` 全域錯誤與 `ErrorBoundary` 都會寫入 `sessionStorage["pf-runtime-diagnostics-v1"]`
- `2026-03-27 22:10` Codex：新增報告 `OPTIMIZATION_REPORT_2026-03-27_FAST_REFRESH_HEALTHCHECK_DIAGNOSTICS.md`
- `2026-03-27 21:45` Codex：已修正 `src/App.jsx` Fast Refresh invalidation 根因，移除所有 named exports，保留 default export `App`
- `2026-03-27 21:45` Codex：`scripts/healthcheck.sh` 改為看最新一筆 `App.jsx` Vite 事件，不再被舊 invalidation 記錄誤導
- `2026-03-27 21:30` Codex：依建議完成新一輪優化落地，新增 TypeScript baseline `tsconfig.json + src/lib/holdingMath.ts`
- `2026-03-27 21:30` Codex：`verify:local` 已納入 `npm run typecheck`；全量測試提升到 `7 files / 56 tests`
- `2026-03-27 21:30` Codex：`scripts/healthcheck.sh` 已能回報 Vite log signal 與 HMR invalidation 警告
- `2026-03-27 21:30` Codex：新增報告 `OPTIMIZATION_REPORT_2026-03-27_TESTS_TS_HEALTHCHECK.md`
- `2026-03-27 21:16` Codex：第三層 debug 完成；已補 `holdingDossiers` rebuild 差異測試與 malformed payload defensive tests
- `2026-03-27 21:16` Codex：`usePortfolioPersistence` / `usePortfolioBootstrap` 已加入 array-shape guard，避免錯誤 payload 汙染 state/persistence
- `2026-03-27 21:16` Codex：hook tests 提升到 `2 files / 12 tests`，全量測試提升到 `7 files / 55 tests`，`npm run verify:local` 再次通過
- `2026-03-27 21:07` Codex：已補完第二層剩餘三條線 `bootstrap cooldown branch`、`research TTL pull`、`cloud save failure / cleanup timer`
- `2026-03-27 21:07` Codex：hook tests 擴充到 `2 files / 8 tests`，全量測試提升到 `7 files / 51 tests`
- `2026-03-27 21:07` Codex：`npm run lint`、`npm run test:run`、`npm run verify:local` 再次全通過；layer-2 報告已更新為完成態
- `2026-03-27 20:45` Codex：第二層 debug 完成；新增 hook 級測試 [usePortfolioBootstrap.test.jsx](/tests/hooks/usePortfolioBootstrap.test.jsx) 與 [usePortfolioPersistence.test.jsx](/tests/hooks/usePortfolioPersistence.test.jsx)
- `2026-03-27 20:45` Codex：目前測試總數提升到 `7 files / 47 tests`，`npm run test:run`、`npm run lint`、`npm run verify:local` 全部通過
- `2026-03-27 20:40` Codex：完成全面 debug sweep；`npm run lint`、`npm run test:run`、`npm run build`、`npm run healthcheck`、`npm run smoke:ui`、`npm run verify:local` 全部通過
- `2026-03-27 20:40` Codex：確認本輪未發現新的 runtime blocker；主要修正為把 `verify:local` 升級成真正完整驗證鏈，納入 lint + tests

- `2026-03-26` Codex：已移除 repo 內 `Claude local over Ollama` 入口、任務與驗證鏈；後續只保留 `Codex / Gemini / Qwen` 作為有效工具鏈
- `2026-03-26` Codex：文件中若仍出現 `James / Curie / Claude local`，視為歷史紀錄，不再作為目前分工

- `16:20` Codex：已建立固定多 AI 協作通道（現為 `AI_COLLABORATION_GUIDE.md`）
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
- `17:52` Codex：新增外部 LLM 共享交接通道 [coordination/llm-bus/board.md](/coordination/llm-bus/board.md)
- `18:02` 使用者要求把 Qwen 與 Claude local 都升到 `qwen3-coder:30b`；舊 `qwen3:14b` 已移除，正在拉新模型
- `20:45` Codex：電腦重開後已重新執行升級流程；`qwen3:14b` 確認移除，`qwen3-coder:30b` 與 `nomic-embed-text` 留存
- `20:48` Codex：`launchctl setenv OLLAMA_CONTEXT_LENGTH 65536 && brew services restart ollama` 完成；Ollama 已重啟
- `20:55` Codex：Qwen / Claude local / Gemini wrapper 與 VSCode tasks 全部重新指向當前模型與健康檢查腳本
- `21:08` Codex：新增三方實測腳本 [validate-local-llm-stack.sh](/scripts/validate-local-llm-stack.sh)
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
  - `Qwen Code`：整理相似個股案例與文件證據
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
- 若再次驗證外部 LLM，先看 [coordination/llm-bus/runs/20260325-210859](/coordination/llm-bus/runs/20260325-210859) 的實測結果，不可把已配置能力誤報成穩定主線能力

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

## Latest checkpoint

- `2026-03-30 04:10` Qwen：完成知識庫搭建三項任務：1) twsemcp 安裝成功，建立 twseAdapter.js 適配層 2) 建立收盤分析 + 深度研究模板 3) 持續填充知識中

- `2026-03-30 04:30` Qwen：知識庫豐富進度：1) 消息連動 +10 條 2) 策略案例 +10 條 3) 風險管理 +12 條。總計 58/500 條 (11.6%)。建立收盤分析 + 深度研究模板。twsemcp 安裝成功。

- `2026-03-30 04:45` Qwen：知識庫豐富進度：1) 技術分析 +20 條（共 30 條）2) 籌碼分析 +12 條（共 20 條）。總計 90/500 條 (18%)。

- `2026-03-30 05:00` Qwen：知識庫豐富進度：1) 基本面分析 +15 條（共 20 條）2) 產業趨勢 +17 條（共 20 條）。總計 122/500 條 (24.4%)。接近 25% 里程碑。

- `2026-03-30 05:10` Qwen：知識庫豐富進度：1) 策略案例 +15 條（共 25 條）2) 消息連動 +20 條（共 30 條）。總計 157/500 條 (31.4%)。突破 30% 里程碑。

- `2026-03-30 05:20` Qwen：知識庫豐富進度：1) 產業趨勢 +15 條（共 35 條）2) 籌碼分析 +15 條（共 35 條）。總計 187/500 條 (37.4%)。接近 40% 里程碑。

- `2026-03-30 05:30` Qwen：知識庫豐富進度：1) 策略案例 +5 條（共 30 條）2) 基本面分析 +10 條（共 30 條）。總計 202/500 條 (40.4%)。**突破 40% 里程碑！**

- `2026-03-30 05:40` Qwen：知識庫豐富進度：1) 技術分析 +10 條（共 40 條）2) 風險管理 +8 條（共 20 條）。總計 220/500 條 (44%)。接近 50% 里程碑。

- `2026-03-30 05:50` Qwen：知識庫豐富進度：1) 策略案例 +5 條（共 35 條）2) 產業趨勢 +5 條（共 40 條）。總計 230/500 條 (46%)。接近 50% 里程碑。

- `2026-03-30 06:00` Qwen：**知識庫豐富進度突破 50% 里程碑！** 1) 消息連動 +10 條（共 40 條）2) 基本面分析 +10 條（共 40 條）。總計 **250/500 條 (50%)**。

- `2026-03-30 06:05` Qwen：已建立 AI 協作討論文件 `docs/AI_COLLABORATION_DISCUSSION.md`，整理 12 個技術與架構問題邀請 Claude 一起討論。優先級 P0 問題 3 個、P1 問題 3 個、P2 問題 3 個。

- `2026-03-30 06:30` Qwen：**P0 工作完成** - 已搬移 twseAdapter.js → api/twse.js，改為直接 fetch TWSE OpenAPI，實作指數退避重試機制。

- `2026-03-30 07:00` Qwen：**P1 工作完成** - 1) 更新供應鏈 schema（增加 dependency、substituteRisk 欄位）2) 加入 usageTracking 機制到知識庫品質驗證框架 3) 實作知識淘汰 3 步驟流程。

- `2026-03-30 07:30` Qwen：**P1 工作全部完成** - 已建立收盤分析 Prompt 模板（XML + few-shot + 驗證機制），存入 `docs/PROMPT_TEMPLATES.md`。

- `2026-03-30 08:00` Qwen：**Claude 建議的全部工作已完成** - P0/P1/P2 共 7 項工作全部完成。準備更新 AI_COLLABORATION_DISCUSSION.md 標記所有問題已解決。

- `2026-03-30 08:30` Qwen：**知識庫豐富進度突破 50%** - 策略案例 +15 條（共 50 條）。總計 **265/500 條 (53%)**。繼續朝向 60% 目標邁進。

- `2026-03-30 09:00` Qwen：**知識庫豐富進度 56%** - 籌碼分析 +15 條（共 50 條）。總計 **280/500 條 (56%)**。繼續朝向 60% 目標邁進。

- `2026-03-30 09:30` Qwen：**知識庫豐富進度 58%** - 技術分析 +10 條（共 50 條）。總計 **290/500 條 (58%)**。距離 60% 目標還差 10 條！

- `2026-03-30 10:00` Qwen：**🎉 知識庫豐富進度突破 60% 里程碑！** - 產業趨勢 +10 條（共 50 條）。總計 **300/500 條 (60%)**。目標達成！

- `2026-03-30 10:30` Qwen：**知識庫豐富進度 62%** - 策略案例 +10 條（共 60 條）。總計 **310/500 條 (62%)**。持續朝向 70% 目標邁進。

- `2026-03-30 11:00` Qwen：**已修正 Claude 審查意見** - 1) 刪除 news-correlation nc-031 到 nc-040（美國總體經濟數據）2) 刪除重複條目 nc-016/nc-018 3) 修正 ca-006 錯字 4) 標記 ca-021 閾值問題。總計 298 條，持續填充中。
- `2026-03-30 11:30` Qwen：已修正 ca-021 閾值為動態標準，news-correlation 填充至 50 條（+22 條台股特定事件）。總計 320 條 (64%)。
- `2026-03-30 12:00` Qwen：news-correlation 填充至 60 條（+10 條台股特定事件）。總計 330 條 (66%)。
- `2026-03-30 12:30` Qwen：news-correlation 填充至 70 條（+10 條）。總計 340 條 (68%)。
- `2026-03-30 13:00` Qwen：**🎉 知識庫突破 70% 里程碑！** news-correlation 完成 80 條目標，buildKnowledgeContext() 已優化為結構化輸出格式。總計 350 條 (70%)。
- [2026-04-02 17:36] Qwen 新任務（via OpenClaw）：請接前端 UX 收尾：補 Daily Report 與 Research 的 loading/progress/error states，讓 20-40 秒等待不再像沒反應；評估並接入 Holdings 的 SupplyChainView；補 Trade OCR 異常圖片的 graceful error 顯示。避免碰 api/research.js 核心策略邏輯，完成後回報 changed files / risks / next best step。
- [2026-04-02 17:36] Claude 新任務（via OpenClaw）：請接品質與驗證工作：審查並加固 Daily Report 的 BRAIN_UPDATE extraction/strip/parser/gate，避免分析結果底部漏出 JSON；同時驗證 knowledge base 與 FinMind 是否真的注入 analyze/research prompt，必要時提出最小修補。請依 done / changed files / risks / next best step 回報。
- [2026-04-02 17:36] Codex 新任務（via OpenClaw）：優先處理 research 主流程閉環：完成 api/research.js 的 local-fast/full mode 收斂，維持四輪研究結構，確認 candidate brain proposal schema、rule lifecycle 與 round metadata 一致；補齊 malformed JSON、fallback summary、no-finmind/stale-finmind 測試。避免大改 UI，完成後回報 changed files / risks / next best step。

- 2026-04-02 19:02 管理決策：Gemini 不再做外部資料蒐集，因專案已有 FinMind API。Gemini 改做低成本支援：FinMind 欄位覆蓋盤點、現有 API/文件對照、prompt/資料缺口整理；主架構決策與複查仍由小奎 + Claude 主導。
- [2026-04-02 19:02] Claude 新任務（via OpenClaw）：管理決策更新：Gemini 不再做外部資料蒐集，因專案已有 FinMind API。請你之後與小奎主導決策與複查，Gemini 只做低成本支援：FinMind 欄位 coverage 檢查、現有 API/文件對照、prompt/資料缺口整理。回報請用白話，聚焦架構是否落地、流程是否順、還有哪些 bug。
- [2026-04-02 20:54] Qwen 新任務（via OpenClaw）：請只做一件事：把前台最後一段閉環確認清楚。優先確認使用者看得到完整結果，不只是系統內部有資料。聚焦 Daily Report / Research / Holdings 的最後顯示與狀態提示是否真的連通。完成後把 done / risks / next best step 寫回 docs/status/current-work.md；若卡住，立即寫 blocker。
- [2026-04-02 20:54] Claude 新任務（via OpenClaw）：請待 Codex / Qwen 把最新成果寫回 docs/status/current-work.md 後，閱讀整體狀態，做下一步整體判斷。你這輪不做機械修改，重點是：確認目前主線離可交付還差什麼、下一輪應該只派哪兩件事。若發現主線卡住或方向錯，立即寫 blocker 到 current-work.md。
- [2026-04-02 20:54] Codex 新任務（via OpenClaw）：請只做一件事：把目前已完成的核心主流程做成正式驗收狀態。優先驗證：1) 全組合研究 4 輪是否真的完整；2) FinMind 是否真的進分析/研究；3) 收盤分析回傳 candidateRules/lessons 時策略更新是否仍成立。完成後把 done / risks / next best step 寫回 docs/status/current-work.md；若卡住，立即寫 blocker。
- [2026-04-02 21:02] Codex 新任務（via OpenClaw）：補充規則確認：repo 內已有回報機制，請在完成或卡住時用 AI_NAME=Codex bash scripts/ai-status.sh done|blocker '訊息' 寫回 current-work。回報格式優先：done / changed files / risks / next best step。
- [2026-04-02 21:02] Qwen 新任務（via OpenClaw）：補充規則確認：repo 內已有回報機制，請在完成或卡住時用 AI_NAME=Qwen bash scripts/ai-status.sh done|blocker '訊息' 寫回 current-work。回報格式優先：done / changed files / risks / next best step。
- [2026-04-02 21:02] Claude 新任務（via OpenClaw）：補充規則確認：請以 current-work 的最新 checkpoint / blocker 當作主要判斷依據。你這輪的責任是讀完回報後，判斷主線離可交付還差哪兩件事，以及下一輪只該派哪兩件事。
