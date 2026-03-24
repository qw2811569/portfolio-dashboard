# Current Work

Last updated: 2026-03-25 16:10

## Objective

Task A：補齊策略大腦規則的證據欄位，讓規則可驗證、可排序、可判斷是否過期。

## Active slices

- `Codex`：strategy brain schema、normalize/merge helper、prompt contract、UI metadata
- `Claude Code over Ollama`：後續可接 candidate rules / checklist 草稿與低成本規則摘要
- `Qwen Code`：後續可接低風險 UI 收尾與測試
- `AnythingLLM`：文件檢索與研究材料整理，不直接改程式

## Files in play

- `src/App.jsx`
- `api/research.js`
- `docs/superpowers/plans/2026-03-25-strategy-brain-v2-llm-routing-plan.md`
- `docs/superpowers/status/current-work.md`
- `CLAUDE.md`
- `QWEN.md`

## Latest checkpoint

- `16:02` Codex：完成 `validationScore / staleness / evidenceRefs` 的 rule normalization 與 fallback 推導
- `16:04` Codex：策略大腦 UI 改為顯示驗證分、狀態與證據來源
- `16:06` Codex：收盤分析 / 復盤 / cleanup / research 的 brain JSON 契約已同步
- `16:08` Codex：`npm run build` 通過；`api/research.js` import 檢查通過

## Next actions

- 把 `current-work.md` 接到日常流程，之後每一輪都先更新
- 規劃 Task B：收盤分析改成「先驗證規則，再新增規則」
- 補 `evidenceRefs` 的實際產生流程，不只支援 schema
- 評估是否為策略大腦補單元測試

## Stop-in-5-min fallback

- 先完成當前 edit batch，不再開新 scope
- 至少更新一次這份檔案的 `Latest checkpoint`
- 明確寫下：
  - 已完成的檔案
  - 尚未完成的下一個函式 / 區塊
  - 下一步最直接的指令或檔案位置

## Blockers / assumptions

- 目前 `validationScore` 與 `staleness` 仍以 fallback 推導為主，真正精準化要靠 Task B 之後的規則驗證流程
- `evidenceRefs` schema 已就位，但實際自動回填來源還要再補
- 必須維持舊版 localStorage brain 資料相容，不能要求使用者重置資料
