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

## 已完成任務

- ✅ P0-P1：prompt 瘦身 + brain proposal gate/eval
- ✅ P3-P6：FinMind adapter 擴充 + prompt budget + cron 時區 + streaming 設計
- ✅ P7-P8：streaming 實作 + production smoke
- ✅ FIX-1~4：BRAIN_UPDATE strip + 研究超時 + 知識庫驗證 + FinMind 驗證

## 當前任務（第七輪）

**必讀：** `docs/status/session-handoff-2026-04-02-v2.md`

**開始前先 `git pull origin main`。**

### FIX-5：全組合研究只分析一檔

**現象：** 用戶按「全組合研究 + 進化提案」，結果只出現一檔台達電的分析。

**根因：** FIX-2 把本地 research 改成 `local-fast` 1 輪模式，但全組合研究（evolve mode）需要 4 輪（Round 1 個股快掃 → Round 2 組合建議 → Round 3 系統診斷 → Round 4 提案）。1 輪只做完第一檔就結束。

**修法：** `api/research.js` 的 `local-fast` 模式應該跑完 4 個 Round，但每個 Round 只做 1 次 AI call（不迭代改善）。不是「只做 Round 1」。

**位置：** `api/research.js` line ~647 `mode === 'evolve'` 區塊

### FIX-6：分析顯示「資料來源不足」— FinMind 數據沒進 prompt

**現象：** 收盤分析和深度研究都顯示「缺乏最新季報財務數據」「無法評估營收趨勢」。

**根因：** `dossierByCode` 在分析開始時可能還沒有 FinMind enrichment 完成。Codex 已在 FIX-4 補了 7 個 dataset，但需要驗證 `hydrateDossiersWithFinMind()` 是否在分析 prompt 組裝前被正確呼叫。

**驗證方式：** 在 `buildCompactFinMindSummary()` 加一行 `console.debug` 印出每個 dataset 是否有值。如果是空的，追蹤 `fetchStockDossierData()` 回傳什麼。

**位置：** `src/lib/dossierUtils.js`

### FIX-7：策略大腦沒更新

**現象：** 收盤分析產出 BRAIN_UPDATE 但策略大腦沒有實際更新。

**驗證：** 確認 `extractDailyBrainUpdate()` 能正確從 AI 回覆中解析 JSON，且 `hasMeaningfulBrainUpdate()` 回傳 true。

### 成本守則

必讀：`docs/deployment-and-api-strategy.md`

- 不要頻繁 push
- 本地測試用 `vercel dev`（FINMIND_TOKEN 必須在 `.env`）
- 不要手動 Redeploy 除非用戶要求

## Codex 不要做的事

- 不要改知識庫 JSON 內容（Claude/Qwen 負責）
- 不要改事件行事曆 Cron（Claude 負責）
- 不要改 GEMINI.md / QWEN.md（各自負責）
- 不要留 uncommitted changes 給別人
- **不要頻繁 push 或觸發 deploy**（見成本守則）

## 交接格式

- `done`
- `changed files`
- `risks`
- `next best step`
