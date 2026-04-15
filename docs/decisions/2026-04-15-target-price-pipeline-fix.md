# Target Price Pipeline 修復（Phase 1 + 計畫）

**日期**：2026-04-15
**參與者**：Claude + Codex（5 人格辯論）
**源頭**：`.tmp/target-price-pipeline-redesign/`

## 發現的 bugs

1. **Cron 每次 timeout**：`vercel.json` 沒給 target-price cron 特別 maxDuration，吃預設 `api/*.js = 10s`。11 檔 × sleep 2.5s = 27.5s 根本跑不完
2. **RSS query 過嚴**：9 個 keyword AND 連在一起（`<code> <name> 台股 目標價 投顧 研究報告 法說 財報 when:30d`），小型股命中率 0
3. **Blob 從未寫入成功**：因為 (1) 每次 cron 被 kill，Blob 永遠空
4. **UI 把 ETF / 權證 也算進「缺資料」警告**（該跟 cron skip list 對齊）

## Phase 1 修復（2026-04-15 完工）

1. `vercel.json` target-price cron `maxDuration: 60`
2. Cron sleep `2500ms → 250ms`
3. RSS 拆 3 條 query merge（`目標價`、`投顧`、`研究報告`）by url/hash dedupe
4. `scripts/backfill-target-prices.mjs` 一次性 backfill CLI
5. `src/lib/instrumentTypes.js` 共用 skip list（UI + cron）— ETF 警告從 14 → 10

## Phase 2 計畫（1 週內）

- 週更主排程 + 手動 refresh
- 每檔 per-stock status（success/fail/reason）
- Partial success visible
- UI 只顯示有券商 + 日期 + 信心的 target
- **Warrant → underlying 的 map**（落實 2026-03-23 P0.3）
- 連跑 5 天成功率 >90% 為成功標準

## Phase 3 計畫（1 月內）

- 搜尋 / 抽取拆層
- AB test 三家 AI provider：
  - **Anthropic Claude web_search**（$8-18/月）
  - **Perplexity Sonar**（$2.6/月）
  - **Gemini 2.5 Flash grounding**（500 RPD 免費 → ~$0/月）
- Provider fallback
- 若 Vercel 任務仍脆弱 → 搬 VM 長任務
- 成功標準：覆蓋率 >85%、月成本 <$5

## 供應商比較（5 人格辯論找出）

| Provider                       | 成本 / 月 (450 calls)  | 注意                         |
| ------------------------------ | ---------------------- | ---------------------------- |
| Anthropic Claude + web_search  | $8-18                  | 整合最簡單，但最貴           |
| Perplexity Sonar               | $2.6                   | 專做 web-grounded            |
| **Gemini 2.5 Flash grounding** | **~$0** (500 RPD 免費) | 最便宜，用量完全在 free tier |

## 決議

- Phase 1 band-aid 跑穩 → Phase 2 observability → Phase 3 換 provider
- **不先換 provider**，現有 pipeline 先活起來

## 一句話結論

> 先把 cron 跑活並做一次 backfill；跑穩後再用 Gemini 或 Perplexity 取代現有 AI extract。

## 2026-04-15 Phase 2 實測結果

- Prompt tuning + target-aware ranking + false-positive 過濾完成（commit a92311c）
- **覆蓋率仍 4/11**（2489 瑞軒從 false-positive 42.9 掉到 0，3167 大量補回真 target 319）
- **根因確認**：7/11 小型股 RSS 新聞**本身沒有明確 target price 文字**，prompt tuning 天花板到此
- 要 ≥8/11 必須進 **Phase 3**：換更強 grounding 的 provider（Gemini 2.5 Flash）或擴大資料源（Yahoo 股市 / CMoney 頁面），不能再調 prompt

## 2026-04-16 Phase 3 status

- ✅ 新增 `api/cmoney-notes.js`
- ✅ `analyst-reports` fallback 擴成 `Gemini → RSS → CMoney → per-band`
- ✅ 同 firm 衝突改成保留最新 date
- ✅ 補 parser / handler tests
- ⏸️ 尚未加 cron / 尚未 prod ship
