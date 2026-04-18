# FinMind API 完整參考

> ⚠️ **2026-04-18 update** · 本 repo 目前以 `claude.md` 的付費 FinMind 規則為準：`1600 req/hr`。
> R105 audit 顯示，現況主要缺口不是「先升 Backer 才能用」，而是 repo-side `call-method-error`、period semantics 與 participant label mapping；詳 `docs/status/kb-availability-2026-04-18.md`。

最後更新：2026-04-02
來源：https://finmindtrade.com/llms-full.txt + https://finmind.github.io/llms.txt

## API 基本資訊

- Project operating rule: 付費帳號，`1600 req/hr`（依 `claude.md`）
- Base URL: `https://api.finmindtrade.com/api/v4`
- Auth: `Authorization: Bearer {token}`
- Legacy early-April note: 舊文件曾記 `600 req/hr (有 token) / 300 req/hr (無 token)`；那是免費/舊假設，不是本 repo 目前 limiter 假設
- Bulk query (省略 data_id): Backer/Sponsor 才能用

## 目前已接入的 datasets (api/finmind.js)

| Dataset                                  | 用途           | 關鍵欄位                                                                  |
| ---------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| TaiwanStockInstitutionalInvestorsBuySell | 三大法人       | date, stock_id, name(Foreign_Investor/Investment_Trust/Dealer), buy, sell |
| TaiwanStockMarginPurchaseShortSale       | 融資融券       | date, stock_id, MarginPurchaseTodayBalance, ShortSaleTodayBalance         |
| TaiwanStockPER                           | PER/PBR/殖利率 | date, stock_id, PER, PBR, dividend_yield                                  |
| TaiwanStockFinancialStatements           | 損益表         | date, stock_id, type, value, origin_name                                  |
| TaiwanStockDividend                      | 股利政策       | date, stock_id, CashEarningsDistribution, StockEarningsDistribution       |
| TaiwanStockMonthRevenue                  | 月營收         | date, stock_id, revenue, revenue_month, revenue_year                      |

## 高價值未接入 datasets

### P0 — 免費可用，直接補強分析

| Dataset                           | 價值                                         | Tier |
| --------------------------------- | -------------------------------------------- | ---- |
| **TaiwanStockBalanceSheet**       | 資產負債表 — 負債比、股東權益、總資產        | Free |
| **TaiwanStockCashFlowsStatement** | 現金流量表 — 營運/投資/融資現金流            | Free |
| **TaiwanStockDividendResult**     | 除權息實際結果 — 填息狀況追蹤                | Free |
| **TaiwanStockShareholding**       | 外資持股比率（ForeignInvestmentRemainRatio） | Free |
| **TaiwanStockNews**               | 個股新聞 — title, description, link, source  | Free |
| **TaiwanStockSecuritiesLending**  | 借券餘額 — 高借券費率 = 空頭壓力             | Free |
| **TaiwanDailyShortSaleBalances**  | 融券+借券完整空單餘額                        | Free |
| **TaiwanStockDayTrading**         | 當沖比率 — 投機情緒指標                      | Free |

### P1 — Backer 才能用，有戰略價值

| Dataset                                   | 價值                           | Tier   |
| ----------------------------------------- | ------------------------------ | ------ |
| **TaiwanStockHoldingSharesPer**           | 持股分布（散戶 vs 大戶集中度） | Backer |
| **TaiwanStockMarketValue**                | 每日市值                       | Backer |
| **TaiwanStockIndustryChain**              | 產業鏈分類                     | Backer |
| **TaiwanBusinessIndicator**               | 景氣指標（領先/同時/落後）     | Backer |
| **TaiwanFuturesOpenInterestLargeTraders** | 期貨大額交易人留倉 — 大戶動向  | Backer |
| **CnnFearGreedIndex**                     | 恐懼貪婪指數                   | Backer |

### P2 — Sponsor 獨占，夢幻級數據

| Dataset                              | 價值                          | Tier    |
| ------------------------------------ | ----------------------------- | ------- |
| **TaiwanStockTradingDailyReport**    | 券商分點買賣超 — 籌碼分析聖杯 | Sponsor |
| **TaiwanstockGovernmentBankBuySell** | 八大行庫買賣超 — 國安基金動向 | Sponsor |
| **taiwan_stock_tick_snapshot**       | 即時快照                      | Sponsor |

## 架構筆記

- FinancialStatements/BalanceSheet/CashFlows 共用 type/value/origin_name schema，需要 pivot
- TaiwanStockDividend = 政策公告，TaiwanStockDividendResult = 實際除權息結果
- Free tier 每次只能查單一個股（必須帶 data_id），Backer 可以省略查全市場
- 沒有「董監持股變動」dataset，需要另找來源（MOPS）
