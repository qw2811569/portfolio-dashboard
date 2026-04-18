# External LLM Board

最後更新：2026-04-09

## Gemini

- role: 公開資料蒐集員
- current status: CLI 可用；`gemini-2.5-flash` headless `plan` mode 今晚可用，`gemini-3.1-flash-lite-preview` 今晚命中 `429 MODEL_CAPACITY_EXHAUSTED`
- best for:
  - 新聞 / 公告 / 法說 / 公開報告索引
  - citations / freshness / unresolved questions
  - blind-spot review / 外部真值缺口提示
- limits:
  - 不是最終數字真值
  - 某些模型會先碰到 daily quota
  - consensus 任務要用短 prompt；長 prompt 較容易浪費 quota
  - research scout wrapper 不適合精細控制 consensus flags

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
- 外部 research：Gemini
- 低風險 patch：Qwen

## Validation lane

- latest run: `coordination/llm-bus/runs/20260325-210859`
  - Gemini：CLI 正常，但 research 測試命中 `429 RESOURCE_EXHAUSTED`，此輪未完成輸出
  - Qwen：當時仍是本地模型路徑，結果僅供歷史參考；現已改回 plain CLI
- current run: `coordination/llm-bus/runs/20260409-221610`
  - Gemini：`gemini-2.5-flash` 已成功完成最小 headless 回覆；`gemini-3.1-flash-lite-preview` 今晚不可作 blocking lane
  - notes: see `coordination/llm-bus/runs/20260409-221610/gemini-operating-notes.md`
- acceptance rule:
  - 只記錄實測通過的能力
  - 若某一路 headless 模式不穩，直接降級角色，不硬撐

## Active shared brief

- current stabilization brief:
  - `coordination/llm-bus/runtime-stabilization-brief.md`
- rule:
  - Claude / Qwen / Gemini 先讀 shared brief，再在自己 lane 回報
  - 不再只靠 Codex 口頭轉述背景
