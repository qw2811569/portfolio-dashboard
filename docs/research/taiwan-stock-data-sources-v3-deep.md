# 台股資料源深度研究 — V3 Deep

**研究日期**：2026-04-16  
**研究者**：Codex  
**範圍**：只做研究與文件，不改 production code  
**研究對象**：TWSE OpenAPI、cnyes 外資評等、Fugle API、TEJ API

---

## 先講 3 個推翻點

1. **TWSE OpenAPI 不是「全市場 1700+」單一來源。**
   - 我在 `https://openapi.twse.com.tw/v1/opendata/t187ap03_L` 實測拿到 **1081 rows**。
   - `2330`、`3055` 找得到，但 `6470` 找不到。
   - `6470` 在 cnyes company profile 解析為 **宇智網通，上櫃**，這代表 **TWSE OpenAPI 只覆蓋上市，不含上櫃**；若要全市場，至少還要加上 TPEx。

2. **cnyes 的覆蓋比 Qwen v2 寫的「~400 檔」更廣，但可用資料不是 per-firm 明細。**
   - `2330 / 3055 / 6470` 的研究頁與 `targetPrice` API 都能回 200。
   - 我額外做了 sample check：上市 40 檔、上櫃 40 檔，**80/80 的 targetPrice endpoint 都回 200**。
   - 但其中只有 **上市 21/40、上櫃 13/40** 真的有 `targetValuation.data`；而且多數只有 `numEst = 1`，不是「多家投顧明細」。

3. **Fugle / TEJ 都是「資料源強」，但跟現有 `target-price` pipeline 的契合度其實不高。**
   - 兩家都不是現成的 analyst target-price source。
   - 兩家更適合做 **行情 / 歷史 / 基本面 / 籌碼**，不是直接替換 `api/analyst-reports.js` 的來源。

---

## 現有系統接法先讀這裡

### 現況

- `api/cron/collect-target-prices.js:188-207` 會打 `/api/analyst-reports?refresh=1`，只接收 analyst payload。
- `api/cron/collect-target-prices.js:125-170` 最後只吃 `firm / target / date` 類型的結果。
- `api/analyst-reports.js:718-740` 現行 fallback chain 是：
  - `gemini grounding`
  - `rss extraction`
  - `cmoney notes`
- `api/analyst-reports.js:746-800` 會把不同來源 merge 成統一的 `items[]`。
- `api/cmoney-notes.js:143-213` 是目前最接近「可模仿的 source adapter 範本」：
  - HTML/JSON 抽取
  - normalize date / firm / stance
  - 轉成 `reports` 或 `aggregate`
- `api/_lib/` 目前沒有通用 HTTP client。
  - `api/_lib/cache.js` 只有 memory cache。
  - `api/_lib/local-env.js` 只是 local env loader。

### 結論

- **只要來源拿不到 `firm + target + date`，就接不上現有 target-price pipeline。**
- 因此：
  - **cnyes**：可接，但比較像 **aggregate fallback adapter**，不是 per-firm adapter。
  - **TWSE / Fugle / TEJ**：比較像未來 **market-data/fundamentals/chips adapter**，不是這條 pipeline 的直接來源。

---

## 1. TWSE OpenAPI

### 實測結果

- curl 狀態：
  - `https://openapi.twse.com.tw/v1/swagger.json` → **200**
  - `https://openapi.twse.com.tw/v1/opendata/t187ap03_L` → **200**
  - `https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL` → **200**
  - `https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL` → **200**
  - `https://openapi.twse.com.tw/v1/exchangeReport/BFI84U` → **200**
  - `https://openapi.twse.com.tw/robots.txt` → **404**
- 速率：
  - 連打 `t187ap03_L` **8 次皆 200**
  - headers **未看到** `X-RateLimit-*` / `Retry-After`
- schema 片段：
  - `t187ap03_L` keys：`出表日期`, `公司代號`, `公司名稱`, `公司簡稱`, `外國企業註冊地國`
  - `STOCK_DAY_ALL` keys：`Date`, `Code`, `Name`, `TradeVolume`, `TradeValue`
  - `BWIBBU_ALL` keys：`Date`, `Code`, `Name`, `PEratio`, `DividendYield`, `PBratio`
  - `BFI84U` keys：`Code`, `Name`, `StartDate`, `EndDate`, `Reason`
- robots.txt：
  - **拿不到 robots 本體，實測為 404。**
  - Qwen v2 寫「無限制」太武斷；更準確的說法是「本次實測 `openapi.twse.com.tw/robots.txt` 不存在」。

### 資料覆蓋實測

- 樣本：

| Dataset                        | Rows | 2330 | 3055 | 6470 |
| ------------------------------ | ---: | ---- | ---- | ---- |
| `opendata/t187ap03_L`          | 1081 | OK   | OK   | MISS |
| `exchangeReport/STOCK_DAY_ALL` | 1350 | OK   | OK   | MISS |
| `exchangeReport/BWIBBU_ALL`    | 1070 | OK   | OK   | MISS |

- 解讀：
  - `2330`：OK
  - `3055`：OK
  - `6470`：MISS
  - 這不是 random miss；`6470` 在 cnyes company profile 解析為 **上櫃**，所以 **TWSE OpenAPI 本質上只覆蓋上市市場**。
- 目標價 / 基本面 / 籌碼：
  - 目標價：**無**
  - 基本面：**有一部分**，例如 `BWIBBU_ALL` 可拿 PE / PBR / 殖利率
  - 籌碼：**有部分事件/市場資料**，但本次沒找到可直接替代 analyst target 的欄位

### 接入成本

- 需新寫：
  - 若目標是接 `api/analyst-reports.js`：**不建議寫**
  - 若目標是接 future market-data adapter：需要新寫 **TWSE dataset mapper**
- 沿用：
  - 可沿用 `fetch`
  - 可沿用 `api/_lib/cache.js` 做短 TTL cache
  - 若只是要寫成 snapshot，也可沿用 `collect-target-prices.js` 的 snapshot 結構概念
- 工時估：
  - 只做單一 dataset fetch + normalize：**2-4 小時**
  - 做成多 dataset 統一 adapter：**0.5-1 天**

### 風險

- 反爬：
  - 目前 open API 很寬鬆，8 次連打沒出現 429。
  - 但 **TWSE 主站使用條款**明寫，未經同意不得以自動化裝置、指令碼、蜘蛛、爬蟲或擷取程式下載網站資料。
  - 我傾向解讀為：**OpenAPI 可用，但不要把主站頁面抓取邏輯跟 openapi host 混在一起。**
- 法律：
  - `swagger.json` 直接連到 TWSE 使用條款。
  - 若走 OpenAPI 本身，比抓 HTML 頁面風險低很多。
- 長期穩定性：
  - 官方、免費、收盤後資料穩。
  - 但**範圍只到上市**，若需求是全市場，就不是單獨可用方案。

### Claude 的反駁提問

- Qwen v2 說「TWSE OpenAPI 覆蓋 E (1700+)」，我**不同意**。
- 更精確的說法應該是：
  - **TWSE OpenAPI = 上市盤面強**
  - **不是全台上市櫃單一來源**
- 要不要把「TWSE + TPEx 官方 open data 組合」視為同一個官方方案？如果不算同一組，Qwen 的 rank 1 其實高估了它的單源能力。

---

## 2. cnyes 外資評等

### 實測結果

- curl 狀態：
  - `https://www.cnyes.com/robots.txt` → **200**
  - `https://www.cnyes.com/twstock/2330/research/finirating` → **200**
  - `https://www.cnyes.com/twstock/3055/research/finirating` → **200**
  - `https://www.cnyes.com/twstock/6470/research/finirating` → **200**
  - `https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/targetPrice/TWS:2330:STOCK` → **200**
  - `https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/factSetEstimate/TWS:2330:STOCK` → **200**
- 速率：
  - `targetPrice` endpoint 連打 **8 次皆 200**
  - headers **未看到** `X-RateLimit-*` / `Retry-After`
- schema 片段：
  - `targetPrice` keys：`symbolId`, `chName`, `rateDate`, `feHigh`, `feLow`, `feMean`, `feMedian`, `numEst`
  - `factSetEstimate` keys：`symbolId`, `chName`, `rateDate`, `feMark`, `feBuy`, `feOver`, `feHold`, `feSell`
- robots.txt：
  - `User-agent: *` 下有大量 `Disallow`
  - 明確看到 `Disallow: /news/`
  - **沒有看到** `/twstock/` 或 `/twstock/*/research/finirating` 被禁止
  - 所以這次實測下，**研究頁路徑沒有被 robots 明文擋住**

### 資料覆蓋實測

- 直接樣本：

| Code | Market | 頁面 | targetPrice data | `numEst` |
| ---- | ------ | ---- | ---------------- | -------: |
| 2330 | 上市   | OK   | OK               |       36 |
| 3055 | 上市   | OK   | OK               |        1 |
| 6470 | 上櫃   | OK   | OK               |        1 |

- 補充樣本化測試：
  - 上市名單 40 檔抽樣：**40/40 endpoint 200，21/40 有 `targetValuation.data`**
  - 上櫃名單 40 檔抽樣：**40/40 endpoint 200，13/40 有 `targetValuation.data`**
  - 沒資料的情況不是 404，而是 **`data: null`**
- 解讀：
  - **頁面/endpoint 覆蓋明顯比「只有 400 檔」更廣**
  - 但「真的有 analyst target 資料」的覆蓋率，sample 看起來沒有到全市場
  - 而且有資料的很多是 **`numEst = 1`**
- 外資 vs 本土投顧：
  - 目前實測 payload 都是 FactSet-style aggregate 欄位
  - 研究頁 meta 文字也寫的是 **「外資券商評等」**
  - **沒有看到本土投顧欄位或來源識別**
  - 我的結論是：**這條線本質上是外資 aggregate，不是本土投顧整合**
- 目標價 / 基本面 / 籌碼：
  - 目標價：**有，但 aggregate**
  - 基本面：頁面 payload 有 company profile / valuation 周邊資料
  - 籌碼：不是主力

### 接入成本

- 需新寫：
  - **新 source adapter**
  - 最合理是比照 `api/cmoney-notes.js`，但 parser 目標改成：
    - `aggregate = { medianTarget, min, max, firmsCount }`
    - 而不是 `reports[]`
- 沿用：
  - `api/analyst-reports.js:746-807` 的 merged payload 形式可沿用
  - `api/cmoney-notes.js` 的 normalize date / number / evidence 邏輯很像，可直接借鏡
- 工時估：
  - 只做 aggregate fallback adapter：**4-6 小時**
  - 若硬要找 per-firm row endpoint：**高風險探索 0.5-1 天，且可能白做**

### 風險

- 反爬：
  - 目前研究頁與 marketinfo API 都能穩定 200。
  - 但它不是公開授權 API 文件的一部分，我看不到正式契約，**這是最大風險**。
- 法律：
  - robots 沒擋 `/twstock/research`
  - 但 **「robots 沒擋」不等於「授權你把資料當產品 API 用」**
  - 若未來做 production ingestion，我會把它列成 **法律灰區**，尤其是商業產品長期使用。
- 長期穩定性：
  - 最可怕的不是 403，而是 **欄位改名、`data: null` 規則改掉、或 marketinfo endpoint 下線**
  - 這條線沒有 API contract，維運風險高於 Fugle / TEJ

### Claude 的反駁提問

- Qwen v2 說 cnyes 是「最佳免費目標價來源」，這句我**半同意**。
- 我同意它是 **最佳免費 aggregate target source**。
- 我不同意把它講成「多家券商目標價明細來源」。
- 更尖銳的問題是：
  - 如果現有 pipeline 最終需要 `firm + target + date`，那我們到底是在接「目標價來源」，還是在接「共識區間 fallback」？

---

## 3. Fugle API

### 實測結果

- curl 狀態：
  - `https://developer.fugle.tw/robots.txt` → **404**
  - `https://developer.fugle.tw/docs/pricing/` → **200**
  - `https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/2330` → **401**
  - `https://api.fugle.tw/marketdata/v1.0/stock/intraday/candles/2330` → **401**
  - `https://api.fugle.tw/marketdata/v1.0/stock/snapshot/quotes/TSE` → **401**
  - `https://api.fugle.tw/marketdata/v1.0/stock/snapshot/movers/TSE?direction=up&change=percent` → **401**
- 速率：
  - unauth response 只有 `access-control-expose-headers`
  - 可看到 **會 expose** `Retry-After,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset`
  - 但 **這次 401 實測沒有回具體數值**
  - docs 寫明：超限時會回 **429**
- schema 片段：
  - 這次沒有 key，只能看到錯誤 schema：
    - `message`
    - `statusCode`
- robots.txt：
  - `developer.fugle.tw/robots.txt` 實測 **404**

### 資料覆蓋實測

- 2330：
  - live endpoint 因無 key，**只能驗到 401 auth gate**
- 3055 / 6470（小型股）：
  - 這次**沒法做 live data coverage 實測**
  - 但官方 pricing/doc 頁寫：
    - 「台股可追蹤標的包含**興櫃、上市櫃個股及指數、權證、ETF、ETN**」
    - 「歷史行情目前僅支援**上市櫃個股及 ETF**」
- 目標價 / 基本面 / 籌碼：
  - 目標價：**無**
  - 基本面：不是主打
  - 籌碼 / 行情 / 即時：**強**

### 接入成本

- 需新寫：
  - 若接現有 target-price pipeline：**不值得**
  - 若接 future market-data layer：需要新寫 **Fugle REST adapter**
  - 若用 WebSocket，還要多寫 reconnect / subscription lifecycle
- 沿用：
  - `api/_lib/local-env.js` 可處理 local key
  - `api/_lib/cache.js` 可做 snapshot cache
  - 現有程式大量直接用 `fetch`，不用先重構共用 client
- 工時估：
  - REST-only quote/snapshot adapter：**4-6 小時**
  - WebSocket production adapter：**1-2 天**

### 風險

- 反爬：
  - 幾乎不是重點，因為這是正規 API。
- 法律：
  - 低於 cnyes，因為它本來就是 developer product。
- 長期穩定性：
  - 官方 pricing 頁 2026-03-31 更新，公開寫：
    - 基本用戶：免費
    - 開發者：`NT$1499/月`
    - 進階用戶：`NT$2999/月`
    - 60/min, 600/min, 2000/min 的配額差異
  - **風險不是突然封鎖，而是方案權限/限額調整。**

### Claude 的反駁提問

- Qwen v2 把 Fugle 排第 3，我認為**對「整體台股資料源」合理，對「我們現有 target-price 問題」不合理**。
- 更精確的定位應該是：
  - **即時行情 / quote infra：強**
  - **analyst target-price pipeline：弱相關**
- 如果這輪只是在補目標價來源，Fugle 的優先序應該下修。

---

## 4. TEJ API

### 實測結果

- curl 狀態：
  - `https://api.tej.com.tw/robots.txt` → **200**
  - `https://api.tej.com.tw/documents.html` → **200**
  - `https://api.tej.com.tw/document_rest.html` → **200**
  - `https://api.tej.com.tw/api/datatables/TWN/APRCD.json` → **400**
  - `https://api.tej.com.tw/api/datatables/TWN/APRCD/metadata` → **200**，但 body 是 error JSON
  - `https://api.tej.com.tw/api/search/table/市盈率` → **400**
  - `https://api.tej.com.tw/api/apiKeyInfo/DEMO` → **404**
- 速率：
  - docs 寫明：
    - 試用：**500 calls/day**
    - 付費：**2000 calls/day**
    - 單次最多 **10,000 rows**
  - 實測 headers **未看到** `X-RateLimit-*` / `Retry-After`
  - metadata endpoint 連打 **5 次皆 200**，但只是回 error JSON
- schema 片段：
  - 沒 key 時錯誤 schema：
    - `error.code`
    - `error.message`
  - 例：
    - `AAA001` / `請輸入您的api_key`
    - `AAA000` / `api_key不存在`
- robots.txt：
  - `User-agent: *`
  - `Crawl-delay: 300`
  - `Disallow: /api`
  - `Disallow: /datatables`
  - `Disallow: /search`

### 資料覆蓋實測

- live endpoint：
  - 無 key，**無法直接驗 2330 / 3055 / 6470 row-level data**
- 但官方 TQuant/TEJ 資料集頁清楚寫：
  - `TWN/APIPRCD`：股價交易資訊，**台灣上市櫃市場、退市股票**
  - `TWN/APISHRACT`：三大法人、融資券、當沖，**台灣上市櫃市場、退市股票**
  - `TWN/APISHRACTW`：集保庫存，**台灣上市櫃市場、退市股票**
  - 多個表都標示：
    - 初入江湖：**近五年**
    - 牛刀小試：**近十年**
    - 高手過招 / 法人：**2005 年起**
- 目標價 / 基本面 / 籌碼：
  - 目標價：**這次沒找到官方 target-price dataset**
  - 基本面：**強**
  - 籌碼：**強**

> 上面「沒有 target-price dataset」是根據我讀到的官方 REST docs + TQuant 資料集頁做的**推論**，不是完整產品 catalogue 證明。

### 接入成本

- 需新寫：
  - 新的 **TEJ table adapter**
  - 要決定 table code 與欄位 mapping，不是只打一條 endpoint 就結束
  - 若要同時接 price + chips + fundamentals，至少 2-3 個表
- 沿用：
  - 現有 `fetch`
  - `api/_lib/local-env.js`
  - `api/_lib/cache.js`
- 工時估：
  - 單表 proof-of-concept：**6-10 小時**
  - 多表整合 + normalize：**1-2 天**

### 風險

- 反爬：
  - robots 對 `/api`、`/datatables`、`/search` 是 **Disallow**
  - 但若你是正式 API key 用戶，實務上主要受契約與配額管理，而不是 robots
- 法律：
  - 低於 cnyes，高於 TWSE OpenAPI
  - 因為這是正式 API，但明確是授權制、不可假裝免費抓
- 長期穩定性：
  - 配額規則公開，但我**這次沒在官方 API docs 上直接找到 Qwen v2 寫的 `NT$488 / NT$888` 價格頁**
  - 我只能在 TEJ 自家資料集頁確認方案名稱與年限差異，**價格本身這次未完成官方驗證**
  - 所以真正的風險是：
    - 授權成本
    - 欄位與方案綁定
    - 商務談判後的價格變動

### Claude 的反駁提問

- Qwen v2 把 TEJ 排第 4，我認為**對台股基本面 / 籌碼系統合理**，但對「這輪目標價研究」有點太高。
- 如果我們討論的是 `api/analyst-reports.js` 的下一個 source，TEJ 的 relevance 不如 cnyes。
- 如果我們討論的是 **長期台股資料底座**，TEJ 反而可能比 cnyes 更值得付費。

---

## Decision 摘要表

| Source       | 實測可行                         | 即戰力                                       | 長期風險                        | 推薦動作                          |
| ------------ | -------------------------------- | -------------------------------------------- | ------------------------------- | --------------------------------- |
| TWSE OpenAPI | **高**，但只到上市               | 對 target-price **低**；對市場/基本面 **中** | 法律低、範圍風險高              | **觀察**                          |
| cnyes 外資   | **中高**，頁/API 都能打          | 對 aggregate target fallback **高**          | 無 API contract、欄位變動風險高 | **接（只當 aggregate fallback）** |
| Fugle        | **中**，auth gate 清楚           | 對 target-price **低**；對即時行情 **高**    | 定價/限額變動，但契約清楚       | **觀察**                          |
| TEJ          | **中**，auth gate 清楚、文件完整 | 對 target-price **低**；對基本面/籌碼 **高** | 商務授權與定價不透明            | **觀察**                          |

---

## 我的最終判斷

### 如果你問「下一個最值得先接的 target-price source 是誰？」

- **cnyes，但只該接成 aggregate fallback，不要假裝它是 per-firm。**

### 如果你問「下一個最值得花錢接的長期台股資料底座是誰？」

- **TEJ**，但這是另一條案子，不是 `target-price` 這條。

### 如果你問「TWSE 要不要現在接？」

- **不要用它解 target-price 問題。**
- 它值得接，是因為官方、免費、穩；但那是 market/fundamental/chips 的 lane。

### 如果你問「Fugle 要不要現在接？」

- **如果你下一題是即時行情 / WebSocket，就接。**
- **如果你下一題還是 analyst target-price，就先不要。**

---

## 建議下一步

1. **先接 cnyes aggregate adapter**
   - 只產出 `aggregate`
   - 欄位建議：`medianTarget`, `min`, `max`, `firmsCount`, `date`, `source_url`
   - 不要塞 fake `firm`

2. **把 current pipeline 的 source type 分成兩類**
   - `firm-level reports`
   - `aggregate consensus`
   - 不然現在的 schema 會逼來源假裝自己是 per-firm

3. **把 TWSE / Fugle / TEJ 從「target-price source」清單拆出去**
   - 另外開一份 market-data / fundamentals / chips 方案比較

---

## 參考連結

- TWSE OpenAPI Swagger: https://openapi.twse.com.tw/v1/swagger.json
- TWSE 使用條款: https://www.twse.com.tw/zh/page/terms/use.html
- TWSE 上市公司基本資料: https://openapi.twse.com.tw/v1/opendata/t187ap03_L
- TWSE 日成交資訊: https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
- TWSE 本益比/殖利率/股價淨值比: https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL
- cnyes 2330 研究頁: https://www.cnyes.com/twstock/2330/research/finirating
- cnyes targetPrice API: https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/targetPrice/TWS:2330:STOCK
- cnyes factSetEstimate API: https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/factSetEstimate/TWS:2330:STOCK
- Fugle getting started: https://developer.fugle.tw/docs/data/http-api/getting-started
- Fugle pricing: https://developer.fugle.tw/docs/pricing/
- TEJ API docs: https://api.tej.com.tw/documents.html
- TEJ REST docs: https://api.tej.com.tw/document_rest.html
- TEJ TQuant 資料集頁: https://tquant.tejwin.com/%E8%B3%87%E6%96%99%E9%9B%86/
