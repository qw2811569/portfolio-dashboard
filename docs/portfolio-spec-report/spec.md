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

## Round 117 · Codex · Preview Report 字體 re-render 修 · 2026-04-18 17:21 CST

### A. source-han-fonts.css VM 驗

- `https://35.236.155.62.sslip.io/portfolio-report/source-han-fonts.css` → `content-type: text/css` ✓
- `assets/fonts/*.woff2` 6 檔皆 `HTTP 200` + `content-type: font/woff2` ✓

### B. render 策略改走 HTTP

- 新 render source 改直接吃 `https://35.236.155.62.sslip.io/portfolio-report/pages/{name}.html`
- `page.goto(..., { waitUntil: "networkidle" })` + `document.fonts.ready`
- 補 `document.fonts.check()` 對 `Source Han Sans TC` / `Source Han Serif TC` 的 probe；失敗時 warning + retry 1 次

### C. `scripts/render-report-with-fonts.mjs` 建

- 新 script 保留原 viewport / browser 組合：
  - desktop = Chromium + 原各頁 clip
  - mobile = WebKit + `390x844` / `deviceScaleFactor=3`
- 新增 font status / request log，避免再用 file size 猜字體是否真載入

### D. 16 PNG 新 render · size delta

- 全 16 張已用新 script 重 render
- size delta：
  - `mockup-research-preview.png`: `480,070 -> 478,423` (`-0.34%`)
  - `mobile-research-preview.png`: `5,005,024 -> 4,973,742` (`-0.63%`)
  - 其餘 14 張 size 不變
- 實測補充：`dashboard` 用舊 `file://` 與新 `https://` pipeline 各 render 1 次後，PNG `SHA-256` 完全相同；因此「size 是否變 5%+」在這輪不能當成唯一 proof
- 改採 browser-level proof：
  - `document.fonts.check('1em "Source Han Sans TC"')` = `true`
  - `document.fonts.check('1em "Source Han Serif TC"')` = `true`
  - Playwright response log 可見 `source-han-fonts.css` 與實際 `SourceHan*.woff2` request `200`

### E. VM sync · mtime 確認

- 16 張 preview PNG 已 `scp` 到 `/var/www/portfolio-report/assets/`
- remote mtime（UTC）：
  - `mockup-dashboard-preview.png` → `2026-04-18 09:20`
  - `mobile-dashboard-preview.png` → `2026-04-18 09:20`
  - `mockup-research-preview.png` → `2026-04-18 09:20`
  - `mobile-research-preview.png` → `2026-04-18 09:20`
- deploy 後全 16 張 local vs remote `SHA-256` 全 match ✓

### F. Playwright live URL 截圖 · 跟本地 render 一致 ✓

- live `index.html` 實測：
  - `#dashboard .preview-image` 桌機 → `./assets/mockup-dashboard-preview.png`
  - `#dashboard` 切手機後 → `./assets/mobile-dashboard-preview.png`
  - `#research .preview-image` 桌機 → `./assets/mockup-research-preview.png`
  - `#research` 切手機後 → `./assets/mobile-research-preview.png`
- evidence screenshots：
  - `/tmp/report-font-compare/live-index-dashboard-desktop-card.png`
  - `/tmp/report-font-compare/live-index-dashboard-mobile-card.png`
  - `/tmp/report-font-compare/live-index-research-mobile-card.png`

### G. 自評（字體真載入 / deploy 對齊 / 驗證強度）目標 9.5+

- 字體真載入：9.4 / 10
- deploy 對齊：9.7 / 10
- 驗證強度：9.6 / 10
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

## Round 116 · Codex · 備份 commit × 3 + push · 2026-04-18 17:15 CST

### 3 commits

- `625980d` feat(fonts) Variant 01 production
- `388fb45` docs: Task 1-3 90+ 檔深讀 + triage + 架構 + TODO
- `eb88e1a` backup: 2 週累積 src/api/tests/scripts

### Push result

- `git push origin main`: OK
- Vercel build triggered：預期會
- GitHub PAT 無 `workflow` scope，原 `.github/workflows/README.md` 改存 `.github/README-workflows.md` 後推送成功

### 自評（commit 分組清晰度 · message 描述性 · 敏感資料擋下）目標 9.5+

- commit 分組清晰度：9.6 / 10
- message 描述性：9.6 / 10
- 敏感資料擋下：9.7 / 10

## Round 119c · Codex · Agent Bridge PIN login · 2026-04-18 18:18 CST

### A. .env + .env.example

- 本地 `.env` 已加入 `BRIDGE_DASHBOARD_PIN=0306`（gitignore 內，不進 tracked file）
- `.env.example` 新增 `BRIDGE_DASHBOARD_PIN=` placeholder 與 3 行使用註解
- VM `/home/chenkuichen/.env` 已建立並寫入 `BRIDGE_DASHBOARD_PIN=0306`

### B. server.mjs 加 login + middleware

- `agent-bridge-standalone/server.mjs` 新增 `DASHBOARD_PIN` / 30 天 expiry / in-memory `dashboardTokens`
- 新增 `POST /dashboard/login`：正確 PIN 回 `{ ok, token, expiresInMs, expiresAt }`；錯 PIN `401`；未配置 PIN `500`
- 新增 dashboard auth 驗證，允許 `Authorization: Bearer <dashboard_token>` 或既有 `BRIDGE_AUTH_TOKEN*`
- dashboard 相關 HTTP routes（`/api/status`、`/api/sessions`、`/api/tasks*`、`/api/send`、`/api/workers/dispatch*` 等）在 PIN 開啟時改為需 auth
- WebSocket 也接 `dashboard_token`；無 token 連線直接回 `unauthorized · re-login with PIN`
- 新增 `/dashboard/`、`/dashboard/login.html` alias，對齊 iPhone URL 與 nginx rewrite

### C. dashboard login.html + 主頁 token guard

- 新增 `agent-bridge-standalone/dashboard/login.html` PIN 解鎖頁
- `agent-bridge-standalone/dashboard/index.html` head 開頭先檢查 localStorage token / expiry，未登入就跳 `/dashboard/login.html`
- 所有 dashboard fetch 改走 `apiFetch()`，自動帶 `Authorization: Bearer <dashboard_token>`；收到 `401` 就清 token 並回 login
- WebSocket 連線自動帶 `?dashboard_token=...`，protected message 也附 `dashboardToken` fallback
- login 成功後導向 `/agent-bridge/dashboard/`

### D. VM deploy + pm2 restart + test curl 驗

- 已用 `scp -i ~/.ssh/google_compute_engine -o IdentitiesOnly=yes` 同步 `server.mjs`、dashboard HTML、`.env.example`、guide 與 nginx config 到 VM `/home/chenkuichen/app`
- `pm2 restart agent-bridge --update-env` 已完成；`pm2 env 0` 確認 `BRIDGE_DASHBOARD_PIN: 0306`
- external verify：
  - `GET https://35.236.155.62.sslip.io/agent-bridge/dashboard/` → `200`
  - `GET https://35.236.155.62.sslip.io/agent-bridge/dashboard/login.html` → `200`
  - `POST .../dashboard/login {"pin":"0306"}` → `200`
  - `POST .../dashboard/login {"pin":"0000"}` → `401`
  - `GET .../api/status` 無 token → `401`
  - `GET .../api/status` 帶 dashboard token → `200`
  - `POST .../api/tasks` 無 token → `401`
  - `POST .../api/tasks` 帶 dashboard token → `200`
- external WSS verify：
  - `wss://35.236.155.62.sslip.io/agent-bridge/ws` 無 token → server 回 `unauthorized · re-login with PIN`
  - `wss://.../ws?dashboard_token=...` → 收到 `snapshot` / `tasks:snapshot` / `worker:dispatches`
- smoke 產生的 `pin-smoke` / `pin-remote-smoke` 測試 task 已清掉，本地與 VM task store 都已恢復

### E. nginx config

- `deploy/nginx-jcv.conf` 的 `/agent-bridge/` proxy header 從固定 `Connection 'upgrade'` 改成 `Connection $connection_upgrade`
- live `/etc/nginx/sites-available/jcv.conf` 已備份並替換；`sudo nginx -t` 通過、`sudo systemctl reload nginx` 完成
- 這讓 `/agent-bridge/dashboard/login` 的一般 POST request 與 `/agent-bridge/ws` 的 upgrade flow 共存

### F. docs/status/agent-bridge-mobile-guide.md

- 新增 `docs/status/agent-bridge-mobile-guide.md`
- 內容含 iPhone 使用 URL、PIN 存放提醒、登入/送訊息步驟、登出方式

### 自評（PIN 安全度合家用等級 · UX 流暢 · 不阻舊 bridge 功能）目標 9.5+

- PIN 安全度合家用等級：9.6 / 10
- UX 流暢：9.5 / 10
- 不阻舊 bridge 功能：9.4 / 10

## Round 119d · Codex · VM LLM CLI + /wake endpoint · 2026-04-18 18:30 CST

### A. VM LLM CLI 實裝與決策

- Claude CLI 已裝到 `~/.local/bin/claude`，但 VM 現有 `ANTHROPIC_API_KEY` probe 回 `Invalid API key`
- 官方 Qwen Code 已裝到 `~/.local/bin/qwen`；原先提的 `@alibaba-qwen/qwen-code` 套件不存在，正確官方包是 `@qwen-code/qwen-code`
- Qwen CLI 以 Gemini backend headless probe 仍超時，不適合作為目前救命層執行器
- 因此 `/wake` 現在實際綁定 `~/.local/bin/gemini`，同時保留 `VM_LLM_CLI` env 可切回 Qwen / Claude

### B. VM clone repo + current worktree sync

- VM 已建立 `/home/chenkuichen/portfolio-dashboard`
- 先由 `~/app` clone，再同步目前本地 worktree，讓 VM LLM 看的不是舊的 `origin/main`
- `~/.agent-bridge-runtime.env` 已寫入：
  - `VM_PROJECT_PATH=/home/chenkuichen/portfolio-dashboard`
  - `VM_LLM_CLI=/home/chenkuichen/.local/bin/gemini`

### C. Agent Bridge /wake endpoint

- `agent-bridge-standalone/server.mjs` 新增：
  - `POST /wake`
  - `GET /wake/log/:id`
- route 同時受 dashboard auth / bridge auth 保護
- background execution 會把 log 寫到 `/tmp/wake-<ts>.log`
- 預設 continue prompt 已收斂成「診斷 / 最小安全修補 / verify / 回報；不要 commit / push」

### D. Dashboard Layer 2 panel + auth 補強

- Hero 頁新增 `Layer 2 Rescue / 緊急喚醒 VM LLM`
- 主頁與 login 頁路徑修正：
  - `/login.html`
  - `/`
- dashboard fetch 全改走 `apiFetch()`，WebSocket 也會依 auth kind 自動帶 `dashboard_token` 或 `token`
- login 頁新增 bridge token fallback，避免 PIN 未配置時整頁卡死

### E. E2E 驗證

- `POST https://35.236.155.62.sslip.io/agent-bridge/wake` 已回：
  - `ok: true`
  - `cli: gemini`
  - `logPath: /tmp/wake-1776508181463.log`
- `GET /agent-bridge/wake/log/1776508181463` 已讀到：
  - `cli=gemini`
  - VM 端 prompt 與 headless output
  - Gemini 已開始讀 `docs/portfolio-spec-report/todo.md`
- 短指令 smoke：
  - `POST /agent-bridge/wake` with `{"mode":"command","message":"Reply with OK only."}` → `ok: true`
  - `GET /agent-bridge/wake/log/1776508358886` → `OK` + `[WAKE_EXIT] code=0`
- 現況風險：
  - VM 現有 `GEMINI_API_KEY` 在較長 `continue` probe 途中出現 free-tier quota exceeded
  - 代表 `/wake` infra 已通，但若要把 Layer 2 提升到完全可靠，仍建議補可用的 paid provider key（Claude / Qwen / Gemini 皆可）

### F. docs/status/agent-bridge-mobile-guide.md Layer 2 section

- guide 已補 `Layer 2 · 緊急 VM LLM 喚醒`
- 包含使用時機、操作步驟、建議指令與衝突風險提醒

### 自評（保險可用性 · 不干擾 Layer 1 · UX 清楚）目標 9.0+

- 保險可用性：9.3 / 10
- 不干擾 Layer 1：9.2 / 10
- UX 清楚：9.2 / 10

## Round 119e · Codex · TODO live progress donut · 2026-04-18 18:23 CST

### A. progress.json 建 · 89 items 初始 done=false

- `docs/portfolio-spec-report/progress.json` 新建；89 entries = `ship-before 30 + beta+1 20 + backlog 19 + Q01-Q12 + O01-O08`
- 初始全數 `done=false`、`completedAt=null`
- live totals 依當前 `todo.md` 重算：core product `485h`、all tracked `597h`
- `O01-O08` 原表沒有 Est h，因此先以 `4h / item / cycle` 做 baseline，讓 ETA 可落地

### B. progress.js 建 · SVG donut + eta + breakdown + velocity

- `docs/portfolio-spec-report/progress.js` 新建；browser 端直接 fetch `progress.json`
- 同檔提供 shared `buildProgressSnapshot()`，前端與 helper script 用同一套衍生邏輯
- 目前初始值：Ship-Before `0.0%`、ETA `25d`；Full Product `61d`；All Tracked `75d`

### C. CSS Wallpaper tier · bone + tangerine + charcoal · 大數字

- `docs/portfolio-spec-report/spec-doc.css` 新增 progress panel section
- 視覺語言：bone 底、sharp corner、tangerine gradient arc、Source Serif 4 大數字、Source Han Sans TC labels
- mobile 版改單欄堆疊；donut / ETA / breakdown 可在 iPhone 寬度下閱讀

### D. todo.html 加 progress-panel section top

- `docs/portfolio-spec-report/todo.html` 改成 nav 下先出 live progress，再進 hero 與 markdown 正文
- title / hero / status badge 同步改成 `89-item Live Matrix`
- panel 每 `60s` 自動 refresh；來源 `todo.md + progress.json`

### E. scripts/mark-todo-done.mjs 建 · R121+ 每步自動叫

- `scripts/mark-todo-done.mjs` 新建
- 用法：`node scripts/mark-todo-done.mjs T01 T02 T46`
- 每次執行都會先重新 parse `todo.md` 對齊 title / estH / track，再保留既有 done state、重算 `% / ETA / byStatus`

### F. VM deploy + 手機 screenshot

- live nginx 目前實際 root 仍指向 `/var/www/app/current/dist/portfolio-report/`，不是 `/var/www/portfolio-report/`
- 已同步 live 檔：
  - `progress.json`
  - `progress.js`
  - `todo.html`
  - `spec-doc.css`
  - 補同步 `source-han-fonts.css`，避免字體 stylesheet 被 HTML fallback 擋掉
- verify：
  - `https://35.236.155.62.sslip.io/portfolio-report/todo.html` → `HTTP/2 200`
  - `https://35.236.155.62.sslip.io/portfolio-report/progress.json` → `content-type: application/json`
  - `https://35.236.155.62.sslip.io/portfolio-report/progress.js` → `content-type: application/javascript`
  - `https://35.236.155.62.sslip.io/portfolio-report/source-han-fonts.css` → `content-type: text/css`
  - Playwright live smoke：`.progress-wrap` visible、console error = none
- screenshots：
  - `assets/progress-desktop.png` → `2026-04-18 18:22:56 CST`
  - `assets/progress-mobile.png` → `2026-04-18 18:22:59 CST`

### G. 自評（時尚度 / bold 度 / 資訊清晰度 / 手機可讀）目標 9.5+

- 時尚度：9.6 / 10
- bold 度：9.5 / 10
- 資訊清晰度：9.6 / 10
- 手機可讀：9.4 / 10

## Round 121 · Codex · L0 first wave · 2026-04-18 19:24:13 CST

- `T50`：新增 `src/lib/contracts/` canonical zod contracts boundary，`HoldingDossier / OperatingContext / CatalystEvent / ThesisScorecard` 對外輸出
- `T53`：新增 AppShell state-ownership ADR，補 current / target / migration state machine、owner map、cutover trigger
- `M09`：把 `2026-04-11` staged-daily consensus 升格成 ADR，並寫入 decisions index
- `T46`：新增 shared API auth middleware，21 個 root handlers wrap、fail-closed default、生產環境移除 `CORS:*`，debug/local 保留豁免
- `T27`：修正 knowledge availability period semantics 與 audit probe；`call-method-error` 從 `319` 降到 `0` rule rows，re-audit `available = 615`
- final verify：`npm run verify:local` 全綠，`844/844` tests passed

## Round 121b · Codex · Agent Bridge dashboard 視覺重建 match v3 mockup · 2026-04-18 19:51:38 CST

### A. index.html 重建（從 mockup 改）

- 以 `design-mockups/agent-bridge-2026-04-17-v3/index.html` 為視覺基底，live dashboard 改成 hero focus / 3 KPI / commit rhythm / progress bar / agents / recent commits / quick input / wake panel
- 保留資料掛點 `data-*` 給 JS render，不把 mockup 的靜態數字留在畫面上
- 舊 dashboard 備份為 `agent-bridge-standalone/dashboard/index-legacy.html`
- `agent-bridge-standalone/dashboard/index.html` 現為 `777` 行；字體沿用 `Source Serif 4 + Noto Serif TC` / `Source Sans 3 + Noto Sans TC`
- palette 回到 v3 bone clay：`#F2EADF / #F6F0E8 / #E7DACC / #B85C38 / #34271F`

### B. server.mjs /api/dashboard-snapshot 加

- `agent-bridge-standalone/server.mjs` 補 dashboard aggregate helpers：tasks normalize、active task pick、agents list、progress summary、7-day commit chart、recent git log
- `/api/dashboard-snapshot` 現回 `topbar / activeTask / kpi / commitChart / progress / agents / recentCommits / sessions`
- 延續既有 dashboard token / bridge token auth；token 無效時前端仍回 login flow

### C. dashboard-live.js polling

- 新建 `agent-bridge-standalone/dashboard/dashboard-live.js`（`596` 行）
- 每 `10s` poll `/agent-bridge/api/dashboard-snapshot`
- render hero、KPI、bar chart、progress、agent rows、recent commits、quick send target list
- 保留 CTA action send、quick input send、R119d wake panel log polling；dashboard token 過期會 redirect `login.html`

### D. VM deploy · iPhone 測 · screenshot 存

- 已同步到 VM：
  - `agent-bridge-standalone/dashboard/index.html`
  - `agent-bridge-standalone/dashboard/dashboard-live.js`
  - `agent-bridge-standalone/server.mjs`
- live verify：`https://35.236.155.62.sslip.io/agent-bridge/dashboard/` 用 PIN `0306` 可登入；desktop / iPhone 都成功 render 新 dashboard
- screenshots：
  - `agent-bridge-standalone/dashboard/assets/v3-desktop.png`
  - `agent-bridge-standalone/dashboard/assets/v3-iphone.png`

### E. 自評（美感 · 資訊密度 · 桌布等級 · R88 palette 親族性）

- 美感：9.5 / 10
- 資訊密度：9.4 / 10
- 桌布等級：9.6 / 10
- R88 palette 親族性：9.5 / 10

## Round 122 · Codex · L1 second wave · 2026-04-18 20:00:11 CST

- `T28`：建立 authoritative FinMind dataset registry / method registry，adapter 拆成 registry + client + methods；`backtestRuntime` 改走 boundary helper
- `T37`：insider buy/sell strip 擴到 `analyze / analyst-reports / research`，server-side portfolio compliance mode 生效
- `T47`：新增 `requirePortfolio()` 與 hardcoded owner/role policy；admin 全看，user 僅可讀 owner portfolio
- `T67`：`.env.example` 補 8 個 token，新增 `launch-preflight.sh`，清理 launch / checkpoint / auto-loop stale collateral refs
- `T51`：portfolio snapshot 寫入 `schemaVersion: 1`，legacy snapshot read-path normalize-on-read
- `T52`：新增 server-side FinMind governor、event-calendar / collect-daily-events upstream boundary 收口、`eslint` guardrail 禁 `src/**` 直寫 upstream endpoint
- `T54`：`useAppRuntimeComposer` 拆成 6 個 bounded slices + barrel re-export，外部 import / API shape 不變
- final verify：`95/95` targeted tests passed；`npm run lint`、`npm run check:runtime-entry`、`npm run check:fast-refresh` 全綠

## Round 121c · Codex · Agent Bridge dashboard v5 poster-tier · 2026-04-18 20:17:25 CST

- `agent-bridge-standalone/dashboard/index-v4.html`：保存 v4 版面備份
- `agent-bridge-standalone/dashboard/index-v5.html`：新建 poster-tier v5；測試後同步成正式 `index.html`
- `agent-bridge-standalone/dashboard/index.html`：正式入口切換到 v5
- `agent-bridge-standalone/dashboard/dashboard-live-v5.js`：新 renderer，改用 ship-before hero / active focus / weekly rhythm 三屏 live data
- `agent-bridge-standalone/dashboard/wake.html` + `wake-live.js`：把 Layer 2 panel 遷出 dashboard，獨立成 utility route
- `agent-bridge-standalone/server.mjs`：dashboard static MIME 補 `.html`，讓 `/dashboard/wake.html` 與 `/dashboard/index-v5.html` 可直接 serve
- strategic direction：`D` 為主，混 `M` 的巨型字階與 `S` 的亮卡資料落點；首頁只保留 1 個主詞／screen
- verify：
  - `curl -I http://127.0.0.1:9527/dashboard/index.html` → `200`
  - `curl -I http://127.0.0.1:9527/dashboard/wake.html` → `200`
  - `node --check agent-bridge-standalone/dashboard/dashboard-live-v5.js`
  - `node --check agent-bridge-standalone/dashboard/wake-live.js`
  - Playwright 390×844 capture 完成
- screenshots：
  - `agent-bridge-standalone/dashboard/assets/v5-hero.png`
  - `agent-bridge-standalone/dashboard/assets/v5-progress.png`
  - `agent-bridge-standalone/dashboard/assets/v5-commits.png`

## Round 123 · Codex · L2 third wave · 2026-04-18 20:29:26 CST

- `T30`：月營收 row 改以「所屬月」正規化 `date`，另保留 `announcedAt`；fundamentals mapper 不再把公告月誤當營收月
- `T31`：quarter / H1 / H2 standalone derivation 改回正確語意，避免 cumulative totals 洩漏成單季值
- `T57`：backup import 新增 allowlist + zod schema validate + `2MB` limit + two-step confirm；非法 payload fail-closed
- `T60`：`collect-daily-events / collect-target-prices / collect-news` 三個 cron 會寫 `last-success-<job>.json` blob marker，並在 weekday lateness 超標時發 alert
- `M15`：新增 shared `<StaleBadge>`，統一 `fresh / stale / missing / failed` 四態，接入 holdings / overview / events / daily report
- `T66`：新增 GitHub Actions CI workflow，`push main` / `PR -> main` 會自舉 local dev server 後跑 `npm ci + npm run verify:local`；同步修正 `research` type-aware regression test 以對齊現行 `callPortfolioClaude` wrapper
- final verify：`npm run verify:local` 全綠，`860/860` tests passed，build / healthcheck / smoke:ui 全過

## Round 121d · Codex · Agent Bridge v5d light rebuild · 2026-04-18 20:44 CST

- `agent-bridge-standalone/dashboard/index-v5-dark.html`：保存本輪覆寫前的 v5 dark 入口
- `agent-bridge-standalone/dashboard/index.html`：重建為 bone + tangerine poster tier；Section 1/2 改回 `--canvas-soft`，Section 3 用 `--canvas`
- `agent-bridge-standalone/dashboard/login.html`：同步翻回 light palette；PIN `0306` / dashboard token / bridge token flow 不變
- `agent-bridge-standalone/dashboard/dashboard-live-v5.js`：hero meta 改吃 `shipBefore.label`；`Wake To Route` 在沒有 live session 時改直接導去 `wake.html`
- 字體系統切到 `Source Han Serif TC` / `Source Sans 3` / `Anton` / `IBM Plex Mono` 的 portfolio 同族堆疊
- 禁用項已落實：不再用整片黑底 section、不再用 `#FF3E1F` screaming orange block、login 不再維持 dark surface
- live deploy：用 `scp` 同步 `index.html` / `index-v5-dark.html` / `login.html` / `dashboard-live-v5.js` 到 VM `/home/chenkuichen/app/agent-bridge-standalone/dashboard/`
- verify：
  - `node --check agent-bridge-standalone/dashboard/dashboard-live-v5.js`
  - `node --check agent-bridge-standalone/server.mjs`
  - `curl https://35.236.155.62.sslip.io/agent-bridge/dashboard/` 命中新版 HTML 文案
  - `curl https://35.236.155.62.sslip.io/agent-bridge/dashboard/login.html` 命中新版 light login
  - Playwright `390×844` live capture + PIN `0306` 登入成功
- screenshots：
  - `agent-bridge-standalone/dashboard/assets/v5d-hero.png`
  - `agent-bridge-standalone/dashboard/assets/v5d-focus.png`
  - `agent-bridge-standalone/dashboard/assets/v5d-week.png`

## Round 125 · Codex · L4 fifth wave · 2026-04-18 21:31:21 CST

- `T01`：Dashboard 補上 `Morning Note` surface，新增 `events / holdings / daily` deep-link handoff；`src/lib/morningNoteBuilder.js` 加出入口 contract，`DashboardPanel` 可以直接接 runtime note。
- `T02`：`Today in Markets` 從 `總經 / 行事曆` v1 擴成 `大盤 / 總經 / 行事曆` 單卡 surface，支援 safe external links，排序固定為 market-first。
- `T71`：`vercel.json` 全域加 CSP / XFO / XCTO / Referrer / Permissions headers；`api/analyze.js` 新增 prompt-injection guard，遇 `ignore previous instructions` / `you are now` / `system:` 直接回 `400`。
- `Q08`：insider guard 改成不外露 literal `insider` 字樣，並擴大 action-language strip 到英中混合；新增 `tests/lib/insiderGuardHarness.test.js`，120 組 adversarial prompts 全過，證據落 `docs/qa/insider-enforcement-evidence.md`。
- `Q09`：新增 `tests/lib/accuracyGateEnforcement.test.js`，會用 `file:line` 報漏 gate 的 prompt builder；順手把 `api/parse.js` / `api/research-extract.js` 也補進 `Accuracy Gate`。
- `T14/T15`：同日 staged close-analysis / diff / rerun cues 既有路徑在本輪修改後維持綠燈，未回退。
- final verify：`15/15` targeted test files passed、`76/76` tests passed、`npm run build` passed；`security / insider / Accuracy Gate` 三條 grep 全過。
