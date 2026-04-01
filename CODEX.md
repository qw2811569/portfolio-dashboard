# Codex Guide

最後更新：2026-04-01

這份是 Codex 的短版角色卡，不是獨立 source of truth。**完整 AI 分工與任務路由規則看 `docs/AI_COLLABORATION_GUIDE.md`**。

## 先讀

1. `docs/AI_COLLABORATION_GUIDE.md`（尤其 §7 知識庫+事件行事曆架構）
2. `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`
3. `docs/status/current-work.md`
4. `docs/superpowers/specs/2026-03-31-kb-evolution-design.md`（知識庫演化方案）

## Codex 的角色

你是**最終裁決者**：策略大腦邏輯、schema、cloud sync、rule lifecycle、prompt 契約、驗收。

## Git 紀律（重要）

**2026-04-01 發現的問題：** Codex 上次 session 的改動沒有 commit，被混進 Claude 的 commit（`2d6b587`，186 files），導致：

- git blame 歸因錯誤（Codex 的代碼被標記為 Claude 寫的）
- rollback 困難（無法只 revert Codex 的改動）
- 其他 AI 不確定哪些檔案是安全的

**規則：**

1. **工作結束前必須 commit 自己的改動。** 用 `AI_NAME=Codex bash scripts/ai-commit.sh "message"`
2. **只 stage 自己改的檔案。** 用 `git add <specific-files>`，不要用 `git add -A`
3. **如果 lint 不過無法 commit，在 `docs/status/current-work.md` 記錄哪些檔案有 uncommitted changes**
4. Push 前確認 `git diff --cached --stat` 只包含自己的檔案

## 當前任務

### 緊急：latency 60.21s 接近 timeout 邊界

2026-04-01 production smoke test 回報 `/api/analyze` 真實 payload 花了 60.21s，幾乎觸發 60s timeout。

**必須在下一輪優先處理：**

- 方案 A：prompt 進一步瘦身（holdingSummary 截斷 top 5 持股、brainContext 精簡到 1000 字以下）
- 方案 B：改用 streaming response（`ReadableStream`），前端逐步渲染，不受 function timeout 限制
- 方案 C：把 `maxDuration` 提到 120s（需要 Vercel Pro plan）

**建議 A+B 並行 — 先瘦 prompt 降到 40s 以內，同時規劃 streaming 作為長期方案。**

### P0：research API prompt 瘦身（修 timeout）

收盤分析和深度研究在 production 常 timeout（已把 maxDuration 從 10s 提到 60s，但 prompt 太長仍可能超時）。

**根因：** prompt 組裝把所有持股 dossier + 知識庫 5 條 + 策略大腦全部規則 + 歷史分析 + 事件都塞進去，容易超過 8000 tokens input，Claude 回覆需要 30-50 秒。

**做法：**

- `api/research.js` 和 `src/hooks/useDailyAnalysisWorkflow.js` 的 prompt 組裝加入 token 預算控制
- holdingSummary 超過 3000 字時截斷（保留最大部位 5 檔）
- brainContext 超過 1500 字時只保留 user rules + 最近 3 條 lessons
- 或改用 streaming response

### P1：brain proposal 加上 gate/eval

`api/research.js` 已產出 `brainProposal: { status: 'candidate' }` 但沒有 gate。

**做法：**

- 新增 `evaluateBrainProposal(proposal, currentBrain)` 函數
- Gate 條件：
  - 不能刪除 user-confirmed rules
  - 新增規則不超過 3 條/次
  - 每條規則必須有 `evidence_refs`
  - 不能跟現有 rules 語意重複
- UI 加「套用提案」/「放棄提案」按鈕

### P2：knowledge evolution 接入 research evolve

參考 `docs/superpowers/specs/2026-03-31-kb-evolution-design.md`。把知識庫的 confidence auto-adjust 接到 research evolve pipeline。

### 新一輪任務（Claude 2026-04-02 指派）

**開始前先 `git pull origin main`。**

#### P3：FinMind adapter 擴充 — 免費 datasets 補齊

Claude 已建好 `docs/finmind-api-reference.md`，列出所有 90 個 datasets 的 tier 和欄位。

目前 `api/finmind.js` 只接了 6 個 datasets，但 FinMind 免費就能用的高價值 datasets 還有很多。

**優先補接的 datasets（全部 Free tier）：**

1. **TaiwanStockBalanceSheet** — 資產負債表（負債比、股東權益）
   - schema 跟 FinancialStatements 一樣（type/value/origin_name），需要 pivot
2. **TaiwanStockCashFlowsStatement** — 現金流量表（營運/投資/融資）
   - 同上 schema
3. **TaiwanStockShareholding** — 外資持股比率（`ForeignInvestmentRemainRatio`）
   - 追蹤外資信心度變化
4. **TaiwanStockDividendResult** — 除權息實際結果（填息狀況）
5. **TaiwanStockNews** — 個股新聞（title, description, link, source）
   - Qwen 會用這個建動態事件來源（取代 Gemini 手動蒐集法說會）
   - Codex 負責確保 api/finmind.js 的 DATASET_MAP 有加入此 dataset

**做法：**

- 在 `api/finmind.js` 的 `DATASET_MAP` 加入這 5 個 dataset
- 在 `src/lib/dataAdapters/finmindAdapter.js` 加對應的 fetch 函數
- BalanceSheet 和 CashFlows 可以跟 FinancialStatements 共用 transform 邏輯（pivot by type）

**不需要改前端** — dossier enrichment 會自動吃到新數據。

#### P4：prompt 契約更新 — 供應鏈 + 主題 context

Claude 剛把 `supplyChain.json` 從 8→20 entries，`themes.json` 也全部填滿。這意味著 daily analysis prompt 現在每檔持股都有供應鏈和主題 context。

**需要 Codex 做的：**

1. 確認 `buildSupplyChainContext()` 和 `buildThemeContext()` 的輸出不會讓 prompt 爆掉
   - 新增的供應鏈 context（20 檔 x 平均 200 字 = 4000 字）可能把 prompt 推回 timeout 邊界
2. 在 `promptBudget.js` 加入供應鏈 context 的截斷規則
   - 例如：只保留 upstream/downstream 各 top 3、customers top 5
3. 考慮把供應鏈 context 從每檔持股重複塞入改成全局一次性附帶

#### P5：Vercel Cron 時區修正（如需要）

`api/cron/collect-daily-events.js` 的 Cron 在 Vercel 上是 UTC 時區。確認 08:00 UTC 是否對應台灣時間 16:00（收盤後），如果不是，調整 cron schedule。

#### P6：streaming response 規劃（長期）

60.21s latency 即使瘦身後仍可能在持股數增加時回到邊界。規劃 `/api/analyze` 改用 streaming response（`ReadableStream` + Vercel Edge Function），讓前端逐步渲染分析結果。

**這是規劃文件，不是立即實作。** 產出一份 `docs/specs/streaming-analysis-design.md`：

- 前端 `useDailyAnalysisWorkflow.js` 如何改成 streaming consumer
- Edge Function vs Serverless Function 的 timeout 差異
- 預估可以省多少 perceived latency

### ~~P7/P8~~ ✅ 已完成（streaming 實作 + production smoke）

### 緊急 Bug 修復（Claude 2026-04-02 第三輪 — 用戶回報）

**用戶實際使用時發現 5 個 bug，其中 3 個由 Codex 負責修。**

**開始前先 `git pull origin main`。**

#### BUG-1：上傳成交 OCR 辨識失敗

**現象：** 用戶上傳交易截圖，辨識失敗。

**診斷：**

1. `api/_lib/ai-provider.js` line 12 — `DEFAULT_MODEL = 'claude-sonnet-4-20250514'`。但 OCR 需要 vision 能力，確認 Sonnet 是否支援 image input，或是否需要改用其他 model
2. `useTradeCaptureRuntime.js` line 265 — `extractTradeParseJsonText()` 在 AI 回傳非 JSON 時靜默失敗，用戶只看到「辨識失敗」但看不到具體錯誤
3. `api/parse.js` — 確認 request body 有正確把圖片 base64 傳到 Claude API

**修法：**

- 在 `api/parse.js` 加 console.log 印出 AI 回傳的原始 response，方便 debug
- 在 `useTradeCaptureRuntime.js` 的 catch 中顯示具體錯誤訊息給用戶，而不是只說「辨識失敗」
- 確認環境變數 `ANTHROPIC_API_KEY` 在 Vercel production 有設定

#### BUG-2：收盤分析沒有分析評論

**現象：** 用戶按「收盤分析」，有跑但結果是空的（沒有文字評論）。

**診斷：** streaming 改版（`9bd48fd`）後，`useDailyAnalysisWorkflow.js` 的 response 處理流程改了。可能的問題：

1. `stripDailyAnalysisEmbeddedBlocks()` 把 AI 回傳的整段文字都刪了（如果 AI 只回傳 JSON blocks 沒有人話）
2. streaming consumer 在拼接 chunks 時可能漏了 content
3. AI prompt 要求輸出 `EVENT_ASSESSMENTS` + `BRAIN_UPDATE` blocks，但沒有明確要求也要輸出人類可讀的分析文字

**修法：**

- 用真實 payload 在 production 跑一次 `POST /api/analyze?stream=1`，把原始 response 印出來看
- 如果 AI 確實只回傳 JSON blocks，在 `dailyAnalysisRuntime.js` 的 system prompt 明確要求「必須先輸出中文分析評論，然後才輸出 JSON blocks」
- 在 `stripDailyAnalysisEmbeddedBlocks()` 後，如果結果為空，保留原始文字而不是回傳空

#### BUG-4：深度研究卡住

**現象：** 用戶按「深度研究」後 UI 一直轉，沒有結果也沒有錯誤。

**診斷：** `useResearchWorkflow.js` line 18 的 fetch 沒有 `AbortSignal.timeout()`，Vercel 30s-60s 超時後靜默失敗。

**修法：**

1. 在 `useResearchWorkflow.js` 的 fetch 加上 `signal: AbortSignal.timeout(55000)`（55 秒，略低於 Vercel 60s）
2. catch 中區分 timeout vs 其他錯誤，顯示對應訊息
3. 如果 `/api/research` 也該改成 streaming，參考 `/api/analyze` 的 streaming 改法

### 全面 Bug Sweep（Claude 2026-04-02 第四輪 — 最高優先）

用戶回報 production 出現 403 Forbidden 和 lazy import crash。之前的 bug fix 可能沒完全解決，或引入了新問題。

**Codex 負責：API 層 + 部署層全面檢查**

**開始前先 `git pull origin main`。**

#### SWEEP-1：Vercel 部署狀態確認

1. 確認最新 commit `ba97499` 已在 production 部署成功
2. 確認 `npm run build` 在 Vercel 上是綠的（不是本地）
3. curl 測試所有 API endpoints 的 HTTP status：
   ```bash
   for ep in /api/twse /api/finmind /api/event-calendar /api/analyze /api/research /api/parse /api/analyst-reports /api/gemini-research; do
     code=$(curl -s -o /dev/null -w "%{http_code}" "https://jiucaivoice-dashboard.vercel.app$ep")
     echo "$code $ep"
   done
   ```
4. 如果有 403/500，查 Vercel Dashboard 的 Function Logs

#### SWEEP-2：環境變數確認

在 Vercel Dashboard → Settings → Environment Variables 確認以下都有設定：

- `ANTHROPIC_API_KEY`（必要 — OCR 和分析都靠這個）
- `PUB_BLOB_READ_WRITE_TOKEN`（行事曆 cron 需要）
- `CRON_SECRET`（cron 認證需要）
- `FINMIND_TOKEN`（可選，但有的話 rate limit 更高）

#### SWEEP-3：streaming analyze 端到端測試

用真實 payload 打 production：

```bash
curl -X POST https://jiucaivoice-dashboard.vercel.app/api/analyze?stream=1 \
  -H "Content-Type: application/json" \
  -d '{"holdings":[{"code":"2308","name":"台達電"}],"mode":"daily"}' \
  -N --max-time 65
```

確認回傳有 SSE events 且包含中文分析評論（不只是 JSON blocks）。

#### SWEEP-4：OCR parse 端到端測試

用一個最小 base64 image 打 production `/api/parse`，確認不是 500。

#### SWEEP-5：research 端到端測試

打 production `/api/research`，確認 55 秒 timeout 正常回傳錯誤訊息（而不是 hang）。

### P9：FinMind 付費後 — Backer datasets 接入（等付費確認）

完整 dataset 參考見 `docs/finmind-api-reference.md`。

## Codex 不要做的事

- 不要改知識庫 JSON 內容（Claude/Qwen 負責）
- 不要改事件行事曆 Cron（Claude 負責）
- 不要改 GEMINI.md / QWEN.md（各自負責）
- 不要留 uncommitted changes 給別人

## 交接格式

- `done`
- `changed files`
- `risks`
- `next best step`
