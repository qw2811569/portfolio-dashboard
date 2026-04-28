# Ref 05 · Financeux — Quicked 7（business accounting platform · tablet/desktop-first）

**主入口**：[`../INDEX.md`](../INDEX.md) ｜ **Ref 索引**：[`./README.md`](./README.md)

- **來源**：[`https://www.financeux.com/work/quicked-7`](https://www.financeux.com/work/quicked-7)
- **設計工作室**：BN Digital（financeux.com）
- **客戶**：Stealth Fintech Startup（Los Angeles, 2024-01 launch）
- **產品定位（官方原話）**：「Business accounting platform — invoices, expenses, payroll, automated workflows」
- **取得日期**：2026-04-27
- **由誰提出**：用戶（第五組）
- **檔案**：4 張主圖 + 全文 + HTML 已落檔在 [`./05-financeux-quicked-7/`](./05-financeux-quicked-7/)
  - `quicked-7-Img_01.webp` — Dashboard 全景（左 sidebar + Cash Flow / Profit & Loss 兩 chart card）
  - `quicked-7-Img_02.webp` — 「Payments Setup」big display step + 表單區塊 + Invoice Template 邊框預覽
  - `quicked-7-Img_03.webp` — Accounting 三 account split tile + Create Invoice form steps + 黑底「≠」reconcile diff
  - `quicked-7-Img_04.webp` — 「All Invoices」全表格頁（11 列 invoice + Total 合計 + 持久 sidebar nav）
  - `page-text.md` / `page.html` — 原始全文與 HTML

## 為什麼存這份（重點：聚焦切換邏輯）

> 「題外話這是要你觀察他們的切換面板的邏輯」 — 用戶 2026-04-27

Quicked 7 是目前 6 份 ref 裡**形態最接近持倉看板**的（**tablet/desktop-first** + 多 entity 表格 + 多分類左 nav）— Vorxs/Klar/Paydex 都是 mobile-first，pattern 套到 desktop 要重新想。Quicked 7 直接示範**desktop 版怎麼把「資訊很多」收成「永遠知道自己在哪、怎麼換頁、怎麼鑽進去」**。

這份**最值得學的不是視覺**（極黑白），而是它的「**永遠在場的左 nav + 巨型 page title + cyan 唯一 CTA**」三件套怎麼合作達成「不迷路」。

## 切換面板的邏輯（panel-switching / focus / drill）

### 1. **Persistent Left Sidebar Nav**（不隱藏 / 不抽屜）

Img_04 完整呈現：左側黑色窄條永遠在場，列出 8 個 route：

```
Launchpad
Dashboard
→ Payments      ← 當前頁，前面加 → 箭頭 + 白字
   Purchases
   Receipts
   Accounting
   Banking
   Reports
─────────
🔔 Notification
⚙️ Settings
```

→ **「不靠 tab 切換 + 不靠 hamburger 抽屜，直接全展開」**。換頁等於點 sidebar 任一 row。

→ 對照本專案：持倉看板現在頂部 9-tab 已鎖死（2026-04-18 SA），**桌機版可考慮加左 sidebar 列出 6 個 route page**（Overview / 持倉 / 交易日誌 / 收盤分析 / 全組合研究 / 情報脈絡）— 上 tab 切「資料切片」(KPI 維度 / 時段)，左 nav 切「頁」。職責不混。

### 2. **Page Hero = ALL CAPS 巨型 sans display**（佔水平 1/3+）

每個 route 進場第一眼是**粗黑 huge sans 標題**填左半幅：

- Img_01：`Dashboard`
- Img_02（傾斜投影）：`Payments Setup`
- Img_03：`Accounting` + `Create Invoice`
- Img_04：`All Invoices`

字級巨大到**幾乎是 hero number 等級**。意思：**「頁名」本身就是 visual anchor，user 一眼知道在哪頁**，不用再讀 breadcrumb / 標籤。

→ 對照持倉看板：我們現在 page title（`收盤分析` / `情報脈絡`）字級偏小，視覺重量輸給 KPI grid。可借鑒「page title 比所有 metric 都大」的紀律。

### 3. **Cyan 單一 accent CTA**（全站只有一個高飽和按鈕）

整個畫面**只有 1 個亮 cyan 圓角膠囊按鈕**：

- Img_01：左 sidebar 下方 `+`（new entry）
- Img_02：右上角 `↗`（continue setup）
- Img_03：`Reconcile ↗`（resolve diff）+ `Continue ↗`（form next step）
- Img_04：`Invoice +`（create new）

**其他所有 button 都是白底黑字 outline 或純文字**。Cyan = 「你現在最該按的那顆」。

→ 對照持倉看板：現在多個 page 同時擺 4-5 個同重量 CTA（新增交易 / 編輯組合 / 篩選 / 匯出 / Refresh），分不出主從。借鑒 Quicked 紀律：**一頁同時最多 1 個 cyan / 主色 CTA**，其餘降到 outline。

### 4. **Step-Form Side Index**（vertical stepper · greyed-out future steps）

Img_03 左下「Create Invoice」表單：

```
Main Info     ← 黑體（當前）
Customer      ← 灰
Services      ← 灰
Taxes         ← 灰
```

未來步驟**不隱藏**，灰色 in-place 列出 — 讓 user 一眼知道「這 form 共 4 步、還剩 3 步」。

→ 對照持倉看板：「上傳成交」「新增交易」「編輯組合」這類多步表單目前都是 modal 一頁塞滿。借鑒：**改 stepped form，左側 4-step index 灰／黑切換**，每步只露 3-5 個 field，user 不會被「一次吐 20 個 field」嚇退。

### 5. **Multi-Account Split Tile**（橫向分割 · 同階對照）

Img_03 上方「Accounting」頁：

```
┌─────────────────┬─────────────────┬─────────────────┐
│ Manually Added  │ Revolut UK      │ Wise US         │
│ Created 23 Jun  │ GBP account     │ USD account     │
│ $1,856.54       │ $987.32         │ $320.28         │
│ Cash on Hand    │ Checking ****679│ Checking ****804│
│ Unreconciled    │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

3 個 account 用**等寬 split tile** 並排，標題置左、金額置右下、metadata 小字底部。**沒有任何分隔線、沒有 card 邊框** — 純粹靠白底 + 大 padding 製造區隔。

→ 對照持倉看板的多組合切換器（per `docs/specs/2026-03-23-multi-portfolio-event-tracking-design.md`）：現在用下拉選單只能看 1 個組合。借鑒 Quicked split tile：**桌機版「全組合研究」頁可改 3-4 組合並排 split tile + 同 KPI 指標**，user 一眼跨組合對照。

### 6. **「≠」Mathematical Symbol as Hero**（reconcile diff）

Img_03 右下黑底 panel：

```
Total
$2,379.65
Statement Balance

   ≠

$1,856.54
Quicked7 Balance
```

兩個數字之間**唯一的視覺元素是 `≠`**。沒寫「The two values do not match」之類人話。**符號本身 = message**。

→ 對照持倉看板：警示 / diff 場景（成本價 vs 市價 / 應有部位 vs 實際部位 / 預估報酬 vs 實際報酬）目前都用紅字 + 文字描述。借鑒：**`+` / `-` / `≠` / `↗` / `↘` 純符號當 hero**，省 copy + 國際化、視覺更乾淨。

### 7. **Light/Dark Toggle 永久外露**（不藏 settings）

Img_04 右上角 header：

```
Account   En ▾   ☀️ ☾   Log Out
```

**太陽 / 月亮 icon 並排**，一眼看出當前 light（太陽 fill）。不像多數產品藏在 Settings。

→ 對照持倉看板：dark mode 應該是「投資人凌晨看盤」剛需，現在沒有 toggle。借鑒：**header 永久外露 sun/moon**，不沉到 settings。

### 8. **「Watch Video / View Message」浮動 helper**

Img_03 / Img_04 右下角永遠有兩顆膠囊：

- `Watch Video 📹` — 解釋這頁怎麼用（onboarding video）
- `View Message 💬` — 跟 support / 系統訊息溝通

**不是 modal、不是 toast、不是 onboarding overlay** — 持久但低調的浮動 helper。

→ 對照持倉看板：現在沒「這頁怎麼用」入口。借鑒：**收盤分析 / 全組合研究這類重邏輯頁**右下角加「Watch / Help」浮動，不打斷主流程。

### 9. **Display Title 當 Section Divider**（不靠 line / card border）

Img_02 投影視角清楚顯示：頁面用 `Payments Setup` / `Architecture` / `Partnership` / `About You` 等**多層字級的 display title** 當區塊邊界，**沒有 card border、沒有水平 line、沒有 background block**。

→ 對照持倉看板：現在大量靠 `border-card` / `bg-muted` 切區塊，視覺很碎。借鑒：**桌機版可試「字級即 hierarchy」**，純白底大字小字錯落分區。

### 10. **Step Countdown Number**（filmstrip 倒數）

Img_02 中央有個**圓圈內的「3」+ filmstrip 標記**，是 Payments Setup 流程的 step indicator。比「Step 3 of 5」純文字進化版 — **數字本身巨大化當視覺錨點**。

→ 對照持倉看板：「上傳成交」「綁定券商」這類多步流程，借鑒「step number 巨大化」當每步 hero。

## 視覺 / 互動觀察

### 配色

- **底**：純白 `#FFFFFF`（極致簡潔）
- **主字 / nav**：純黑
- **唯一 accent**：Cyan `#5DD9F7` ish（CTA 專用）
- **Diff / 重點 panel**：黑底 + 白字（Total panel）
- **Sidebar**：純黑底 + 灰字 nav（active 白字）
- **無 brand 主色**（極端 monochrome） — 跟 Vorxs（sage olive）/ Klar（粉紫橘）走完全不同方向

### 字型

- **主 UI 字**：geometric sans（看似 Söhne / Inter 系，bold weight 多）
- **Hero title**：超粗、超大（佔水平 30-40%），**頁名 > KPI 數字**
- **數字**：寬幅 sans display（同 Vorxs / Paydex 紀律），`$X,XXX.XX` 兩位小數
- **層次**：
  - 第 1 層 = 巨型頁名（`Dashboard` / `All Invoices`）
  - 第 2 層 = 第二級標題（`Manually Added` / `Wise US`）
  - 第 3 層 = hero number（金額）
  - 第 4 層 = metadata（`Created 23 Jun, 2024` / `Checking ****804`）
  - 第 5 層 = nav / button label

### 資料密度

**中-高**。Img_04 表格 11 列 × 5 column × Total 合計，密度遠高於 Vorxs / Klar；但靠**極大留白 + 極簡裝飾**讓密度可承受。

→ **對照持倉看板的契合度最高**：我們本來就是高密度 entity 表格產品，Quicked 證明「高密度 ≠ 雜亂」。

### 動效角色（推測）

靜態 case study 無動效資訊。但從版面紋理推測：

- Sidebar nav hover 應有微妙 background fade
- Step countdown「3」可能 morph 進場
- Cyan CTA hover 應有 lift + 些微 saturation
- Light/Dark toggle 切換應整頁 fade-cross

合乎本專案 `2026-04-26-motion-relax`「服務易讀性 + 不沉悶」紀律。

## 可借鑒到本專案的點（panel-switching 切換邏輯為主）

| #   | Pattern                                         | 怎麼用在持倉看板                                                      |
| --- | ----------------------------------------------- | --------------------------------------------------------------------- |
| 1   | 持久左 sidebar 列 6 route                       | 桌機版加，mobile 仍走頂部 9-tab；上 tab = 切片，左 nav = 換頁         |
| 2   | 巨型 page title hero                            | 每 route 進場第一眼是頁名，字級 > 任何 KPI 數字                       |
| 3   | 全站僅 1 個亮色 CTA                             | 一頁最多 1 個 cyan / coral 主按鈕，其餘 outline                       |
| 4   | Step-form side index（greyed-out future steps） | 「新增交易 / 上傳成交 / 編輯組合」改 4-step stepper，未來步灰色不隱藏 |
| 5   | Multi-account split tile                        | 「全組合研究」頁桌機版做 3-4 組合等寬並排 + 同 KPI                    |
| 6   | 純符號 hero（≠ / ↗ / ↘）                        | 警示 / diff / 趨勢，符號代替文字當 message                            |
| 7   | Header 永久 light/dark toggle                   | 不藏 Settings，header 右側 ☀️/☾ 並排                                  |
| 8   | 浮動 Watch Video / Help                         | 收盤分析 / 全組合研究右下角持久 helper，不擋主流程                    |
| 9   | Display title 當 divider                        | 桌機版減少 card border，靠字級對比分區                                |
| 10  | Step number 巨大化                              | 多步流程把「3 of 5」改成圓圈內超大「3」+ filmstrip                    |

## 不適用本專案的點

1. **純黑白 monochrome** — 持倉看板「投資網紅軟語氣」（per `project_soft_language_style`）需要溫度，極端 monochrome 偏冷靜偏 B2B SaaS。色彩可借「單一 accent 紀律」，但底色不能照抄純白。
2. **`Quicked7` 文字 logo** — 我們既有 brand。
3. **Tablet/desktop-only mockup** — Quicked 4 張圖全都 tablet 演示，**完全沒露 mobile**。我們需要 mobile 並重，必須自己想 mobile 怎麼變。
4. **單一 user / 單一 company** — Quicked 假設一個 owner 看自己的 invoice。我們是多 portfolio + 多 persona（per `claude.md` R7.5），sidebar nav 要保留組合切換器空間。
5. **發票 / 付款 domain copy** — `Reconcile` / `Statement Balance` / `Unpaid` 直接套不上股市，但 pattern 可遷移到「對帳成交 / 應有持股 / 未配發股息」等股市 diff 場景。

## 給 Codex 的提問（待 Round 1 討論）

1. **持倉看板桌機版要不要新增左 sidebar nav？** 跟現有 9 個頂部 tab 怎麼配？
   - 提案：頂部 9 tab = 「資料切片」（KPI 維度切換），左 sidebar = 「6 route page 切換」。職責正交。
   - 反駁點：是否會跟既有 mobile 9-tab sticky decision（`2026-04-24-mobile-sticky-policy`）衝突？mobile fallback 怎麼降階？
2. **既有 Tailwind / design token 撐不撐 hero title 字級？**
   - `text-7xl` 夠嗎？還是要新增 `text-display-2xl`（可能 96-120px）？
   - 跟 Vorxs / Paydex / Finno 的 hero 字級需求**是否該共用 token**？（一個 spec 定義跨 ref 共通字級系統）
3. **Cyan 單 accent 跟既有警示色階怎麼整合？**
   - 現在我們有 success/warning/danger 多色階。借鑒「全站 1 個 accent」要砍多少現有色？
   - grep `bg-primary` `text-primary` `bg-success` `bg-danger` 列現況，再決定。
4. **Stepped form side-index 改造代價：**
   - 現有 modal form（`UploadFillsModal` / `EditPortfolioModal` / `NewTradeForm`）幾個？哪個最該先 stepped？
5. **Multi-account split tile vs 既有 portfolio switcher：**
   - 「全組合研究」頁是否本來就有 spec？要不要拆「總覽（split tile）vs detail（單組合 zoom）」雙視圖？

## 跟 Ref 02-04 的 cross-reference

| 維度           | Quicked 7（本份）       | Vorxs（02）            | Paydex（03）        | Finno（04）            |
| -------------- | ----------------------- | ---------------------- | ------------------- | ---------------------- |
| Form factor    | **Tablet/desktop**      | Mobile                 | Mobile（含 dark）   | Tablet/desktop         |
| 主切換邏輯     | **持久左 nav + 大頁名** | Card stack + drawer    | Section header date | Numbered tab + sidebar |
| Accent         | Cyan（1 色）            | Coral + Yellow（2 色） | Coral（1 色）       | Mint + Cream（2 色）   |
| 資料密度       | **中-高**（表格友善）   | 中                     | 中                  | 中-低                  |
| 對本專案契合度 | **★★★★★** 桌機版直接抄  | ★★★★ pattern 抄        | ★★★ dark mode 抄    | ★★★★ 平板版 hybrid     |

**Quicked 7 是本系列裡 form factor + 資料密度最契合持倉看板的一份**，下一輪 Codex 討論可優先以 Quicked 為桌機 baseline。
