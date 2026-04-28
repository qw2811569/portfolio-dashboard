# External LLM Board

最後更新：2026-04-28（R32 R12 · purpose tightened）

> **Purpose（R32 起）**：only LLM lane capability + dispatch policy notes（Gemini / Qwen / Codex 各自能做不能做的）。
> Sprint state / current task / blocker 已交給 [`docs/NOW.md`](../../docs/NOW.md) + [`docs/status/active-debt-2026-04-28.md`](../../docs/status/active-debt-2026-04-28.md)。
> 本檔不再扮演「current task 看板」· 不要再從這裡讀「現在做什麼」。

## Gemini

- role: 用戶盲點審查 / multi-LLM 反駁者
- current status: CLI 可用；`gemini-2.5-flash` headless `plan` mode 今晚可用，`gemini-3.1-flash-lite-preview` 今晚命中 `429 MODEL_CAPACITY_EXHAUSTED`
- best for:
  - blind-spot review / 反駁與質疑 current plan
  - citations / freshness / unresolved questions 的二次查核
  - 指出 repo / 人類 / Codex 可能忽略的外部真值缺口
- limits:
  - 不做 primary 資料蒐集 lane
  - 不是最終數字真值
  - 某些模型會先碰到 daily quota
  - consensus 任務要用短 prompt；長 prompt 較容易浪費 quota
  - 不適合精細控制 consensus flags 或穩定阻塞主線

## Qwen

- role: 低風險 coding worker
- current status: 已恢復為 plain Qwen CLI；本地 Ollama 路徑已移除
- best for:
  - bounded patch ideas
  - helper / test / mechanical refactor
- limits:
  - 不適合高風險主線
  - 本機延遲高，不適合阻塞主線

## Active coordination rule

- 高風險主線：Codex
- 外部 research / blind-spot review：Gemini（非 primary data lane）
- 低風險 patch：Qwen

## Validation lane

- latest run: `docs/archive/2026-Q2/llm-bus-runs/runs/20260325-210859`（R32 R8a archive · 原 `coordination/llm-bus/runs/`）
  - Gemini：CLI 正常，但 research 測試命中 `429 RESOURCE_EXHAUSTED`，此輪未完成輸出
  - Qwen：當時仍是本地模型路徑，結果僅供歷史參考；現已改回 plain CLI
- current run: `docs/archive/2026-Q2/llm-bus-runs/runs/20260409-221610`（R32 R8a archive）
  - Gemini：`gemini-2.5-flash` 已成功完成最小 headless 回覆；`gemini-3.1-flash-lite-preview` 今晚不可作 blocking lane
  - notes: see `docs/archive/2026-Q2/llm-bus-runs/runs/20260409-221610/gemini-operating-notes.md`
- acceptance rule:
  - 只記錄實測通過的能力
  - 若某一路 headless 模式不穩，直接降級角色，不硬撐

## Active shared brief

- current stabilization brief:
  - `coordination/llm-bus/runtime-stabilization-brief.md`
- rule:
  - Claude / Qwen / Gemini 先讀 shared brief，再在自己 lane 回報
  - 不再只靠 Codex 口頭轉述背景
