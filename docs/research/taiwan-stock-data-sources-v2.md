> ⚠️ **SUPERSEDED · 2026-04-18** · 此檔為歷史參考 · 最新狀態請見 `docs/research/taiwan-stock-data-sources-v3-deep.md`
>
> 保留理由：被 `docs/product/portfolio-dashboard-spec.md` / 其他 spec 引用為歷史證據，刪除會斷脈絡。

---

# 台股資料源研究報告 — V2（12 個選項）

**研究日期**：2026-04-16
**研究者**：Qwen
**狀態**：已完成

---

## 完整比較表

| #   | Source                           | 類型           | Auth           | robots.txt    | 覆蓋(E/M/L) | 更新頻率   | 費用                     | 整合工時 | 推薦優先序 |
| --- | -------------------------------- | -------------- | -------------- | ------------- | ----------- | ---------- | ------------------------ | -------- | ---------- |
| 1   | **TWSE OpenAPI**                 | REST/JSON      | 免 Auth        | ✅ 允許       | E (1700+)   | 每日收盤後 | 免費                     | 0.5d     | 1          |
| 2   | **FinMind API**                  | REST/JSON      | API Key (免費) | ✅ 允許       | E (1700+)   | 每日 17:30 | 免費 600 req/hr          | 0.5d     | 2          |
| 3   | **Fugle API**                    | REST+WebSocket | API Token      | ✅ 允許       | E (1700+)   | 即時/日線  | 免費(限) / NT$1,499/月起 | 1d       | 3          |
| 4   | **TEJ API**                      | REST/JSON      | API Key (付費) | ✅ 允許       | E (1700+)   | 每日       | NT$488/月起(個人)        | 1d       | 4          |
| 5   | **MOPS 公開資訊觀測站**          | HTML/JSON      | 免 Auth        | ⚠️ 改版後反爬 | E (1700+)   | 月/季/年   | 免費                     | 2d       | 5          |
| 6   | **鉅亨網 cnyes 外資評等**        | HTML           | 免 Auth        | ✅ 允許       | M (~400)    | 每日       | 免費                     | 1d       | 6          |
| 7   | **Qdata (CMoney)**               | REST/JSON      | API Key        | N/A           | E (1700+)   | 每日       | 免費(1年) / NT$2,999/月  | 1d       | 7          |
| 8   | **Shioaji (永豐)**               | Python SDK     | 券商帳戶       | N/A           | E (1700+)   | 即時/日線  | 免費(需永豐戶)           | 1d       | 8          |
| 9   | **Yahoo Finance RSS + yfinance** | RSS/Python     | 免 Auth        | ✅ 允許       | M (~400)    | 延遲15分   | 免費                     | 0.5d     | 9          |
| 10  | **Alpha Vantage**                | REST/JSON      | API Key        | ✅ 允許       | M (~400)    | 延遲15分   | 免費 25 req/日           | 0.5d     | 10         |
| 11  | **PTT Stock (ptt.cc)**           | HTML/BBS       | 免 Auth        | ✅ 允許       | L (輿論)    | 即時       | 免費                     | 1d       | 11         |
| 12  | **MacroMicro API**               | REST/JSON      | 企業方案       | N/A           | L (總經)    | 每日       | 客製報價(貴)             | 2d       | 12         |

---

## 各選項詳細說明

### 1. TWSE OpenAPI ⭐ 最高推薦

- **URL**：`https://openapi.twse.com.tw/v1/`（Swagger: `/v1/swagger.json`）
- **資料**：個股日成交資訊、大盤指數、三大法人買賣、融券餘額等
- **優點**：官方來源、JSON 格式、每日更新、完全免費、無需 Auth
- **限制**：`/v1` 端點只保留「前一天/前一個月」資料；歷史資料需走舊版 `twse.com.tw/exchangeReport/STOCK_DAY`
- **robots.txt**：無限制
- **覆蓋**：全市場 1700+ 檔
- **整合**：`fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY?response=json&date=20260415&stockNo=2330')`

### 2. FinMind API ⭐ 免費最強

- **URL**：`https://api.finmindtrade.com/api/v4/`
- **資料**：75+ 台股 dataset — 股價、PER/PBR、三大法人、融資融券、月營收、技術指標
- **優點**：開源、免費 600 req/hr、Python SDK (`pip install FinMind`)、REST API 任何語言可用
- **限制**：**無目標價/分析師評等** dataset；高階資料需 Backer/Sponsor 會員
- **robots.txt**：允許
- **覆蓋**：全市場（上市/上櫃/興櫃）
- **整合**：已有部分整合到本專案（`useFinMindData.js`）

### 3. Fugle API

- **URL**：`https://developer.fugle.tw/`
- **資料**：即時行情（WebSocket）、日內成交、歷史行情、技術指標、企業事件、選擇權/期貨
- **優點**：時報資訊合作、資料品質高、WebSocket 即時推送、developer docs 完整
- **限制**：免費版僅 5 訂閱、60 req/min；**不含日內快照、技術指標、選擇權**（需付費）
- **定價**：Basic 免費 / Developer NT$1,499/月 / Advanced NT$2,999/月
- **覆蓋**：全市場（上市/上櫃/ETF/ETFN/權證）
- **整合工時**：1 天（需處理 WebSocket + REST 雙模式）

### 4. TEJ API

- **URL**：`https://api.tej.com.tw/`
- **資料**：台股/港/中/日/韓全市場 — 股價、財報、營收、籌碼、ESG、產業分類
- **優點**：台灣資料龍頭、最完整、TQuant Lab 可回測、Python SDK
- **限制**：試用版僅 1 年資料；付費版 NT$488/月起（小資方案，5 年/10 萬筆/日）
- **定價**：初入江湖 NT$488/月 / 牛刀小試 NT$888/月 / 客製報價
- **robots.txt**：允許爬公開內容
- **覆蓋**：全市場 + 亞洲多國
- **整合工時**：1 天（REST API 直覺，但需處理分頁和資料庫代號）

### 5. MOPS 公開資訊觀測站

- **URL**：`https://mops.twse.com.tw/mops/web/`
- **資料**：財報（資產負債/綜合損益/現金流）、董監持股、月營收、重大訊息
- **優點**：官方來源、財報最權威、完全免費
- **限制**：**2024 改版後反爬機制加強**；非 Ajax 靜態頁可 parse 但需處理驗證碼；無正式 API
- **robots.txt**：⚠️ 改版後有反爬，需控制頻率
- **覆蓋**：全市場
- **整合工時**：2 天（需處理表單提交、驗證、HTML parse）

### 6. 鉅亨網 cnyes 外資評等 ⭐ 目標價最佳免費來源

- **URL**：`https://www.cnyes.com/twstock/board/ratediff.aspx`
- **資料**：外資券商（FactSet 聚合）對台股的評等、目標價（舊/新）、現價
- **優點**：**唯一免費可取得「多家券商目標價」的來源**；每日更新；FactSet 數據
- **限制**：僅外資（QFII），不含本土投顧；HTML 表格需 parse；覆蓋約 400 檔主要股票
- **robots.txt**：無限制
- **覆蓋**：主要 400 檔（外資有覆蓋的個股）
- **整合工時**：1 天（HTML table parse → JSON）

### 7. Qdata (CMoney)

- **URL**：`http://www.cmoney.com.tw/cmweb/upmain/qdata/qdata.asp`
- **資料**：每日價量、三大法人明細、技術指標、投資評等 API（90+ 種）
- **優點**：CMoney 獨家數據、贈送 1-2 年資料長度、有免費層
- **限制**：免費版僅 1 年資料；付費版 NT$2,999/月；需申請 API Key
- **robots.txt**：N/A（需 Auth 的 API）
- **覆蓋**：全市場上市櫃
- **整合工時**：1 天

### 8. Shioaji（永豐金證券）

- **URL**：`https://sinotrade.github.io/zh/`
- **資料**：台股全市場即時行情、歷史資料、帳務查詢、委託下單
- **優點**：Python SDK 成熟、社群活躍、免費（需永豐證券帳戶）
- **限制**：**需開永豐證券戶**；訂閱上限 200 檔/帳號；每日 login 上限 1000 次
- **robots.txt**：N/A（券商 API）
- **覆蓋**：全市場
- **整合工時**：1 天（需處理帳戶認證流程）

### 9. Yahoo Finance RSS + yfinance

- **URL**：`https://tw.stock.yahoo.com/rss-index`（RSS）/ `pip install yfinance`（Python）
- **資料**：個股新聞、研究報告 RSS；yfinance 可抓股價、財報、**analysis 頁有 target price**
- **優點**：完全免費、yfinance 可抓 `info['targetMeanPrice']`
- **限制**：台股 target price 覆蓋率低（主要美股）；RSS 僅新聞不含評等；延遲 15 分鐘
- **robots.txt**：允許
- **覆蓋**：主要 400 檔（有 Yahoo 頁面的個股）
- **整合工時**：0.5 天

### 10. Alpha Vantage

- **URL**：`https://www.alphavantage.co/`
- **資料**：全球股票時間序列、技術指標、財報
- **優點**：免費、支援台股（`.TW` suffix）、註冊即得 API Key
- **限制**：**免費僅 25 req/日**；台股延遲 15 分鐘；無目標價資料
- **robots.txt**：允許
- **覆蓋**：主要 400 檔
- **整合工時**：0.5 天

### 11. PTT Stock（批踢踢實業坊）

- **URL**：`https://www.ptt.cc/bbs/Stock/index.html`
- **資料**：散戶討論、個股分析文、投資心得
- **優點**：免費、即時輿情、可抓推/噓數做情緒分析
- **限制**：非結構化資料、需 NLP 處理；需設 cookie（年滿 18 歲）；無 API
- **robots.txt**：允許
- **覆蓋**：L（僅熱門個股有討論）
- **整合工時**：1 天（HTML parse + 簡易 NLP）

### 12. MacroMicro 財經M平方

- **URL**：`https://www.macromicro.me/`
- **資料**：總經數據、景氣指標、產業趨勢圖表
- **優點**：數據視覺化佳、機構授權數據
- **限制**：**API 僅企業方案**（客製報價，昂貴）；免費版僅手動下載；非個股層級
- **robots.txt**：N/A
- **覆蓋**：L（總經/產業層級，非個股）
- **整合工時**：2 天（企業方案需商務流程）

---

## 分類覆蓋分析

### A. 券商目標價 / 分析師評等

| Source                 | 覆蓋      | 費用        | 備註                                   |
| ---------------------- | --------- | ----------- | -------------------------------------- |
| 鉅亨網 cnyes           | M (~400)  | 免費        | FactSet 聚合外資評等，**最佳免費來源** |
| Yahoo Finance yfinance | M (~400)  | 免費        | `targetMeanPrice` 但台股覆蓋低         |
| Qdata (CMoney)         | E (1700+) | NT$2,999/月 | 有「每日投資評等 API」但付費           |
| TEJ API                | E (1700+) | NT$488/月起 | 有法人買賣超，但**無目標價**           |

### B. 股價 / 成交量 / 技術指標

| Source        | 覆蓋 | 費用            | 備註                    |
| ------------- | ---- | --------------- | ----------------------- |
| TWSE OpenAPI  | E    | 免費            | 官方來源，但僅近期資料  |
| FinMind       | E    | 免費            | 75+ dataset，最完整免費 |
| Fugle         | E    | 免費/NT$1,499起 | 即時 WebSocket 最強     |
| Alpha Vantage | M    | 免費(25req/日)  | 適合備援                |

### C. 籌碼 / 三大法人 / 融資融券 / 借券

| Source         | 覆蓋 | 費用             | 備註                       |
| -------------- | ---- | ---------------- | -------------------------- |
| FinMind        | E    | 免費             | 三大法人、融資融券 dataset |
| TWSE OpenAPI   | E    | 免費             | 三大法人買賣、融券餘額     |
| Qdata (CMoney) | E    | 免費/NT$2,999/月 | 三大法人明細               |
| TEJ API        | E    | NT$488/月起      | 籌碼面完整                 |

### D. 基本面 / 財報 / 月營收 / 重大訊息

| Source       | 覆蓋 | 費用        | 備註               |
| ------------ | ---- | ----------- | ------------------ |
| MOPS         | E    | 免費        | 財報最權威，但反爬 |
| FinMind      | E    | 免費        | 月營收 dataset     |
| TEJ API      | E    | NT$488/月起 | 財報+營收+ESG      |
| TWSE OpenAPI | E    | 免費        | 基本資料           |

### E. 新聞 / 輿論 / 社群

| Source    | 覆蓋 | 費用 | 備註         |
| --------- | ---- | ---- | ------------ |
| Yahoo RSS | M    | 免費 | 個股新聞 RSS |
| PTT Stock | L    | 免費 | 散戶輿情     |
| 鉅亨網    | M    | 免費 | 新聞+評等    |

---

## 🏆 推薦組合：達成「每檔持股 ≥3 家投顧目標價」

### 推薦組合：鉅亨網 cnyes + Qdata (CMoney) + Yahoo Finance yfinance

| 角色     | Source                                   | 覆蓋率                   | 成本        |
| -------- | ---------------------------------------- | ------------------------ | ----------- |
| **主力** | 鉅亨網 cnyes 外資評等                    | ~70%（外資有覆蓋的個股） | 免費        |
| **補充** | Qdata CMoney 投資評等 API                | ~85%（上市櫃全覆蓋）     | NT$2,999/月 |
| **備援** | Yahoo Finance yfinance `targetMeanPrice` | ~30%（台股覆蓋有限）     | 免費        |

**總成本**：NT$2,999/月（約 $95 USD）
**整合工時**：2-3 天
**預期覆蓋率**：~90%（400 檔主要股可達 ≥3 家，小型股可能僅 1-2 家）

**風險**：

1. 鉅亨網 HTML 結構變更需維護 parser
2. Qdata 需商務流程申請 API Key
3. 小型股/興櫃股可能仍不足 3 家投顧覆蓋

---

## ⚠️ 反駁 / Flag

### Flag 1：「每檔 ≥3 家投顧目標價」是過度規格

**理由**：

- 台灣小型股/興櫃股根本沒有 3 家以上投顧覆蓋
- 即使是 0050 成分股，部分也只有 1-2 家外資出具報告
- **建議改為**：「有幾家算幾家，aggregate 顯示」+ 不足 3 家時標註「覆蓋不足」
- 這跟 Goodinfo/Yahoo 的做法一致 — 他們也是顯示「N 家評等」而非硬性要求 3 家

### Flag 2：LLM + web search 其實不適合這個場景

**理由**：

- 目標價是**結構化數字**，不需要 LLM 理解
- web search 回傳的是網頁/摘要，需要額外 parse，不如直接 call API
- 券商 App 的做法就是 **call 資料供應商的 API**（FactSet、CMoney、TEJ）
- LLM + search 適合「非結構化分析」（如新聞情緒、個股評論），不適合「精確數字查詢」

### Flag 3：FinMind 沒有目標價資料

經確認，FinMind 的 75+ dataset 中**沒有分析師目標價/評等**相關資料。如果目標價是核心需求，FinMind 無法滿足，必須搭配其他來源。

---

## 結論

1. **股價/籌碼/財報**：FinMind + TWSE OpenAPI 免費組合已足夠
2. **目標價/評等**：必須付費 — 鉅亨網免費但覆蓋有限，Qdata NT$2,999/月最完整
3. **新聞/輿情**：Yahoo RSS + PTT 免費即可
4. **如果要省錢**：鉅亨網 cnyes（免費）+ FinMind（免費）+ TWSE（免費）= $0，但目標價覆蓋 ~70%
5. **如果要完整**：上述 + Qdata NT$2,999/月 = 覆蓋 ~90%
