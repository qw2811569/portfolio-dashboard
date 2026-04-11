# External LLM Bus

這個資料夾是外部 LLM 的共享交接通道。

目的：

- 讓 `Gemini`、`Qwen` 用同一種格式交接任務
- 讓 Codex 可以快速知道：
  - 誰正在做什麼
  - 誰卡在哪裡
  - 誰的結果可採用、誰的結果只能當草稿

## 檔案

- `board.md`：目前任務、結果、阻塞點總表
- `runtime-execution-plan.md`：主執行計劃，所有 wave 的 live truth
- `runtime-stabilization-brief.md`：每輪重大決策的摘要與已採納結論
- `runs/<timestamp>/`：每輪重大決策的 raw discussion artifacts
  - `question.md`
  - `claude.md`
  - `qwen.md`
  - `gemini.md`
  - `consensus.md`

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

## 共識流程

每個重大決策都要留一份 run artifact：

1. 先把題目寫進 `runs/<timestamp>/question.md`
2. 各 lane 原始回覆分別落到：
   - `claude.md`
   - `qwen.md`
   - `gemini.md`
3. 最後才把收斂結果寫進 `consensus.md`
4. 主 brief 只放摘要，不重複貼全文
