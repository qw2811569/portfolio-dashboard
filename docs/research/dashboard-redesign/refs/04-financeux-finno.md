# Ref 04 · Financeux — Finno (digital wallet / cashback / crypto, tablet-first)

**主入口**：[`../INDEX.md`](../INDEX.md) ｜ **Ref 索引**：[`./README.md`](./README.md)

- **來源**：[`https://www.financeux.com/work/finno`](https://www.financeux.com/work/finno)
- **設計工作室**：BN Digital（financeux.com，跟 Ref 02/03 同工作室）
- **客戶**：NDA Fintech Co.（Atlanta, Georgia）
- **產品定位（官方原話）**：「Gateway to secure, simple, and fast transactions」+ 數位錢包 / cashback / 加密貨幣
- **取得日期**：2026-04-27
- **由誰提出**：用戶
- **檔案**：4 張主圖 + 全文 + HTML 已落檔在 [`./04-financeux-finno/`](./04-financeux-finno/)
  - `finno-Img_01.webp` — hero 場景（**iPad** 放暗岩石上，"Start Doing More with Finno" 著陸頁）
  - `finno-Img_02.webp` — 3 iPad grid（Send Again / Your Accounts / Bitcoin price chart）
  - `finno-Img_03.webp` — 桌面版「Cash Back Deals」+ 月份 pill row「Your Activity」
  - `finno-Img_04.webp` — 局部放大（01-04 numbered list / Chase Balance / 卡片 nav 細節）
  - `page-text.md` — case study 全文
  - `page.html` — 原始 HTML

## 為什麼存這份

前三份（Ron / Vorxs / Paydex）都 **mobile / phone-first**。Finno 是**tablet + desktop-first**，這跟我們持倉看板的實際 form factor（Vercel 網頁，desktop 為主）**完全對齊**。

另外 Finno 的視覺語言**最跳脫**：水彩漸層背景 + 中空外框 display 字 + 大量 humanist 細節（avatar 泡泡 / 笑臉 emoji / 軟糖色）。這提供了「**如果我們不走工業 utility 而是 humanist warm**」的具體參考。

## 視覺 / 互動觀察

### 配色

- **底**：奶油白 / 米白（`#F5F1E8` ish），不是純白
- **動態 accent**：**水彩漸層 mesh blob** — 薄荷綠（`#A8E5C7` ish）+ 淡藍（`#B8DDE0` ish）+ 米黃，整面背景像噴霧暈染
- **主字**：墨黑（純文字 + 中空外框混用）
- **次要 chrome**：黑色填充按鈕 / 黑色 icon
- **無 secondary 色階**：跟 Ron Design 同紀律，但用「漸層 mesh」做出**情緒層**而非用第二 accent
- 完全沒有 coral / red / yellow 警示色 — 因為 cashback / 數位錢包是「正向引導」mood，沒警示需求

### 字型

- **主 UI 字**：Geometric humanist sans（看起來像 Söhne / Switzer / Inter Display），重 weight 黑體
- **Hero display 字**：**solid + outline 混用** — `CASH BACK DEALS` 中「CASH」實心黑、「BACK」中空外框。同一行字內製造視覺紋理。`SEND AGAIN` 也是同 pattern（前實後虛或前虛後實）
- **數字**：humanist sans display，跟 UI 字同字型但巨大（`$1,245.21` 佔卡片 1/3）
- **label**：常規 sans，混排（不像 Paydex 全 mono）

### 主互動模式 — Sidebar Nav + 章節 Hero + 行動推薦 Grid

整體版型是**經典 desktop SaaS dashboard**，但細節做得很有設計感：

**(A) 左側持久 sidebar nav**：

- `Dashboard / Finances / Contacts / Deals / Wallet / Activity` 主導航
- `Help / Settings / Notifications` 次導航（下方）
- active state = 黑底白字膠囊
- 跟我們持倉看板**頂部 9 tab** 是不同方向的選擇

**(B) 主內容區 hero 章節標題**：

- 進入每章節（Cash Back Deals / Your Accounts / Your Activity）有**大 hero 章節標題**
- 標題用 solid+outline 混排製造視覺地標
- 標題不是「資料」，是「導引讀者目前在哪一段」

**(C) 行動推薦 grid**：

- Cash Back Deals = 6 個品牌 logo 卡片 grid（Walmart / Target / Domino's / Alibaba / ABC + 1 空 slot）
- 每個卡片：品牌 logo + 名稱 + 條件（`2% cash back`）+ 右側 `+` 加入按鈕
- 不是「資料展示」是「推薦 + 行動觸發」

**(D) 月份膠囊 row**：

- `Jan / Feb / Mar / Apr / May / Jun / Jul / Aug / Sep / Oct / Nov / Dec` 12 顆膠囊
- active month（Apr）用更深邊框 + 更高一點，其他扁平
- 取代傳統 datepicker / dropdown

### 資料密度

**中**。明顯比 Vorxs / Paydex 低，但比 Ron Design 高很多。Finno 走「情緒優先 + 資料適量」路線：每頁主要 1-2 個 hero 章節，每章節 4-6 張子卡。

→ 我們持倉看板的「概覽 / Daily 收盤分析」可以借這個密度級別。但「持倉明細 / 交易日誌 / 全組合研究」需要的是 Paydex 那種高密度，**不適合 Finno 模式**。

### 動效角色（推測）

從漸層 mesh 推測有動：

- 背景 mesh 緩慢漂移（10s+ loop，類似 Apple 系統 wallpaper）
- Hero 章節標題進場可能有 outline → solid 的填充動畫
- 月份膠囊切換有彈性 spring transition

合 [`2026-04-26-motion-relax`](../../../decisions/2026-04-26-motion-relax.md)「動畫服務易讀性 + 觀賞性」原則。

### Tab Bar / Navigation

**Sidebar 持久型 nav**（左），不是底部 tab bar。這跟 Vorxs / Paydex 的 mobile 抽屜模式相反，**完全 desktop SaaS pattern**。

→ 我們持倉看板**桌面版**現用頂部 9 tab。要不要考慮**桌面 sidebar + 行動 top tab** 的雙模式？這需要重新檢討但不在本研究 scope（per 9 tab 已鎖死）。**但 sidebar 模式可借鑒給 Daily 收盤分析這類「需要章節導覽」的長頁面**做局部 sub-nav。

### Avatar Bubble Cluster（Img_02）

「Send Again」段落用**重疊圓形**展示常用聯絡人：

- 3-4 個圓圈交錯重疊，每圈裝一個人像 + 名字標籤
- 圓圈大小不一，最近聯絡的最大
- 整組形成「人際關係網」視覺

→ 這個我們**多 portfolio 切換器**可以借鑒（per `claude.md` R7.5 多 portfolio = 多 persona）。每個 portfolio 一顆泡泡（玖采組 / 金聯成董座 / 短期波段組），active 那顆放大放前面。

### Numbered List `01.` ~ `04.` for Tabs（Img_04 左上）

`01. Loyalty Card / 02. Donate / 03. Savings (active) / 04. Gifts`：

- 每行：`<編號 outline pill> + <標籤 outline pill>` 兩段式
- active = 雙 pill 都填實線邊框
- inactive = 雙 pill 都是淡灰 ghost
- 右側 icon 提示分類

→ **持倉個股 detail 內部 sub-tab** 可借鑒：`01. 基本面 / 02. 籌碼面 / 03. 技術面 / 04. 事件回顧`。比卡片堆疊或下拉選單更明確。

### Quick-Amount Pills（Img_04 左下）

`$20 / $50 / $100` 三個圓角邊框膠囊，點一下就帶值。

→ 可借鑒到「快速設停利停損」：`+5% / +10% / +15%` 三顆 pill。或「快速調整曝險」：`+10萬 / +50萬 / +100萬`。

### 章節編號 Marker（Img_04 右上）

`04 assets` — 大數字 `04` + 小字 `assets`，當作章節標識符放在區段右上角。

→ Daily 收盤分析 long page 內部章節分隔可借：`01 主因 / 02 籌碼 / 03 風險`。

### 笑臉 Emoji 😊 在右上角（Img_03）

純表情符號當 sentiment indicator。**跟我們投資場景完全不合**（投資 sentiment 不該用 emoji 表達），但記下這 pattern 證明 Finno 走的是「lifestyle app」mood，不適合我們抄。

### Hybrid Solid+Outline Display Typography

最強烈的視覺簽名：

- `CASH BACK DEALS`：CASH 實心、BACK 中空、DEALS 實心
- `SEND AGAIN`：SEND 實心、AGAIN 中空
- `YOUR ACTIVITY`：YOUR 實心、ACTIVITY 中空
- `YOUR ACCOUNTS`：YOUR 實心、ACCOUNTS 中空

→ 規律是「修飾詞實 + 名詞中空」或「主詞實 + 動詞中空」。每段 2 字，前實後虛。

我們可借鑒到 hero metric 標籤：`今日 損益`、`本月 報酬`、`累計 部位` — 前 2 字實心、後 2 字中空。**但僅限超大字級**（≥48px），小字會閱讀困難。

## 可借鑒到本專案的點

| #   | Pattern                        | 怎麼用在持倉看板                                                                   |
| --- | ------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | Tablet/desktop-first 版型      | 持倉看板原本就 desktop-first，視覺基準應該對齊 Finno 而非 phone-first 的 Ref 01-03 |
| 2   | Hybrid 實心+中空 display 字    | Hero metric 標籤 `今日 損益` / `本月 報酬` 用前實後虛（僅限 ≥48px）                |
| 3   | 月份膠囊 row                   | 事件 tracker / 交易日誌 的「歷史月份切換」用 12 顆 outline pill 取代 dropdown      |
| 4   | Avatar bubble cluster          | **多 portfolio 切換器** = 重疊圓泡泡，每組一顆，active 最大最前                    |
| 5   | Numbered sub-tab `01./02./03.` | 個股 detail 內部 sub-tab（基本面/籌碼面/技術面/事件）                              |
| 6   | Quick-amount pills             | 快速停利停損（+5/+10/+15%）、快速曝險調整（+10萬/+50萬）                           |
| 7   | 章節 marker `04 assets`        | Daily 收盤分析長頁面內部章節編號                                                   |
| 8   | 大 hero 章節標題               | 每個章節之間用 8-10rem 的章節標題作視覺分隔，取代純粹「上一個 card 結束」          |
| 9   | Sidebar 局部 sub-nav           | Daily 收盤分析這類長頁面內部用 sidebar 作章節跳轉                                  |

## 不適用本專案的點

1. **水彩漸層 mesh blob 背景** — 對「投資理財決策」mood 太柔，會讓資訊權威感降低。我們有 7-8 位數的金額，視覺需要嚴肅一點。**色相方向不抄**。
2. **笑臉 emoji 😊 sentiment** — 投資 sentiment 不該用 emoji，會讓 sophisticated 用戶覺得 toy。
3. **Cash back / 品牌 logo grid** — 我們不是 cashback app，這個版型不可平移。
4. **Sidebar nav 取代頂部 tab** — 9 tab 結構鎖死（per 2026-04-18 SA），不重開。但**頁內局部 sub-nav** 可借（如 #9）。
5. **iPad 巨大 hero** — 我們 desktop 不是 tablet，比例不同。要做要調整。
6. **完全沒有警示色** — 投資場景必須有「停損 / 異常 / 警示」明確視覺信號（per Vorxs/Paydex 的 coral）。Finno 那種「全正向」mood 不夠。

## 給 Codex 的提問（待 Round 1 討論）

1. **桌面版 sidebar 局部 sub-nav 落點**：
   - 哪幾個現有 page 是「長頁面 + 多章節」？（grep `useRoute*Page` 找）
   - 哪幾個適合導入內部 sidebar / sticky 章節 nav？
2. **Hybrid 實心+中空字 hero label 渲染代價**：
   - Tailwind 有沒有 `-webkit-text-stroke` utility？還是要寫 custom class？
   - 字型支援嗎？我們現在用什麼字型？要不要 swap 到 humanist sans display weight?
3. **多 portfolio avatar bubble switcher**：
   - 既有 `usePortfolioAccounts` hook 結構支援自訂 avatar / icon 嗎？
   - 如果要做 bubble cluster，元件 path 應該放哪裡？（chrome 層 / Header / drawer）
4. **月份膠囊 row 跟 events / 交易日誌 整合**：
   - 既有月份切換是哪種 UI？（dropdown / segmented control / pagination）
   - 換成 12 顆 pill row 對 mobile 寬度影響？
5. **Quick-amount pills 對 trade 流程**：
   - 既有 `TradeDisclaimerModal` / 新增交易 form 有沒有快速金額／百分比？
   - 加 quick-amount pills 的 PR scope？

## 四 ref 收斂表（Refs 01 + 02 + 03 + 04）

| 維度        | Ron Design    | Vorxs               | Paydex                  | Finno                            | 我們持倉看板會選                        |
| ----------- | ------------- | ------------------- | ----------------------- | -------------------------------- | --------------------------------------- |
| Form factor | phone         | phone               | phone                   | **tablet/desktop**               | **desktop**（Finno 對齊）               |
| Mood        | 純白極簡      | sage olive 暖 card  | 黑底工業 utility        | 米白漸層 humanist                | **暖 humanist + 適度密度 + 警示色**     |
| accent      | 1 (黃)        | 2 (coral 警示 + 黃) | 1 (coral 全功能)        | 0（漸層 mesh 取代）              | **2 (coral 警示 + 待定第二色)**         |
| 資料密度    | 極低          | 中                  | 高                      | 中                               | **中-高**                               |
| 數字字型    | dot-matrix    | 寬 sans display     | mono terminal           | humanist sans display            | **humanist sans display + mono table**  |
| Hero 標籤   | 標準 ALL CAPS | 標準 ALL CAPS       | mono ALL CAPS           | **hybrid 實心+中空**             | **hybrid 實心+中空（限超大）**          |
| nav         | 底 pill bar   | 抽屜                | 抽屜 + `01./02.` 編號   | **左 sidebar + sub-章節編號**    | 9 tab 鎖死，頁內局部 sidebar 借用       |
| 章節分隔    | n/a           | 卡片堆              | 色塊章節 + date divider | **大 hero 章節標題 + chap 編號** | **章節標題 + date divider 混用**        |
| 互動觸發    | 平靜          | 中性 form           | calculator numpad       | **avatar bubble + quick pills**  | **bubble (portfolio) + pills (快金額)** |

**四 ref 都同意（極強信號）**：

- ✅ Hero number 獨立 display 字型 + 字級陡（差 3-4 層）
- ✅ Accent ≤2 種，禁止多色階堆疊
- ✅ 次要資訊降階到淺灰
- ✅ 動效服務易讀性，不裝飾

**3+/4 同意**：

- ✅ 多 chunk spotlight（Ron 是極端例外不算）
- ✅ 色塊 / 色相分章節（Ron 是極端例外不算）
- ✅ 章節標題或 chapter marker 作視覺分隔（Vorxs / Paydex / Finno）

**只 Finno 提供**：

- ⚠️ Tablet/desktop-first 排版（**對我們 form factor 對齊 ✅**，極可借鑒）
- ⚠️ Hybrid 實心+中空 display 字（待驗證適合中文字 / 我們字型）
- ⚠️ Avatar bubble cluster（多 portfolio 切換器有發揮空間）
- ⚠️ Quick-amount pills（trade 流程能借）
- ⚠️ Sidebar sub-nav for long pages（Daily 收盤分析能借）

**只 Vorxs/Paydex 提供，Finno 沒有**：

- ✅ Coral 警示色（Finno 沒警示需求所以省了，但**我們有**，必須補回）

## 跟 Refs 02/03 的 cross-reference 結論升級

Ref 04 提供「**desktop SaaS** + **humanist mood**」的具體參考，補齊了前 3 ref 的 phone-first / utility-mood 缺口。

**最後合成方向**（給 Round 1 討論）：

> **mood 取 Vorxs 的暖 + 加入 Finno 的 humanist + tablet/desktop 比例 + Paydex 的資料密度紀律 + 全部三者的紀律共識（hero / accent / 層次陡 / chunk spotlight）**

對應到具體決策：

- **頁面比例**：desktop 為主（per Finno）
- **色彩 mood**：奶油白底（per Finno）+ sage olive 卡片（per Vorxs）+ coral 警示（per Vorxs/Paydex）
- **字型**：humanist sans display（hero）+ mono（資料 table 值）— 雙字型（per Paydex/Finno 各取一）
- **資料密度**：頁類分階 — 概覽 / Daily 走中密度（per Vorxs/Finno）；持倉 / 交易日誌走高密度（per Paydex）
- **互動觸發**：portfolio switcher = avatar bubble（per Finno）；trade input = calculator mode（per Paydex）；快速金額 = pills（per Finno）
- **章節分隔**：hero 章節標題（per Finno）+ date divider（per Paydex）+ key-value table for detail（per Paydex）
- **特殊紋理**：sunburst 重量感（per Vorxs）；sparkline 純色 bar（per Paydex）— 不超用，每頁限 1 個視覺驚喜
