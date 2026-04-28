# Current Work

Last updated: 2026-04-28 19:50 (R32 docs cleanup truncation)

> **Note**：歷史 checkpoint（pre-2026-04-27 · 546 行）已歸檔到
> [`docs/archive/2026-Q2/status-history/current-work-history-pre-2026-04-27.md`](../archive/2026-Q2/status-history/current-work-history-pre-2026-04-27.md)
> · 本檔只保留近 30 entries · per `docs/decisions/2026-04-24-runtime-status-file-policy.md`

## Management preferences

- 對使用者回報請用白話，少用 coding 術語。
- 回報重點聚焦：目前目標、專案架構是否落地、流程是否順、是否還有 bug。
- 決策與整體邏輯複查由小奎 + Claude 主導，再分派給 Codex / Qwen / Gemini。
- 成本意識：Claude/API 分析昂貴，正式測試前先盡量用低成本方式把流程理順。
- 不要為了內部討論過度消耗 token，結論要短、清楚、可執行。

## Start here

- 第一入口：[`docs/NOW.md`](./NOW.md)（R32 起 · 60 行 sprint snapshot）
- 全 doc 索引：[`docs/CANONICAL-INDEX.md`](./CANONICAL-INDEX.md)
- 協作規則：[`claude.md`](../../claude.md) + [`docs/AI_COLLABORATION_GUIDE.md`](./AI_COLLABORATION_GUIDE.md)
- 開新對話必讀：see `docs/NOW.md` "How To Dispatch Agents" 段

## Latest checkpoint

- `2026-04-27 20:29` Codex：R27a pushed: 4d4b15d + 1def0f3. Claude: R27 fresh + mutual QA.
- `2026-04-27 17:53` Codex：R21a pushed 1e0f8d2 · Events mobile regression fixed: mobile buckets open by default, timeline no longer says no major events when hero has active count. Claude: R21 fresh + mutual QA.
- `2026-04-16 21:57` Qwen：Regression 6: 828/828 pass, 4 risks found (2 MED, 2 LOW)
- `2026-04-16 21:42` Qwen：Action Center QA: 5 bugs found (1 P0, 2 P1, 2 P2)
- `2026-04-16 21:39` Qwen：Round 5 regression: 812/812 pass, 3 risks identified (git timeout, sparkline perf, mobile responsive)
- `2026-04-16 21:35` Qwen：Persist live validate: 806/806 pass, bridge persist ✅, AbortController ✅, lint ✅
- `2026-04-16 21:35` Qwen：Persist live validate: 806/806 pass, bridge persist ✅, AbortController ✅, lint ✅
- `2026-04-16 20:13` Qwen：Final regression complete: 764 tests pass, build OK, lint 0 errors. Ship ready 8.5/10. Report: .tmp/regression-final/qwen-report.md
- `2026-04-16 20:09` Qwen：cnyes coverage measurement: 5/11 → 7/11 (+19%), report saved to .tmp/coverage-measure/qwen-report.md
- `2026-04-16 20:00` Qwen：TWSE Live Smoke: 4 endpoints verified (200 OK, 1.3MB+313KB+115KB), no rate limit (5/5 pass), found 5 bugs (P0: no timeout, P1: Content-Type mismatch + institutional endpoint risk, P2: no retry + date edge cases). FinMind overlap: TWSE can replace catalog/prices/valuation (60% call reduction). Report: .tmp/twse-live-smoke/qwen-report.md
- `2026-04-16 19:54` Qwen：Regression: 752/752 pass, 3 P2 issues found
- `2026-04-16 19:31` Qwen：Phase 2 落差審查完成：10 項承諾 4 項 render/2 項有感，推薦 B 方案（補內容架構）
- `2026-04-16 17:07` Qwen：localhost QA: 10 issues found, report @ .tmp/localhost-qa/qwen-report.md
- `2026-04-16 03:25` Qwen：研究完成：12 個台股資料源（含表格+推薦組合），報告存於 docs/research/taiwan-stock-data-sources-v2.md
- `2026-04-16 00:22` Qwen：Regression sweep: 716 tests pass / 0 fail. Trade fix verified. Target-price quality improved. No user-facing drift.
- `2026-04-12 04:25` Qwen：QA Round 3: FAIL — 待補資料 18 (ETFs/warrants have no FinMind fundamentals, backlog gate needs type filter). Code audit: 0 bugs in A1/A2 logic.
- `2026-04-03 17:32` Qwen：任務 G：零波動修復 + 事件計數修復，build ✅ vitest 369/369 ✅ lint ✅
- `2026-04-03 17:32` Qwen：任務 G 完成：G1 零波動修復（changePct null 處理 + UI 顯示 —）+ G2 事件計數修復（移除 >1% 嚴格過濾），build ✅ vitest 369/369 ✅ lint ✅
- `2026-04-03 17:18` Qwen：交接：任務 F 完成，請 Claude 指派新任務
- `2026-04-03 17:15` Qwen：任務 F：事件預測測試 19/19 + KB 回歸 27/27（615條）+ 全量 369/369 + build + lint 全過
- `2026-04-03 17:14` Qwen：任務 F 完成：事件預測引擎 19/19 ✅、KB 回歸 27/27（615 條）✅、全量測試 369/369 ✅、build ✅、lint ✅（0 errors）
- `2026-04-03 12:29` Codex：完成 Batch C Evolution Loop：新增 observation log、rule outcome scorer、confidence batch adjustment/evolution log，並在 daily analysis / research 完成時寫 observation；已通過 build/vitest。
- `2026-04-03 12:23` Codex：完成 Batch A Decision Layer：A1 buildKnowledgeQueryProfile + weighted knowledge retrieval；A2 新增 analysisFramework.js；A3 新增 buildColdStartDossierSummary，並逐項通過 build/vitest。
- `2026-04-03 12:17` OpenClaw：自動閉環完成：2 輪後穩定
- `2026-04-03 12:16` Codex：Round 1 修復完成
- `2026-04-03 12:15` Codex：完成歷史回測框架：新增 scripts/backtest.sh 與 src/lib/backtestRuntime.js，支援指定日期/代碼/回數、歷史 FinMind dossier、規則式分析、未來價格評估與知識回饋，並通過 build/vitest。
- `2026-04-03 12:09` Codex：緊急前端 bug 修復完成：新用戶 fallback 不再自動載入 seed holdings/targets/watchlist；/api/brain 無資料時回空預設結構避免 500；並已通過 lint 與 vitest。
- `2026-04-03 12:04` Codex：完成 Batch 3：3A /api/parse 接 Claude Vision 並回 structured OCR JSON、補具體錯誤處理；3B OCR 目標價結果自動更新 holdings targetPrice，且已通過 build/vitest。
- `2026-04-03 11:59` Codex：完成 Batch 2：2A 收盤分析 prompt 注入台股市場訊號（營收/事件窗口/目標價 freshness/法人5日）；2B 新增 historical analogs 比對並注入 prompt，且已通過 build/vitest。

---

**Pre-2026-04-27 entries**：[archive/2026-Q2/status-history/current-work-history-pre-2026-04-27.md](../archive/2026-Q2/status-history/current-work-history-pre-2026-04-27.md)（546 行 · R104-R141 sprint trail）
