# Decision Log 索引

**最後更新**：2026-04-25

**用途**：防止每次 session 重開舊討論。凡多 LLM 討論過 + 用戶拍板的主題，應先從這份索引找。

**規則**：

- 開新討論前先搜這份索引。
- 已有 decision 就優先遵循；若要推翻，必須新寫 decision 檔明示原因。
- 歷史背景若已移到 `docs/archive/2026-Q2/`，只作考古，不作 current truth。

## 資料 Pipeline

| Decision                                                                                | 日期       | 狀態                | 摘要                                                                                                                           |
| --------------------------------------------------------------------------------------- | ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [2026-03-25-targets-freshness](./2026-03-25-targets-freshness.md)                       | 2026-03-25 | ✅ 決議             | 目標價 freshness 7/30 天、fundamentals 用 entry.updatedAt、shared date parser 支援 YYYY/MM + ISO                               |
| [2026-04-16-target-price-scraping-source](./2026-04-16-target-price-scraping-source.md) | 2026-04-16 | 🚫 per-firm blocked | 合併 3/23 與 4/15 歷史脈絡後的正式結論：public per-firm source 不成立；aggregate fallback 由 CMoney phase 3 / cnyes 類來源承接 |
| [2026-04-16-cmoney-notes-as-phase3](./2026-04-16-cmoney-notes-as-phase3.md)             | 2026-04-16 | ✅ 實作完成         | CMoney `notes/?tag=78570` 進 target-price Phase 3：單券商抽 firm-level， 多券商保留 aggregate fallback                         |
| [2026-04-15-gemini-role-blind-spot-only](./2026-04-15-gemini-role-blind-spot-only.md)   | 2026-04-15 | ✅ 決議             | Gemini 角色 = blind-spot only；不做資料蒐集，只做用戶盲點審查 + multi-LLM 反駁                                                 |

## 架構

| Decision                                                                          | 日期       | 狀態                        | 摘要                                                                                                                                        |
| --------------------------------------------------------------------------------- | ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [2026-04-15-knowledge-api-blob-not-vm](./2026-04-15-knowledge-api-blob-not-vm.md) | 2026-04-15 | ⚰️ SUPERSEDED by 2026-04-25 | 知識庫搬 Vercel Blob（不 VM）+ 直連 Blob read + `/api/knowledge/update` write — **2026-04-25 因目標函數改為 single-cloud sovereignty 推翻** |
| [2026-04-18-appshell-state-ownership](./2026-04-18-appshell-state-ownership.md)   | 2026-04-18 | ✅ 決議                     | AppShell vs route-shell 的 state owner map、current/target/migration state machine、以及 cutover trigger 被正式寫死                         |
| [2026-04-25-vercel-full-decoupling](./2026-04-25-vercel-full-decoupling.md)       | 2026-04-25 | 🟡 Phase 0 進行中           | **全棄 Vercel** 拉到 VM 自有 stack（hosting / Blob / cron / runtime env 全搬 GCP）· 採 Codex 2a 6-phase 順序 · 推翻 04-15 / 04-16 兩份      |

## Multi-LLM 協作

| Decision                                                                              | 日期       | 狀態        | 摘要                                                                                                 |
| ------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| [2026-04-15-gemini-role-blind-spot-only](./2026-04-15-gemini-role-blind-spot-only.md) | 2026-04-15 | ✅ 決議     | Gemini 角色 = 用戶盲點審查員 + multi-LLM 反駁者。不做資料蒐集。不建議架構遷移。                      |
| [2026-04-15-bridge-auth-token-split](./2026-04-15-bridge-auth-token-split.md)         | 2026-04-15 | ✅ 實作完成 | VM Agent Bridge prod/preview token 拆開，避免 preview 分支拿 prod token                              |
| [2026-04-24-runtime-status-file-policy](./2026-04-24-runtime-status-file-policy.md)   | 2026-04-24 | ✅ 決議     | `ai-activity*` / `data-coverage-*` / bridge `tasks.json` 保留 local runtime 用途，但退出 git history |

## 產品策略

| Decision                                                                                        | 日期       | 狀態                        | 摘要                                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | ---------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [2026-04-16-product-stage-stability-first](./2026-04-16-product-stage-stability-first.md)       | 2026-04-16 | ✅ 決議                     | 當前階段 prototype → internal beta。先穩定再談錢。VM/Vercel 照用不優化成本。Stripe/multi-tenant 延後。UX / 呈現層優先於 infra                 |
| [2026-04-16-vm-maximization-roadmap](./2026-04-16-vm-maximization-roadmap.md)                   | 2026-04-16 | ⚰️ SUPERSEDED by 2026-04-25 | 能搬 VM 就搬：5 個 cron + analyst-reports + research job queue。Vercel 只留 CDN + 輕量 API — **2026-04-25 升級為「全棄 Vercel」**             |
| [2026-04-16-naming-portfolio-vs-agent-bridge](./2026-04-16-naming-portfolio-vs-agent-bridge.md) | 2026-04-16 | ✅ 決議                     | 持倉看板（Vercel 產品）vs Agent Bridge（VM LLM 面板）名稱統一，禁用 dashboard 單字                                                            |
| [2026-04-16-vm-migration-url-plan](./2026-04-16-vm-migration-url-plan.md)                       | 2026-04-16 | ✅ 決議                     | 穩了再買 domain：先 sslip.io 撐遷移期，VM ship 無回退 7 天 + atomic deploy 2 次成功 → 買 `.com` 走 Cloudflare                                 |
| [2026-04-16-product-gap-and-arch-direction](./2026-04-16-product-gap-and-arch-direction.md)     | 2026-04-16 | ✅ 決議                     | 產品化 gap 共識（距離 2-4 個月）+ 長期架構：Vercel=純 web server / VM=純 backend。cnyes aggregate fallback 工時 4-6h                          |
| [2026-04-24-r120-scope-batch](./2026-04-24-r120-scope-batch.md)                                 | 2026-04-24 | ✅ 決議                     | R119 executability 抽出 15 題一次拍板：contract strict、freshness 7/30/1d、signed URL 15m、hard-block、Morning Note 08:30、Q-I1 維持不 rotate |

## 產品功能

| Decision                                                                          | 日期       | 狀態        | 摘要                                                                                                                                 |
| --------------------------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [2026-04-15-news-vs-events-separation](./2026-04-15-news-vs-events-separation.md) | 2026-04-15 | ✅ 實作完成 | News/Events UI 完全分離，discriminator 用 `recordType`（不用 `type` 避免與 event.type 衝突）                                         |
| [2026-04-11-staged-daily-analysis](./2026-04-11-staged-daily-analysis.md)         | 2026-04-11 | ✅ 決議     | 2026-04-11 staged-daily analysis 成為正式 runtime contract：`T0 收盤快版`、`T1 資料確認版`、inline diff、cooldown-gated auto confirm |
| [2026-04-24-mobile-sticky-policy](./2026-04-24-mobile-sticky-policy.md)           | 2026-04-24 | ✅ 決議     | Mobile（≤768px）只允許 `app-shell` 的 title + tabs sticky；其他 panel 預設隨滾動；例外需實機截圖 + 工時實測 + 拍板                   |

## 待歸檔（TODO）

以下主題曾討論，但還沒有正式 decision 文件：

- 三層選股模型（量化 40% + 事件 30% + 大腦驗證 30%）— 歷史脈絡見 `docs/archive/2026-Q2/root-history/stock-selection-strategy.md`
- Multi-portfolio event tracking design — 歷史脈絡見 `docs/archive/2026-Q2/spec-history/2026-03-23-multi-portfolio-event-tracking-design.md`
- Coverage and workflow integration — 歷史脈絡見 `docs/archive/2026-Q2/spec-history/2026-03-28-coverage-and-workflow-integration-design.md`

## 開新討論前必做

1. **Ctrl+F 這份 index**：你要討論的主題有沒有已存在的 decision？
2. 有 → 讀那份 decision，決定是「遵循」還是「要推翻」（推翻要新寫文件）
3. 沒有 → 可以開新討論
