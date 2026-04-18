# 持倉看板 System Analysis

> 日期：2026-04-18  
> 文件類型：SA（System Analysis）  
> 目標讀者：PM / Stakeholder / 新加入團隊 / Phase 2 規劃者

---

## 1. Executive Summary

持倉看板是一個給台股投資決策使用的個人工作站，不是單純的持股列表，也不是新聞聚合頁。
它把開盤前、盤中、盤後、週末四種節奏串成一條可執行 workflow，目標是讓使用者在有限時間內看清楚持股、理解催化、做出下一步判斷，並留下可回顧的決策痕跡。
產品的差異化不在「更多資訊」，而在「把資訊整理成可決策的結構」：持股 dossier、論述 scorecard、事件追蹤、研究輸出、交易記錄與教練式回顧共同運作。
這是一個內部 beta 階段產品，優先級是穩定、準確、可持續擴充，不追求社群化、公開 watchlist 或多租戶商業化。
Phase 1 的核心成功標準，是讓小奎與金聯成董座兩種使用情境都能在同一套產品裡自然成立，且不因 insider 身分或台股語境而產生錯誤建議。

---

## 2. 產品願景

### 2.1 願景定義

持倉看板的任務，是把「投資焦慮」轉成「有結構的判斷」。

它不是要讓使用者每天無限滑資料，而是建立一個明確節奏：

- 開盤前知道今天該注意什麼。
- 盤中快速定位哪個持股需要深看。
- 盤後完成唯一一次 ritual 式檢視。
- 週末拿到一份能對自己與 stakeholder 交代的週報。

### 2.2 五條驗收標準

1. 分析要準，不可以把資料幻覺包裝成語氣自信。
2. 視覺要美，且是有品味、有節制、可久看的美。
3. 使用後要比較冷靜，而不是更焦躁。
4. 每一頁都要能指向「下一步」而不是停在資訊展示。
5. 要能同時服務技術型操作者與審美敏感的高階 stakeholder。

### 2.3 產品定位

- 產品類型：台股投資決策工作站
- 主要市場：單一使用者自用 + 內部熟人代操 / 顧問式協作
- 主要平台：Web，優先考慮 iOS Safari
- 使用頻率：高意圖、低頻 ritual；不是社群 feed
- 核心價值：結構化理解、顧問式輸出、合規邊界清楚

### 2.4 非目標

- 不做公開社群型觀察股頁
- 不做即時聊天室
- 不做盤中高頻交易終端
- 不做券商下單
- 不做一般投資論壇式內容牆
- 不以 dark mode 作為 Phase 1 必要條件

---

## 3. User Personas

### 3.1 Persona A：小奎男技術咖

| 欄位     | 定義                                                       |
| -------- | ---------------------------------------------------------- |
| 身分     | 產品設計者、第一位真實用戶、主操作者                       |
| 裝置     | iPhone + Mac                                               |
| 使用習慣 | 願意看數字、熟悉技術詞、能接受資料密度                     |
| 核心需求 | 盤前知道今天風險與催化，盤後快速完成分析，週末有可回顧輸出 |
| 痛點     | 資料分散、訊號過多、事件與持股 thesis 沒有被同一套結構接住 |
| 期待語氣 | 像懂市場的顧問或資深同事，不要像 AI 範本                   |
| 決策方式 | 會看證據、看變化、看異常，重視可驗證性                     |

### 3.2 Persona B：金聯成董座女愛美 insider 7865

| 欄位     | 定義                                                             |
| -------- | ---------------------------------------------------------------- |
| 身分     | 高階女性 stakeholder、上市公司董座、管理階層                     |
| 關鍵持股 | 金聯成帳戶持有 7865，自家股，屬 insider 情境                     |
| 使用習慣 | 不想被技術詞轟炸，對畫面質感、文字分寸與可信度高度敏感           |
| 核心需求 | 看懂整體狀態、知道風險、知道該注意什麼，但不能出現不合規建議     |
| 痛點     | 一般投資工具太醜、太 tech、太像 AI；也常忽略管理階層持股的特殊性 |
| 期待語氣 | 顧問化、成熟、克制、乾淨，不指手畫腳                             |
| 決策方式 | 看整體調性、風險敘述、合規邊界、週報是否可對外解釋               |

### 3.3 共同需求

- 兩位 persona 都要信任系統的數字與來源。
- 兩位 persona 都需要下一步建議，但建議形式不同。
- 兩位 persona 都需要「不被嚇到」的提示系統。
- 兩位 persona 都不接受 AI 味濃厚的流水帳輸出。

### 3.4 差異化需求

- 小奎可以接受框架、scorecard、z-score、sparkline。
- 金聯成董座需要技術詞外露減量，並在 insider 情境下只看風險與合規敘述。
- 小奎重 workflow completeness。
- 金聯成董座重產品成熟度、信任感與美感。

---

## 4. Business Context

### 4.1 台股語境

本產品服務的是台股決策流程，不可套用美股預設語意。

- 台股語境採紅漲綠跌。
- 正向、獲利、上漲應用偏紅的 warm family。
- 負向、下跌、虧損採中性深灰黑，不放大恐慌。
- 綠色不作為主要結構或正向語義。

### 4.2 Insider 7865 的商業與合規前提

- `7865` 在金聯成帳戶裡代表自家股情境。
- 這不是髒資料，而是正確且需保留的商業前提。
- 系統必須辨識「同一股票在不同 portfolio 身分不同」。
- insider 規則是 per-portfolio，不是 per-stock 全域鎖死。
- 對 insider 部位，系統只做紀錄、風險、狀態、合規敘述，不做 AI 買賣建議。

### 4.3 使用節奏

這不是 daily scrolling product，而是固定 ritual product。

- 08:30 前後：讀 Morning Note
- 盤中：必要時查 Holdings / Detail Pane / Events
- 14:00 後：做唯一一次盤後檢視與 streaming 收盤分析
- 週日 20:00：接收 Weekly PDF

### 4.4 Stakeholder 場景

- PM 需要快速理解 scope 與 phase 切分
- 董座需要看懂產品成熟度與合規分寸
- 新人需要一份不用追 88 輪討論也能上手的文件
- 工程與設計要有穩定 contract，可在不重開產品辯論的情況下實作

---

## 5. Route 清單與每頁 User Goal

### 5.1 Route 原則

- 正式 IA 為 8 頁
- `Watchlist` 不列入正式 route
- 每一頁都必須回答單一使用意圖
- 所有頁面共用同一層 portfolio / dossier / events / logs / context

### 5.2 八頁定義

| Route     | 頁面目的     | 使用者核心問題                           | 主要輸出                                                   |
| --------- | ------------ | ---------------------------------------- | ---------------------------------------------------------- |
| Dashboard | 每日總覽入口 | 今天先看什麼？                           | Morning Note、Today in Markets、KPI、Daily Principle、焦點 |
| Holdings  | 持股工作台   | 哪些部位值得我現在深入看？               | 多組合切換、篩選、持股列表、detail pane                    |
| Events    | 催化驗證     | 哪些事件將影響 thesis，哪些該回頭驗證？  | upcoming / pending / reviewable event timeline             |
| News      | 情報脈絡     | 今天有哪些新情報值得記住，但還不到結論？ | 新聞分流、客觀摘要、來源時間                               |
| Daily     | 收盤分析     | 盤後我該怎麼總結今天與安排明天？         | streaming close analysis、top actions、pillar review       |
| Research  | 全組合研究   | 哪些持股需要更深研究與策略輸出？         | research reports、信心標記、資料待補                       |
| Trade     | 上傳成交     | 如何快速把成交單變成系統狀態？           | upload、parse、preview、apply                              |
| Log       | 交易日誌     | 我為什麼做這筆交易，之後學到什麼？       | journal、reflection、coachable history                     |

### 5.3 Dashboard

- 盤前與盤後的首頁入口
- 先給節奏，再給細節
- 不是總覽版 holdings table

### 5.4 Holdings

- 真正的日常工作台
- 支援多 portfolio 與多層次篩選
- 右側 detail pane 是核心，不是附加說明

### 5.5 Events

- 專注催化與驗證工作
- 用來回答「什麼時候該重看 thesis」
- 與 raw news 嚴格區分

### 5.6 News

- 只做情報整理，不搶事件的工作
- 不直接給買賣方向
- 目的在建立背景脈絡

### 5.7 Daily

- 盤後 ritual 中心
- 把今天的 market move、持股 thesis、行動建議整理成一份可讀輸出

### 5.8 Research

- 研究頁不是另一份 daily report
- 應聚焦較慢、較深、較可保存的研究輸出

### 5.9 Trade

- 目標是減少手動維護持倉成本
- 上傳與預覽是風險點，需強調安全與可回退

### 5.10 Log

- 記錄決策動機、情緒、結果
- 讓系統可累積教訓與回顧

---

## 6. Functional Requirements

### 6.1 三個時間節點

| 時段   | Feature        | 功能定義                                                   |
| ------ | -------------- | ---------------------------------------------------------- |
| 開盤前 | Morning Note   | 自動整理今日事件、觀察股、法人動向與關注提示，作為開場入口 |
| 盤後   | Close Analysis | 14:00 後串流生成的收盤分析，重點是總結與明日操作           |
| 週末   | Weekly PDF     | 每週整合持倉研究與變化的正式輸出，可供分享與 review        |

### 6.2 Morning Note

- 自動生成，不靠手動編輯
- 來源是 holdings、events、thesis、institutional flow、watch signals
- 是 Dashboard 的頂部入口
- 必須可作為其他頁面的 upstream entry，而不是孤島

### 6.3 Close Analysis

- 為盤後唯一 ritual
- 必須支援 streaming
- 內容需落到 tomorrow actions，不只總結漲跌
- 應回寫到 analysis history 與 relevant scorecard

### 6.4 Weekly PDF

- 週日固定產出
- 語氣偏顧問，不可像 AI 生成備忘錄
- 需有 insider 專屬 section 與 compliance wording
- 可作為 stakeholder review 材料

### 6.5 Multi-portfolio switcher

- 正式產品 feature，不可省略
- 可以切換真實 portfolio
- overview 與 portfolio 是不同 view mode，不是假 portfolio
- 資料儲存必須 pid-scoped
- owner-only cloud sync 是硬限制

### 6.6 Multi-filter

Holdings 頁至少需提供以下層次：

- type
- sector
- holding status
- thesis pillar 狀態
- search

### 6.7 Detail Pane

- 為右側 reading pane pattern
- 點選持股列後打開
- 是理解單一持股的主閱讀區
- 所有內容必須來自同一份 `HoldingDossier`

### 6.8 五個焦慮指標

| 代號 | 問題                 | 定義                              |
| ---- | -------------------- | --------------------------------- |
| X1   | 今天漲跌正常嗎？     | 7-day 相對大盤 z-score            |
| X2   | Thesis 還成立嗎？    | pillar 狀態與變化                 |
| X3   | 法人在我持股怎麼動？ | 5-day 法人買賣超 sparkline        |
| X4   | 部位集中度是否過高？ | concentration / Herfindahl 類指標 |
| X5   | 三天內有沒有事件？   | upcoming 3-day events 提示        |

### 6.9 Accuracy Gate

所有 AI pre-display 內容都必須先通過五條 gate：

1. 必須帶 source citation
2. 數字需對齊 dossier，不可幻覺
3. confidence < 0.7 時要顯性降級
4. insider 情境跳過 buy/sell 建議
5. prompt 內有 self-check step

### 6.10 Insider rules

- 顯示 `👑 公司代表` badge
- 不產出 AI 買賣建議
- 可顯示風險摘要、部位狀態、事件與合規提醒
- 自家新聞不做 AI impact judgment
- Weekly PDF 另立 insider section

### 6.11 Copy Tone Matrix

| Voice | 用途                   | 頁面傾向                     |
| ----- | ---------------------- | ---------------------------- |
| 顧問  | 高信任、成熟、帶方向   | Dashboard / Daily / Research |
| 編輯  | 整理脈絡、客觀轉述     | News / Events                |
| 同事  | 指令明確、協助完成工作 | Trade / Log                  |
| 系統  | 僅狀態、錯誤、進度     | 全站 status / error / helper |

### 6.12 Cross-page workflow

- Morning Note 要能 handoff 到 Events / Holdings / Daily
- Trade 完成後要同步 Holdings 與 Log
- Events 驗證結果要更新 thesis pillar
- Research 輸出要可引用同一份 dossier 與 lessons
- Close Analysis 不得自成孤島，需連回持股與歷史

---

## 7. Non-Functional Requirements

### 7.1 Responsive

| 裝置 | 寬度         | 基本要求                               |
| ---- | ------------ | -------------------------------------- |
| 手機 | 390px 代表寬 | 單欄、thumb-friendly、重要內容先於裝飾 |
| 平板 | 768px 代表寬 | 兩欄、可同時看列表與 detail            |
| 桌機 | 1200px 以上  | 穩定兩欄或大兩欄、右側固定 pane        |

### 7.2 Accessibility

- 目標對齊 WCAG AA
- touch target 至少 44x44
- dynamic type ready
- screen reader label 不得遺漏
- 顏色不能是唯一訊號來源

### 7.3 Performance

- iOS Safari 操作流暢，主互動目標 60fps
- streaming 首次完整出稿在 60 秒內
- skeleton 與 partial text 要避免閃爍感
- 資料載入延遲應有誠實反饋

### 7.4 i18n 與語言規則

- 主語言為台灣繁中
- meta label 可保留英文
- 系統外露詞需中文化，不用工程黑話
- 禁簡中
- 禁 PM spec 口吻直接外露給使用者

### 7.5 Truthfulness

- 每塊資料需有來源與時間
- stale / fallback 需可見
- 不可隱藏信心不足

### 7.6 Fallback / Resilience Plan

| 失效場景                     | 使用者前台表現                                          | 系統回退策略                                                            |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| FinMind API 掛掉             | 顯示 `last-fetch` 時間、`stale` badge、retry CTA        | 先保留最後一次成功資料，不把空資料偽裝成最新狀態                        |
| AI 幻覺或 `confidence < 0.7` | Accuracy Gate 隱藏建議區，只留 facts / source / warning | 不把低信心內容升格為 action；沿用既有 gate 規範                         |
| 券商成交單 parse fail        | 友善錯誤 copy、手動輸入入口、CSV template 下載          | 保留原始上傳檔，不直接套用半解析結果                                    |
| Vercel Blob 讀取失敗         | 顯示 snapshot 模式與資料時間                            | 回落讀 localStorage snapshot，維持最近一次可讀狀態                      |
| VM 掛掉                      | Vercel 側仍可開啟持倉看板                               | 以前端既有資料與 Blob / local snapshot 進 degraded mode，不讓整站不可讀 |

Fallback 原則：

- 寧可明示 degraded，也不能假裝正常。
- 所有 fallback 都要保留最後成功時間與下一步恢復手段。

---

## 8. Data Model / Workflow Objects

### 8.1 `HoldingDossier`

單一持股的 canonical object。

應包含：

- 基本持股資訊
- thesis scorecard
- events
- research mentions
- recent closes
- target / valuation context
- source / freshness metadata

### 8.2 `ThesisScorecard`

用來描述投資論述是否仍成立。

應包含：

- thesis statement
- pillars
- pillar status
- update log
- invalidation logic

### 8.3 `CatalystEvent`

用來描述一個催化事件，而不是普通新聞。

應包含：

- title
- date
- linked holdings
- expected impact
- review window
- pillar linkage
- review result

### 8.4 `TradeLog`

用來記錄實際交易、理由、結果與回顧。

### 8.5 `CoachLessons`

用來累積跨交易與跨 portfolio 的教訓。

- owner flows 要能看到
- 不應混淆為原始交易紀錄

### 8.6 `OperatingContext`

跨頁共享的工作脈絡物件。

應至少包含：

- current session mode
- nextActionLabel
- portfolio context
- ritual timing
- top warnings

---

## 9. Cross-page Integration Contract

### 9.1 Shared State

以下狀態不該被各頁重複定義：

- active portfolio
- view mode
- holdings
- events
- daily analysis history
- research history
- trade log
- coach lessons
- operating context

### 9.2 Handoff Rules

- Dashboard 點進來的 action 必須能跳到對應頁並帶 context
- Holdings detail pane 點事件，應能帶到 Events 的相同 object
- Events 驗證後，Daily / Research / Holdings 都要看到結果
- Trade apply 後，Holdings 與 Log 不能有狀態落差

### 9.3 Route-shell vs Canonical AppShell

- route hook 可以持有 view-state
- canonical domain state 應留在 AppShell runtime
- mutation 不應藏在 route-local isolated state
- 未來若導入正式 router，也不得破壞 shared contract

### 9.4 Canonical 原則

- `HoldingDossier` 是 detail pane / research / daily / PDF 的共同底座
- 事件與新聞分流
- insider 判斷需依 portfolio context 決定
- `OperatingContext.nextActionLabel` 為跨頁共享欄位

---

## 10. Decision Log

### 10.1 產品與商業

1. 正式產品名稱為「持倉看板」，與 Agent Bridge 分離。
2. 當前階段是 internal beta，先穩定再談商業化。
3. 觀察股頁不列入正式 8 頁 IA。
4. 產品節奏以盤後 single ritual 為核心，而不是即時 feed。

### 10.2 Persona 與合規

5. 產品需同時支援小奎與金聯成董座兩種使用情境。
6. `7865` 在金聯成 portfolio 中視為 insider holding。
7. insider 規則以 portfolio 維度決定，不是股票全域規則。
8. insider 顯示文案採 `👑 公司代表`，不用「內部人」。

### 10.3 IA 與 Workflow

9. 正式 IA 為 Dashboard / Holdings / Events / News / Daily / Research / Trade / Log。
10. Morning Note、Close Analysis、Weekly PDF 為三個時間節點主功能。
11. Holdings 頁必須包含 multi-portfolio switcher、multi-filter、detail pane。
12. News 與 Events 必須分流，不能共用同一種內容語意。

### 10.4 Data 與 Trust

13. `HoldingDossier`、`ThesisScorecard`、`CatalystEvent` 為核心 workflow objects。
14. 所有 AI pre-display 輸出必須通過 Accuracy Gate。
15. 低信心、stale、fallback 都要顯性呈現，不可默默吞掉。

### 10.5 視覺與語氣

16. Phase 1 使用 R88 後的新 palette，不沿用舊 sage system。
17. copy 分為顧問 / 編輯 / 同事 / 系統四種 voice。
18. 系統外露詞需中文化，避免工程術語直接出現在介面。

---

## 11. Phase 1 Scope Summary

Phase 1 的產品面交付，至少要完成以下事項：

- Dashboard 盤前與盤後模式成立
- Morning Note 可讀且可 handoff
- Holdings 的 multi-portfolio / filters / detail pane 成立
- 五個焦慮指標至少有明確 UI contract
- Close Analysis 與 Accuracy Gate 成立
- Trade 到 Holdings / Log 的同步打通
- Weekly PDF 有可交付版本
- insider UX 與 compliance wording 到位

---

## 12. 成功定義

如果一位新人只讀這份文件，就能回答以下問題，代表 SA 成功：

- 這產品是什麼，不是什麼
- 為什麼同時有小奎與金聯成董座兩種 persona
- 為什麼 insider 7865 是產品核心條件，不是例外髒資料
- 為什麼 Morning Note、Close Analysis、Weekly PDF 是主線
- 為什麼 detail pane、Accuracy Gate、五個焦慮指標屬於 Phase 1 核心

## Round 92 · Codex · SA/SD 補 + HTML render + nav · 2026-04-18 02:56 CST

- 補上 `Fallback / Resilience Plan`，把 FinMind、AI confidence、Trade parse、Blob、VM 五條退化策略寫成前台 contract。
- 規則鎖定為顯性 degraded、顯示 last successful fetch、提供 recovery path。
