# Holding Dossier 與資料更新架構設計

最後更新：2026-03-24

## 1. 背景與問題

目前 App 已經有很多有價值的資料：

- 持倉本身：股數、成本、損益、類型
- `STOCK_META`：產業、策略、持有週期、定位、龍頭/二線
- `targets-v1`：投顧 / 共識目標價
- `news-events-v1`：事件預測、追蹤、復盤
- `research-history-v1`：深度研究
- `strategyBrain`：規則、教訓、常犯錯誤、跨組合教練教訓

但目前收盤分析與深度研究在真正送進 AI 前，資料被壓得過薄，造成幾個問題：

1. 持倉端很完整，但 AI 看到的上下文過度摘要，分析有割裂感
2. 財報、投顧目標價、研究摘要沒有被系統性整理成「每檔持股的完整檔案」
3. 若之後加更多資料源，流程容易因為等待資料過久而停滯
4. 股價 API 若重複抓取太頻繁，很容易被來源擋掉

## 2. 本設計要達成的事

### 2.1 主要目標

1. 新增 `holding dossier`，把每檔持股整理成可直接給 AI 使用的完整檔案
2. 讓 `收盤分析` 與 `深度研究` 都優先吃 dossier，而不是各自拼湊零散 state
3. 建立 `stale-while-revalidate` 架構，避免資料更新卡住整段分析
4. 把股價抓取改成「每個交易日收盤後只抓一次」的硬規則
5. 建立 freshness / timeout / partial success 機制，讓資料不完整時也能繼續分析

### 2.2 非目標

- 這一版不追求即時盤中監控
- 這一版不做秒級 / 分鐘級輪詢
- 這一版不先解決所有財報與投顧資料的自動化來源問題
- 這一版不要求所有 dossier 欄位都一次補齊

## 3. 關鍵原則

### 3.1 先分析，再補資料

分析流程不可被資料刷新完全阻塞。

規則：

- 先用目前本地快取資料建立 dossier
- dossier 建好就可開始 AI 分析
- 新資料刷新在背景進行
- 若刷新成功，更新 dossier，供下一次分析使用

### 3.2 資料更新全部允許 partial success

任何資料刷新流程都必須接受：

- 有些資料成功
- 有些資料超時
- 有些資料來源失敗

即使如此，分析仍然要能完成。

### 3.3 任何資料來源都不能無限等待

每個資料來源都必須有 timeout。

建議：

- 股價 batch：`5-8 秒`
- 財報 / 月營收 / 目標價補強：`8-12 秒`
- AI 分析：`20-30 秒`

超時後應直接標記 `stale` 或 `failed`，不可卡住主流程。

### 3.4 股價只在收盤後抓一次

這是硬規則，不是建議。

根據 TWSE 官方說明，常規交易時段為 `09:00-13:30`，收盤最後撮合為 `13:25-13:30`，特殊情況可能延到 `13:33`。

因此本專案規定：

- 自動股價抓取最早只能在 `Asia/Taipei 13:35` 之後進行
- 每個交易日只允許 **一次** 自動 batch 抓取
- 不允許：
  - 啟動時反覆自動刷新
  - 切 tab 就抓
  - 切組合就抓
  - 輪詢式抓價

### 3.5 市場價格快取應是全域，不是每組合各抓一次

市場價格是全市場共享資料，不需要每個 portfolio 分開抓。

因此應新增全域價格快取，而不是依 portfolio 分別抓。

## 4. 新資料模型

### 4.1 Global Market Price Cache

新增：

- `pf-market-price-cache-v1`
- `pf-market-price-sync-v1`

用途：

- 存當日收盤後抓回來的全域價格快照
- 所有 portfolio 共用

建議結構：

```json
{
  "marketDate": "2026-03-24",
  "syncedAt": "2026-03-24T13:36:22+08:00",
  "source": "twse",
  "status": "fresh",
  "prices": {
    "3017": { "price": 1820, "yesterday": 1795, "change": 25, "changePct": 1.39 },
    "2308": { "price": 385, "yesterday": 382, "change": 3, "changePct": 0.79 }
  }
}
```

同步 metadata：

```json
{
  "marketDate": "2026-03-24",
  "syncedAt": "2026-03-24T13:36:22+08:00",
  "status": "success",
  "codes": ["2308", "3017", "3443"],
  "failedCodes": []
}
```

### 4.2 Holding Dossier

新增：

- `pf-{pid}-holding-dossiers-v1`

每檔持股一份 dossier，建議結構：

```json
{
  "code": "3017",
  "name": "奇鋐",
  "position": {
    "qty": 1000,
    "cost": 1680,
    "price": 1820,
    "value": 1820000,
    "pnl": 140000,
    "pct": 8.33,
    "type": "股票"
  },
  "meta": {
    "industry": "AI/伺服器",
    "strategy": "成長股",
    "period": "中長",
    "position": "核心",
    "leader": "龍頭"
  },
  "thesis": {
    "summary": "散熱龍頭，受惠 AI 伺服器滲透率提升",
    "holdingPeriod": "中長",
    "whyOwn": "高階散熱產品 ASP 上行",
    "exitPlan": "若 AI ASP 動能轉弱或估值過熱則減碼"
  },
  "targets": {
    "avgTarget": 2037,
    "reports": [{ "firm": "國際共識", "target": 2037, "date": "2026/03" }],
    "updatedAt": "2026/03/17",
    "freshness": "stale"
  },
  "fundamentals": {
    "revenue": null,
    "eps": null,
    "grossMargin": null,
    "roe": null,
    "updatedAt": null,
    "freshness": "missing"
  },
  "events": {
    "pending": [],
    "tracking": [],
    "latestClosed": null
  },
  "research": {
    "latestConclusion": "研究摘要",
    "latestAt": "2026/03/24",
    "freshness": "fresh"
  },
  "brainContext": {
    "matchedRules": [],
    "matchedMistakes": [],
    "matchedLessons": []
  },
  "freshness": {
    "price": "fresh",
    "targets": "stale",
    "fundamentals": "missing",
    "research": "fresh"
  },
  "sync": {
    "lastBuiltAt": "2026-03-24T13:37:01+08:00",
    "usedMarketDate": "2026-03-24"
  }
}
```

### 4.3 Brain v2 準備欄位

這一版先不強制立刻把 `strategyBrain` 全量改版，但 dossier builder 應預留結構化映射：

- `matchedRules`
- `matchedLessons`
- `matchedMistakes`

之後升級 brain v2 時，可直接接：

- `coreRules`
- `candidateRules`
- `checklists`
- `evidenceLog`

## 5. Freshness 狀態設計

每個 dossier 欄位都應標記 freshness：

- `fresh`
- `stale`
- `missing`
- `failed`

定義建議：

- `price`
  - `fresh`：今日收盤後同步成功
  - `stale`：使用前一交易日價格
  - `missing`：完全沒有價格
- `targets`
  - `fresh`：30 天內更新
  - `stale`：超過 30 天
  - `missing`：未設定
- `fundamentals`
  - `fresh`：最近一個月營收 / 最近一季財報已更新
  - `stale`：超過合理更新窗口
  - `missing`：尚未建立
- `research`
  - `fresh`：最近 30 天內有研究
  - `stale`：超過 30 天
  - `missing`：無研究

## 6. 收盤分析流程設計

### 6.1 新流程

收盤分析應拆成：

1. 載入本地快取資料
2. 判斷是否需要做今日唯一一次 post-close 價格同步
3. 用現有資料先組出 dossier
4. 立即開始 AI 分析
5. 若背景同步成功，更新 dossier 與本地快取

### 6.2 收盤價同步規則

新增 helper：

- `canRunPostClosePriceSync(now, syncMeta)`

邏輯：

1. 時區固定 `Asia/Taipei`
2. 若當前時間早於 `13:35`，不可自動抓價
3. 若今日已同步成功，不可再次抓取
4. 若今日不是交易日，維持舊快取，不主動抓

### 6.3 對 UI 的要求

在收盤分析頁顯示：

- `今日收盤價已同步` / `沿用前次價格`
- `同步時間`
- `部分股票更新失敗`（若有）

若今日價格未同步，AI 報告要顯示：

- `以下分析部分依賴舊價格快照`

## 7. 深度研究流程設計

### 7.1 新流程

深度研究不可直接把所有資料抓齊才開始。

應拆成：

1. 先從 dossier 取本地資料
2. 背景補：
   - fundamentals
   - targets
   - 最新研究上下文
3. 若補強資料在時間預算內回來，納入研究
4. 若沒回來，直接用現有 dossier 進行研究，並註記 freshness

### 7.2 研究流程時間預算

建議：

- dossier enrichment 預算：`10-12 秒`
- 超過時間就停止等待，進入 AI 研究

### 7.3 研究流程要回傳的 metadata

研究結果要額外帶：

```json
{
  "dataFreshness": {
    "price": "fresh",
    "targets": "stale",
    "fundamentals": "missing"
  },
  "usedFallback": true,
  "timedOutSources": ["fundamentals"]
}
```

## 8. 防停滯技術規則

### 8.1 所有資料刷新都用 `Promise.allSettled`

不可用 `Promise.all` 直接把整批掛死。

### 8.2 所有 fetch 都要包 `withTimeout`

新增共用 helper：

```js
withTimeout(promise, ms, label)
```

超時後應回傳可辨識的 `timeout` error，不可永遠 pending。

### 8.3 任何 enrich 失敗不得阻止主分析

規則：

- enrich 失敗 → dossier 對應欄位標 `failed`
- 主分析照跑
- 畫面提示資料新鮮度

### 8.4 AI 分析前的 context builder 只能吃 dossier

不要再由不同頁面各自臨時拼：

- holdings
- targets
- events
- research
- brain

改為統一：

- `buildAnalysisContextFromDossiers()`
- `buildResearchContextFromDossiers()`

## 9. 目標價與財報更新策略

### 9.1 目標價

短期策略：

- 優先沿用現有 `targets-v1`
- 截圖解析若抓到 `targetPriceUpdates`，更新 dossier
- 先由手動輸入 / 券商截圖維持資料品質

中期策略：

- 再接外部 public report / consensus source
- 外部來源只能背景補強，不可阻塞主分析

### 9.2 財報 / 月營收

短期策略：

- 先建立 `fundamentals` 欄位與 freshness 機制
- 沒資料也要能跑，只是標記 `missing`

中期策略：

- 接 `FinMind` 或其他台股資料來源
- 更新頻率：
  - 月營收：每日最多檢查一次
  - 季報：每日最多檢查一次
- 一律背景更新，不阻塞主流程

## 10. 建議新增的 helper / module

建議新增：

- `src/lib/marketSync.js`
  - `canRunPostClosePriceSync`
  - `syncPostCloseMarketPrices`
  - `readMarketPriceCache`
- `src/lib/dossier.js`
  - `buildHoldingDossiers`
  - `matchBrainContext`
  - `computeFreshness`
- `src/lib/async.js`
  - `withTimeout`
  - `allSettledMap`

## 11. 實作順序

### Phase A

- 新增 global market price cache
- 關掉現有啟動時自動重複抓價邏輯
- 改成收盤後每日一次批次同步

### Phase B

- 新增 `holding-dossiers-v1`
- 將 holdings / targets / events / research / brain 組成 dossier

### Phase C

- 收盤分析改吃 dossier
- 顯示 freshness / stale badge

### Phase D

- 深度研究改成 dossier + enrichment timeout

### Phase E

- 再接 fundamentals / public target refresh

## 12. 關鍵決策

這份設計最重要的決策只有兩個：

1. AI 不能等所有資料都刷新完才開始
2. 股價 API 只能在收盤後每日抓一次，且採全域共用快取

只要這兩條守住，後面就算加更多資料源，也不會把整個系統拖死。

## 13. 參考

- TWSE Trading Mechanism Introduction:
  https://www.twse.com.tw/en/page/products/trading/introduce.html
- TWSE Trading System / Regular Trading:
  https://www.twse.com.tw/en/products/system/trading.html
