# Decision Log 索引

**最後更新**：2026-04-18

- 2026-04-18 · Round 97-98c · 40+ 檔深讀 + 9 blocker 收斂 + RBAC B6 獨立確認 → `docs/product/portfolio-dashboard-spec.md#round-98c`

## 資料 Pipeline

| Decision                                                                                | 日期       | 狀態            | 摘要                                                                                                                                          |
| --------------------------------------------------------------------------------------- | ---------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [2026-03-23-target-collection-strategy](./2026-03-23-target-collection-strategy.md)     | 2026-03-23 | ✅ 決議         | 目標價採全域 per-stock cache + 硬 fallback chain + 權證 map 標的股 + async/segmented batch 避免 Vercel timeout                                |
| [2026-03-25-targets-freshness](./2026-03-25-targets-freshness.md)                       | 2026-03-25 | ✅ 決議         | 目標價 freshness 7/30 天、fundamentals 用 entry.updatedAt、shared date parser 支援 YYYY/MM + ISO                                              |
| [2026-04-15-target-price-pipeline-fix](./2026-04-15-target-price-pipeline-fix.md)       | 2026-04-15 | ✅ phase 1 完工 | 修 cron timeout (maxDuration=60) + RSS 3 條 query + backfill CLI；Phase 2 weekly + observability；Phase 3 AB test Gemini/Perplexity/Anthropic |
| [2026-04-16-target-price-scraping-source](./2026-04-16-target-price-scraping-source.md) | 2026-04-16 | 🚫 blocked      | Goodinfo 路徑失效、Yahoo 對 AI bot 明文禁止、cnyes 只公開 aggregate consensus，無法達成 per-firm target 明細抓取                              |
| [2026-04-16-cmoney-notes-as-phase3](./2026-04-16-cmoney-notes-as-phase3.md)             | 2026-04-16 | ✅ 實作完成     | CMoney `notes/?tag=78570` 進 target-price Phase 3：單券商抽 firm-level， 多券商保留 aggregate fallback                                        |
| [2026-04-15-gemini-role-blind-spot-only](./2026-04-15-gemini-role-blind-spot-only.md)   | 2026-04-15 | ✅ 決議         | Gemini 角色 = blind-spot only；不做資料蒐集，只做用戶盲點審查 + multi-LLM 反駁                                                                |

## 架構

| Decision                                                                          | 日期       | 狀態                   | 摘要                                                                                                                        |
| --------------------------------------------------------------------------------- | ---------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [2026-04-15-knowledge-api-blob-not-vm](./2026-04-15-knowledge-api-blob-not-vm.md) | 2026-04-15 | 🟡 設計完成 (v2 brief) | 知識庫搬 Vercel Blob（不 VM）+ 直連 Blob read + `/api/knowledge/update` write + manifest 原子切版 + dev local JSON fallback |
| [2026-04-18-appshell-state-ownership](./2026-04-18-appshell-state-ownership.md)   | 2026-04-18 | ✅ 決議                | AppShell vs route-shell 的 state owner map、current/target/migration state machine、以及 cutover trigger 被正式寫死         |

## Multi-LLM 協作

| Decision                                                                              | 日期       | 狀態        | 摘要                                                                            |
| ------------------------------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------------------------------- |
| [2026-04-15-gemini-role-blind-spot-only](./2026-04-15-gemini-role-blind-spot-only.md) | 2026-04-15 | ✅ 決議     | Gemini 角色 = 用戶盲點審查員 + multi-LLM 反駁者。不做資料蒐集。不建議架構遷移。 |
| [2026-04-15-bridge-auth-token-split](./2026-04-15-bridge-auth-token-split.md)         | 2026-04-15 | ✅ 實作完成 | VM Agent Bridge prod/preview token 拆開，避免 preview 分支拿 prod token         |

## 產品策略

| Decision                                                                                        | 日期       | 狀態      | 摘要                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [2026-04-16-product-stage-stability-first](./2026-04-16-product-stage-stability-first.md)       | 2026-04-16 | ✅ 決議   | 當前階段 prototype → internal beta。先穩定再談錢。VM/Vercel 照用不優化成本。Stripe/multi-tenant 延後。UX / 呈現層優先於 infra |
| [2026-04-16-vm-maximization-roadmap](./2026-04-16-vm-maximization-roadmap.md)                   | 2026-04-16 | 🟡 執行中 | 能搬 VM 就搬：5 個 cron + analyst-reports + research job queue。Vercel 只留 CDN + 輕量 API。11 項 P0/P1/P2 清單               |
| [2026-04-16-naming-portfolio-vs-agent-bridge](./2026-04-16-naming-portfolio-vs-agent-bridge.md) | 2026-04-16 | ✅ 決議   | 持倉看板（Vercel 產品）vs Agent Bridge（VM LLM 面板）名稱統一，禁用 dashboard 單字                                            |
| [2026-04-16-vm-migration-url-plan](./2026-04-16-vm-migration-url-plan.md)                       | 2026-04-16 | ✅ 決議   | 穩了再買 domain：先 sslip.io 撐遷移期，VM ship 無回退 7 天 + atomic deploy 2 次成功 → 買 `.com` 走 Cloudflare                 |
| [2026-04-16-product-gap-and-arch-direction](./2026-04-16-product-gap-and-arch-direction.md)     | 2026-04-16 | ✅ 決議   | 產品化 gap 共識（距離 2-4 個月）+ 長期架構：Vercel=純 web server / VM=純 backend。cnyes aggregate fallback 工時 4-6h          |

## 產品功能

| Decision                                                                          | 日期       | 狀態        | 摘要                                                                                                                                 |
| --------------------------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [2026-04-15-news-vs-events-separation](./2026-04-15-news-vs-events-separation.md) | 2026-04-15 | ✅ 實作完成 | News/Events UI 完全分離，discriminator 用 `recordType`（不用 `type` 避免與 event.type 衝突）                                         |
| [2026-04-11-staged-daily-analysis](./2026-04-11-staged-daily-analysis.md)         | 2026-04-11 | ✅ 決議     | 2026-04-11 staged-daily analysis 成為正式 runtime contract：`T0 收盤快版`、`T1 資料確認版`、inline diff、cooldown-gated auto confirm |

## 待歸檔（TODO）

以下主題曾討論，但還沒有正式 decision 文件：

- 三層選股模型（量化 40% + 事件 30% + 大腦驗證 30%）— 見 `docs/stock-selection-strategy.md`
- Multi-portfolio event tracking design — 見 `docs/specs/2026-03-23-multi-portfolio-event-tracking-design.md`
- Coverage and workflow integration — 見 `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md`

## 開新討論前必做

1. **Ctrl+F 這份 index**：你要討論的主題有沒有已存在的 decision？
2. 有 → 讀那份 decision，決定是「遵循」還是「要推翻」（推翻要新寫文件）
3. 沒有 → 可以開新討論
