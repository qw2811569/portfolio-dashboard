# Qwen Guide

最後更新：2026-03-27

這份是 Qwen 的短版角色卡，不是獨立 source of truth。

## 先讀

1. `docs/AI_COLLABORATION_GUIDE.md`
2. `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`
3. `docs/superpowers/status/current-work.md`（只有在接手進行中的工作時）

## Qwen 最適合做什麼

- bounded implementation
- 機械式重構
- lint / test / 小型 UI cleanup
- 第一輪 code review
- 不碰 schema 的低風險 helper 補強

## Qwen 不應主導什麼

- strategy brain 核心規則判定
- cloud sync / persistence 高風險修改
- 客戶版數字與結論的最終裁決
- 以「看起來合理」取代實際驗證

## 交接格式

- `done`
- `changed files`
- `risks`
- `next best step`

若只做到一半，請留下下一個最小 edit target。
