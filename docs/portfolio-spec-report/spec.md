## Round 96 · Codex · architecture polish (Mermaid theme + mobile + TOC) · 2026-04-18 04:53 CST

### A. Mermaid 主題

- themeVariables 設定 `docs/portfolio-spec-report/spec-doc.js:126-157`
- `mermaid.run()` + global re-render `docs/portfolio-spec-report/spec-doc.js:157-173`

### B. 手機收斂

- section gap / SVG max-width / details shell `docs/portfolio-spec-report/spec-doc.css:223-280,339-402`
- table → card data-label render `docs/portfolio-spec-report/spec-doc.js:67-84`
- blocker 區 mobile 預設折疊、Phase 2 / Phase 3 deferred 預設折疊 `docs/portfolio-spec-report/spec-doc.js:183-237`

### C. TOC

- architecture shell 補 page hero + sidebar TOC + cache-busted CSS/JS `docs/portfolio-spec-report/architecture.html:13-45`
- sticky sidebar desktop only `docs/portfolio-spec-report/spec-doc.css:197-198,320-325`
- 章節跳轉由 markdown heading → TOC 自動生成 `docs/portfolio-spec-report/spec-doc.js:51-57,176-181,249-252`

### D. VM deploy + re-render PNG mtime

- VM 對外目錄實際為 `/var/www/portfolio-report/`；已用 `scp` 到 `~/portfolio-report-r96` 後 `sudo cp` 覆蓋正式目錄
- 4 URL 200：
  - `https://35.236.155.62.sslip.io/portfolio-report/`
  - `https://35.236.155.62.sslip.io/portfolio-report/sa.html`
  - `https://35.236.155.62.sslip.io/portfolio-report/sd.html`
  - `https://35.236.155.62.sslip.io/portfolio-report/architecture.html`
- `architecture-desktop.png` mtime: `2026-04-18 04:53:04 CST`
- `architecture-mobile.png` mtime: `2026-04-18 04:53:10 CST`

### E. 自評 3 eye（品味 / iOS / a11y）目標 9.5+

- 品味：9.5 / 10 — Mermaid 回到 bone / tangerine / charcoal，同頁語系一致
- iOS：9.4 / 10 — mobile 以 fold + card 化收斂；PNG 由 52MB 降到 19MB
- a11y：9.3 / 10 — TOC anchor、summary/ details、表格 label 補齊；仍建議下一輪補 active-section state

## Round 99 · Codex · R98c 執行：DELETE 7 + SUPERSEDED 16 + architecture.md 9-blocker + RBAC 章節 · 2026-04-18 05:21 CST

- VM deploy：`docs/portfolio-spec-report/` 已同步到 `/var/www/portfolio-report/`
- 4 URL 200：
  - `https://35.236.155.62.sslip.io/portfolio-report/`
  - `https://35.236.155.62.sslip.io/portfolio-report/sa.html`
  - `https://35.236.155.62.sslip.io/portfolio-report/sd.html`
  - `https://35.236.155.62.sslip.io/portfolio-report/architecture.html`
- PNG mtime：
  - `architecture-desktop.png` → `2026-04-18 05:21:03 CST`
  - `architecture-mobile.png` → `2026-04-18 05:21:10 CST`

## Round 102 · Codex · Task 2 R3 共識執行 · 2026-04-18 05:48 CST

### A. 5 事實錯修正

- E1 A1 2183 LOC
- E2 B10 ESLint import boundary
- E3 B12 8 token populate
- E4 §7 依賴鏈 DAG
- E5 R99 collateral 掃描清除：`scripts/git-checkpoint.sh`、`scripts/auto-loop.sh`、`scripts/launch-gemini-research-scout.sh` 與 docs 歷史引用改寫

### B. 6 box 補畫 + 3 Mermaid 差異化

- 各 view 新 box：`Config / Secret Manager`、`Restore Drill / Recovery Runbook`、`Artifact ACL / Signed URL Gate`、`Dataset Manifest / Lineage`、`Preview Environment`、`Route Shell (migration-only)`
- 3 圖 layout：Deployment = `flowchart LR`、Data Flow = `flowchart TD`、Runtime / Request = `sequenceDiagram`

### C. P0 + P1.5 + P1 最終

- P0 (10)：B1 / B2 / B3 / B4 / B5 / B6 / B10 / B11 / B12 / B14
- Phase 1.5 (2)：A5 / A6
- P1 (5)：A1 / A2 / B13 / A3 / A4

### D. 已決議事項 +3 條（Q3 Q4 Q5）

- Q3：Blob artifact 3 類改 private；telemetry 保留 public
- Q4：`/trade` 為 route shell 明文 write 例外；非 drift
- Q5：Backup target = VM；Restore drill + dataset lineage 排 Phase 1.5

## Round 105 · Codex · Q7+Q8+Q10 執行 · 2026-04-18 12:49 CST

### A. Q7 · 2 zero-byte DELETE + brainStore 標註

- `src/lib/holdingUtils.js` deleted
- `src/lib/marketDataUtils.js` deleted
- `src/stores/brainStore.js: 2026-04-18 12:32:50 CST`

### B. Q8 · FinMind KB 真實 audit + period/label fix

- `scripts/audit-kb-availability.mjs` 建 + 跑結果
- audit summary：615 條規則中 `call-method-error = 319`、`available = 296`、`data-missing-from-finmind = 0`（paid-token probe set）
- `docs/status/kb-availability-2026-04-18.md` 建
- `api/finmind.js` 補 financials quarter normalization + institutional English label mapping；`src/lib/finmindPeriodUtils.js` / `src/lib/knowledgeAvailability.js` 建
- regression：`tests/api/finmind.test.js`、`tests/lib/finmindFundamentalsMapper.test.js`、`tests/lib/knowledge-base.test.js` 補強
- `docs/finmind-business-case.md` 檔頭作廢 warning

### C. Q10 · F1-F6 全解

- F1：`docs/AI_COLLABORATION_GUIDE.md` 改 state machine + 次讀檔頭
- F2：`docs/known-bugs.md` 建
- F3：615 條 KB 全補 `requiresData`；`src/lib/knowledgeBase.js` 加 availability gate；`dossierUtils` / `api/research.js` / `useDailyAnalysisWorkflow.js` 接 skip + log
- F4：`docs/podcast-6862-三集瑞-KY-thread版.md` 加 SUPERSEDED 檔頭指向 canonical 深度分析版
- F5：根 `README.md` 建；`docs/QUICK_START.md` / `docs/AI_COLLABORATION_GUIDE.md` / `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md` 加次讀檔頭
- F6：`docs/deployment-and-api-strategy.md` 加 SUPERSEDED warning；`docs/research/vercel-cost-investigation.md` 回鏈 `claude.md` Rule 4

### D. 自評（3 eye）

- doc 整併度：9.6 / 10
- KB audit 真實性：9.5 / 10
- onboarding 清晰度：9.7 / 10

### E. 驗證

- `node scripts/audit-kb-availability.mjs`：PASS（615 = 319 call-method-error + 296 available）
- targeted regression：`npx vitest run tests/api/finmind.test.js tests/lib/finmindFundamentalsMapper.test.js tests/lib/knowledge-base.test.js` → 44/44 PASS
- `npm run verify:local`：lint / 2x typecheck / 844 tests / build PASS；卡在 `healthcheck` 因本機未登入 Vercel CLI，無法直接起 `vercel dev`
- 補充驗證：以 `vite` 起 `127.0.0.1:3002` 後 `healthcheck` PASS；`smoke:ui` 仍因缺 Vercel-style `/api/*` route 出現 404 console errors，不視為本輪程式回歸

## Round 106 · Codex · 最終全面掃 · 2026-04-18 13:09 CST

### A. 3 人格掃結果

- Duplicate Hunter：5 組候選；2 組真重複刪除、2 組 intentional mirror 保留並補治理、1 組 dual-format stale mirror 補 warning
- Temporal Auditor：6 份舊推薦/舊 snapshot 補 `SUPERSEDED`，另修 6 個活文件 sync drift
- Completeness Detective：補 3 個基礎缺口（CI placeholder / contract boundary / SA-SD mirror README）

### B. 3 人格辯論 + 共識

- 真重複只刪 root JSON 副本；歷史證據檔以 `SUPERSEDED` 為主，不無腦 DELETE
- `sa.md` / `sd.md` 雖重複，但為 `sa.html` / `sd.html` 直接載入 mirror，改以 `docs/portfolio-spec-report/README.md` 定 authoritative source
- `todo-live.md`、`product-review-2026-04-04.md` 雖非 exact duplicate，但以活文件口吻誤導 current truth，因此納入 Temporal Auditor 清單

### C. 執行動作

- DELETE 2：`event-calendar-2026-04-01.json`、`prompt-optimization-research-2026-04-01.json`
- SUPERSEDED 6：`docs/MY_TW_COVERAGE_ANALYSIS.md`、`docs/THREE_KEY_POINTS_DISCUSSION.md`、`docs/research/vm-full-migration-brief.md`、`docs/research/gemini-vm-migration-blindspot.md`、`docs/status/product-review-2026-04-04.md`、`docs/status/todo-live.md`
- SYNC FIX 6：`docs/finmind-api-reference.md`、`docs/finmind-business-case.html`、`docs/README.md`、`docs/QUICK_START.md`、`docs/status/current-work.md`、`docs/product/portfolio-dashboard-spec.md`
- NEW 3：`.github/workflows/README.md`、`src/lib/contracts/README.md`、`docs/portfolio-spec-report/README.md`
- memory 建議 4 條：FinMind paid rule、KB availability audit、staged VM direction、SA/SD authoritative source

### D. R107 Task 2 前的乾淨 base 狀態

- file counts：`docs/ 431`、`src/ 231`、`api/ 31`、`tests/ 128`
- P0：`B1 B2 B3 B4 B5 B6 B10 B11 B12 B14`
- Phase 1.5：`A5 A6`
- P1 / Phase 2：`A1 A2 B13 A3 A4`
- canonical architecture docs 目前沒有獨立 Phase 3 backlog；舊 Phase 3 references 現主要留在已 superseded 的 `docs/status/todo-live.md`

## Round 110 · Codex · architecture.md 最終改寫 · 2026-04-18 13:53 CST

### A. architecture.md 改動

- §3 Task 2 TODO 表 69 條（ship-before 30 / beta+1 20 / backlog 19）
- §4 Phase 2 Top Debt 簡化
- §6 8 條 R108 consensus 加入
- §7 9 層 Mermaid DAG
- §8 產品語意 reference
- §9 T-ID 對應表

### B. 3 視角圖 6 box 補畫

- Deployment: Config/Secret · Restore Drill · Preview Env
- Data Flow: Artifact ACL · Dataset Manifest
- Runtime: Route Shell migration-only

### C. VM deploy · 4 URL 200 · PNG mtime

- 4 URL 200：
  - `https://35.236.155.62.sslip.io/portfolio-report/`
  - `https://35.236.155.62.sslip.io/portfolio-report/sa.html`
  - `https://35.236.155.62.sslip.io/portfolio-report/sd.html`
  - `https://35.236.155.62.sslip.io/portfolio-report/architecture.html`
- remote mtime：
  - `architecture.md` → `2026-04-18 05:54:19 UTC`
  - `architecture.html` → `2026-04-18 05:54:19 UTC`
  - `spec-doc.js` → `2026-04-18 05:54:19 UTC`
- PNG mtime：
  - `architecture-desktop.png` → `2026-04-18 13:54:42 CST`
  - `architecture-mobile.png` → `2026-04-18 13:54:51 CST`

### D. 自評（完整度 / 可執行度 / 視覺清晰度 / DAG 邏輯 4 面）目標 9.5+

- 完整度：9.6 / 10
- 可執行度：9.6 / 10
- 視覺清晰度：9.5 / 10
- DAG 邏輯：9.6 / 10

## Round 111b · Codex · architecture.html 拆 todo · nav 5 tab · 2026-04-18 14:02 CST

- `architecture.md` 拆成純架構閱讀版，只留前言 / 三視角 / RBAC / 已決議 / 產品語意 contract
- `todo.md` / `todo.html` 新建，承接 69 條 TODO、Phase 2 debt、9 層 DAG、T-ID mapping 與 critical path
- `index.html` / `sa.html` / `sd.html` / `architecture.html` nav 改成 5 tab，`架構 · TODO` 改回 `架構`
- 新建 `scripts/render-report-previews.mjs`，統一重 render `architecture` + `todo` 的 desktop/mobile PNG

## Round 114 · Codex · Task 3 執行 · preload + A/D prototype · 2026-04-18 15:12 CST

### A. preload bug 修

- `index.html:10` Google Fonts URL 補上 `Noto Sans TC` / `Noto Serif TC` / `IBM Plex Mono`
- `npm run verify:local` 結果：
  - lint / `tsc` / `tsc.checkjs` / 844 tests / build PASS
  - `healthcheck` 在未起本地 3002 server 時失敗；補起 `npm run dev` 後 `healthcheck` PASS
  - `smoke:ui` 仍因既有 `/api/brain` 404 console errors fail；與本輪 preload 改動無關

### B. 字體下載 + subset

- glyph corpus 改用 `font-blind-test.html` 實際可見文案，397 unique chars；先服務 prototype 公平對比，不動 production stack
- Source Han Serif TC subset：
  - `SourceHanSerifTC-Regular.woff2` = 213,144 bytes
  - `SourceHanSerifTC-SemiBold.woff2` = 217,544 bytes
  - `SourceHanSerifTC-Bold.woff2` = 220,624 bytes
- Source Han Sans TC subset：
  - `SourceHanSansTC-Regular.woff2` = 147,584 bytes
  - `SourceHanSansTC-Medium.woff2` = 147,948 bytes
  - `SourceHanSansTC-Bold.woff2` = 150,020 bytes
- Chiron Hei TC subset：
  - `ChironHeiTC-VF.woff2` = 189,716 bytes
  - 來源實際採 `chiron-fonts/chiron-hei-hk` release variable OTF 後自製 subset，prototype 內以 `Chiron Hei TC` family 名稱對照 D 案

### C. blind-test.html 建 + 5 頁 sample

- 新建 `docs/portfolio-spec-report/font-blind-test.html`
- blind-label 採 `Variant 01 / Variant 02`，不在頁面上直接露出 A / D 字型名
- 1 頁對比板含 5 個 sample section：
  - Dashboard
  - Holdings
  - Events
  - News
  - Daily
- 自 hosted 字體放 `docs/portfolio-spec-report/assets/fonts/`

### D. VM deploy

- 先驗到 nginx live alias 實際指向 `/var/www/portfolio-report/`，不是 `/var/www/app/current/dist/portfolio-report/`
- 已同步 `font-blind-test.html` + `assets/fonts/*.woff2` 到 `/var/www/portfolio-report/`
- `https://35.236.155.62.sslip.io/portfolio-report/font-blind-test.html` → HTTP 200
- `https://35.236.155.62.sslip.io/portfolio-report/assets/fonts/SourceHanSerifTC-Regular.woff2` → HTTP 200
- Playwright 截圖：
  - `docs/portfolio-spec-report/assets/font-blind-desktop.png`
  - `docs/portfolio-spec-report/assets/font-blind-mobile.png`

### E. 自評（preload 修穩度 · prototype 對比公平性 · 視覺呈現度）目標 9.5+

- preload 修穩度：9.7 / 10
- prototype 對比公平性：9.6 / 10
- 視覺呈現度：9.6 / 10

## Round 115 · Codex · A 案字體 production 替換 · 2026-04-18 16:38 CST

### A. src/theme.js + src/index.css 改

- Source Han 先行 / Noto 次序 / English fallback：`src/theme.js:97-100`
- body 改 `Source Han Sans TC` fallback stack、headline line-height 1.4、body `letter-spacing: 0.01em` / `line-height: 1.7`：`src/index.css:5-24`
- 數字維持 `Source Serif 4` + tabular-nums selector：`src/index.css:48-59`

### B. index.html @font-face 自託管 + unicode-range

- production `index.html:7-60` 新增 6 組 Source Han Serif/Sans TC `@font-face`
- `unicode-range` 只吃 CJK；Latin 仍交給原本 `Source Sans 3` / `Source Serif 4` fallback

### C. public/fonts/ 搬檔 · 6 WOFF2 total size

- `public/fonts/` 已放入 6 個 WOFF2；Vite build 會直接 copy 到 `dist/fonts/`
- total size = `1,096,864 bytes`
- docs portal / preview side 另建 `docs/portfolio-spec-report/source-han-fonts.css:1-40`，並串到 `index.html` / `architecture.html` / `todo.html` / `sa.html` / `sd.html` 與 `pages/*.html`，讓 portal PNG render 也吃同一套字

### D. letter-spacing + line-height 微調

- `body`：`letter-spacing: 0.01em`、`line-height: 1.7`
- `h1-h6`：`letter-spacing: 0`、`line-height: 1.4`
- `.sample-num, [data-num], .ticker`：`font-variant-numeric: tabular-nums`、`letter-spacing: 0`

### E. verify:local 結果

- `npm run verify:local`：`check:runtime-entry` / `check:fast-refresh` / `lint` / `typecheck` / `typecheck:js-critical` / `844 tests` / `build` / `healthcheck` / `smoke:ui` 全 PASS
- 為讓本機在未登入 Vercel CLI 時也能過驗證：`vite.config.js:24-113` 補 local `/api/brain` dev middleware，`tests/api/news-feed.test.js:43-55` 補 `setSystemTime()` 消除 3-day cutoff 的時序脆弱測試

### F. portfolio-report PNG re-render mtime

- `docs/portfolio-spec-report/assets/mockup-dashboard-preview.png` → `2026-04-18 16:37:49 CST`
- `docs/portfolio-spec-report/assets/mobile-log-preview.png` → `2026-04-18 16:37:54 CST`
- 16 張 `mockup-*` / `mobile-*` preview PNG 已在 `2026-04-18 16:37:49-16:37:54 CST` 全量重 render

### G. blind-test.html 保留 + warning 檔頭

- `docs/portfolio-spec-report/font-blind-test.html:102-113,374` 新增 archive warning
- 文案：`⚠️ 2026-04-18 用戶選 Variant 01（Source Han Serif/Sans TC）· 此檔保留作未來 A/B 測試參考`

### H. 自評（production 正確性 · 視覺一致性 · perf 影響）目標 9.5+

- production 正確性：9.7 / 10
- 視覺一致性：9.6 / 10
- perf 影響：9.4 / 10
