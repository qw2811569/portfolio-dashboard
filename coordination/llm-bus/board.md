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
- current status: 已切到 `qwen3-coder:30b`；headless 自動任務實測 240s 內未交稿
- best for:
  - bounded patch ideas
  - helper / test / mechanical refactor
- limits:
  - 不適合高風險主線
  - 本機延遲高，不適合阻塞主線

## Claude Local

- role: 互動式 prompt / checklist 草稿助手
- current status: 已切到 `qwen3-coder:30b`；互動啟動正常，headless 非互動模式實測 240s 內未交稿
- best for:
  - prompt 草稿
  - checklist / guardrail wording
- limits:
  - 不適合 headless 自動化主線

## Active coordination rule

- 高風險主線：Codex + James + Curie
- 外部 research：Gemini
- 低風險 patch：Qwen
- 互動式草稿：Claude Local

## Validation lane

- latest run: `coordination/llm-bus/runs/20260325-210859`
  - Gemini：CLI 正常，但 research 測試命中 `429 RESOURCE_EXHAUSTED`，此輪未完成輸出
  - Qwen：`low-risk patch draft` headless 測試逾時
  - Claude Local：`prompt / checklist / guardrail draft` headless 測試逾時
- acceptance rule:
  - 只記錄實測通過的能力
  - 若某一路 headless 模式不穩，直接降級角色，不硬撐
