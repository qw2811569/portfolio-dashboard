# Behance gallery — Startify · SaaS Analytics Platform & UX UI Design

**主入口**：[`../../INDEX.md`](../../INDEX.md) ｜ **Ref 索引**：[`../README.md`](../README.md) ｜ **抓取工具**：[`../../TOOLS.md`](../../TOOLS.md)

- **Source URL**：https://www.behance.net/gallery/237850033/Startify-SaaS-Analytics-Platform-UX-UI-Design
- **Designer**：[Yurii Volot](https://www.behance.net/yuriivolot)（Behance profile，請以 page.html 內 owner block 為準）
- **og:description（節錄）**：「Starlify is a comprehensive analytics platform designed to help businesses track, analyze, and optimize their digital presence in real-time. The dashboard provides actionable insights across multiple metrics including sales funnels, user engagement, retention...」
- **Tools**：Photoshop · Illustrator
- **Creative fields**：Product Design · UI/UX · Web Design
- **License**：Attribution, Non-commercial, No Derivatives
- **取得日期**：2026-04-27
- **檔案**：22 張 project module 已落檔在 `./img-01.png` ~ `./img-22.png`（已從原 57 張清掉 avatar/工具 icon/related thumb 噪訊）；`page.html` 完整保留供後續 grep
- **由誰提出**：用戶（第十五組）

> ⚠️ 注意：抓取時 owner 解析回到 Behance 站內 nav（Explore/Jobs/About）— 真實 designer Yurii Volot 在 page.html 的 owner block 區段。後續 Codex 可 grep `658A021954C2E2610A4C98A5` 或 `Yurii Volot` 比對。

---

## 為什麼存這份（重點）

這是**桌機 SaaS analytics dashboard 的完整 case study**，結構類似 RonDesignLab Dribbble 七段（Client Pain → About → Wireframe → Final UI），但更深 — 22 張 module 圖橫跨：

1. **Hero 鏡頭（img-01）** — 監視器斜放展示主 dashboard
2. **Quote 客戶見證（img-02）** — 「Startify transformed how we understand our users. What used to require multiple tools and endless clicking now happens instantly.」by Samuel Mitchell, Head of Analytics
3. **User Persona（img-12）** — Sarah Mitchell, 32, Senior Marketing Manager · Pain Points 84% / Goals 75% / Motivations 64%；上排 **3-tab：User Persona / Customer / Target Audience**
4. **Wireframe / Style guide / 各 page 完稿** 共 19+ 張

→ **跟我們持倉看板距離最近的形態**：tablet/desktop SaaS analytics + 多 KPI grid + 多 chart + region heatmap + sessions/views/users 多面板。**比 Quicked 7（Ref 05）更接近實際 production analytics 工具**。

---

## 切換面板的邏輯（panel-switching · 對應用戶之前設定的研究主軸）

從 hero（img-01）即可看到的高密度切換 pattern：

### 1. **Pill-Tag Context Indicator**（右上角）

img-01 右上 4 個橢圓 chip：

```
( UX/UI ) ( SaaS )
( Dashboard ) ( Platform )  ◇ ← 黃色 brand 點
```

**不是 nav，是 metadata tag** — 但放在「mockup 之外」的右上，當作展示語境的視覺鎖。
→ 對本專案：**展示用 portfolio 截圖**也可借這 pattern；產品內**頁面右上加類別 chip**（`分析 / 監控 / 個股 / 全組合`）讓使用者知道當下進入哪種模式。

### 2. **Top KPI Strip · 6-cell 帶大數字**（hero 圖中段）

```
78  / 70%   |  56  / 33%  |  203       |  12  ↗     |  234        |  62
Goals Completed | Active Tracking | Setup Required | Errors | View Notes | Tips
```

**6 個 KPI 一字排開**，每個 = 大數字 + 副標。**綠/黃/灰 三色 background 各 2 格** → 用顏色把 KPI 分群（達標 / 進行中 / 待處理）。
→ 對本專案：「持倉 Overview」可借「KPI 分群配色」— 例如 達標部位 / 警示部位 / 觀察名單 各用一色 background pill。

### 3. **「黑底 panel · realtime」**（右上角）

```
Active users in the last 30 min.       ✓
16,248
Active users per minute    | 23,342 (黃 highlight)
[ bars chart … ]
```

**整片 dashboard 中唯一的黑底區塊** = realtime stream。**用色塊本身告訴 user「這塊是即時不停變」**。
→ 對本專案：「收盤分析」即時行情 panel / 個股 live price / 通知串流 borrow 此 — **「即時資料 = 黑底」當視覺通用語**。

### 4. **Tab cluster（img-12 User Persona）**

3 個分類 tab（User Persona / Customer / Target Audience）+ 右側「Empathy ◆」 — 跟 Klar 的 split-tile 同源，但更輕量（純文字 tab 不填色）。

### 5. **Recommended panel · 多 sub-table 並排**

img-01 下半段有「Recommended」section，內含 3 個 sub-table：

- Active users / Country identifier（地圖 + region 排行）
- Sessions（channel group 分類）
- Views（page title 排行）

**3 表並排同階**，但**每表標題前各有狀態圈**（✓ 表示資料健康），讓 user 在 3 表之間切看的同時還能掃到「哪表有問題」。
→ 對本專案：「全組合研究」3 個組合並列時，每組合卡標題前加一個「健康狀態圈」（✓/⚠/⚡）

### 6. **Color discipline · 3-accent**

整 dashboard：

- 黃（brand · highlight）
- 綠（達標 / positive）
- 灰（中性 / 預設）
- 紅（少量警示 · img-01 上 12 errors）

→ **比 Vorxs（2 accent）更鬆，但比一般 SaaS（5+ 色階）緊**。是「中等紀律」的範例。

### 7. **半透明 brand watermark**（hero 視覺手法）

img-01 監視器後方有大面積淡灰 `Startify` watermark — 純品牌曝光，**不影響 dashboard 本身判讀**。
→ 對本專案：marketing 截圖 / 案例展示時可借（產品內不需）。

---

## 跟其他 ref 的 cross-reference

| 維度           | Startify (本份)                          | Quicked 7 (05)          | 持倉看板需求         |
| -------------- | ---------------------------------------- | ----------------------- | -------------------- |
| Form factor    | Tablet/desktop（單一 hero）              | Tablet/desktop          | 桌機 baseline        |
| KPI 數量       | **6 主 KPI 一字排**                      | 0-1（純表格 dashboard） | 4-6 KPI（中等密度）  |
| Chart 類型     | Line + bars + region heatmap + sub-table | Line + bar              | 兩者皆要             |
| Realtime panel | 黑底專屬                                 | 無                      | **借鑒**             |
| Tag chip       | 頁面右上 metadata                        | 無                      | 可借鑒（標頁面類別） |
| Color accent   | 3 色（黃/綠/灰）+ 警示紅                 | 1 色（cyan）            | 3 色適合（KPI 分群） |

---

## 待 Round 1 給 Codex 的取捨題

1. **「黑底 panel = 即時資料」是否升 design token？** 全站 realtime stream 走同一規格。
2. **6-KPI 一字排 vs 我們現在的 KPI grid**：grep 既有 `KpiGrid` / `OverviewMetrics` 元件，看密度差距。
3. **3 色 accent 跟既有 brand token 整合**：黃 / 綠 / 灰是否能 reuse 現有 token？或需新增？
4. **Behance 22 張 module 是否值得逐張 close-read**？目前我只 close-read 了 img-01/02/12；其餘 19 張可下一輪 open as priority candidates。

---

## Image inventory（22 張 project module，依文章原順序）

| #   | 檔案         | 來源 URL（從 page.html 抽）                                                                                   |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| 01  | `img-01.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/5564bd237850033.6915d7aa6d096.png` ⭐️ Hero monitor |
| 02  | `img-02.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/c2a5fd237850033.6915d727b5634.png` 客戶見證        |
| 03  | `img-03.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/6db8cf237850033.6915d727b2d91.png`                 |
| 04  | `img-04.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/540ab7237850033.6915d727b1113.png`                 |
| 05  | `img-05.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/5c2f0e237850033.6915d727b3e56.png`                 |
| 06  | `img-06.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/ad4519237850033.6915d727b456d.png`                 |
| 07  | `img-07.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/8dfee6237850033.6915d727b4f0f.png`                 |
| 08  | `img-08.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/c33d39237850033.6915d727b66b7.png`                 |
| 09  | `img-09.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/cf0bc4237850033.6915d727b05b9.png`                 |
| 10  | `img-10.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/ef10b5237850033.6915d727b8a36.png`                 |
| 11  | `img-11.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/a65f5b237850033.6915d727afd5c.png`                 |
| 12  | `img-12.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/50e195237850033.6915d727b8030.png` ⭐️ User Persona |
| 13  | `img-13.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/fe044c237850033.6915d727b6ddb.png`                 |
| 14  | `img-14.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/9d7046237850033.6915d727b9172.png`                 |
| 15  | `img-15.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/7d0de5237850033.6915d727b34a0.png`                 |
| 16  | `img-16.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/ab1a02237850033.6915d727b0b4e.png`                 |
| 17  | `img-17.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/07a15c237850033.6915d727b98ac.png`                 |
| 18  | `img-18.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/06df15237850033.6915d727ba9ad.png`                 |
| 19  | `img-19.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/f0bbaa237850033.6915d727b9fb5.png`                 |
| 20  | `img-20.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/ec5739237850033.6915d727b1887.png`                 |
| 21  | `img-21.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/2c4a60237850033.6915d727b1fb2.png`                 |
| 22  | `img-22.png` | `https://mir-s3-cdn-cf.behance.net/project_modules/fs_webp/acc5e4237850033.6915d727b780a.png`                 |

> 重新抓取本 gallery：
>
> ```bash
> node scripts/fetch-behance-gallery.mjs \
>   "https://www.behance.net/gallery/237850033/Startify-SaaS-Analytics-Platform-UX-UI-Design" \
>   "docs/research/dashboard-redesign/refs/16-behance-startify-saas"
> ```
