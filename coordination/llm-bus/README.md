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
