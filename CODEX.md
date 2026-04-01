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
