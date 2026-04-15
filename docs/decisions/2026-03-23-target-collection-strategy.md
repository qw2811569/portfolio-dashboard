# Target Collection Strategy（目標價蒐集策略）

**日期**：2026-03-23
**參與者**：Codex + Qwen + Gemini + Claude
**源頭**：`.tmp/target-collection-strategy/consensus.md`

## P0 決議（已實作狀態標註）

1. **全域 per-stock cache**，不是 per-user 跑 → ✅ 實作 (Vercel Blob)
2. **Hard fallback chain**：broker → system estimate (PER-band)，不留 blank → ✅ 實作
3. **權證不直接 RSS 查**，該 map 到標的股 → ⚠️ 只 skip 沒 map（Phase 2 補）
4. **Async/segmented batch**，避免 Vercel timeout → ❌ 未實作（2026-04-15 phase 1 band-aid 用 maxDuration=60 暫解，真正 async 排進 Phase 2）

## P1 決議

- Freshness 狀態 + UI 標籤（broker consensus vs 系統估算）
- 萃取 safeguard：價格範圍驗證、券商名驗證、離群值過濾 / 中位數
- AI 萃取只跑 high-value 股票，低覆蓋率跳過

## P2

- 規則 / regex 預過濾，降 token 成本
- UI 翻譯成 upside % + 便宜/貴 indicator

## 不同意見（歷史）

- **Staleness cutoff**：Codex 45d / Qwen 7-30d / Gemini 30-90d → 後續在 `2026-03-25-targets-freshness.md` 以 Qwen 方案 (7/30) 定案
- **Warrant handling**：只 skip vs map underlying vs auto-map → 目前 skip，Phase 2 補 map
- **Scale control**：cap 80-120 stocks vs queue fan-out → 目前沒 cap，用量小暫不需

## 實作備忘

- Cron: `api/cron/collect-target-prices.js`
- Read API: `api/target-prices.js`
- Source: `api/analyst-reports.js` (RSS + AI extract)
- Blob key: `target-prices/<code>.json`
