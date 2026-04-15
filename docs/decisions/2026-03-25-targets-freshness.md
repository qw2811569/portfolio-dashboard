# Targets Freshness（目標價/財報新鮮度）

**日期**：2026-03-25
**參與者**：Codex + Qwen + Gemini
**源頭**：`.tmp/targets-freshness/consensus.md`

## P0 決議（全部實作）

1. **`freshness.targets` 在 `buildHoldingDossiers` 計算** → ✅
2. **`freshness.fundamentals` 從 `entry.updatedAt` 推導**，不 hardcode `fresh` → ✅
3. **共用 date parser**，處理 `YYYY/MM`、`YYYY/MM/DD`、ISO、malformed → ✅ (`src/lib/dateUtils.js`)

## 閾值（Qwen 方案定案）

- **Targets**：`fresh: 7d`, `aging: 30d`（原本 30/90 改掉）
- **Fundamentals**：`fresh: 30d`, `aging: 90d`（保留）
- 常數：`src/lib/dateUtils.js` `TARGETS_FRESHNESS_THRESHOLDS`

## 分類語意

- `missing`：無報告 / 無可 parse 日期
- `stale`：有報告但超過 aging 閾值
- `aging`：過了 fresh 但還沒 stale
- `fresh`：在 fresh 閾值內

## 驗證

2026-04-15 Qwen 驗證：cron + fetch + 7/30 freshness + UI badge + aging warn 均到位（feat-01 complete）。
