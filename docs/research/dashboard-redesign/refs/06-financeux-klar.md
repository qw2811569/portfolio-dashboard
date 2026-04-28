# Ref 06 · Financeux — Klar（trading app · democratize finance）

**主入口**：[`../INDEX.md`](../INDEX.md) ｜ **Ref 索引**：[`./README.md`](./README.md)

- **來源**：[`https://www.financeux.com/work/klar`](https://www.financeux.com/work/klar)
- **設計工作室**：BN Digital（financeux.com）
- **客戶**：NDA Fintech Co.（Oslo, Norway，2023-12 launch）
- **產品定位（官方原話）**：「Easy-to-use trading app · democratize finance · make trading accessible to everyone · turn it practically into a game」
- **取得日期**：2026-04-27
- **由誰提出**：用戶（第六組）
- **檔案**：4 張主圖 + 全文 + HTML 已落檔在 [`./06-financeux-klar/`](./06-financeux-klar/)
  - `klar-Img_01.webp` — hero 場景（手持手機）
  - `klar-Img_02.webp` — Portfolio screen（time period segmented + 4 action grid + Stocks/ETFs split + ratings bar + analyst accordion）
  - `klar-Img_03.webp` — 多 screen mosaic（Buy / Cash / Watchlist 等切面）
  - `klar-Img_04.webp` — 4-panel mosaic（Stock detail target slider · Overview hero $8,325 · News card · Explore category tile）
  - `page-text.md` / `page.html` — 原始全文與 HTML

## 為什麼存這份（重點：聚焦切換邏輯）

> 「題外話這是要你觀察他們的切換面板的邏輯」 — 用戶 2026-04-27

**Klar 是 6 份 ref 裡跟持倉看板 domain 最近的一份** — 它就是 trading app（股票 / ETF / 共同基金 / bonds / 即時報價 / 投組管理）。BN Digital 給的官方說明甚至寫「make trading accessible to everyone」+「practically turns it into a game」 — 這跟我們「投資網紅軟語氣」的方向高度相容（per `project_soft_language_style`）。

更重要：Klar 在「資訊太多怎麼讓人聚焦」這題給了**最豐富的切換 pattern 集合** — segmented control / split tile / 動作 grid / accordion / horizontal stacked bar / 嵌入式 ticker chip / explore tile grid，全在同一 app 裡。

## 切換面板的邏輯（panel-switching / focus / drill）

### 1. **Time-Period Segmented Control**（最核心切換器）

Img_02 portfolio 頁頂部 chart 下方：

```
[ 1H | 1D | 1W | 1M | 1Y | All ]
```

6 個 pill 等寬連體，**選中態深色填底 + 白字**，其餘灰底深字。**整個 chart 只跟著它變** — user 不用滑頁、不用切 tab、不用點任何別的東西。

→ 對照持倉看板：「收盤分析」/「全組合研究」現有時段切換是不是這個樣子？grep 確認。借鑒「等寬 segmented + 深填 active」當所有時間維度切換的 canonical pattern。

### 2. **4-Action Quick Grid**（同階大圖示按鈕）

Img_02 上方：

```
┌────┬────┬────┬────┐
│ +  │ ⇄  │ ↗  │ ↘  │
│dep │conv│send│recv│
└────┴────┴────┴────┘
```

4 個動作正方形格子等寬並排，**圖示 + 一行文字標籤**。所有 grid 同色、同尺寸 — 沒有「主動作 vs 次動作」分級。

→ 跟 Quicked「全站 1 個 cyan CTA」紀律**剛好相反**。Klar 的選擇是「多動作但同階」，Quicked 是「多動作降階只剩一個」。

→ 對照持倉看板：mobile 版 Overview 頂部可借「4-grid 主動作」（新增交易 / 上傳成交 / 切組合 / 看通知）— 因為 mobile 動作必須一指能點到，「同階大圖示」比「藏 menu 後展開」效率高。

### 3. **Split-Tile with Focus State**（同階對照 + 高亮主焦點）

Img_02 中段：

```
┌──────────────┬──────────────┐
│ My Stocks    │ My ETFs      │
│ ↗ +12.4%     │ ↘ -2.1%      │
│ orange fill  │ purple fill  │ ← orange = 當前 focus
└──────────────┴──────────────┘
```

兩個 tile 等寬並排，但**選中態用「整 tile 改成飽和橘色」**（不是邊框、不是 dot、不是底線）— 整塊變色，視覺上像「點亮一塊」。

→ 比 Quicked 的「3 account 純白 split tile」多一層「當前 focus」狀態。**橘 vs 紫 還暗示了「進攻 vs 守備」、「上升 vs 防禦」的情緒色**，不只是 selection。

→ 對照持倉看板：「持倉」頁切「個股 vs ETF vs 現金」時，借鑒「等寬 split tile + 整塊變色 selection」。Vorxs 的 vertical color bar 偏細節，Klar 的整塊變色偏 hero — 看資訊密度選擇。

### 4. **Accordion + ".." Collapse**（漸進揭示細節）

Img_02 底部 stock detail panel：

```
┌─────────────────────────────┐
│ Apple Inc.   AAPL  $173.20  │  ← 主行
│ ─────────────────────────── │
│ Price Analysts        ⌃ ..  │  ← 可展開
│   Buy   62.9%  ████████░░  │
│   Hold  29.1%  ████░░░░░░  │
│   Sell   8.0%  █░░░░░░░░░  │
└─────────────────────────────┘
```

`..` 符號表示「還有更多、可收合」。**展開不切頁、不彈 modal**，原地累加內容。

→ 對照持倉看板：個股 detail 現在傾向跳新頁。借鑒「主資訊永遠在、次要資訊 accordion 展開」— 尤其分析師評等 / 籌碼變動 / 法人動向這類「想看才看」的二級資料。

### 5. **Horizontal Stacked Ratings Bar**（一行表達多比例）

Img_02 stock detail 內：

```
Buy 62.9%  ████████████░░░░░
Hold 29.1% ███████░░░░░░░░░░
Sell  8.0% ██░░░░░░░░░░░░░░░
```

每行 = 「label + 百分比 + 水平 bar」一體成型，**bar 長度視覺即比例**。比 pie chart 直觀、比純數字直觀。

→ 對照持倉看板：「收盤分析」分析師評等 / 「全組合研究」資產類別佔比 / 「持倉」單股的買賣超佔比 — 全可借鑒這 pattern。

### 6. **Stock Target-Range Slider**（hero 視覺化）

Img_04 左上：

```
Current
$273.39

Low $320.50    Target $310.00    High $340.90
[──────●─────────────────────────────────]
        ↑ slider thumb 標當前位置
```

水平條表示 Low → High 區間，**slider thumb 標 current position**。一眼看出「現在價格落在分析師目標的什麼相對位置」。

→ 對照持倉看板：個股「目標價區間」「52 週高低」「成本價 vs 市價」全可借這 pattern。比純數字「目標 $310 / 現價 $273」省好幾秒判讀時間。

### 7. **Embedded Ticker Chip in News Card**（嵌入式相關性提示）

Img_04 左下 News card：

```
News                                          ⋯
─────────────────────────────────────────────
AAPL ↑ 0.41%  ·  SPOT ↑ 0.23%
─────────────────────────────────────────────
Spotify to Introduce More Expensive
Subscription Tier For Music Lovers...
3h ago  ·  Bloomberg Technology
```

新聞前面**先列「相關股票即時 ticker」當小 chip**，再放標題。**不用點進新聞 user 已知道「這篇講的兩支股票今天都漲」**。

→ 對照持倉看板的「情報脈絡」頁：每篇新聞 / 法說 / 公告前**自動掛上相關持倉股 + 即時報價 chip**。借鑒「資訊不是 list，是上下文聚合」。

### 8. **Explore Category Tile Grid**（drill-in 入口）

Img_04 右下「Explore」頁：

```
🔍              ⋯

Explore
─────────────────────

┌──────┬──────┬──────┐
│ ESG  │ ETFs │Bonds │
│ icon │ icon │ icon │
└──────┴──────┴──────┘
```

每個 tile 一個 category，**點進去是該 category 的列表**。Tile 本身極簡（icon + label），不擺數字 / chart。

→ 對照持倉看板：mobile 版「全組合研究」進場可借「4-6 個分類 tile（產業 / 策略 / 規模 / 風險）」當 drill-in 入口，user 自選切片再深入。

### 9. **Bottom 4-Tab Mobile Nav**（Overview 級切換）

Img_02 底部 dock：

```
[ 🏠 ] [ 💼 ] [ 💳 ] [ 🟠 ]
home   port   wallet  more
```

4 顆 icon 等寬，當前頁「橘色實心 dot 高亮」。**只有 mobile 形態用，desktop 走別的（推測 sidebar）**。

→ 對照持倉看板：我們現在 9-tab 已鎖死，**不抄此 pattern**。但「mobile 主切換維度建議降到 4-5 顆」是值得反思的訊號。

### 10. **Buy / Sell Symmetric Action Pair**（雙向極性按鈕）

Img_04 左上 detail card 底部：

```
[ ⋯ ]  [ ↗ Buy ]  [ ↘ Sell ]
       white       coral fill
```

Buy 和 Sell **形狀對稱、方向箭頭對稱（↗ vs ↘）、顏色對比（白 vs 橘紅）**。雙向動作極性極清楚。

→ 對照持倉看板：「新增交易」目前是中性按鈕進 form 再選 buy/sell。借鑒「直接給 ↗ / ↘ 對稱按鈕當 entry」— 一鍵語義先表態，後面只填數量價格。

## 視覺 / 互動觀察

### 配色（mobile 模式）

- **底**：粉紫白偏暖（`#F0EBED` ish）— 帶溫度的 light mode
- **二級面板**：飽和深紫（`#3F2A8C` ish），用在 detail card / news card
- **Focus accent**：飽和橘紅（`#E94E29` ish），用在 selected tile / Sell button / overview hero 大底色
- **Secondary accent**：紫（`#5B3FB3` ish），用在 Buy / 次要 selection
- **Overview $8,325 卡**：整張橘紅實心底 + 白字 + 白色 sparkline — 跟 Vorxs hero 卡風格 echo
- **無 success/info/warning 多色階堆疊** — 同 Vorxs / Paydex / Quicked 紀律

### 字型

- **主 UI 字**：geometric sans（接近 Inter / Söhne）
- **數字**：寬幅 sans display，**同金額永遠 `$X,XXX.XX` 兩位小數**
- **Hero number**：Overview $8,325.00 字級巨大，佔 1/3 卡片高
- **層次**：
  - 第 1 層 = hero number（$8,325 / $273.39）
  - 第 2 層 = section title（My Stocks / Price Analysts / News）
  - 第 3 層 = metric label（Low / Target / High / Buy 62.9%）
  - 第 4 層 = metadata（3h ago · Bloomberg Technology）

### 資料密度

**中**。比 Vorxs 略低，遠低於 Quicked 7。每個 panel 1 主數字 + 2-3 對照 + 一個視覺元素（slider / bar / sparkline）。

### 動效角色（推測）

- Time-period segmented 切換 → chart smooth morph + 上升/下降色 flash
- Stocks/ETFs tile 點選 → 整塊變色 transition
- Accordion 展開 → height auto fade
- Buy/Sell 按下 → ripple + slight scale
- Overview hero 數字進場 → counter roll-up

合乎本專案 `2026-04-26-motion-relax`「服務易讀性 + 不沉悶」紀律。

## 可借鑒到本專案的點（panel-switching 切換邏輯為主）

| #   | Pattern                                    | 怎麼用在持倉看板                                               |
| --- | ------------------------------------------ | -------------------------------------------------------------- |
| 1   | Time-period segmented `1H/1D/1W/1M/1Y/All` | 收盤分析 / 全組合研究 / 個股 detail 全部時間切換用同一 pattern |
| 2   | 4-action quick grid                        | Mobile 版 Overview 頂部「新增交易 / 上傳成交 / 切組合 / 通知」 |
| 3   | Split-tile with focus colour               | 「持倉」切「個股 vs ETF vs 現金」整塊變色                      |
| 4   | Accordion `..` 漸進揭示                    | 個股 detail 主行常駐，分析師評等 / 籌碼 / 公告 accordion 展開  |
| 5   | Horizontal stacked ratings bar             | 分析師評等 / 資產配置 / 買賣超佔比 一行可視化                  |
| 6   | Target-range slider                        | 目標價 vs 現價 / 52 週高低 / 成本價 vs 市價 視覺化             |
| 7   | News card with embedded ticker chip        | 情報脈絡每篇新聞掛持倉股 + 即時報價                            |
| 8   | Explore category tile grid                 | 全組合研究 mobile 進場 4-6 分類 tile                           |
| 9   | Symmetric Buy/Sell action pair             | 新增交易直接用 ↗/↘ 對稱對顏色                                  |
| 10  | Hero overview with directional arrow       | 今日總損益用 ↗/↘ pill + 整卡 fill 色                           |

## 不適用本專案的點

1. **Bottom 4-tab mobile nav** — 9-tab 已鎖死（2026-04-18 SA），不重開。
2. **Sage / 飽和粉紫底色** — 跟既有 brand 衝突可能性高，需驗證。
3. **「Practically a game」基調** — Klar 走遊戲化（gamify）方向，跟我們「投資網紅軟語氣」**部分相容**（都鼓勵互動 + 反命令式）但不能照抄遊戲化 reward 機制（會踩到「投資不是賭博」紅線）。
4. **單一 portfolio 假設** — 整 app 預設一個 user / 一個 portfolio。我們是多組合 + 多 persona（per `claude.md` R7.5），切換器要保留。
5. **Mutual fund / bonds / ESG 維度** — 我們持倉看板偏台股個股 + ETF，bonds / 共同基金 domain 不共通。Pattern 借鑒，content scope 不抄。

## 給 Codex 的提問（待 Round 1 討論）

1. **Time-period segmented 是否該升為 design token / 共用元件？**
   - 既有 `<TimeRangeTabs>` / `<PeriodSelector>` 之類元件 grep 一下，列現況。
   - 統一 pattern 後，6 個 route page 全用同一個元件。
2. **Stocks/ETFs split-tile focus 改造代價**：
   - 現在「持倉」頁是 list 還是 grid？grep `HoldingsPanel`。
   - 加 split-tile selection 跟 sortable 表格邏輯怎麼共存？
3. **Accordion 在持股詳情的接入點**：
   - 個股 detail 現在是 modal / 抽屜 / 跳新頁？
   - 借 Klar 改「主行常駐 + accordion 展開」是否會重寫 routing？
4. **Target-range slider 視覺化是否值得開新 dep？**
   - 純 CSS / SVG 能畫嗎？還是要用 chart lib？
   - 跟 Vorxs sunburst 視覺化合不合併成一個「金融視覺化 component pack」？
5. **News card embedded ticker chip 跟 FinMind 即時報價的串接**：
   - 「情報脈絡」頁現在有沒有 article-to-stock 關聯資料？
   - FinMind 1600 req/hr 配額能不能撐每篇文章 2-3 顆 ticker chip？

## 跟 Ref 02-05 的 cross-reference（panel-switching 維度）

| 維度             | Klar（本份）                  | Quicked 7（05）    | Vorxs（02）      | Paydex（03）        | Finno（04）        |
| ---------------- | ----------------------------- | ------------------ | ---------------- | ------------------- | ------------------ |
| Form factor      | Mobile                        | **Tablet/desktop** | Mobile           | Mobile（含 dark）   | Tablet/desktop     |
| 主切換器         | **Segmented + tile**          | 持久左 nav         | Card stack       | Section-header date | Numbered tab       |
| 動作密度         | **多動作同階**                | 1 cyan CTA         | 1-2 coral CTA    | 3-button grid       | Quick-amount pills |
| Drill-in 模式    | **Accordion 漸進**            | 點 nav 整頁切      | 整頁切（drawer） | Section 切          | Tab 切             |
| 對比視覺化       | **Stacked bar / slider**      | 純表格             | Sunburst / 紋理  | Receipt / 表格      | Hybrid display     |
| 跟持倉看板契合度 | **★★★★★** (trading 同 domain) | ★★★★★（桌機形態）  | ★★★★ pattern 抄  | ★★★ dark 抄         | ★★★★ 平板 hybrid   |

**Klar + Quicked 7 是本系列雙主軸**：

- **Quicked 7** 給「桌機 baseline · 高密度資料 · 不迷路 nav」 → 解決「網頁太長」的**結構**面
- **Klar** 給「mobile baseline · 切換 / 漸進揭示 / 對比視覺化」 → 解決「資訊太密」的**互動**面

下一輪 Round 1 brief 給 Codex 時，**這兩份應為 primary refs**，其他 4 份（Ron / Vorxs / Paydex / Finno）為 secondary 印證。
