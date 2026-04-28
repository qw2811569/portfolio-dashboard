# Ref 03 · Financeux — Paydex (international banking / FX app case study)

**主入口**：[`../INDEX.md`](../INDEX.md) ｜ **Ref 索引**：[`./README.md`](./README.md)

- **來源**：[`https://www.financeux.com/work/paydex`](https://www.financeux.com/work/paydex)
- **設計工作室**：BN Digital（financeux.com，跟 Ref 02 同工作室、不同案）
- **客戶**：NDA Fintech Co.（London, UK）
- **產品定位（官方原話）**：「Mobile App that empowers sending money to loved ones, paying international bills, or managing business finances」
- **規模指標**：上線 12 個月內 200,000+ 用戶 / $450M+ 交易額 / 50+ 幣別 / 21% 月成長 / 59% 6 個月留存
- **取得日期**：2026-04-27
- **由誰提出**：用戶
- **檔案**：4 張主圖 + 全文 + HTML 已落檔在 [`./03-financeux-paydex/`](./03-financeux-paydex/)
  - `paydex-Img_01.webp` — hero 場景（黑底手機放暗岩石上，主畫面 Send Me / Bills / Car 三 card）
  - `paydex-Img_02.webp` — 6 phone grid（FX converter / numpad send / cards 多幣別）
  - `paydex-Img_03.webp` — 紅繩纏繞手機（exchange rate `£1 = ₹105.84` + 3 月 sparkline）
  - `paydex-Img_04.webp` — Account 主頁（3 coral 按鈕）+ Transaction Detail 表格 + Account Statements 月份分隔
  - `page-text.md` — case study 全文
  - `page.html` — 原始 HTML

## 為什麼存這份

Ref 02（Vorxs）走 sage olive 暖色 + card-stacked spotlight。Paydex 是**同工作室、相反 mood**：黑底主軸 + 工業/utility tone + mono terminal 數字。對比觀察兩份能看出**「一個 hero number 紀律 + 同一單色 accent」的 pattern 在不同色彩主軸下都成立**，幫我們判斷哪些 pattern 是 universal、哪些是只屬於某個 mood。

也因 Paydex 是「資料超多 + 操作很複雜」（FX / send / 多幣別 / 多卡片）的 app，跟我們持倉看板的「資料豐富度」更接近。**Ref 02 看 mood，Ref 03 看 dense data 怎麼塞**。

## 視覺 / 互動觀察

### 配色

- **底**：純黑 / 深炭灰（`#0E0E0E` ish）為主，淺灰（`#E5E5E1` ish）為次
- **主字**：白（黑底上）/ 純黑（淺底上），對比強硬
- **唯一 accent**：飽和 coral（`#E94E1B` ish，比 Vorxs 的 coral 更橘更亮），用在：
  - 主 CTA fill（CONTINUE / CONVERT / TOP UP / SEND）— 整顆按鈕 coral 底
  - hero 數字後的閃爍游標 `|`（input-state 提示）
  - 入款金額 / 重要 metric 純文字（`500.00 GBP`、`800.00 GBP`）
  - 紅繩道具（行銷照）
- **無第二 accent**：跟 Ron Design 同極端紀律，比 Vorxs（coral + 黃 雙 accent）更嚴
- 灰階分 4 層：純黑 / 深灰 / 中灰 / 淺灰，用色塊區分區域（chrome / data / detail / chrome）

### 字型

- **主 UI 字**：Geometric mono / quasi-mono sans（看起來像 IBM Plex Mono / JetBrains Mono / Söhne Mono），所有 ALL CAPS 標籤都是 mono，造成「終端機 / 收據 / 計算機」感
- **數字**：同字型寬幅 mono display，hero 字級巨大（`760.00 BRITISH POUND` 佔卡片 1/3 高度）
- **層次**：
  - 第 1 層 = hero number（白/黑、巨大、mono）
  - 第 2 層 = 標籤 ALL CAPS、極寬 letter-spacing（`BRITISH POUND`、`EXCHANGE RATE`）
  - 第 3 層 = 表格欄位（同字型 mono、中等灰）
  - 第 4 層 = 細節資訊 / footer

### 主互動模式 — Calculator + Receipt 雙模

Paydex 有兩個明顯模式：

**(A) Calculator mode**（input / 操作中）：

- 螢幕中央 hero 數字 + 閃爍游標 `|`
- 螢幕上**直接給 1-2-3 數字鍵盤**（`1 2 3 / 4 5 6 / 7 8 9 / . 0 ◀`）
- 底部 coral CTA 按鈕（CONTINUE / CONVERT）
- 整頁就**一個任務**：輸入金額

**(B) Receipt mode**（讀資料 / 看完成的事）：

- 螢幕中央 hero 數字 + 標籤
- 下方 key-value table（`CATEGORY    GENERAL` / `CONVERTED FROM    GBP` / `FEE    0.32 GBP` / ...）每行一條，無卡片裝飾、僅淡水平線
- 底部「次要 CTA」（`RECEIPT`、`SEARCH`）
- 像「銀行交割明細表」的單頁 UI

**啟示**：可能我們持倉看板的某些頁面要分這兩 mode：

- 「新增交易」「修改持倉」「設定 alert」 → Calculator mode（input + numpad + 主 CTA）
- 「持倉明細」「事件詳情」「Daily 收盤分析報告」 → Receipt mode（key-value table + 細水平線）

### 資料密度

**高**。比 Ron / Vorxs 都高。Paydex 的單頁能塞 8-12 個資料點（多幣別卡 list、轉帳明細 table、月份 grouped 交易 history）。但**密度高但不亂的關鍵**：

1. 每個「資訊組」用色塊區分（黑塊 vs 淺塊）— 視覺上「分章節」
2. table 用單純細線分隔，不用 card chrome
3. 標籤一律 ALL CAPS + mono，造成像「機械列表」的閱讀預期 — 用戶知道「這是查資料不是讀 feed」
4. **每個 chunk 仍有 1 個 hero number**，hero number 把 chunk 內注意力收斂到一處

→ 我們持倉看板的高密度頁面（持倉 list、研究頁、Daily 收盤）可借鑒：**用色塊分章節 + 細線 table 表達「officia 資料」mood**，避開「全部塞卡片」的 card-fatigue。

### 動效角色（推測）

從 hero 數字後的 coral cursor `|` 推測：

- 進入 input mode 時 cursor 閃爍（CSS `animation: blink 1s steps(1) infinite`）
- numpad 點擊有觸覺回饋 / 按鍵 fill 短暫 invert
- 完成轉帳 / 交易時可能有「receipt 從上往下印出」的逐行 reveal

合 [`2026-04-26-motion-relax`](../../../decisions/2026-04-26-motion-relax.md)「動畫服務易讀性」原則。

### Tab Bar / Navigation

**沒有底部 tab bar**（同 Vorxs）。用 **`01. ACCOUNT` / `02. CARDS` 顯式編號 + 右上抽屜 `≡`** 做 nav。

→ 這個 nav 模式不抄（我們 9 tab 已鎖死）。但**「明確編號 / 章節感」**可以借鑒到「報告類頁面」的內部章節（如 Daily 收盤分析的 §1 / §2 / §3）。

### Section-header Date Divider（Img_04 右）

Account Statements list：

- `MAY. 2024` 大字 ALL CAPS 灰色當 section header（無背景無邊框）
- 下方該月交易直接列（icon + 標題 + 副標 + 金額），**無 card chrome**
- 只有水平細線分隔
- `APRIL. 2024` 下一個 section

**極度可掃讀**。比卡片堆好閱讀（卡片需切換上下文，純 list 一氣呵成）。

→ **強烈建議用在交易日誌**：現在交易日誌如果是 card list，改 section-header date divider 立刻好讀 50%。

### 3-button Coral Action Grid（Img_04 左）

Account 主頁 hero 數字下方：

- 3 個等寬 coral 方塊：`+ TOP UP` / `⇄ CONVERT` / `→ SEND`
- 每塊頂部 icon + 底部 ALL CAPS 標籤
- 整列佔螢幕寬度 100%，每塊 ~33% 寬

→ 適合放在持倉看板「投組總覽」頁的 hero 數字下方，3 主動作：`+ 新增交易` / `📤 上傳成交` / `🔔 設提醒`

### Bordered Table for Transaction Detail（Img_04 中）

Transaction detail 用 key-value table：

```
CATEGORY              GENERAL
CONVERTED FROM        GBP
FEE                   0.32 GBP
EXCHANGE RATE         105.84
CONVERTED TO          26,694.99 INR
COMPLETED             24 MAY'24, 09:10AM
TRANSACTION NUMBER    #45679873
```

每行：左 ALL CAPS 標籤、右值（mono、左對齊或右對齊）、底部一條淡水平線。

→ **持倉個股 detail / 事件詳情** 完美適用：grep 既有 `holdings/*` 看是否能改成這個 layout。

### Live-Rate Sparkline（Img_03）

`PAST 3 MONTHS` 標籤下：

- 純 coral 實心垂直 bar 序列，無軸線無刻度標籤
- 左邊豎排 5 個 rate 值（108.84 / 108.09 / 107.34 / 106.59 / 105.84）做隱形 y-axis
- 整圖很小（佔螢幕 1/4）但資訊量足

→ 持倉個股「過去 N 天股價走勢縮圖」可借鑒：sparkline 不需要傳統 chart lib，純色塊序列就夠。

## 可借鑒到本專案的點

| #   | Pattern                     | 怎麼用在持倉看板                                                                    |
| --- | --------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Section-header date divider | **交易日誌**改 list + 月份大字標題 + 細線分隔（取代卡片堆）                         |
| 2   | 3-button coral action grid  | **投組總覽**頁 hero 下放 `新增交易 / 上傳成交 / 設提醒` 3 等寬大按鈕                |
| 3   | Bordered key-value table    | **個股 detail / 事件詳情**改細線 table（key 左、value 右），取代多 card 拼接        |
| 4   | Calculator mode for input   | **新增交易 / 修改持倉**頁專注 input：hero 數字 + 游標 + 主 CTA，不塞其他資訊        |
| 5   | Receipt mode for read       | **Daily 收盤分析**呈現像「銀行交割單」：hero metric + key-value table + receipt CTA |
| 6   | 色塊分章節（dark/light）    | 高密度頁面用「黑塊章節 / 淺塊章節」交替，視覺先把頁面切 chunk                       |
| 7   | Mono ALL CAPS + 寬 tracking | 「資料 / 列表 / 細節」標籤一律 mono ALL CAPS，建立「這是查資料不是讀 feed」預期     |
| 8   | Sparkline 純色塊序列        | 個股縮圖股價，純 coral bars 不用 chart lib                                          |

## 不適用本專案的點

1. **黑底主軸** — 跟我們 brand「投資網紅軟語氣」（per `project_soft_language_style`）衝突。Paydex 是工業 utility 冷感，我們是「主力剛進、無空軍壓力」溫暖暗示。**色相方向不抄**。
2. **Coral 取代正報酬綠** — 投資 convention：台股紅漲綠跌、美股 green up red down。Paydex 把 coral 當 highlight（所有 in-flow 都用 coral）我們不能照抄，否則跟用戶心智模型衝突。**Coral 在我們專案應限定「警示 / 觸發 / CTA」**，不染金額符號。
3. **Calculator 螢幕內 numpad** — desktop-first 不需要；mobile 用系統鍵盤即可。
4. **`01.` / `02.` 顯式編號** — 9 tab 已是 ground truth，不需多一層編號。
5. **Currency Converter 整套 UI** — 持倉看板雖然有多幣別但不是兌換 app。
6. **無 avatar / profile** — 我們是多 portfolio + 多 persona（per `claude.md` R7.5），chrome 必保留組合切換器。
7. **Mono 全站** — 全站 mono 太冷。應限定「數字 + 資料 table 標籤」mono，**正文 / 標題仍用 humanist sans** 維持親切。

## 給 Codex 的提問（待 Round 1 討論）

1. **交易日誌 section-header date divider 改造代價**：
   - grep 既有交易日誌元件 path（`useRouteTradeLogPage` / `TradeLog*`）
   - 既有是 card-list 還是 table-list？資料結構支援按月 group 嗎？
   - 改 list + 月份標題的 PR scope 預估
2. **持倉總覽 3-button action grid 落點**：
   - 既有 portfolio overview 頁面 hero 是什麼？（哪個 KPI 當 hero？）
   - 3 個 primary action 是哪 3 個？grep 既有 nav / quick-action 看 user 真的會做什麼
3. **個股 detail 改 bordered table**：
   - 既有 `HoldingsPanel` / 個股展開 detail pane 是什麼結構？
   - 改 table 要拆掉哪些 sub-component？跟 trade modal 重疊嗎？
4. **「Receipt mode」概念能否套用 Daily 收盤分析**：
   - 既有 `DailyHero` / `DashboardPanel` 是哪種呈現？（feed / card / report）
   - 改 receipt 樣式跟 Morning Note Card / `markdown_leak_qa_gap` 的修法相容嗎？
5. **mono 字型決策**：
   - 既有 design token 有沒有 mono？是哪一支（IBM Plex Mono / JetBrains Mono / Geist Mono）？
   - 全 hero 數字統一改 mono 對既有 Tailwind class 影響範圍？

## 三 ref 收斂表（Ref 01 + Ref 02 + Ref 03）

| 維度       | Ref 01 (Ron Design) | Ref 02 (Vorxs)           | Ref 03 (Paydex)                           | 我們持倉看板會選                                                     |
| ---------- | ------------------- | ------------------------ | ----------------------------------------- | -------------------------------------------------------------------- |
| 焦點顆粒度 | 整頁一焦點          | 每卡一焦點               | 每 chunk 一焦點 + Calculator/Receipt 雙模 | **每 chunk 一焦點 + 雙模分頁**                                       |
| accent     | 1 (黃)              | 2 (coral 警示 + 黃 引導) | 1 (coral 全功能)                          | **2 (coral 警示 + 第二色待定)**                                      |
| 主 mood    | 純白極簡            | sage olive 暖色卡片      | 黑底工業 utility                          | **暖色 + 適度密度**                                                  |
| 資料密度   | 極低                | 中                       | 高                                        | **中-高**（金融需求）                                                |
| 數字字型   | dot-matrix（不抄）  | 寬 sans display          | mono terminal display                     | **寬 sans display + mono** 混用（display 給 hero、mono 給 table 值） |
| 章節分隔   | n/a（單頁單焦點）   | 卡片堆疊                 | 色塊章節 + section header divider         | **section header divider + 色塊章節**                                |
| nav        | 底部 pill bar       | 抽屜                     | 抽屜 + 編號                               | 9 tab 鎖死，**頁內微 nav 借編號**                                    |
| input UX   | n/a                 | 普通 form                | Calculator mode（numpad）                 | **Calculator mode 給交易輸入頁**                                     |
| detail UX  | n/a                 | 卡片堆                   | Receipt mode（細線 table）                | **Receipt mode 給個股 / 事件詳情**                                   |

**三 ref 都同意（強信號）**：

- ✅ Hero number = 獨立 display 字型 + 字級陡（差 3-4 層）
- ✅ Accent ≤2 種，禁止多色階堆疊
- ✅ 次要資訊降階到淺灰，不能等大平鋪
- ✅ 動效服務易讀性，不裝飾
- ✅ 資料密度跟 layout 解耦：高密度也能聚焦，靠視覺層次而非削減資訊

**Ref 02 + 03 同意但 Ref 01 不適用（中等信號）**：

- ✅ 多 chunk 同時呈現 spotlight（每 chunk 一焦點）
- ✅ 用色塊區分功能區（chrome / action / data / detail）

**只 Ref 03 提供（待驗證信號）**：

- ⚠️ Calculator vs Receipt 雙模分頁概念 — 需驗我們是否真的有「全 input」「全 read」這種頁面分布，還是大多是混合
- ⚠️ Mono 字型給資料 table — 跟既有 brand 暖度衝突，要試

## 與 Ref 02 的對比小結

Ref 02 + Ref 03 同工作室出品，**「核心紀律一樣（hero / accent / mono / 色塊章節）但 mood 完全相反」**。這驗證一個假設：

> **「設計紀律」是 portable 的，「色彩 mood」是 brand-specific 的。**

我們可以**抄紀律 + 自選 mood**：紀律走 Ref 02/03 都同意的部分，mood 偏 Vorxs 的暖（per `project_soft_language_style`）但保留 Paydex 的「資料表格 utility 感」（per 我們需要呈現 dense data）。
