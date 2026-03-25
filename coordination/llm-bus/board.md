# External LLM Board

最後更新：2026-03-25

## Gemini

- role: 公開資料蒐集員
- current status: 可用
- best for:
  - 新聞 / 公告 / 法說 / 公開報告索引
  - citations / freshness / unresolved questions
- limits:
  - 不是最終數字真值
  - 某些模型會先碰到 daily quota

## Qwen

- role: 低風險 coding worker
- current status: 可啟動，help 正常；本機 Ollama 路徑可接，但 headless 任務偏慢
- best for:
  - bounded patch ideas
  - helper / test / mechanical refactor
- limits:
  - 不適合高風險主線
  - 本機延遲高，不適合阻塞主線

## Claude Local

- role: 互動式 prompt / checklist 草稿助手
- current status: 可透過 Ollama 啟動並回報版本；非互動 prompt 目前不穩
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
