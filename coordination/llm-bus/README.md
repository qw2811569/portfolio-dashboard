# External LLM Bus

這個資料夾是外部 LLM 的共享交接通道。

目的：

- 讓 `Gemini`、`Qwen` 用同一種格式交接任務
- 讓 Codex 可以快速知道：
  - 誰正在做什麼
  - 誰卡在哪裡
  - 誰的結果可採用、誰的結果只能當草稿

## 檔案（R32 R14 更新 · 與現況對齊）

- `board.md`：**LLM lane capability + dispatch policy**（R32 R12 起 · 不再是 current task 看板 · 當前 sprint 看 `docs/NOW.md` + `docs/status/active-debt-2026-04-28.md`）
- `runtime-execution-plan.md`：主執行計劃，所有 wave 的 live truth
- `runtime-stabilization-brief.md`：每輪重大決策的摘要與已採納結論
- `agent-bridge-tasks.json`：當前 task 佇列（session 開頭必讀 · per `claude.md:13`）
- `alerts.jsonl` / `pending-decisions.jsonl`：runtime log（writers in `agent-bridge-standalone/workers/`、`api/_lib/`、`scripts/`）· 不該手動編輯
- ~~`runs/<timestamp>/`~~ **R32 R8a 已 archive 至 [`docs/archive/2026-Q2/llm-bus-runs/runs/`](../../docs/archive/2026-Q2/llm-bus-runs/runs/)** · 18 個 historical per-session ledger · 不再 active write

## 固定欄位

每個外部 LLM 回報盡量使用：

- `task`
- `done`
- `unknowns`
- `risks`
- `limits`
- `next_best_step`

研究類再補：

- `facts`
- `citations`
- `freshness`
- `unresolved_questions`

## 共識流程（R32 R14 更新）

R32 起改採 **shared-doc append pattern**（per `claude.md` `### 多 LLM 協作用「Shared Doc Append 模式」`）：

- 每個討論主題開一份 `.tmp/<topic>/<topic>-shared.md`
- Round-by-round append（不再分檔到 `runs/<timestamp>/`）
- 收斂後：寫成正式 decision 到 `docs/decisions/YYYY-MM-DD-<topic>.md`，sprint trail 留在 `.tmp/<topic>/`
- 範例：`.tmp/r31-fix/r31-shared.md`、`.tmp/r32-docs/r32-shared.md`

歷史 `runs/<timestamp>/` artifacts 已 archive（看 `docs/archive/2026-Q2/llm-bus-runs/runs/`），不再用。
