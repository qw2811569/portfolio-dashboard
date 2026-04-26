# R12 QA · Codex 獨立報告

VM HEAD: 86da46e
拍照時間: 2026-04-27 00:35:35 CST

## A. 9 HIGH 議題評分表

| # | 議題 | 狀態 | commit | file:line | 截圖 | 備註 |
|---|------|------|--------|-----------|------|------|
| 1 | Mobile 首頁還不是「今天先做什麼」 | 部分修 | 553c0f0 | `src/components/overview/DashboardPanel.jsx:1996` `src/components/overview/DashboardPanel.jsx:2030` | `02-overview-mobile.png` | 第一屏已先出「今天先做 1 件事」，但 CTA 寫「去 Events 看日程」，5 秒 test 仍有英文 tab 名稱與目的不夠白話。 |
| 2 | 多頁仍有使用者看不懂的英文/工程詞 | 部分修 | 21e6450 | `src/components/holdings/HoldingsPanel.jsx:474` `src/components/holdings/HoldingsPanel.jsx:520` `src/components/log/LogPanel.jsx:868` | `02-overview-mobile.png` `05b-daily-mobile.png` `06b-trade-mobile.png` | 中文化有進展，但 `Events`、`Streaming 摘要`、`Trade 頁`、`Legal`、`Saved filter`、`存 filter`、`memo` 仍外露。這不是 docs-only 殘留，是使用者畫面。 |
| 3 | 研究頁先看到登入/補資料，不是「投資理由還在不在」 | 部分修 | 21e6450 | `src/components/research/ResearchPanel.jsx:169` `src/components/research/ResearchPanel.jsx:180` `src/components/research/ResearchPanel.jsx:202` | 未列入本輪 14 張 | Source 已新增 `research-thesis-status`，測試也鎖「before data repair controls」。但 R12 commit subject 沒宣告 HIGH#3，且本輪 visual-audit 不拍 research，不能算完整視覺驗收。判定：silent miss 被順手側修，仍需獨立截圖驗收。 |
| 4 | 收盤分析的狀態互相打架 | 沒修 | bbea62e / aa5c137 / 363065f | `src/components/reports/DailyReportPanel.jsx:1145` `src/components/reports/DailyReportPanel.jsx:1164` `src/components/reports/DailyReportPanel.jsx:2088` | `05-daily-desktop.png` `05b-daily-mobile.png` | Source 有 waiting CTA，但實際 VM 截圖仍同時顯示「等待明早 08:30」與「每檔今日該做」清單，還有「減碼分批 / 續抱」按鈕。這正是 audit 原 HIGH 的矛盾。recovery commit 後沒有守住。 |
| 5 | 持倉頁找賺最多/賠最多太慢 | 部分修 | 21e6450 / aa5c137 | `src/components/holdings/HoldingsPanel.jsx:1128` `src/components/holdings/HoldingsPanel.jsx:1142` `src/components/holdings/HoldingsPanel.jsx:1327` | `04-holdings-mobile.png` | Source 有 mobile quick entries，但位置在 ring 之後；390x844 第一屏仍先看到狀態卡、資料暫時卡、KPI、結構。散戶要找最大贏家/輸家仍要滑。不是 deliberate defer，是 silent miss/半修。 |
| 6 | Mobile 底部導覽遮內容，也遮交易提醒 | 沒修 | 553c0f0 | `src/index.css:45` `src/components/AppShellFrame.jsx:191` `src/components/Header.jsx:1382` `src/components/Header.jsx:1390` | `06b-trade-mobile.png` `08b-watchlist-mobile.png` | 有加 padding，但底部 nav 仍蓋住 trade modal 主按鈕；watchlist 第一張卡的數字區也被 nav/search 浮鈕切過。CSS safe-area 不是等於 overlay contract。 |
| 7 | 桌機版太多相似盒子，主次不清楚 | 沒修 | 無 | `src/components/common/Base.jsx:25` `src/components/common/Base.jsx:30` | `05-daily-desktop.png` `07-events-desktop.png` | Daily desktop 仍是整頁白底框、灰底列、同階層卡片。沒有 R12 commit 針對 shared Card hierarchy。判定 silent miss。 |
| 8 | 事件頁顏色與標籤太吵 | 部分修 | b9983d8 / 363065f | `src/components/events/EventsPanel.jsx:19` `src/components/events/EventsPanel.jsx:40` `src/components/events/EventsPanel.jsx:968` | `07-events-desktop.png` `07b-events-mobile.png` | 有把資訊型事件摺疊，也降低部分層級；但 filter 仍外露 `EARNINGS / EX-DIVIDEND / SHAREHOLDING-MEETING`，impact emoji 與多色 chip 還在。 |
| 9 | 桌機 filter 區比持倉內容還重 | 修了 | 21e6450 / aa5c137 | `src/components/holdings/HoldingsPanel.jsx:369` `src/components/holdings/HoldingsPanel.jsx:403` `src/components/holdings/HoldingsPanel.jsx:411` | `03-holdings-desktop.png` | 桌機預設 collapsed summary，表格提前露出，這條比 R11 明顯改善。仍有 expanded state 的 `Saved filter / filter` 英文，但不再壓過持倉內容。 |

未動到 5 條的 deliberate defer 判定：HIGH#7 是 silent miss；HIGH#6 是有 CSS 修但實際沒修；HIGH#5 是有側修但未達第一屏目標；HIGH#3 是有側修但本輪沒有 visual 驗收；HIGH#9 是實際已修，原「未動到」清單不符合目前 diff。

## B. §5 4 條紀律 grep 結果

- 多色: 未全清。`src/theme.js:222-224` 仍有 `cyanBg / amber / amberBg` alias；`src/components/events/EventsPanel.jsx:19-28` 事件類型仍映射 positive/up/amber/down/lavender/choco；`src/components/events/EventsPanel.jsx:40-45` impact label 仍用紅/綠/黃 emoji。
- gradient: 全清。指定 grep 無 production component 命中。
- glassmorphism: 全清。指定 grep 無 `backdrop-filter/backdropFilter` 命中。
- 大圓角: 未全清。代表例：`src/components/common/Base.jsx:30` Card 16、`src/components/common/Base.jsx:69` MetricCard 16、`src/components/AppShellFrame.jsx:77` 24、`src/components/trade/TradeDisclaimerModal.jsx:141` 24、`src/components/holdings/HoldingDrillPane.jsx:474` 999。

## C. 14 張截圖 hostile review

### 01-overview-desktop
- 第一眼: 左側是總覽，右側黑卡有焦點，但上方 controls 和 tab 太多，視線先被工具列切碎。
- 設計師挑剃: 白框、灰框、細線太多；真正主卡與下方焦慮卡層級接近，桌機像 debug dashboard。
- 散戶困惑: 「今天先看 5 個問題」下面又有多張卡，不知道先按哪一個。
- 評分: MEDIUM

### 02-overview-mobile
- 第一眼: 「今天先做 1 件事」在最上方，這是 R12 最有效的改善。
- 設計師挑剃: CTA 橘色太重且文案混 `Events`；底部 nav/search 浮鈕仍壓住內容尾端。
- 散戶困惑: 「3 天內 1 件」與「3 天後 · 115Q1 概估」不夠口語，會懷疑是不是財報日。
- 評分: MEDIUM

### 03-holdings-desktop
- 第一眼: 表格比 R11 早出現，filter 不再霸占半屏。
- 設計師挑剃: 右 rail、持倉結構、Top 5、表格全部同一種圓角卡，頁面仍重。
- 散戶困惑: 最大賺/賠有摘要，但被夾在很多統計後面，還不是最直接的入口。
- 評分: MEDIUM

### 04-holdings-mobile
- 第一眼: 先看到狀態卡和資料暫時卡，不是最大贏家/輸家。
- 設計師挑剃: 卡片堆疊太長，灰底列密度高，第一屏沒有清楚的「持倉排序」主角。
- 散戶困惑: 需要滑過結構與篩選後才進到持倉卡，找賺最多/賠最多仍慢。
- 評分: HIGH

### 05-daily-desktop
- 第一眼: 等待狀態和逐檔建議同時出現。
- 設計師挑剃: 整頁是同款長條灰卡，沒有「現在不能看建議」的強制視覺狀態。
- 散戶困惑: 上面說等 08:30，下面又叫我減碼分批/續抱，會不知道哪個可信。
- 評分: HIGH

### 05b-daily-mobile
- 第一眼: 「還有 25 件事件等待自動復盤」後立刻看到 `Streaming 摘要`。
- 設計師挑剃: waiting state、summary、逐檔行動全部同時渲染，狀態語言不一致。
- 散戶困惑: 「減碼分批」按鈕看起來可執行，但文案又說先照原計畫檢查。
- 評分: HIGH

### 06-trade-desktop
- 第一眼: 彈窗置中，背景有遮罩，主流程能辨識。
- 設計師挑剃: modal 內框太圓、卡中卡太多，checkbox 與 CTA 距離不夠像一步完成。
- 散戶困惑: 文案比以前白話，但「內部測試版」會降低信任。
- 評分: MEDIUM

### 06b-trade-mobile
- 第一眼: 交易提醒很大，但底部 nav 直接壓住主按鈕。
- 設計師挑剃: modal 與 bottom nav 同時爭最高層，這是明顯 polish bug。
- 散戶困惑: 勾選後不知道底下橘色按鈕是否可按，且 `Trade` / `Legal` 還是英文。
- 評分: HIGH

### 07-events-desktop
- 第一眼: 事件很多，filter 和 timeline 讓頁面像資料表。
- 設計師挑剃: 英文 chip、emoji、灰底內框仍太吵；b9983d8 只降了一部分噪音。
- 散戶困惑: `EARNINGS / EX-DIVIDEND / SHAREHOLDING-MEETING` 不如中文事件類別直覺。
- 評分: HIGH

### 07b-events-mobile
- 第一眼: 「還有 25 件事件等待自動復盤」很清楚，但下方接力計畫很長。
- 設計師挑剃: 卡片內又包卡，留白偏厚，底部 nav 遮擋第二張事件卡上緣。
- 散戶困惑: 「接力計畫」像內部術語；不知道是今天要做、還是系統排程。
- 評分: MEDIUM

### 08-watchlist-desktop
- 第一眼: 目標距離可見，新增觀察股按鈕清楚。
- 設計師挑剃: 清單視覺過淡，重點數字沒有形成掃描節奏。
- 散戶困惑: `-17.9%` 是離目標近還是跌幅？需要看欄名才懂。
- 評分: MEDIUM

### 08b-watchlist-mobile
- 第一眼: 焦點觀察卡有「現價/目標/潛在」，比 R11 好。
- 設計師挑剃: 第一張觀察股大數字被底部 nav/search 浮鈕橫切，這是 R12 新殘留。
- 散戶困惑: 「距目標價 -17.9%」與「潛在空間 +21.8%」同時出現，語義要想一下。
- 評分: HIGH

### 09-news-desktop
- 第一眼: 新聞列表可讀，右側脈絡卡有幫助。
- 設計師挑剃: 橘色小按鈕重複 10 次，視覺節奏像廣告列表。
- 散戶困惑: 每則都有同樣 CTA，不知道哪些真的跟持倉最相關。
- 評分: MEDIUM

### 09b-news-mobile
- 第一眼: 頁首說明清楚，但第一則新聞標題巨大、像文章頁而不是列表。
- 設計師挑剃: hero-size typography 用在新聞卡，和 dashboard 層級混在一起。
- 散戶困惑: Google/Yahoo 來源清楚，但「先裸讀毛坯」仍像內部流程。
- 評分: MEDIUM

## D. R12 新引入的 issue（不在 audit 既有清單）

1. 首頁 mobile CTA 新增英文 route 名稱：`去 Events 看日程`。這是 HIGH#1 修法帶出的 HIGH#2 副作用。
2. Daily recovery 後出現 waiting + actionable list 同屏：`05b-daily-mobile.png` 同時有 `Streaming 摘要`、逐檔「減碼分批/續抱」。
3. Trade mobile modal primary CTA 被 bottom nav 擋住：`06b-trade-mobile.png`，修 safe-area 沒處理 modal/nav z-index contract。
4. Watchlist mobile 的新目標距離資訊被 nav/search overlay 切過：`08b-watchlist-mobile.png`，新增價值有了，但第一張卡可讀性被破壞。
5. 中文化 commit 沒清掉 workflow/product terms：`Saved filter`、`存 filter`、`Trade 頁`、`Legal 四欄詳情` 會讓產品看起來仍像內測後台。

## E. 我反駁 Claude 的地方

1. 不能把 HIGH#4 判成已修。Source 有 waiting CTA 不代表 live 狀態乾淨；截圖證明逐檔建議仍在 waiting state 顯示。
2. 不能把 HIGH#6 判成 CSS 已修。`padding-bottom` 存在，但 modal/nav overlay 是層級問題，不是一般 page safe-area 問題。
3. 不能把 HIGH#2 判成「大多中文化所以過」。R12 新 CTA 自己又引入 `Events`，trade modal 還有 `Trade/Legal`，holdings expanded 還有 `Saved filter`。
4. 不能把 HIGH#5 判成已修。Quick entries 在 source 裡，不代表 5 秒 first fold 能看到；mobile screenshot 第一屏仍沒有最大贏家/輸家入口。
5. 事件頁不能只看 b9983d8 的 quiet hierarchy。英文 filter chips 與 impact emoji 仍讓桌機事件頁像資料表貼標籤。

## F. 總分

- 視覺質感（設計師視角）: 7.1 / 10
- 散戶可用（5 秒 test）: 6.6 / 10
- audit §5 紀律遵守: 7.4 / 10

R12 不是爛，但還沒有過 hostile QA。首頁第一動作、holdings 桌機 filter、watchlist 目標距離是真進步；Daily waiting 與 mobile overlay 是目前最不能放過的兩個 HIGH。
