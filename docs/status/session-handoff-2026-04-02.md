# Session 交接文件 — 2026-04-02

## 本 session 完成的事

### 資料層（已驗證可用）

- supplyChain.json: 8→20 entries（全部持股覆蓋）
- themes.json: 12→14 主題，stock arrays 全部填滿
- themeClassification.json: per-holding 主題+供應鏈位置
- seedData.js STOCK_META: themes 全部更新
- FinMind 4 小時 localStorage 快取（解決 637 次/hr 超限）
- docs/finmind-api-reference.md: 90 datasets 完整參考
- docs/deployment-and-api-strategy.md: Vercel + Claude API 成本策略

### API 層（已驗證可用）

- /api/analyze: 非 streaming 模式在本地可用，20-40 秒回結果
- /api/event-calendar: FinMind 直接呼叫外部 API（不再 self-request deadlock）
- /api/twse: 正常
- /api/finmind: 正常（需要 .env 裡有 FINMIND_TOKEN）

### 前端（已驗證可用）

- 所有 9 個頁面載入正常（移除了全部 lazy loading）
- analyzeRequest.js: 本地自動跳過 streaming
- stripDailyAnalysisEmbeddedBlocks: regex 放寬

### 基礎設施

- GitHub SSH + PAT 設好
- Vercel Ignored Build Step = exit 0（push 不自動 build）
- Vercel Build Machine = Standard（待確認）
- Telegram 通知腳本 scripts/notify-handoff.sh

---

## 目前各頁面狀態

### ✅ 持倉（Holdings）

- 顯示 17 檔持股 + 即時報價
- 有主題 chips 和 competitors
- 供應鏈視覺化元件（SupplyChainView）已建但未接入

### ✅ 收盤分析（Daily Report）

- 能跑出完整中文分析
- **問題：** BRAIN_UPDATE JSON 偶爾沒被 strip（regex 依賴 AI 輸出格式一致）
- **問題：** 非 streaming 模式要等 20-40 秒，沒有進度提示很像「沒反應」

### ⚠️ 深度研究（Research）

- 按鈕有接線，會呼叫 /api/research
- **問題：** vercel dev 的 function timeout 只有 30s，research 需要 40-60s → 超時
- **解法：** 只能在 production（60s limit）或改 research 為 streaming

### ✅ 行事曆（Events）

- 固定事件（FOMC、月營收、財報季、央行）
- Gemini 靜態事件（法說會、股東會）
- FinMind 新聞事件（付費後有資料）
- **問題：** FinMind 新聞沒有「法說會日期」，只有一般新聞報導

### ⚠️ 觀察股（Watchlist）

- 功能正常但可能沒有數據

### ⚠️ 交易上傳（Trade）

- OCR 功能正常（正常圖片可辨識）
- **問題：** 異常圖片返回 500 而非 graceful error

### ⚠️ 策略大腦（Brain）

- 收盤分析會產出 BRAIN_UPDATE
- 但 extractDailyBrainUpdate 解析依賴 AI 輸出格式一致
- brain proposal gate/eval 已建好但未完整測試

### ❓ 新聞（News）

- 有 Google News RSS + Gemini research browser
- 未完整測試

### ❓ 交易紀錄（Log）

- 功能應該正常，未測試

---

## 未解決的問題（優先級排序）

### P0 — 影響核心使用

1. **BRAIN_UPDATE JSON 顯示在分析結果底部** — regex strip 不夠穩健
2. **深度研究在本地超時** — vercel dev 30s limit vs research 需要 60s
3. **知識庫 600 條是否有被注入分析 prompt** — 需要驗證

### P1 — 影響使用體驗

4. **收盤分析等待時間太長沒提示** — 非 streaming 模式沒有進度 UI
5. **FinMind 付費功能是否全面發揮** — 三大法人、財報三表是否有出現在分析中
6. **event-calendar FinMind 新聞 0 筆** — token 在 .env 但 vercel dev 可能沒讀到

### P2 — 新功能

7. **OpenClaw Telegram bot 自動回覆** — 需要用戶 `openclaw onboard` 重新登入 OpenAI
8. **多用戶支援** — 認證系統、資料庫、資料隔離
9. **streaming 在 production** — 已建好但本地無法測試

---

## 給下一個 session 的 Claude

1. **先讀這份文件 + CLAUDE.md + current-work.md**
2. **不要再一個一個修 bug** — 用 systematic-debugging skill
3. **本地測試用 `vercel dev`，但注意它有 30s function timeout**
4. **push 前確認 .env 沒有 secrets**（之前 Telegram token 洩露過）
5. **FINMIND_TOKEN 必須在 .env（不是 .env.local）才能被 vercel dev 的 serverless function 讀到**
6. **Vercel 額度管控：不要頻繁 push，Ignored Build Step 已設 exit 0**

## 啟動 vercel dev 的指令

```bash
source ~/.nvm/nvm.sh && nvm use 24
pkill -f "vercel dev" 2>/dev/null
nohup npx vercel dev --listen 0.0.0.0:3002 > /tmp/vercel-dev.log 2>&1 &
# 等 5 秒後訪問 http://localhost:3002
```
