# VM 最大化利用 Roadmap

**日期**：2026-04-16
**用戶指示**：

> 「vm 可以就用吧，你先不用擔心費用」
> 「記得把能妥善利用 vm 的地方都利用上去，不然 vercel 太容易讓專案出錯」

**本輪 session 實測 Vercel 痛點**：

- ignoreCommand shallow clone bug（commit 68ed3cd 才修）
- ignoreCommand v1 被 revert 兩次
- Vercel env 需手動 add
- news-feed 502（commit f18659b 才修）
- cron maxDuration 60s 不夠（target-price timeout）
- Gemini free tier 20 req/day（Vercel 側跑撞到）

Vercel flakiness 確實多。**能搬 VM 就搬**。

## 職責分工（未來目標狀態）

### VM = 重活 + 資料整合 + 長任務 + LLM orchestration

- ✅ 所有 cron job（7 個）
- ✅ 所有 AI extract / grounding（analyst-reports / research）
- ✅ LLM CLI runtime（infra-03）
- ✅ 外部資料爬蟲 / API 轉接（MOPS / TWSE / CMoney / 央行）
- ✅ FinMind SQLite cache
- ✅ Agent Bridge dashboard
- ✅ Future: Vector DB / RAG / WebSocket 盤中推送

### Vercel = 前端 CDN + 輕量 API + Auth

- ✅ React 持倉看板 (static CDN hosting)
- ✅ 輕量 read-only API（/api/target-prices、/api/news-feed 改當 VM proxy）
- ✅ 未來：Stripe webhook / OAuth 流程
- ❌ 不跑 AI / 不跑爬蟲 / 不跑長任務

## 工作清單（搬 / 新建，按優先序）

## 例外

Knowledge API 仍留 Blob，見 [`2026-04-15-knowledge-api-blob-not-vm.md`](./2026-04-15-knowledge-api-blob-not-vm.md)。VM 最大化不是全搬；read-heavy、write-rarely 的知識檔分發仍遵循 2026-04-15 決議。

### P0（本週要搬）

| #   | 工作                      | 目前位置                            | 搬到                            | 解的痛                                |
| --- | ------------------------- | ----------------------------------- | ------------------------------- | ------------------------------------- |
| 1   | `analyst-reports` worker  | `api/analyst-reports.js` Vercel     | VM node worker                  | Vercel 60s timeout / Gemini quota     |
| 2   | `research-deep` job queue | `api/research.js` Vercel            | Vercel submit → VM worker → SSE | Vercel 300s timeout                   |
| 3   | `target-price-cron`       | `api/cron/collect-target-prices.js` | VM cron（systemd timer）        | cron rate limit / ignoreCommand flaky |
| 4   | `news-collect-cron`       | `api/cron/collect-news.js`          | VM cron                         | 同上                                  |
| 5   | `events-calendar-cron`    | `api/cron/collect-daily-events.js`  | VM cron                         | 同上                                  |

### P1（下週）

| #   | 工作                                    | 內容                                                    |
| --- | --------------------------------------- | ------------------------------------------------------- |
| 6   | infra-03 LLM CLI on VM                  | Codex / Qwen / Gemini CLI 裝 VM、systemd、canonical log |
| 7   | 新資料源（MOPS / TWSE / 央行 / 財政部） | 官方合規來源，VM cron 抓，結果寫 Blob                   |
| 8   | FinMind SQLite cache on VM              | 每日 sync、前端 fallback VM API 讀                      |

### P2（月內）

| #   | 工作                   | 內容                                          |
| --- | ---------------------- | --------------------------------------------- |
| 9   | Vector DB + RAG        | pg-vector 裝 VM，research artifacts embedding |
| 10  | WebSocket 盤中推送     | TWSE → VM → 前端 SSE                          |
| 11  | Watchdog + Line Notify | VM health check，異常推 Line                  |

## 搬的架構原則（Codex 反駁過的）

1. **Vercel 不直連 VM** — 經「submit jobId → poll / SSE」，VM down 時 Vercel 可 fallback
2. **VM 寫 Blob，Vercel 讀 Blob** — 維持既有 data flow，不 tightly couple
3. **VM 是 canonical，Mac 只 viewer** — 避免 dispatch 歷史分裂
4. **Secret 放 VM keychain / root-only systemd env** — 絕不 repo / .env

## 我會做什麼（Claude）

作為架構師：

1. 每個 P0 task 先寫 implementation brief
2. 派 Codex 執行
3. Review + 驗收
4. 不動 production code

## 當前進度

- ⏳ Codex ship VM dashboard v2 背景中（`bptarcpsj`）
- ✅ 財經資料盤點 done
- ✅ VM Round 1 Codex + Gemini done（Qwen 明日補）
- 🎯 **下一步**：VM dashboard ship 完 → P0 #1 `analyst-reports` 搬 VM
