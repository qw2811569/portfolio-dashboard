# Dashboard 互動介面重設計 · Research INDEX

**開案日**：2026-04-27
**負責**：Claude（架構 / 派工 / 收斂）+ Codex（實作 / 反駁）
**狀態**：🟢 **Round 1-20 完成（2026-04-28 Auto Mode 收斂）** · spec 草案 + decision 草案待拍板

## 子文件導覽（避免孤兒）

- 🎯 **[`MISSION.md`](./MISSION.md)** ⭐️ — 用戶 5 條 design principle（兩 LLM 必讀，每 round 結尾要回扣）
- 🌐 **[`SOURCES.md`](./SOURCES.md)** — 22 個推薦資料源（A/B/C/D 分類，公開/需登入/WAF 標註）
- 📚 **[`refs/README.md`](./refs/README.md)** — Ref 索引（25 份 · Refs 01-25）
- 🛠 **[`TOOLS.md`](./TOOLS.md)** — 7 個抓取工具（Dribbble shot/profile · Muz.li · Behance · listing · Chat-image extractor）
- 💬 **[`rounds/discussion.md`](./rounds/discussion.md)** — Multi-LLM Round notes（**20 輪完成 ✅**）
- 📊 **[`pattern-matrix-v1.md`](./pattern-matrix-v1.md)** — 29 個 pattern A-FF + 對應 mission 5 原則 + 6 route page 配方
- 📁 **[`briefs/`](./briefs/)** — Codex 派工 brief 收檔
- 📖 父專案索引 → [`../../CANONICAL-INDEX.md`](../../CANONICAL-INDEX.md)
- 🎯 **結論 spec** → [`../../specs/2026-04-28-dashboard-redesign-spec.md`](../../specs/2026-04-28-dashboard-redesign-spec.md)
- 📌 **拍板 decision** → [`../../decisions/2026-04-28-dashboard-redesign.md`](../../decisions/2026-04-28-dashboard-redesign.md)（草案，待用戶拍板）

---

## 動機（Why）

**用戶觀察（2026-04-27）**：

> 「我們現在的網頁太長，資訊量太多很難聚焦。」

持倉看板（Vercel `jiucaivoice-dashboard.vercel.app` + VM `35.236.155.62.sslip.io` / `104.199.144.170.sslip.io`）目前是**長頁面 + 多 tab + 多 card** 的密集資訊架構。Round 1 SA/SD（2026-04-18）已奠定 9 tab 結構與 6 個 route page，但**互動 / 聚焦 / 視覺層次**還沒被當主議題收斂過。

本研究目標：**找出最適合本專案的互動介面（focus pattern）**，把「一頁全塞」改成「主動聚焦 + 漸進揭示」。

---

## 不重開的舊議題

開新討論前，先比對既有 decision，違反者要寫推翻文件：

- [`docs/decisions/index.md`](../../decisions/index.md) — 全 decision 索引
- [`docs/specs/2026-04-18-portfolio-dashboard-sa.md`](../../specs/2026-04-18-portfolio-dashboard-sa.md) — 9 tab + 6 route page 主架構（互動細節未鎖）
- [`docs/specs/2026-04-18-portfolio-dashboard-sd.md`](../../specs/2026-04-18-portfolio-dashboard-sd.md) — 元件 / state owner map

**本研究不重開**：tab 結構、route 切分、storage adapter、VM-Vercel 切分。
**本研究專注**：頁面內互動 pattern（focus / drill / progressive disclosure / motion / data density）。

### 已有 decision · 必須遵循（不要再吵的紀律）

| Decision                                                                                                        | 對本研究的限制                                                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`2026-04-24-mobile-sticky-policy`](../../decisions/2026-04-24-mobile-sticky-policy.md)                         | Mobile（≤768px）只能 `app-shell` title + tabs sticky；要新增 sticky 必走例外流程 |
| [`2026-04-26-motion-relax`](../../decisions/2026-04-26-motion-relax.md)                                         | 動畫禁令已撤；只要 serve 易讀性 + 不沉悶就允許；仍尊重 `prefers-reduced-motion`  |
| [`2026-04-16-naming-portfolio-vs-agent-bridge`](../../decisions/2026-04-16-naming-portfolio-vs-agent-bridge.md) | 文件 / spec 一律「持倉看板」或「Agent Bridge」，不准混用 dashboard 字眼          |

---

## Refs · 視覺/設計參考

| #   | 來源                                                                                                                                        | Form factor                          | 觀察重點                                                                                                                                                             | 描述檔                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 01  | IG `@ron_design`（2026-04 ish）                                                                                                             | Mobile                               | 極簡 B/W + 單一黃 accent · dot-matrix 數字 · 大留白 · 單一 metric 突出                                                                                               | [`refs/01-ron-design-statistics-app.md`](./refs/01-ron-design-statistics-app.md)                                             |
| 02  | [Financeux — Vorxs](https://www.financeux.com/work/vorxs)                                                                                   | Mobile                               | Card-stacked spotlight · sage olive + coral 警示 + 黃 引導 · sunburst 重量感視覺                                                                                     | [`refs/02-financeux-vorxs.md`](./refs/02-financeux-vorxs.md)                                                                 |
| 03  | [Financeux — Paydex](https://www.financeux.com/work/paydex)                                                                                 | Mobile（含 dark）                    | 黑底 mono terminal 字 · Calculator vs Receipt 雙 mode · section-header date 切片                                                                                     | [`refs/03-financeux-paydex.md`](./refs/03-financeux-paydex.md)                                                               |
| 04  | [Financeux — Finno](https://www.financeux.com/work/finno)                                                                                   | **Tablet/desktop**                   | Hybrid solid+outline display 字 · 數字 sub-tab `01./02.` · Sidebar nav · Avatar bubble cluster                                                                       | [`refs/04-financeux-finno.md`](./refs/04-financeux-finno.md)                                                                 |
| 05  | [Financeux — Quicked 7](https://www.financeux.com/work/quicked-7)                                                                           | **Tablet/desktop**                   | **持久左 nav 8 items · 巨型 page title hero · cyan 1-CTA 紀律 · split tile · `≠` 純符號 hero**                                                                       | [`refs/05-financeux-quicked-7.md`](./refs/05-financeux-quicked-7.md)                                                         |
| 06  | [Financeux — Klar](https://www.financeux.com/work/klar)                                                                                     | Mobile                               | **Trading app 同 domain · time-period segmented · split-tile focus · accordion · stacked bar · target-range slider**                                                 | [`refs/06-financeux-klar.md`](./refs/06-financeux-klar.md)                                                                   |
| 07  | [Dribbble — StreamLogic](https://dribbble.com/shots/27231820-StreamLogic-Industrial-Dashboard-Smart-Pump-Monitoring-UI)                     | Desktop SaaS                         | **RonDesignLab · 同 designer 跨 domain · 案例文「Client Pain → About → Task → Process → Key Decisions → Growth Effect」7 段結構** · 工業 IoT pump                    | [`refs/07-dribbble-streamlogic/page-text.md`](./refs/07-dribbble-streamlogic/page-text.md)（描述檔待寫）                     |
| 08  | [Dribbble — Synthex SaaS](https://dribbble.com/shots/27131881-Synthex-UI-Analytics-SaaS-Dashboard)                                          | Desktop SaaS                         | **RonDesignLab · Analytics SaaS desktop · 7 段案例文 + 3200×2400 原圖 + .mp4 動畫**                                                                                  | [`refs/08-dribbble-synthex-saas/page-text.md`](./refs/08-dribbble-synthex-saas/page-text.md)（描述檔待寫）                   |
| 09  | [Dribbble — Synthex Mobile](https://dribbble.com/shots/27086410-Synthex-SaaS-Analytics-Mobile-Dashboard)                                    | Mobile                               | **RonDesignLab · Synthex 同產品 mobile 版 · 4800×3600 原圖（3x density）· 跟 Ref 08 是同一個產品的雙形態觀**                                                         | [`refs/09-dribbble-synthex-mobile/page-text.md`](./refs/09-dribbble-synthex-mobile/page-text.md)（描述檔待寫）               |
| 10  | [Dribbble — Celoxis](https://dribbble.com/shots/27023847-Celoxis-Dashboard-Management-Platform-SaaS)                                        | Desktop SaaS                         | **RonDesignLab · Project management SaaS · 7 段案例文 · 跟我們持倉看板「多 entity / 多 portfolio」結構同型**                                                         | [`refs/10-dribbble-celoxis/page-text.md`](./refs/10-dribbble-celoxis/page-text.md)（描述檔待寫）                             |
| 11  | [Dribbble — Finance Mobile](https://dribbble.com/shots/27316040-Finance-Mobile-App)                                                         | Mobile                               | **Zain's Studio · Send-money + Wallet 雙 screen · 數字鍵盤 + quick-amount pills · soft cream + coral accent**                                                        | [`refs/11-dribbble-finance-mobile-app/page-text.md`](./refs/11-dribbble-finance-mobile-app/page-text.md)                     |
| 12  | [Dribbble — Task Management](https://dribbble.com/shots/27246973-Task-Management-App)                                                       | Mobile                               | Md Uzzal Hossain · 3 mobile screen · weekly date strip + 任務狀態 chip · 跟本專案直接相關度低                                                                        | [`refs/12-dribbble-task-management-app/page-text.md`](./refs/12-dribbble-task-management-app/page-text.md)                   |
| 13  | [**Dribbble — Fintech Investment Portfolio**](https://dribbble.com/shots/26687118-Fintech-Investment-Portfolio-Mobile-App)                  | Mobile                               | **Ronas IT · 14 個 ref 中跟本專案 domain 最近 · Total balance + 4 quick action + Favorites + NVDA stock detail w/ time-period segmented + candle chart · Dark mode** | [`refs/13-dribbble-fintech-investment-portfolio/page-text.md`](./refs/13-dribbble-fintech-investment-portfolio/page-text.md) |
| 14  | [Dribbble — Viora Health Tracking](https://dribbble.com/shots/27318864-Branding-for-Viora-Health-Tracking-Platform)                         | Branding+Dashboard                   | **Afterglow · Brand-first 案例 · 「balance data density with simplicity」金句 · sage green + Gilroy 字 · 健康指標 dashboard 角落露臉**                               | [`refs/14-dribbble-viora-health-tracking/page-text.md`](./refs/14-dribbble-viora-health-tracking/page-text.md)               |
| 15  | [**Muz.li — Dashboard Inspirations 2024**](https://muz.li/blog/dashboard-design-inspirations-in-2024/)                                      | 編輯整理 39 entry                    | **靈感 curate · 39 個 dashboard · RonDesignLab 11/39 · Outcrowd / OWWStudio / Geex Arts 是新發現的 studio 候補**                                                     | [`refs/15-muzli-dashboard-2024/summary.md`](./refs/15-muzli-dashboard-2024/summary.md) ⭐️ 含分類分析                         |
| 16  | [**Behance — Startify · SaaS Analytics Platform**](https://www.behance.net/gallery/237850033/Startify-SaaS-Analytics-Platform-UX-UI-Design) | Desktop SaaS（22 張完整 case study） | **Yurii Volot · 6-KPI 一字排（綠/黃/灰 分群）· 黑底 panel = realtime · 右上 metadata pill · 含 user persona / 客戶見證 / wireframe 全套**                            | [`refs/16-behance-startify-saas/page-text.md`](./refs/16-behance-startify-saas/page-text.md) ⭐️                              |
| 17  | [Muz.li — Dashboard Inspirations 2026](https://muz.li/blog/dashboard-design-inspirations-2026/)                                             | 編輯整理（後續輪 binary 收）         | **2026 年版 muz.li listicle · binary 圖集 23MB · 用作 2026 趨勢補充對照（vs ref 15 = 2024 版）**                                                                     | [`refs/17-muzli-dashboard-2026/`](./refs/17-muzli-dashboard-2026/)（image set · 待寫描述檔）                                 |
| 18  | [Dribbble — RonDesignLab portfolio](https://dribbble.com/RonDesignLab)                                                                      | Studio profile                       | **RonDesignLab studio 全 portfolio · profile-shots.md 寫候補 shots · top-urls.txt 列高 traction 作品** — 補強 ref 07-10 同 designer 連線                             | [`refs/18-dribbble-rondesignlab-portfolio/profile-shots.md`](./refs/18-dribbble-rondesignlab-portfolio/profile-shots.md)     |
| 19  | [Dribbble — Outcrowd portfolio](https://dribbble.com/outcrowd)                                                                              | Studio profile                       | **Outcrowd studio profile · 多 financial / dashboard 案例 · ref 15 muz.li listicle 提到的候補 studio**                                                               | [`refs/19-dribbble-outcrowd-portfolio/profile-shots.md`](./refs/19-dribbble-outcrowd-portfolio/profile-shots.md)             |
| 20  | [Dribbble — Geex Arts portfolio](https://dribbble.com/geexarts)                                                                             | Studio profile                       | **Geex Arts studio profile · 同樣是 muz.li 提到的高密度 dashboard 候補 studio**                                                                                      | [`refs/20-dribbble-geexarts-portfolio/profile-shots.md`](./refs/20-dribbble-geexarts-portfolio/profile-shots.md)             |
| 21  | [Dribbble — OWW Studio portfolio](https://dribbble.com/oww)                                                                                 | Studio profile                       | **OWW Studio · ref 15 muz.li 列為 11/39 中提到的 minimalist dashboard studio**                                                                                       | [`refs/21-dribbble-owwstudio-portfolio/profile-shots.md`](./refs/21-dribbble-owwstudio-portfolio/profile-shots.md)           |
| 22  | [Awwwards — Site of the Day](https://www.awwwards.com/sites-of-the-day/)                                                                    | Web SOTD 圖集                        | **Awwwards 每日精選 · binary image set 4.2MB · 跨業 layout 變化補充 — 不限 dashboard，當 layout/typography 廣度補強**                                                | [`refs/22-awwwards-sotd/`](./refs/22-awwwards-sotd/)（image set · 待寫描述檔）                                               |
| 23  | [Codrops — Experiments](https://tympanus.net/codrops/category/playground/)                                                                  | Web experiments 圖集                 | **Codrops 互動實驗 · binary 1.5MB · 用作 micro-interaction / motion 設計補充**                                                                                       | [`refs/23-codrops-experiments/`](./refs/23-codrops-experiments/)（image set · 待寫描述檔）                                   |
| 24  | [Land-book — Web design gallery](https://land-book.com/)                                                                                    | Web design gallery 圖集              | **Land-book curated · binary 2.4MB · 用作 landing page / marketing layout 廣度補強**                                                                                 | [`refs/24-land-book/`](./refs/24-land-book/)（image set · 待寫描述檔）                                                       |
| 25  | [Refero — Web design search](https://refero.design/)                                                                                        | Searchable design ref                | **Refero search engine · binary 1.3MB · 跨 dashboard / fintech 取樣**                                                                                                | [`refs/25-refero/`](./refs/25-refero/)（image set · 待寫描述檔）                                                             |

> 📥 用戶後續會持續丟 refs，每筆**必填**：來源、日期、觀察重點、描述檔路徑。
> Binary 放 `refs/<NN>-<slug>/` 子資料夾，描述檔名同子資料夾名 + `.md`（或 summary.md / page-text.md）。
>
> **抓取工具**：詳見 [`TOOLS.md`](./TOOLS.md) — 含 5 支 scrapers（Dribbble fetch + parse / Muz.li / Behance / chat image extractor）使用範例與重用指引。
>
> **同 designer 線索**：Ref 01（IG @ron_design）+ Refs 07-10（Dribbble RonDesignLab）+ muz.li 11 個 entry → **同一個工作室 RonDesignLab** 的作品。Codex 後續可直接逛 https://dribbble.com/RonDesignLab 抓更多範例。

---

## 切換面板的邏輯 · Cross-Ref Summary（**本研究核心**）

> 用戶 2026-04-27 直接定義本研究主軸：
> 「題外話這是要你觀察他們的切換面板的邏輯。」
>
> 這對應「網頁太長 / 資訊太密 / 難聚焦」三大痛點。**視覺只是表象，真正解的是「user 怎麼在多資訊環境中決定看什麼」**。

下表是 6 份 ref 在「切換 / 聚焦 / 漸進揭示」維度上的 pattern map：

| Pattern                                               | Ron 01 | Vorxs 02 | Paydex 03 | Finno 04 | Quicked 05 | Klar 06 | 本專案契合度     |
| ----------------------------------------------------- | ------ | -------- | --------- | -------- | ---------- | ------- | ---------------- |
| **A. 整頁單焦點**（單 hero metric）                   | ✅★    | —        | —         | —        | —          | —       | ★★（太極端）     |
| **B. 持久左 sidebar nav**（不藏不抽屜）               | —      | —        | —         | ✅       | ✅★        | —       | ★★★★★ 桌機       |
| **C. 巨型 page title 當 hero**                        | —      | —        | ✅        | ✅       | ✅★        | —       | ★★★★             |
| **D. 全站僅 1 個 accent CTA**                         | ✅     | ✅(2)    | ✅        | ✅(2)    | ✅★        | —       | ★★★★             |
| **E. Card-stacked spotlight**（多卡 + 各自 hero）     | —      | ✅★      | ✅        | ✅       | —          | ✅      | ★★★★             |
| **F. Time-period segmented control** `1H/1D/1W/...`   | ✅     | —        | —         | —        | —          | ✅★     | ★★★★★            |
| **G. Split-tile（多 entity 同階對照）**               | —      | —        | —         | —        | ✅         | ✅★     | ★★★★★            |
| **H. Split-tile + focus state（整塊變色 selection）** | —      | —        | —         | —        | —          | ✅★     | ★★★★             |
| **I. Section-header date / 大標籤 當分區**            | —      | —        | ✅★       | ✅       | ✅         | —       | ★★★              |
| **J. Numbered sub-tab `01.` / `02.`**                 | —      | —        | —         | ✅★      | —          | —       | ★★★              |
| **K. Stepper form 側邊 index**（greyed-out 未來步）   | —      | —        | —         | —        | ✅★        | —       | ★★★★             |
| **L. Accordion 漸進揭示細節**                         | —      | —        | —         | —        | —          | ✅★     | ★★★★★            |
| **M. Horizontal stacked ratings bar**                 | —      | —        | —         | —        | —          | ✅★     | ★★★★             |
| **N. Target-range slider**（Low / Target / High）     | —      | —        | —         | —        | —          | ✅★     | ★★★★★            |
| **O. 嵌入式 ticker chip in 卡片**                     | —      | —        | —         | —        | —          | ✅★     | ★★★★★            |
| **P. Sunburst / 紋理 重量感視覺**                     | —      | ✅★      | —         | ✅       | —          | —       | ★★★              |
| **Q. Vertical color-bar 雙編碼 list**                 | —      | ✅★      | —         | —        | —          | —       | ★★★★             |
| **R. 純符號當 hero**（`+` `-` `≠` `↗` `↘`）           | —      | —        | ✅        | —        | ✅★        | ✅      | ★★★★             |
| **S. Calculator-mode 大數字輸入**                     | —      | —        | ✅★       | —        | —          | —       | ★★               |
| **T. 4-action quick grid**（同階大 icon）             | —      | —        | ✅        | —        | —          | ✅★     | ★★★              |
| **U. Bottom 4-tab mobile nav**（≤5 顆）               | ✅     | —        | —         | —        | —          | ✅      | ❌（9-tab 鎖死） |
| **V. Watch Video / Help 浮動 helper**                 | —      | —        | —         | —        | ✅★        | —       | ★★★★             |

★ = 該 ref 把這 pattern 做到最完整 / 最值得抄。
✅(2) = 用了該 pattern 但走兩個 accent，非單 1。

### 兩主軸 ref（下一輪 Round 1 baseline）

| Ref           | 解什麼                   | 為什麼 baseline                                                                 |
| ------------- | ------------------------ | ------------------------------------------------------------------------------- |
| **Quicked 7** | 「網頁太長」的**結構**面 | Tablet/desktop-first · 高資料密度 · 持久 sidebar · 巨型 page title · 1 cyan CTA |
| **Klar**      | 「資訊太密」的**互動**面 | Trading 同 domain · 6 種切換 pattern 集大成 · 漸進揭示 · 對比視覺化             |

其他 4 份（Ron / Vorxs / Paydex / Finno）為 secondary 印證 — 提供單一焦點極端、card-stacked spotlight、dark mode、sub-tab、avatar cluster 等補強 pattern。

### 對應到本專案 6 個 route page 的初步映射（待 Codex Round 1 反駁）

| Route page | 主切換需求                     | 推薦 pattern 組合（從上表挑）                                                                  |
| ---------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Overview   | 多 KPI 同階聚焦                | E（card-stacked）+ R（純符號 hero）+ T（4-action quick grid · mobile）                         |
| 持倉       | 切「個股 / ETF / 現金」 + 排序 | G+H（split-tile + focus）+ Q（vertical color-bar list）+ L（accordion 個股 detail）            |
| 交易日誌   | 時間維度 + 過濾 + 分組         | I（section-header date）+ K（filter stepper）+ R（純符號 hero）                                |
| 收盤分析   | 時段切換 + 個股鑽研            | F（time-period segmented）+ M（stacked ratings bar）+ N（target-range slider）+ L（accordion） |
| 全組合研究 | 多組合對照 + drill-in          | G（split-tile 等寬並排）+ T（category tile grid · mobile）+ E（card-stacked）                  |
| 情報脈絡   | 新聞 + 持倉股關聯 + 時序       | I（section-header date）+ O（嵌入式 ticker chip）+ E（card-stacked）                           |

**全 6 個 route page 共用骨幹**：B（桌機 sidebar nav）+ C（巨型 page title hero）+ D（1 cyan CTA 紀律）+ V（Watch/Help 浮動 helper）— 這 4 個 pattern 不分頁全站套用，先確立「每頁該長怎樣」骨架，內部 widget 才照表挑 pattern。

---

## Rounds · Multi-LLM 討論

採用 **Shared Doc Append 模式**（per `claude.md`）：

- Round notes 累積在 [`rounds/discussion.md`](./rounds/discussion.md)（單一檔，依時間 append）
- Round header：`## Round N · Agent · YYYY-MM-DD HH:MM`
- 不刪別人段落，只 append

| Round | Agent  | 主題                        | 狀態      |
| ----- | ------ | --------------------------- | --------- |
| 0     | Claude | 開案 / refs 蒐集 / 範圍框定 | 🟡 進行中 |

---

## Briefs · 派工

Codex/Qwen/Gemini 派工 brief 放 `briefs/`，命名 `YYYY-MM-DD-<agent>-<topic>.md`。
**brief 必含**（per memory `feedback_dispatch_must_link_source_docs`）：

- 直接連回 source doc 路徑 + § anchor
- 不 paraphrase，要 Codex 自己讀
- 至少 1 個反駁 Claude 的 prompt

---

## Final Output

收斂完最後產出：

- `docs/specs/2026-04-28-dashboard-redesign-spec.md` — canonical spec
- `docs/decisions/2026-04-28-dashboard-redesign.md` — 拍板決議（草案）
- 同步更新 `docs/decisions/index.md`

---

## 變更紀錄

| 日期       | 變更                                                                                                                                                                                                                                                                                                                                                                                                                                                       | by             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 2026-04-27 | 開案 · 建立資料夾骨架 · 收 ref 01                                                                                                                                                                                                                                                                                                                                                                                                                          | Claude         |
| 2026-04-27 | 收 ref 02-06（Vorxs / Paydex / Finno / Quicked 7 / Klar） · 全部 binary + 描述檔                                                                                                                                                                                                                                                                                                                                                                           | Claude         |
| 2026-04-28 | 新增「切換面板的邏輯」cross-ref summary（A-V 22 patterns）+ 6 route page 映射                                                                                                                                                                                                                                                                                                                                                                              | Claude         |
| 2026-04-28 | 收 ref 07-10（Dribbble · 同 designer RonDesignLab）— binary + 7 段案例文已落檔；描述檔待用戶蒐集完成後寫                                                                                                                                                                                                                                                                                                                                                   | Claude         |
| 2026-04-28 | 收 ref 11-14（Dribbble · Finance Mobile / Task / Fintech Investment Portfolio / Viora Health）+ 11-14 page-text 落檔；新工具 og:url 抓取補回 07-10                                                                                                                                                                                                                                                                                                         | Claude         |
| 2026-04-28 | 收 ref 15（Muz.li 39 entry · 含分類分析 summary.md）+ ref 16（Behance Startify · 22 張完整 SaaS analytics case study）；新增 `fetch-muzli-listicle.mjs` + `fetch-behance-gallery.mjs` 兩個跨平台抓取工具                                                                                                                                                                                                                                                   | Claude         |
| 2026-04-28 | **Auto Mode 啟動 · 20 輪 multi-LLM 研究**：MISSION.md + SOURCES.md 開檔；Round 1-9 收 Refs 17-25（muz.li 2026 + 4 studio profile + Awwwards/Codrops/Land-book/Refero）；Round 10 pattern matrix v1（29 個 pattern A-FF）；Round 11 Codex 反駁（grep 既有元件 + 4 個漏掉 pattern + 2 個配方錯誤 + strategic warning）；Round 12-17 deep-cut 5 條 mission 原則 + 桌機/mobile spec；Round 18 整合 Codex 修正；Round 19 spec + decision 草案；Round 20 cleanup | Claude + Codex |
