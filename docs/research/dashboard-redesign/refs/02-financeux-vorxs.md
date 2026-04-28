# Ref 02 · Financeux — Vorxs (personal finance app case study)

**主入口**：[`../INDEX.md`](../INDEX.md) ｜ **Ref 索引**：[`./README.md`](./README.md)

- **來源**：[`https://www.financeux.com/work/vorxs`](https://www.financeux.com/work/vorxs)
- **設計工作室**：BN Digital（financeux.com）
- **客戶**：Vorxs Finance（Stockholm, Sweden，2023 launch）
- **產品定位（官方原話）**：「Personal finance app designed to help users manage their money, track expenses, and plan for the future」
- **取得日期**：2026-04-27
- **由誰提出**：用戶
- **檔案**：4 張主圖 + 全文 + HTML 已落檔在 [`./02-financeux-vorxs/`](./02-financeux-vorxs/)
  - `vorxs-Img_01.webp` — hero 場景（手機放岩石上，主畫面 Statement）
  - `vorxs-Img_02.webp` — 5 phone grid（Budget / Account "+" / Transactions / Create Goal）
  - `vorxs-Img_03.webp` — Goals 追蹤 + Budget Category + Bank 帳戶串接
  - `vorxs-Img_04.webp` — Total Spent 放射圖 + Transaction detail + Vorxs 品牌頁
  - `page-text.md` — case study 全文（Challenge / Features / Solution）
  - `page.html` — 原始 HTML（保留供回溯）

## 為什麼存這份

Ref 01（Ron Design）走的是極端簡約：**一頁一焦點**。但投資 app 不可能像 wellness app 一頁只放一個數字 — 我們需要多卡片但每卡片內部仍要有焦點。Vorxs 是中間值的代表：**「卡片堆疊式 spotlight」**，每張卡有自己的 hero number + 情境資料，色塊功能化，比 Ron Design 更貼近金融類產品的可行極限。

也因為它本身就是金融類（personal finance / budget tracking），跟我們持倉看板的距離比 Ron Design 近很多。

## 視覺 / 互動觀察

### 配色

- **底**：暖橄欖綠（`#A6A990` ish），不是純白，是 sage / olive，有暖度
- **主字**：墨黑，無多色
- **二級面板**：深橄欖綠（`#5C5F4A` ish），對比 base 的「下沉感」
- **警示 / CTA accent**：飽和 coral（`#E97250` ish），只用在：
  - `BUDGET OVERRUN` 警告 panel
  - `REPEAT PAYMENT` 主 CTA
  - hero 卡片底部 footer
- **正向引導 accent**：飽和黃（`#E5D24A` ish），只用在：
  - `Travel` 已達標 goal 卡
  - `FINANCIAL` 加分類 prompt
- **無 secondary 色階**（沒有 success/info/warning 的多色階堆疊）— 跟 Ron Design 同紀律

### 字型

- **主 UI 字**：Helvetica / Inter 系，對比 Ron Design 一樣 geometric sans
- **數字**：寬幅 sans display（看起來像 IBM Plex Mono 或 mono 系數字），**hero number 字級巨大**（佔卡片 1/3 高度），所有金額一致 `$X,XXX.0` 格式（連 `.0` 都保留）
- **層次**：
  - 第 1 層 = hero number（黑、巨大）
  - 第 2 層 = 標籤 ALL CAPS、tracking-wide（`AVAILABLE JUNE BUDGET`、`TOTAL SPENT`）
  - 第 3 層 = 次要 metric（同色但小很多）
  - 第 4 層 = 圖表 / 紋理（淺色 grid bars）

### 主互動模式 — Card-Stacked Spotlight

每個卡片 = 一個獨立 spotlight，但**整頁可同時存在多卡片**：

- **Statement 卡**（Img_01）：hero `$3,670.0` + 次要 `$1,500.0`，coral footer
- **Budget 卡**（Img_02 左）：hero `$1,894.0` + BUDGET/LEFT 比較 + coral overrun 警告 panel + 第二 spotlight `$1,864.0 INVESTMENTS`
- **Goal 卡**（Img_03 左）：每 goal 一張子卡，hero = SAVED 數，旁邊 small GOAL 數對照
- **Transaction Detail**（Img_04 中）：hero = `-$1,456.0`，下方詳細 metadata table，底部 coral CTA

→ 這是**「多 spotlight 層疊但不互相搶焦」**的解法。我們持倉看板適合此 pattern 而非 Ron Design 的「整頁一個」。

### 資料密度

**中等**。明顯多於 Ron Design，但每張卡內部仍維持「1 個主數字 + 1-2 個對照 + 紋理填白」的紀律。

跟我們現在持倉看板對比：相當的卡片數量，但**視覺層次明顯更陡**，hero number 跟次要資訊差 3-4 個字級。我們現在的卡片大量「等大字級平鋪」，這是改善關鍵。

### 動效角色（推測）

靜態案例集，無動效資訊。但從版面紋理（細直條紋 bar chart）+ 卡片邊界圓角 + 色塊銳利對比推測：

- 卡片進場可能有 staggered fade-in
- hero number 從 0 滾動到目標值
- coral 警示帶可能 pulse / shimmer

合乎我們 [`2026-04-26-motion-relax`](../../decisions/2026-04-26-motion-relax.md) 的「服務易讀性 + 不沉悶」標準。

### Tab Bar / Navigation

**沒有底部 tab bar**（跟 Ron Design 不同）。看起來是**全畫面卡片直滾 + 右上 menu icon（`⋮⋮`）開抽屜**的架構。

→ 這個我們不能照抄 — 持倉看板已 9 tab + 6 route page（2026-04-18 SA 拍板），結構不重開。但**抽屜替代 secondary nav** 是可考慮的 mobile 簡化路徑。

### Brutalist 大按鈕（Img_02 中央 ACCOUNT 卡）

整張卡 = 一個「+」加號圓圈，佔卡片 60% 面積。**一張卡 = 一個 action**，沒任何裝飾。

→ 我們持倉看板的「新增交易 / 新增監控股 / 新增組合」可考慮這 pattern — 主動作給足空間，不要塞一堆 form field 開門就嚇人。

### Sunburst Radial Visualization（Img_04 左）

`TOTAL SPENT $1,894.0` 下方是個放射狀光暈圖（中間實心圓 + 外緣放射線），不是傳統 pie chart 也不是 bar chart，**是純視覺紋理**讓「總和」感覺有重量。

→ 這個可借鑒到「總曝險 / 總部位 / 總損益」的視覺化。我們現在數字就是數字，缺乏「重量感」。

### Vertical Side-Tab Category Indicators（Img_02 右）

Transactions list 每筆左側有**深綠垂直細條 + icon**，等於用「左邊一條色」+「icon」雙編碼類別，比一般 list 多用一個欄位的 chip / badge 高效。

→ 我們持倉個股 list 適合這 pattern：左側細條編碼**產業**（半導體 / 金融 / 傳產），icon 編碼**訊號狀態**（看好 / 警示 / 持平）。

## 可借鑒到本專案的點

| #   | Pattern                  | 怎麼用在持倉看板                                                         |
| --- | ------------------------ | ------------------------------------------------------------------------ |
| 1   | Card-Stacked Spotlight   | 每張既有卡片找到 1 個 hero metric，提到字級 3-4 倍，次要降階             |
| 2   | 功能化色塊（coral 警示） | coral / red 只給「停損觸發 / 異常波動」warning，不要做 success/info 多色 |
| 3   | Brutalist 主按鈕         | 「新增交易」「上傳成交」這類 entry point 直接給整張卡的「+」             |
| 4   | Sunburst 重量感視覺      | 「總曝險」「今日總損益」加放射或紋理底，讓「大數字」有 mass              |
| 5   | Side-tab 雙編碼 list     | 個股 list 左側細條 = 產業色，icon = 訊號，省一個 column                  |
| 6   | hero number 寬幅 sans    | 數字字型獨立於 UI 字，瞬間導引視線（同 Ref 01 結論）                     |
| 7   | 二色 accent 紀律         | 全站只 2 個 accent（coral 警示 / 黃 引導），其他全降到中性灰             |

## 不適用本專案的點

1. **`$X,XXX.0` 末位 `.0` 格式** — 台股 NTD 不顯示小數位（張、千股單位），這個簽名跟我們不合。USD 部位才有兩位小數。
2. **Sage olive 主色** — 跟我們既有 brand（per `project_soft_language_style` 「投資網紅軟語氣」）需要驗證；olive 偏冷靜不偏「機會感」，可能要調暖。
3. **無底部 tab bar** — 我們 9 tab 結構已鎖死，不能拿掉。這份 ref 的 nav 模式不抄。
4. **單 portfolio 假設** — 整個畫面默認 1 個 user / 1 個 account。我們是多 portfolio + 多 persona（per `claude.md` R7.5 教訓），chrome 設計需要保留組合切換器。
5. **Transaction Detail 全螢幕** — 我們交易日誌進 detail 應該是 drawer / pane，不應全螢幕中斷瀏覽流。
6. **Brutalist big "+" 取代整個 form** — 加股票 / 加交易需要至少 stock symbol + 數量 + 價格，不能一個按鈕了事；可以「先 + 後跳 form」分階段。

## 給 Codex 的提問（待 Round 1 討論）

1. **Card-stacked spotlight 在我們既有 6 route page 的可行性映射**：
   - Overview / 持倉 / 交易日誌 / 收盤分析 / 全組合研究 / 情報脈絡 各自的「card hero metric」是什麼？
   - 哪些頁面**已經有 hero**只是字級不夠陡？哪些是**真的沒設計過**？
2. **既有 Tailwind / design token 能不能撐這個層次**：
   - hero number 需要新增 `.text-display-xl` (96px+)？還是 `text-7xl` 夠用？
   - sage / olive 色塊跟我們現在 brand 衝突嗎？要新增 token 還是 reuse `bg-muted` / `bg-card`？
3. **Side-tab 雙編碼 list 改造代價**：
   - 持倉個股 list 既有元件 path（grep `HoldingsPanel` / `holdings/`）能不能在不破壞 sortable 表格邏輯下加上 vertical color bar？
4. **Sunburst 視覺化的成本**：
   - 純 SVG / Canvas / Lottie？我們既有 chart lib（recharts / d3?）能畫嗎？
   - 為了一個「重量感」紋理開新 dep 划算嗎？— 還是用 CSS gradient 模擬就好？
5. **Coral warning 跟既有警示色階整合**：
   - 現在持倉看板對 alert / warning / danger 的色用法是什麼？grep 一下，列出來，再決定 coral 該整併還是新增。

## 跟 Ref 01 的 cross-reference

| 維度        | Ref 01 (Ron Design) | Ref 02 (Vorxs)           | 我們持倉看板會怎麼選            |
| ----------- | ------------------- | ------------------------ | ------------------------------- |
| 焦點顆粒度  | 整頁一焦點          | 每卡一焦點               | **每卡一焦點**（卡片數視 page） |
| accent 數量 | 1 (黃)              | 2 (coral 警示 + 黃 引導) | 2 — 偏 Vorxs                    |
| 資料密度    | 極低                | 中                       | 中                              |
| 數字字型    | dot-matrix（不抄）  | 寬 sans display          | 寬 sans display                 |
| 色系        | 純白 + 灰           | sage olive + 二 accent   | 待 Round 1 跟 brand 對齊驗      |
| nav         | 底部 pill bar       | 抽屜（無底 bar）         | 9 tab 鎖死，不重開              |

**共通結論**（兩 ref 都同意）：

- ✅ Hero number 必須用獨立 display-style 字型，跟 UI 字明顯區隔
- ✅ accent 顏色 ≤2 種，禁止多色階堆疊
- ✅ 次要資訊降階到淺灰，不能等大平鋪
- ✅ 視覺層次差距要陡（Ron 是極端，Vorxs 是中間值，我們抄 Vorxs）
