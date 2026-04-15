# Decision Log 索引

**最後更新**：2026-04-15

## 資料 Pipeline

| Decision                                                                            | 日期       | 狀態            | 摘要                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ---------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [2026-03-23-target-collection-strategy](./2026-03-23-target-collection-strategy.md) | 2026-03-23 | ✅ 決議         | 目標價採全域 per-stock cache + 硬 fallback chain + 權證 map 標的股 + async/segmented batch 避免 Vercel timeout                                |
| [2026-03-25-targets-freshness](./2026-03-25-targets-freshness.md)                   | 2026-03-25 | ✅ 決議         | 目標價 freshness 7/30 天、fundamentals 用 entry.updatedAt、shared date parser 支援 YYYY/MM + ISO                                              |
| [2026-04-15-target-price-pipeline-fix](./2026-04-15-target-price-pipeline-fix.md)   | 2026-04-15 | ✅ phase 1 完工 | 修 cron timeout (maxDuration=60) + RSS 3 條 query + backfill CLI；Phase 2 weekly + observability；Phase 3 AB test Gemini/Perplexity/Anthropic |
| [2026-04-15-no-gemini-data-scraping](./2026-04-15-no-gemini-data-scraping.md)       | 2026-04-15 | ✅ 決議         | Gemini 不做資料蒐集，只做用戶盲點審查 + multi-LLM 反駁；GEMINI.md slim 到 90 行對齊                                                           |

## 架構

| Decision                                                                          | 日期       | 狀態                   | 摘要                                                                                                                        |
| --------------------------------------------------------------------------------- | ---------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [2026-04-15-knowledge-api-blob-not-vm](./2026-04-15-knowledge-api-blob-not-vm.md) | 2026-04-15 | 🟡 設計完成 (v2 brief) | 知識庫搬 Vercel Blob（不 VM）+ 直連 Blob read + `/api/knowledge/update` write + manifest 原子切版 + dev local JSON fallback |

## Multi-LLM 協作

| Decision                                                                              | 日期       | 狀態        | 摘要                                                                            |
| ------------------------------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------------------------------- |
| [2026-04-15-gemini-role-blind-spot-only](./2026-04-15-gemini-role-blind-spot-only.md) | 2026-04-15 | ✅ 決議     | Gemini 角色 = 用戶盲點審查員 + multi-LLM 反駁者。不做資料蒐集。不建議架構遷移。 |
| [2026-04-15-bridge-auth-token-split](./2026-04-15-bridge-auth-token-split.md)         | 2026-04-15 | ✅ 實作完成 | VM Agent Bridge prod/preview token 拆開，避免 preview 分支拿 prod token         |

## 產品功能

| Decision                                                                          | 日期       | 狀態        | 摘要                                                                                         |
| --------------------------------------------------------------------------------- | ---------- | ----------- | -------------------------------------------------------------------------------------------- |
| [2026-04-15-news-vs-events-separation](./2026-04-15-news-vs-events-separation.md) | 2026-04-15 | ✅ 實作完成 | News/Events UI 完全分離，discriminator 用 `recordType`（不用 `type` 避免與 event.type 衝突） |

## 待歸檔（TODO）

以下主題曾討論，但還沒有正式 decision 文件：

- 三層選股模型（量化 40% + 事件 30% + 大腦驗證 30%）— 見 `docs/stock-selection-strategy.md`
- Multi-portfolio event tracking design — 見 `docs/specs/2026-03-23-multi-portfolio-event-tracking-design.md`
- Coverage and workflow integration — 見 `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md`

## 開新討論前必做

1. **Ctrl+F 這份 index**：你要討論的主題有沒有已存在的 decision？
2. 有 → 讀那份 decision，決定是「遵循」還是「要推翻」（推翻要新寫文件）
3. 沒有 → 可以開新討論
