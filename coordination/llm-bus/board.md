# External LLM Board

最後更新：2026-03-25

## Gemini

- role: 公開資料蒐集員
- current status: CLI 可用；research lane 目前受當日 API quota 影響
- best for:
  - 新聞 / 公告 / 法說 / 公開報告索引
  - citations / freshness / unresolved questions
- limits:
  - 不是最終數字真值
  - 某些模型會先碰到 daily quota

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
- acceptance rule:
  - 只記錄實測通過的能力
  - 若某一路 headless 模式不穩，直接降級角色，不硬撐
