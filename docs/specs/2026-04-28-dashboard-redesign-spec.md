# 持倉看板互動介面重設計 · Spec（Round 19 收斂草案）

**主入口**：[`../research/dashboard-redesign/INDEX.md`](../research/dashboard-redesign/INDEX.md) ｜ **任務脈絡**：[`../research/dashboard-redesign/MISSION.md`](../research/dashboard-redesign/MISSION.md) ｜ **Round notes**：[`../research/dashboard-redesign/rounds/discussion.md`](../research/dashboard-redesign/rounds/discussion.md) ｜ **Pattern matrix**：[`../research/dashboard-redesign/pattern-matrix-v1.md`](../research/dashboard-redesign/pattern-matrix-v1.md)

**前置文件**：

- [`./2026-04-18-portfolio-dashboard-sa.md`](./2026-04-18-portfolio-dashboard-sa.md) — 9 tab + 6 route page baseline（不重開）
- [`./2026-04-18-portfolio-dashboard-sd.md`](./2026-04-18-portfolio-dashboard-sd.md) — 元件 / state owner / data flow

**狀態**：🟡 Round 19 草案 · 待 user 拍板

---

## 0. 用戶五條 design principle（必對齊 · per `MISSION.md`）

1. **Zero-Click Awareness** — 一打開馬上知道持倉狀況
2. **漸進式披露** ⭐️ — 資訊充足但避免失焦
3. **散戶教學** — user 不知道要看什麼，要主動引導
4. **美感** — 台灣最缺，留人靠這個
5. **動畫 / 互動** — Motion as Default, Not Decoration

---

## 1. Frame Inversion（per Codex Round 11 strategic warning）

### 1.1 三大 Inside Contract 是 spec 的 anchor

**不是**「外部 finance dashboard pattern 直接套」，**是**「用 pattern 強化既有 contract」。

| 既有 Contract        | 程式入口                                                          | spec 對應 mission                                                       |
| -------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **HoldingDossier**   | `src/hooks/useRoute*Page.js` + Holdings 元件                      | mission #2 漸進披露的承載對象 — 個股 / 持倉 row 的展開內容              |
| **AccuracyGate**     | `src/components/overview/DashboardPanel.jsx:777` + spec sa.md:497 | mission #3 散戶教學 — AI insight 顯示前的可信度 gate                    |
| **OperatingContext** | `src/hooks/useRouteOverviewPage.js:18` + spec sa.md:393           | mission #1 Zero-click — Overview hero 的 nextActionLabel + top warnings |

### 1.2 Pattern A-FF 是「強化工具」不是「替代品」

| Outside Pattern       | 用來強化哪個 Contract                                           |
| --------------------- | --------------------------------------------------------------- |
| L Accordion           | HoldingDossier 漸進展開                                         |
| Q Vertical color-bar  | HoldingDossier 雙編碼類別                                       |
| N Target-range slider | HoldingDossier 成本 vs 市價                                     |
| DD AccuracyGate hint  | AccuracyGate 視覺化（既有 gate 邏輯，視覺加上 confidence chip） |
| AA AI insight tag     | AccuracyGate 後的呈現                                           |
| W Per-card micro-copy | OperatingContext.nextActionLabel 的視覺呈現                     |
| X Health score badge  | OperatingContext 整體狀態符號化                                 |
| CC StaleBadge         | OperatingContext 資料新鮮度層                                   |

---

## 2. 6 Route Page Spec（修正 Codex Round 11 兩個錯誤）

> ⚠️ Round 12 配方有 2 個錯誤被 Codex 抓到：Overview News 違反分流 / 收盤分析 segmented 違反盤後 ritual。本 spec 已修正。

### 2.1 Overview · 持倉總覽

```
Layer 1（≤ 5s）—— OperatingContext-driven
┌────────────────────────────────────────────┐
│ C 巨型「概覽」頁名 + W micro-copy 1 行    │
│                                            │
│ ┌─ hero card ─────────────────────────┐ │
│ │ today P&L (大字 P+animation #1 counter-up)│
│ │ X Health score badge（綠/黃/紅）   │ │
│ │ AA AI insight 1 句（DD AccuracyGate gate 過再顯）│
│ │ ▶ OperatingContext.nextActionLabel  │ │ ← Codex 強調用這個，不要新聞
│ │ ▶ top warnings（CC Freshness 標）   │ │
│ └─────────────────────────────────────┘ │
│                                            │
│ KPI strip (3-tile · E + W micro-copy 各 1) │
│  ┌──────┬──────┬──────┐                  │
│  │曝險  │持股數│流動性│                  │
│  └──────┴──────┴──────┘                  │
└────────────────────────────────────────────┘
Layer 2 滾動：點 KPI → 同頁 inline drawer 展開分布圖（不切頁）
```

**❌ Round 12 配方移除**：O News + ticker chip（spec 明寫 News/Events 分流）

### 2.2 持倉

```
Layer 1（≤ 5s）—— HoldingDossier 主場
┌────────────────────────────────────────────┐
│ C 巨型「持倉」頁名                          │
│                                            │
│ G+H Split-tile（focus 整塊變色）          │
│  ┌────┬────┬────┐                        │
│  │個股│ETF │現金│ ← 整塊變色 selection   │
│  └────┴────┴────┘                        │
│                                            │
│ Q list：每 row                             │
│  │產業色條│icon│code│name│損益│動作        │
│  └─ 點 → L accordion 展開（不切頁）       │
│      ├ N target-range slider（成本 vs 市價）│
│      ├ M stacked ratings bar（買/持/賣）   │
│      ├ AA AI insight + DD confidence       │
│      └ CC StaleBadge（資料若 stale）       │
└────────────────────────────────────────────┘
```

### 2.3 交易日誌

```
Layer 1（≤ 5s）
┌────────────────────────────────────────────┐
│ C 巨型「交易日誌」                          │
│                                            │
│ I Section-header date 大字（按月）         │
│  ┌─ 2026-04 ────────────────────────┐    │
│  │ Q list（左側買↗綠/賣↘coral 雙編碼）│    │
│  │  └─ R 純符號 hero +/-              │    │
│  │  └─ 點 → drawer slide-in detail   │    │
│  └────────────────────────────────────┘    │
│                                            │
│ + 按鈕（D 1 cyan CTA）→ S Calculator 全螢幕│
└────────────────────────────────────────────┘
```

### 2.4 收盤分析（**最重要修正點**）

```
Layer 1（≤ 5s）—— 盤後 single ritual（不是 realtime）
┌────────────────────────────────────────────┐
│ C 巨型「收盤分析」                          │
│                                            │
│ 「今日 ritual 步驟軸」（不是時段軸 F）     │
│ ┌─ 1 Daily Report ── 2 Analyze ── 3 Stress ─┐│ ← 三步 ritual
│ │ 對應 useRouteDailyPage.js                  ││
│ └────────────────────────────────────────────┘│
│                                            │
│ E hero：今日大盤強弱                       │
│ AA AI insight：「今天最該關注 1 檔」（DD gate）│
│ M stacked ratings bar：分析師買/持/賣      │
└────────────────────────────────────────────┘
```

**❌ Round 12 配方移除**：F Time-Period Segmented `1H/1D/1W/...`（盤後 ritual 不是 realtime feed）

### 2.5 全組合研究

```
Layer 1（≤ 5s）
┌────────────────────────────────────────────┐
│ C 巨型「全組合研究」                        │
│                                            │
│ G Split-tile×N（每組合一塊 + X health badge）│
│  ┌────┬────┬────┬────┐                   │
│  │組合A│組合B│組合C│組合D│                  │
│  └────┴────┴────┴────┘                   │
│  └─ 點 → 同頁 zoom 切單組合（不切頁）     │
│                                            │
│ BB Heat map（產業 / 區域分布）             │
└────────────────────────────────────────────┘
```

### 2.6 情報脈絡

```
Layer 1（≤ 5s）
┌────────────────────────────────────────────┐
│ C 巨型「情報脈絡」                          │
│                                            │
│ FF Filter-first rail（mobile collapsed） ← per Codex   │
│  └ 點展開 filter 才看到 detail              │
│                                            │
│ I 按日 section header                      │
│ E×N news card stack：                       │
│  ├ O 嵌入式 ticker chip（前面）            │
│  ├ headline                                  │
│  └ AA「對你持倉影響」（DD AccuracyGate）    │
│                                            │
│ 動效 #8 staggered fade-in 進場              │
└────────────────────────────────────────────┘
```

---

## 3. Cross-cutting 設計 token（必新增）

### 3.1 Typography Scale（per Round 15）

```css
text-display-2xl: 96-120px / 800   /* C 巨型 page title */
text-display-xl:  72px     / 800   /* E hero 主數字 */
text-display-lg:  56px     / 700   /* split-tile 內 KPI */
text-display-md:  40px     / 700   /* Layer 2 次主 */
text-body-lg:     18px     / 500
text-body-md:     14px     / 400
text-caption:     11-12px  / 500
text-tracking-wide-caps: 11px / 600 ALL CAPS
```

### 3.2 Color Discipline（per Round 15）

```css
accent-primary:  yellow   #E5D24A ish   /* 達標 / 主動作 highlight */
accent-warning:  coral    #E97250 ish   /* 警示 / 停損 / diff */
accent-info:     cyan     #5DD9F7 ish   /* 1 個 CTA */
neutral-50..950: 11 階                  /* 背景 + 文字 + border */
/* 砍掉現有多色階 bg-success / bg-danger 等 */
```

### 3.3 Layer Discipline（per Round 13）

每頁強制三層：

- **Layer 1（≤ 5s）**：1 hero + 3-5 KPI + 1-2 alert
- **Layer 2（5-30s）**：accordion / drawer / 同頁 inline
- **Layer 3（> 30s）**：detail page / fullscreen

### 3.4 Motion Discipline（per Round 14）

12 個 canonical 動效（counter-up / segmented morph / tile focus / accordion fade / hover lift / spotlight cursor / health color / staggered fade / dark fade-cross / diff pulse / sunburst breath / Buy-Sell ripple）— 詳見 [pattern-matrix-v1.md Round 14](../research/dashboard-redesign/pattern-matrix-v1.md)。

每頁 ≥ 3 個 / ≤ 5 並發 / 尊重 `prefers-reduced-motion`。

---

## 4. 實作優先級（per Codex Round 11 grep 結果）

### P0（已有，只需 polish · 1-2 sprint）

| Pattern | 既有元件                     | 動作                              |
| ------- | ---------------------------- | --------------------------------- |
| W       | `DashboardPanel.jsx:512`     | 既有 helper copy 抽 prop 統一接口 |
| L       | 多處分散 accordion           | 抽 `<DisclosureCard>` 元件        |
| BB      | `SeasonalityHeatmap.jsx:217` | 改 portfolio distribution 變體    |
| EE      | `CmdKPalette.jsx`            | 已有，加教學引導 hint             |

### P1（部分 · 需擴充 · 2-3 sprint）

| Pattern | 既有元件                             | 動作                                   |
| ------- | ------------------------------------ | -------------------------------------- |
| H       | `ResearchPanel.jsx:424`              | 抽 `focused` prop                      |
| Q       | `HoldingsTable.jsx:517`              | 加產業色條 leftBorder + icon           |
| X       | `Base.jsx:183` Badge + Concentration | 加 healthScore 分級 prop               |
| AA + DD | `DashboardPanel.jsx:777` AI accuracy | 加 inline confidence tag UI            |
| FF      | `NewsPanel.jsx:633`                  | mobile collapsed 模式擴展到桌機 sticky |

### P2（完全沒有 · 需新建 · 3-4 sprint）

| Pattern    | 新元件                              | 難度 |
| ---------- | ----------------------------------- | ---- |
| C          | `<PageHeroTitle>`                   | 1    |
| F (時段) → | `<RitualStepStrip>` （收盤 ritual） | 1    |
| J          | `<NumberedTabs>` (`01.` `02.`)      | 1    |
| P          | `<SunburstHero>` (CSS gradient)     | 2    |
| Z          | `<IllustrationHero>` slot           | 2    |
| Y          | dark mode toggle + token            | 3    |
| S          | `<TradeCalculatorInput>`            | 3    |

---

## 5. Web vs Mobile 分流（per Round 16-17）

### 桌機

- 加左 sidebar nav（B）= 6 route 永遠在場
- Layer 1 hero zone padding 96px
- D: 1 cyan CTA per page
- V: 右下浮動 Watch / Help

### Mobile（≤ 768px）

- 不抄 bottom 4-tab nav（U pattern · 9-tab 已鎖死）
- Hero 縮 1 級（display-lg 56px）
- T: 4-action quick grid（Overview only）
- accordion 取代 modal
- staggered fade 縮短到 60ms 間隔

---

## 6. Open Questions（待用戶 / Round 21+ 解）

1. **AccuracyGate visual contract**：confidence chip 該長什麼樣？百分比 / 等級 / 純圖示？
2. **Health score 算法**：用什麼維度（曝險 / 集中度 / 流動性 / 持倉天數 ...）？
3. **「投資網紅軟語氣」micro-copy 模板庫**：W per-card 1 行該寫什麼？要 i18n 模板表（per `project_soft_language_style`）
4. **dark mode 上線時程**：Y pattern 是 P2，是否提早？
5. **3D illustration**：是否真的要做（成本高），還是先用 CSS gradient sunburst（P pattern）替代？

---

## 7. 變更紀錄

| 日期       | 變更                                          | by     |
| ---------- | --------------------------------------------- | ------ |
| 2026-04-28 | Round 19 spec 草案 · 整合 Round 1-18 全部研究 | Claude |
