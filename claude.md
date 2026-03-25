# Claude Handoff

最後更新：2026-03-25

## 專案是什麼

這是一個台股投資 / 持倉管理 App，現在已經從單一帳戶升級成：

- 多組合管理
- 事件追蹤三段式：`pending / tracking / closed`
- owner-only cloud gate
- 策略大腦 `coachLessons`
- portfolio-aware backup / import
- watchlist 與接力計畫 UI 優化

主要前端仍集中在 [src/App.jsx](/Users/chenkuichen/APP/test/src/App.jsx)。

## 目前狀態

整體狀態：

- 多組合 / 事件追蹤主功能已落地
- 文件已同步到 spec / implementation plan
- `npm run build` 已通過
- 尚待人工 smoke test

參考文件：

- 設計文件：[docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md](/Users/chenkuichen/APP/test/docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md)
- 實作任務清單：[docs/superpowers/plans/2026-03-23-multi-portfolio-event-tracking-implementation-plan.md](/Users/chenkuichen/APP/test/docs/superpowers/plans/2026-03-23-multi-portfolio-event-tracking-implementation-plan.md)
- Claude 台股分析工具手冊：[docs/superpowers/specs/2026-03-24-claude-tw-stock-analysis-tooling-guide.md](/Users/chenkuichen/APP/test/docs/superpowers/specs/2026-03-24-claude-tw-stock-analysis-tooling-guide.md)
- Holding dossier / 資料更新架構：[docs/superpowers/specs/2026-03-24-holding-dossier-and-refresh-architecture.md](/Users/chenkuichen/APP/test/docs/superpowers/specs/2026-03-24-holding-dossier-and-refresh-architecture.md)
- 客戶報告製作手冊：[docs/superpowers/specs/2026-03-24-client-report-production-playbook.md](/Users/chenkuichen/APP/test/docs/superpowers/specs/2026-03-24-client-report-production-playbook.md)
- Qwen / AnythingLLM / Claude 本機分工手冊：[docs/superpowers/specs/2026-03-25-qwen-anythingllm-setup-and-division.md](/Users/chenkuichen/APP/test/docs/superpowers/specs/2026-03-25-qwen-anythingllm-setup-and-division.md)
- 策略大腦 V2 多模型分工計畫：[docs/superpowers/plans/2026-03-25-strategy-brain-v2-llm-routing-plan.md](/Users/chenkuichen/APP/test/docs/superpowers/plans/2026-03-25-strategy-brain-v2-llm-routing-plan.md)

## 已完成的重點

### 1. 多組合資料層

- `activePortfolioId + viewMode` 已分離
- localStorage 已改成 `pf-{pid}-*`
- 有 migration、backup/import、hydrate guard
- overview 是唯讀，不會寫資料

關鍵位置：

- [src/App.jsx](/Users/chenkuichen/APP/test/src/App.jsx)

### 2. owner-only cloud gate

- 只有 owner portfolio 會讀寫 `/api/brain`、`/api/research`
- 非 owner 與 overview 不碰 cloud singleton

### 3. 事件追蹤升級

- schema 已支援 `eventDate / trackingStart / exitDate / priceAtEvent / priceAtExit / priceHistory`
- 事件可自動從 `pending -> tracking`
- 結案復盤會預填 exit price 與 actual

### 4. 策略大腦 coachLessons

- 非 owner 的復盤會回寫到 owner 的 `coachLessons`
- 不污染 owner 原本的 `rules / stats`

### 5. watchlist / 接力計畫 UI

已完成：

- watchlist 改成 per-portfolio storage：`watchlist-v1`
- watchlist 上方焦點卡改成動態，不再寫死台燿
- 空組合會顯示空狀態
- `events` 分頁的接力計畫改成「濃縮摘要 + 展開完整內容」

### 6. AI provider 已集中

現在所有 AI 路由都走同一個 adapter：

- [api/_lib/ai-provider.js](/Users/chenkuichen/APP/test/api/_lib/ai-provider.js)

這代表之後如果要：

- 換 API key
- 換 model
- 換 endpoint
- 開 / 關 extended thinking

優先改這一個檔與 `.env(.local)` 即可。

## AI / API 架構

### 前端會打哪些 API

- `/api/analyze`
  - 收盤分析
  - 策略大腦更新
  - 復盤後策略整合
- `/api/parse`
  - 成交截圖解析
- `/api/research`
  - 深度研究 / 系統進化
- `/api/twse`
  - 即時股價 / 事件追蹤價格
- `/api/brain`
  - cloud sync / history / brain / events / holdings

### AI 路由現在都共用同一個 adapter

- [api/analyze.js](/Users/chenkuichen/APP/test/api/analyze.js)
- [api/parse.js](/Users/chenkuichen/APP/test/api/parse.js)
- [api/research.js](/Users/chenkuichen/APP/test/api/research.js)

它們都改成透過：

- [api/_lib/ai-provider.js](/Users/chenkuichen/APP/test/api/_lib/ai-provider.js)

### 環境變數

目前支援：

- `AI_API_KEY`
- `AI_MODE`
- `AI_API_ENDPOINT`
- `AI_ENABLE_EXTENDED_THINKING`
- `AI_THINKING_BUDGET_TOKENS`

目前統一由 `.env` 控制 AI 設定，`.env.local` 不再覆蓋 AI 相關欄位。

`.env` 已補上：

- `AI_MODE=claude-sonnet-4-20250514`
- `AI_ENABLE_EXTENDED_THINKING=true`
- `AI_THINKING_BUDGET_TOKENS=2048`

注意：

- 這裡是用 Sonnet 4 的正式 model id
- 「extended」不是 model id，而是透過 thinking 開關控制
- 圖片解析 route 預設不開 extended thinking，避免過慢

### 固定操作守則

Claude 在做台股分析時，預設工具組合是 `twsemcp + FinMind + twstock`：

- `twsemcp`：優先用於收盤分析、事件追蹤、官方數據查核
- `FinMind`：優先用於深度研究、歷史營收 / 財報 / 法人 / 融資融券驗證
- `twstock`：作為本地 fallback 與簡單技術面補充

資料優先序固定為：

1. `twsemcp` / TWSE 官方資料
2. `FinMind`
3. `twstock`
4. `TradingView`
5. `Yahoo Finance / stockscreen`
6. 模型推論

分析規則：

- 若不同來源數字不一致，優先採用較新的官方資料，並標示差異
- 若屬推論而非直接數據，必須明寫「這是推論」
- 不可把技術面判斷寫成基本面事實
- 產出格式固定分成：事實、解讀、動作建議

收盤分析規則：

- 目標是找出今日異常、事件反應、需要復盤的部位，不是重寫整份長報告
- 優先使用 App 內持倉、事件、analysis history、brain，再補 `twsemcp`
- 輸出以「今日總結、異常持股、事件追蹤、明日優先觀察」為主

深度研究規則：

- 目標是釐清邏輯、催化劑、風險、時程與操作節點
- 優先使用 App 內持倉、事件、brain、analysisHistory、researchHistory，再補 `FinMind`
- 輸出以「核心結論、多頭邏輯、風險與失敗條件、時間軸、操作計畫、是否回寫 brain」為主

底線：

- 沒有資料就明說缺資料，不可硬猜
- 每個結論都要附條件，不只給看多 / 看空
- 若研究足以改變策略，必須提出可回寫到 `strategyBrain` 的規則或教訓
- 台股分析不能只看持倉，還要一起看市場結構、月營收 / 法說 / 財報節奏、法人資金、題材輪動與資料新鮮度
- 重要規則要盡量拿去對照過往台股相似個股 / 相似節奏；若失準，要區分是規則本身錯，還是個股 / 流動性 / 市場 regime 差異
- 詳版規則與工具說明見 [docs/superpowers/specs/2026-03-24-claude-tw-stock-analysis-tooling-guide.md](/Users/chenkuichen/APP/test/docs/superpowers/specs/2026-03-24-claude-tw-stock-analysis-tooling-guide.md)

## 本地啟動方式

### 完整模式

用：

```bash
vercel dev
```

原因：

- 前端除了 `/api/twse`，還會打 `/api/brain`、`/api/research`、`/api/analyze`、`/api/parse`
- `npm run dev` 只會跑 Vite 前端，不是完整模式

### 前端單跑

```bash
npm run dev
```

只適合純前端畫面調整，不適合測完整功能。

## 本機 LLM 入口

這台機器目前已裝好：

- `Qwen Code`
- `AnythingLLM`
- `Ollama`
- `Claude Code`

在這個 repo 內的 VSCode 任務可直接用：

- `Claude Code: Launch via Ollama`
- `Claude Code: Launch via Ollama (Print Test)`
- `Qwen Code: Launch In Repo`
- `AnythingLLM: Open Desktop App`
- `Ollama: Start Local Service`
- `Ollama: Restart Local Service (64K Context)`
- `Ollama: Show Running Models`

`Claude Code -> Ollama` 的入口腳本在：

- [scripts/launch-claude-ollama.sh](/Users/chenkuichen/APP/test/scripts/launch-claude-ollama.sh)

預設模型：

- `qwen3:14b`

用途建議：

- `Claude Code over Ollama`：低成本草稿、規則整理、checklist 初稿
- `Qwen Code`：低風險工程實作
- `AnythingLLM`：文件檢索 / PDF / 研究資料整理
- `Codex`：高風險邏輯、prompt 契約、最終驗收

## 關鍵檔案

- 主前端：[src/App.jsx](/Users/chenkuichen/APP/test/src/App.jsx)
- AI adapter：[api/_lib/ai-provider.js](/Users/chenkuichen/APP/test/api/_lib/ai-provider.js)
- AI 分析 route：[api/analyze.js](/Users/chenkuichen/APP/test/api/analyze.js)
- 截圖解析 route：[api/parse.js](/Users/chenkuichen/APP/test/api/parse.js)
- 深度研究 route：[api/research.js](/Users/chenkuichen/APP/test/api/research.js)
- cloud / brain route：[api/brain.js](/Users/chenkuichen/APP/test/api/brain.js)
- 規格文件：[docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md](/Users/chenkuichen/APP/test/docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md)
- 任務清單：[docs/superpowers/plans/2026-03-23-multi-portfolio-event-tracking-implementation-plan.md](/Users/chenkuichen/APP/test/docs/superpowers/plans/2026-03-23-multi-portfolio-event-tracking-implementation-plan.md)

## 還沒做完 / 下一步最值得做

優先建議：

1. 策略大腦 V2：證據鏈、驗證分數、規則升降級
2. 收盤分析改成先驗證規則，再新增規則
3. 在持股 dossier / UI 顯示 brain 命中理由與資料新鮮度
4. 手動 smoke test
5. watchlist 編輯 UI（現在已是 per-portfolio，但還沒有完整新增/編輯/刪除介面）

## 手動 smoke test 清單

至少驗這幾個：

1. `me` 啟動後資料與舊版一致
2. 新增 `wang` 後資料預設為空
3. `me -> wang -> me` 切換不互相污染
4. overview 唯讀且不寫入任何 key
5. 非 owner 不打 cloud API
6. 事件 `pending -> tracking -> closed` 正常
7. 非 owner 復盤後，owner 的 `coachLessons` 有收到資料
8. watchlist 空組合不會再看到台燿固定卡

## 最近新增但還未提交的變更

目前工作樹重點變更：

- `src/App.jsx`
- `api/analyze.js`
- `api/parse.js`
- `api/research.js`
- `api/_lib/ai-provider.js`
- `scripts/launch-claude-ollama.sh`
- `docs/superpowers/plans/2026-03-25-strategy-brain-v2-llm-routing-plan.md`

如果 Claude 要接手，先讀這些檔，再讀 spec / plan。

## 工作紀律（必讀）

1. **資料在手就直接做，不要再「確認一下」**：如果已經讀過檔案、拿到 PDF 內容、知道色板，就直接動手寫，不要再花 Read/Grep 去重複驗證已知資訊。
2. **能用 Read 讀 3 行解決的，不要開 Agent**：Agent 每次消耗大量 token。只有真正需要跨多檔案深度探索時才用，單一檔案定位用 Grep + Read。
3. **生成靜態內容不需要探索 codebase**：寫 HTML 報告、渲染 PDF 這類任務，拿到資料和樣式就直接寫，不要繞回去讀 App 程式碼。
4. **省 token 意識**：用戶有每日額度限制，每一次 tool call 都在消耗額度。能一次做完的不要分三次，能 parallel 的不要 sequential。
5. **Plan mode 探索上限**：Phase 1 最多開 2 個 Explore agent，不要 3 個都開滿。如果任務範圍明確（比如只改 prompt 文字），直接 Read 目標行數即可，完全不需要 agent。

## 協作契約（多模型）

1. 開工前先讀 [current-work.md](/Users/chenkuichen/APP/test/docs/superpowers/status/current-work.md)。
2. 先認領一個 task slice，再開始改檔，不要多個模型同時碰同一段高風險邏輯。
3. 每完成一個有意義的 batch，就更新一次 `Latest checkpoint`。
4. 如果用戶說「中斷」，只收完當前 batch，並在 5 分鐘內補好 `Stop-in-5-min fallback`。
5. 不要替另一個模型把工作標成完成，除非已經驗證過結果。
6. 台股分析屬高難度任務，先做能力分流：便宜模型先交摘要 / 抽取 / 草稿，Codex 再做檢查、糾正、改派與最終定稿。
7. 若 delegated 結果品質不夠，Codex 要立即收回、縮小範圍或重派，不可硬沿用。
8. 當主線暫時沒有下一步或正在等驗證時，主動向其他模型做一次「優化掃描」，請它們提出可改進點，再由 Codex 篩選是否採納。
9. 歷史相似案例驗證可以委派給便宜模型先整理，但「規則失準 vs 情境差異」的最終判定，保留給 Codex。
10. 每次準備向用戶回報一個階段性進度前，先做一次 `checkpoint meeting`，至少檢查：
   - 目前成果哪裡還薄弱
   - 哪些台股特徵 / 風險節奏被漏掉
   - 是否需要外部參考、官方文件或初級市場資料再驗證
   - 是否真的需要安裝新 skill / 工具，還是只是流程沒用好
11. `checkpoint meeting` 產出只能有三類：
   - 立即採納的改進
   - 暫緩但記錄的想法
   - 明確拒絕的低價值建議
12. 新 skill 只在「形成重複瓶頸、現有工具明顯不夠」時才評估安裝；不可為了新鮮感而加複雜度。
13. 若主題屬高風險或時效性強（例如台股策略、法規、交易節奏、資料源），checkpoint meeting 要明確判斷是否需要先查網路 / 一手來源，再決定下一步。

## 接力建議

如果下一個 Claude 要繼續做事，推薦順序：

1. 先跑 `git status`
2. 再跑 `npm run build`
3. 如需完整驗證，跑 `vercel dev`
4. 先看 [claude.md](/Users/chenkuichen/APP/test/claude.md)、[2026-03-23-multi-portfolio-event-tracking-design.md](/Users/chenkuichen/APP/test/docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md)、[2026-03-23-multi-portfolio-event-tracking-implementation-plan.md](/Users/chenkuichen/APP/test/docs/superpowers/plans/2026-03-23-multi-portfolio-event-tracking-implementation-plan.md)
5. 再決定是做 smoke test、UI 收尾，還是部署
