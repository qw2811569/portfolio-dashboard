# Target Price Scraping Source Investigation

**日期**：2026-04-16
**作者**：Codex
**狀態**：per-firm blocked · aggregate via CMoney phase 3 live（2026-04-16 接 CMoney notes pipeline）
**主題**：Phase 3 券商目標價 / target price scraping source 選型

## 結論

原 brief 指定的 3 個候選來源，**目前都不適合作為「10+ 家投顧目標價明細」的 production scraping source**：

1. **Goodinfo.tw**
   - `robots.txt` 對 `/tw/StockAnalyst.asp` 沒有明文禁止。
   - 但指定 URL `https://goodinfo.tw/tw/StockAnalyst.asp?STOCK_ID=2330` 目前直接回 **HTTP 404**，不是 bot block，而是頁面不存在。
   - 實測回應顯示 IIS 404，實體路徑為 `D:\\Web\\StockTW\\StockAnalyst.asp`。

2. **Yahoo 股市 TW**
   - `https://tw.stock.yahoo.com/robots.txt` 對多個 AI crawler 明文列出：
     - `User-agent: ChatGPT-User`
     - `User-agent: ClaudeBot`
     - `User-agent: GPTBot`
     - `User-agent: anthropic-ai`
     - `Disallow: /`
   - 雖然 `User-agent: *` 不是全站禁止，但本專案是 LLM agent 執行資料蒐集，**不應選用對 AI bot 明文封鎖的來源**。

3. **鉅亨網 cnyes**
   - `robots.txt` 沒有禁止 `/twstock` 路徑，公開頁可讀。
   - 研究頁 `https://www.cnyes.com/twstock/2330/research/finirating` 可正常載入。
   - 但 SSR 與公開 API 只曝露 **aggregate consensus**，例如：
     - `targetValuation`
     - `factSetEstimate`
     - `https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/targetPrice/TWS:2330:STOCK`
     - `https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/factSetEstimate/TWS:2330:STOCK`
   - 這些資料只有高低均值、中位數、評級分布，不含本 task 必要欄位：
     - `firm`
     - `target`
     - `stance`
     - `date`
   - 也就是說，**鉅亨最多只能當 aggregate fallback，不能滿足 per-firm report ingestion**。

## 證據摘要

### Goodinfo

- `robots.txt`: `Allow: /`
- 實測：
  - `curl -I 'https://goodinfo.tw/tw/StockAnalyst.asp?STOCK_ID=2330'`
  - 回 `HTTP/2 404`

### Yahoo

- `robots.txt` 明文：
  - `User-agent: ChatGPT-User`
  - `Disallow: /`
  - `User-agent: ClaudeBot`
  - `Disallow: /`

### cnyes

- 研究頁可開：
  - `https://www.cnyes.com/twstock/2330/research/finirating`
- 公開 aggregate API 可開：
  - `https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/targetPrice/TWS:2330:STOCK`
  - `https://marketinfo.api.cnyes.com/mi/api/v1/financialIndicator/factSetEstimate/TWS:2330:STOCK`
- 但資料內容僅含：
  - `feHigh`
  - `feLow`
  - `feMean`
  - `feMedian`
  - `feBuy/feHold/feSell`
  - `numEst`

## 決策

**不實作三選一 scraping 版本**，因為無法達成驗收標準，硬上只會做出一個看起來有資料、但其實拿不到券商明細的假 solution。

## 歷史脈絡（R135 merge）

### 2026-03-23 已定下的底線

- 目標價 lane 要維持 **全域 per-stock cache**，不是 per-user 現場重跑。
- 必須有 **hard fallback chain**，避免 UI 出現看起來壞掉的空白欄位。
- 權證最終要 map 回標的股，不能把 warrant 當成獨立 target-price truth。
- 真正可持續的版本需要 **async / segmented batch**，而不是把所有來源壓進單一短任務。

### 2026-04-15 已確認的 runtime 問題

- Phase 1 的主要修復是 cron timeout、RSS query 過嚴、Blob 寫不進去、UI skip list 沒對齊。
- 即使這些 plumbing 修完，覆蓋率仍停在 `4/11`，表示瓶頸已不是 parser 或排程，而是 **來源本身沒有足夠 firm-level target rows**。
- 因此 4/15 的「換 provider / 擴資料源」只是排查方向，不再構成「公開來源裡一定找得到 per-firm 明細」的前提。

### 本檔與歷史檔的關係

- `2026-03-23-target-collection-strategy.md` 的 cache / fallback / async 原則保留。
- `2026-04-15-target-price-pipeline-fix.md` 的 timeout / observability / skip-list 修復保留。
- 但「公開來源可補齊 10+ 家投顧明細」這個假設，到 2026-04-16 為止已被正式關閉。
- 目前 live lane 是：**per-firm public source blocked；aggregate 由 CMoney Phase 3 與 cnyes 類來源承接 fallback。**

## 建議下一步

改走下列其中一條：

1. **授權可用的付費/授權 API**
   - 例如 CMoney、FactSet、Refinitiv、券商研究資料供應商。
   - 這是唯一穩定達成 `firm + target + stance + date` 的方法。

2. **改 acceptance**
   - 若接受 aggregate consensus 而非 per-firm reports，可用 cnyes：
     - `median/high/low/numEst`
     - `buy/hold/sell distribution`
   - 但這不等於原本要求的 10 家投顧明細。

3. **提供已登入且允許使用的來源**
   - 若團隊有合法可用的 CMoney / 中信 / 其他授權頁面與 session，才能再評估 authenticated scraping。

## 對原 brief 的反駁

原 brief 的核心假設是：

> 「三個候選裡至少有一個可合法且穩定拿到 10+ 家投顧明細」

實測結果否定這個假設：

- Goodinfo：路徑失效
- Yahoo：對 AI crawler 明文禁止
- cnyes：只有 aggregate，沒有 firm-level rows

所以如果目標不變，**更好的方案不是再調 parser，而是換資料授權策略**。
