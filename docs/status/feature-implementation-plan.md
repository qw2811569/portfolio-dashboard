> ⚠️ **SUPERSEDED · 2026-04-18** · 此檔為歷史參考 · 最新狀態請見 `docs/status/current-work.md` + `docs/plans/2026-03-*`
>
> 保留理由：被 `docs/product/portfolio-dashboard-spec.md` / 其他 spec 引用為歷史證據，刪除會斷脈絡。

---

# Feature Implementation Plan — 2026-04-03

## 目標

把專案設計的所有功能真正實現到可用狀態。依影響排序，分三批執行。

---

## Batch 1：核心管線修復（最高優先）

### 1A. News/Analysis Panel 修復

- **問題**：NewsPanel.jsx 顯示的是交易日誌內容，不是新聞/事件分析
- **位置**：src/components/news/NewsPanel.jsx
- **修法**：
  - 顯示 auto-calendar 事件（from useAutoEventCalendar）
  - 顯示 FinMind 新聞（from finmindAdapter fetchStockNews）
  - 顯示 Gemini 蒐集的產業新聞（from docs/gemini-research/news-\*.json）
  - 每則新聞標記 impact（positive/negative/neutral）和 source
- **驗證**：打開事件分析 tab，應看到近期新聞列表而非交易日誌

### 1B. Cron Event Collection 實作

- **問題**：api/cron/collect-daily-events.js 在架構文件中定義但不存在
- **位置**：api/cron/collect-daily-events.js（新建）
- **修法**：
  - 建立 Vercel Cron endpoint（已在 vercel.json 設定 schedule）
  - 蒐集所有事件來源（固定行事曆 + FinMind 新聞 + Gemini fallback）
  - 存到 Vercel Blob 供前端讀取
  - 加 CRON_SECRET 驗證
- **驗證**：POST /api/cron/collect-daily-events 回 200 且產出事件 JSON

### 1C. Knowledge Evolution 回饋迴路

- **問題**：知識庫有 600 條規則但 confidence 不會根據實際使用結果調整
- **位置**：src/lib/knowledgeEvolutionRuntime.js
- **修法**：
  - 讀取 localStorage 的 kb-usage-log 和 kb-feedback-log
  - 計算每條規則的使用頻率和正面/負面回饋比
  - 自動調整 confidence（正面回饋多 → 提升，負面 → 降低）
  - 產出 evolution proposal 供審查
- **驗證**：模擬回饋資料後，confidence 有變化

---

## Batch 2：分析品質提升

### 2A. Brain Rule Validation — 台股訊號檢查

- **問題**：策略大腦規則驗證完全依賴 AI prompt，沒有結構化資料支撐
- **位置**：src/lib/dailyAnalysisRuntime.js, src/lib/brainRuntime.js
- **修法**：
  - 在收盤分析前，從 FinMind 抓取四類台股訊號：
    1. 月營收節奏（最新月營收 vs 去年同期）
    2. 事件窗口（近 7 天有無法說/財報/除權息）
    3. 目標價新鮮度（最後更新距今天數）
    4. 三大法人動向（近 5 日外資/投信/自營商買賣超）
  - 這些訊號結構化注入 prompt，不再只靠 AI 猜
- **驗證**：收盤分析 prompt 中包含具體數字（如「外資近5日買超 1234 張」）

### 2B. Historical Analogs 歷史類比

- **問題**：Brain rule 有 historicalAnalogs 欄位但從未被填充
- **位置**：src/lib/brainRuntime.js
- **修法**：
  - 從 strategy-cases.json（120 個歷史案例）中匹配當前持股情境
  - 比對條件：同產業、類似事件類型、類似市場環境
  - 自動填入 historicalAnalogs 供 AI 參考
- **驗證**：收盤分析結果中出現「類似歷史案例：...」

---

## Batch 3：使用者體驗完善

### 3A. Trade Screenshot OCR 整合

- **問題**：api/parse.js 有 placeholder 但沒接真正的 Claude Vision
- **位置**：api/parse.js
- **修法**：
  - 接入 Claude Vision API 做截圖解析
  - 抽取：股票代碼、買賣方向、價格、數量、時間
  - 回傳結構化 JSON 供前端填入交易表單
- **驗證**：上傳一張成交截圖，正確解析出交易資訊

### 3B. Target Price 自動更新

- **問題**：交易截圖解析後不會自動更新目標價
- **位置**：src/hooks/useTradeCaptureRuntime.js
- **修法**：OCR 結果如果包含目標價資訊，自動更新到 targets
- **驗證**：上傳含目標價的截圖，targets 自動更新

---

## 執行方式

每批：

1. Claude 寫詳細 spec → 派 Codex 實作
2. Codex 完成 → 派 Qwen QA 驗證
3. 有問題 → Codex 修 → Qwen 再驗
4. 全過 → 下一批

最後跑 auto-loop 做全面回歸測試。
