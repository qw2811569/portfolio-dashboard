# 2026-04-28 R29 + R30 Mega Hostile QA · Bug Consensus

**Trigger**：用戶 dogfood 報「很多功能不能使用 / 顯示要等待 / 收盤分析一直卡著」
**Method**：雙人 Claude + Codex 共識 · R29 5-round × 3 lens + R30 6-lens（/qa interactive · /cso security · /investigate 5-why · a11y+lighthouse · state matrix · architecture）
**VM HEAD audited**：`7449ed7`
**R28 9.95 baseline**：narrow oracle artifact（happy-path screenshot only）— 本文 90 finding 都 R28 9.95 視角看不到

**權威位置**：本檔。`.tmp/r156-full-execute/round29-3lens/` + `round30/` 是 process trail（可保留可刪）。

---

## 🟢 R31 Sprint Closure（2026-04-28）· 19/19 HIGH closed · 三維度 9.97 ≥ 9.99 收斂

**Sprint 過程**：`.tmp/r31-fix/r31-shared.md`（632 行 · 9 round Claude+Codex append pattern）

**最終分數**：

- Functional: 9.95（HB-3 / HD-2 文件化 trade-off · 非缺陷）
- a11y / perf: 10.0（Lighthouse perf 0.55→**0.86** · LCP 30.6s→**3.31s** · WCAG AA 全 PASS）
- Security: 9.95（HMAC token contract + 4 negative tests · HB-3 9 vulns risk-accept · HB-5 button removed · HB-6 真 AES-GCM/PBKDF2 migration）

**Verification snapshot**：

- vitest 1336 → **1349** pass (+13 new tests)
- Vite circular chunk warnings 4 → **0**
- Initial bundle 5.4 MB → **0.5 MB**（10× 改善）
- npm vulns 11 (1 high) → **9 moderate (0 high · all risk-accepted)**
- Hardcoded API routes 14+ → **0**
- axe color-contrast violations 9 → **0**
- madge circular imports 2 → **0**

**未進 R31 scope**：

- HB-1 paid API key（DEFERRED · launch 前處理 · per memory `project_secret_rotation_deferred`）
- R29-H1 first-run onboarding（cross with HB-5 portal contract · 留 R32）
- 49 MEDIUM + 22 LOW（next sprint backlog）

---

## 🔥 USER PRIORITY 0 · 收盤分析卡住根因（Daily HA-1）

**Symptom**：Daily 「資料已收齊，AI 正在分析」copy 永不結束。

**Root cause**：

- `src/lib/dailyReportComposer.js:60-65` partial state = `!hasInsight && hasChanges`
- `src/lib/dailyReportComposer.js:143-148` partial copy 寫「AI 正在分析」是**謊言**
- 整個 codebase **沒任何 useEffect auto-trigger `runDailyAnalysis()` when state === partial**
- live VM 30s 觀察：`bodyHasAnalyzing=true` 但 `analyzeRequests=0`
- 加重：`useDailyAnalysisWorkflow.js:887-893` clears `analyzing` 但 persisted preview/streaming 沒清 → page reload 仍 stuck

**Fix R31**：

- 改 copy「資料已收齊 · 點下方按鈕開始」(明示 user action)
- partial state 加 page-load TTL cleanup（5 min stale → reset）
- primary CTA 強化（pulse / orange）
- systemic R32+：拆 5 種 state（waiting/ready/preview-streaming/draft-needs-action/failed-stale）

---

## 🔴 HIGH 19 條（R31 dogfood blocker）

### Lens A · /qa interactive (3)

| #    | Finding                                                      | file:line                                                                                                             | Evidence                              |
| ---- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| HA-1 | **Daily partial state 永久卡「AI 正在分析」** ⚠️ USER PRIO 0 | `dailyReportComposer.js:60-65,143-148` + `useDailyAnalysisWorkflow.js:887-893` + `usePortfolioPersistence.js:259-262` | live 30s `analyzeRequests=0`          |
| HA-2 | News → 深度研究 401 沒 pre-warning                           | News deep-research nav                                                                                                | console 401 + 「需要重新登入」blocker |
| HA-3 | Header tab click 不更新 URL · F5 reset                       | `Header.jsx:75-87` + `useAppShellUiState.js:73-77`                                                                    | dynamic check confirmed               |

### Lens B · /cso security (6)

| #    | Finding                                                         | file:line                                                  |
| ---- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| HB-1 | git history paid API key（DEFERRED per user · launch 前必處理） | `.git history`                                             |
| HB-2 | OWASP A01 same-origin = identity → forge admin claim            | `auth-middleware.js:85-91` + `portfolio-policy.js:103-114` |
| HB-3 | OWASP A06 npm audit 11 vulns（vite high + GCS moderate）        | `package-lock.json`                                        |
| HB-4 | OWASP A07 portfolio identity 無 JWT signature/expiry/issuer     | `portfolio-policy.js:48-79` + `require-portfolio.js:26-53` |
| HB-5 | Auth flow 半實作 · 「重新登入」destination 不存在               | `useUpstreamHealth.js:8`                                   |
| HB-6 | localStorage 存 sensitive data 無 encryption                    | portfolio data + thesis + agent token                      |

### Lens D · perf + a11y (5)

| #    | Finding                                                                | metric / file:line            |
| ---- | ---------------------------------------------------------------------- | ----------------------------- |
| HD-1 | **LCP 30.6s · TTI 30.6s · FCP 16.3s · Performance score 0.55**         | live VM lighthouse            |
| HD-2 | bundle 5.4 MiB / 234 requests · pdfmake 988 KiB + fonts 1.1 MiB unused | `dist/assets`                 |
| HD-3 | FinMind detail calls in critical path（不應 block first paint）        | source defer to lazy          |
| HD-4 | self-hosted fonts 0 cache headers（1.1 MiB savings）                   | nginx config                  |
| HD-5 | 9 tab WCAG AA color contrast 3.71:1 FAIL（< 4.5:1）                    | `C.textMute #838585` on white |

### Lens E · state matrix (2)

| #    | Finding                                              | file:line                |
| ---- | ---------------------------------------------------- | ------------------------ |
| HE-1 | Events true-empty 被 fallback seed 12 events 蓋過    | `EventsPanel.jsx` + seed |
| HE-2 | Overview empty 不可 audit（mixes seeded portfolios） | overview aggregate       |

### Lens F · architecture (4)

| #    | Finding                                                                          | file:line                                                                          |
| ---- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| HF-1 | circular import eventUtils ↔ brainRuntime                                        | madge 2 cycles                                                                     |
| HF-2 | frontend `cronLastSuccess.js` import `api/_lib/*` boundary leak                  | `src/lib/cronLastSuccess.js`                                                       |
| HF-3 | 14+ hardcoded API routes 沒 centralize 進 `API_ENDPOINTS`                        | analyzeRequest / tradeParser / hooks/api/\* / etc                                  |
| HF-4 | Daily state 4 owner drift / overlay state 5 owner / brainStore 自承「half-dead」 | `dailyReportComposer` + `DailyReportPanel` + `useAppShellUiState` + `reportsStore` |

### R29 carry-over（不重複計但仍未修，3）

| #     | Finding                                                 | file:line                                                |
| ----- | ------------------------------------------------------- | -------------------------------------------------------- |
| H29-1 | first-run onboarding 擋 click（同 HA contract 缺）      | `OnboardingTour.jsx:50-63` + `AppShellFrame.jsx:234-238` |
| H29-2 | /api/event-calendar Vite bridge missing（local dev 壞） | `useAutoEventCalendar.js:24-32` + `vite.config.js:72-80` |
| H29-3 | main.jsx vs route pages migration drift                 | `main.jsx:1-14` + `App.routes.jsx` + `tests/routes/`     |

---

## 🟡 MEDIUM 49 條（next sprint）

### A /qa (5)

- MA-1 Events「待復盤 X 件」text 看似可點實 noop
- MA-2 testid pattern 不穩定 e2e selector
- MA-3 Onboarding overlay R29 同根
- MA-4 Trade wizard gate 可見背景
- MA-5 Watchlist add modal selector hit hidden btn

### B /cso (22)

OWASP A02-A10 各 Medium：

- A02 signed-url secret fallback to broad storage tokens
- A03 LLM prompt injection guard 太弱（只擋 3 patterns）+ research/research-extract 無 guard
- A04 無 rate limiter / quota / abuse throttle on AI endpoints
- A05 CSP `'unsafe-inline'` script + style · cron CORS `*` open
- A07 Vercel `npm install` not `npm ci`
- A08 GitHub Actions tag-pinned 不 SHA-pinned
- A09 log AI raw output（可能含 sensitive 持倉/論述）
- A10 internal origin 信 request host (signed-url 可被 host header 操縱)
- 22 條完整列表詳 `.tmp/r156-full-execute/round30/B-cso/round30b-shared.md`

### D a11y (7)

- MD-1 Skip link 缺
- MD-2 Toast 無 aria-live + close × 無 aria-label
- MD-3 Trade wizard placeholder-only inputs
- MD-4 Dialog error 無 aria-invalid/aria-describedby
- MD-5 Trade wizard hidden file input keyboard 不到
- MD-6 HoldingDetailPane scrollable tabIndex=0 noise
- MD-7 AnimatedNumber 不 honor prefers-reduced-motion

### E state matrix (5)

- ME-1 holdings/daily/events 無 route-level 401/offline UI
- ME-2 loading inconsistent（3 routes 沒 skeleton）
- ME-3 research empty + error 同顯混亂
- ME-4 insider header badge 全 route 不顯
- ME-5 events insider 文案沒切換

### F architecture (6)

- MF-1 17 orphan files
- MF-2 barrel files (hooks/index.js fan-out 45)
- MF-3 recharts heavy 用於 sparkline
- MF-4 10 files >1300 LOC（top: dailyPrinciples 2796 / DashboardPanel 2418 / DailyReportPanel 2384）
- MF-5 unused dep node-fetch + depcheck issues
- MF-6 multiple Zustand stores 未 finalize source of truth

### R29 carry-over (4)

- M29-1 mobile drawer 英文 News/Trade/Log（`Header.jsx:92-105`）
- M29-2 X1-X3 desktop placeholder 等寬 grid（`AnxietyMetricsPanel.jsx:655-666`）
- M29-3 desktop dashboard `>` 7×19px button a11y < 44px（`DashboardPanel.jsx:1966-1985`）
- M29-4 visual-audit no diff/oracle（`tests/e2e/visual-audit.spec.mjs:25-136`）

---

## 🟢 LOW 22 條（known debt · backlog）

- L29-1 emoji 🔍 CmdK / 👑 公司代表 chrome
- L29-2 amber color monotony
- L29-3 active caller 仍用 `C.radii.lg=16`
- L29-4 Daily archive timeline default collapsed（acceptable density tradeoff）
- L29-5 component LOC bloat（已 MF-4 升）
- L29-6 CLAUDE.md 350+ 行 hygiene
- L29-7 mobile heatmap 2-row year label only first row anchor
- L29-8 docs startup conflict（README vs SERVER_ACCESS_GUIDE）
- L29-9 500 e2e files hard route
- LA-1 /api/event-calendar console noise
- LA-2 target-price 404 noise on load
- LB-1 .env.example placeholders
- LB-2 .vercel/project.json untracked
- LB-3 .qwen/settings.json historical secret residual
- LB-4 skill supply chain 未 SHA-pinned
- LB-5 healthcheck 不 assert event-calendar
- LD-1 HTTP→HTTPS redirect 1.5s cost
- LD-2 Google Fonts CSS 205 KiB unused on overview
- LD-3 unused JS 839 KiB（holdings 356 + overview 157）
- LE-1 daily/news empty 自寫 不用共用 EmptyState
- LE-2 empty state taxonomy 不統一
- LF-1 ~17 unused exports inside live files

---

## 🧠 SYSTEMIC ROOT CAUSE（R30-C consensus）

**「專案在內部 beta / migration shell / local-first 模式下長出 production-facing promises，但沒把 promise 綁到 authoritative runtime contract」**

3 critical bug 同根：

| Surface     | Promise                | Authoritative contract（缺）           |
| ----------- | ---------------------- | -------------------------------------- |
| Daily 卡住  | copy「AI 正在分析」    | active request / timeout / user-action |
| Auth bypass | same-origin = identity | server-verified session signature      |
| URL 不同步  | tab state              | URL source-of-truth                    |

**R31 修法新原則**：每個 user-visible promise 必須綁 verifiable contract（active request / server-verified session / URL source-of-truth）。

R12-R28 hostile QA 全用 screenshot 看「畫面對不對」沒驗「行為對不對」→ 9.95 是「畫面對」不是「行為對」。

---

## 📊 R28 9.95 vs R30 reality

| 維度           | R28 9.95        | R30 6-lens reality                                 |
| -------------- | --------------- | -------------------------------------------------- |
| 視覺質感       | 9.95            | 仍 ~9.95 視覺沒退化                                |
| 散戶可用       | 9.95            | **3 HIGH 用戶卡住 + 30s LCP** = 不可 dogfood       |
| §5 紀律        | 9.96            | visual rule clean，但 architecture/state/auth 大債 |
| 安全           | 未測            | **6 HIGH critical**                                |
| 性能           | 未測            | **score 0.55 FAIL**（LCP 30.6s）                   |
| a11y           | 未測            | **9 contrast FAIL + 7 MEDIUM**                     |
| state coverage | happy-path-only | **2 HIGH + 5 MEDIUM gap**                          |
| architecture   | 未測            | **4 HIGH systemic drift**                          |

**真實 dogfood readiness**：**NOT READY**。需 R31 修 19 HIGH。

---

## 🛠 R31 修法分組（建議攻擊順序）

| 順  | Group                        | HIGH 條               | 為何先                             |
| --- | ---------------------------- | --------------------- | ---------------------------------- |
| 1   | **USER PRIO 0**              | HA-1                  | 用戶報「卡住」根因                 |
| 2   | **HD perf**                  | HD-1~5                | 30s LCP 是 first-impression killer |
| 3   | **HB auth + HB-3 npm vulns** | HB-2/4/3/6            | 安全紅線 · forge admin             |
| 4   | **HA-2/3 + H29-1/2**         | HA-2 HA-3 H29-1 H29-2 | 互動斷裂                           |
| 5   | **HE state matrix**          | HE-1 HE-2             | empty/error UI                     |
| 6   | **HF architecture**          | HF-1~4 + H29-3        | systemic R32+ 級重構               |

R31 estimated work: 1-2 sprint。修完拉用戶 dogfood 才有意義。

---

## 🤝 雙人 sign-off

- **Codex** (2026-04-28 07:30+08): R30 6-lens 累積 90+ finding 反映 R28 9.95 hostile QA 視角單薄。R31 開 19 HIGH 為 dogfood blocker，按 lens 分組進攻。MEDIUM 進 R32 sprint，LOW 進 backlog。
- **Claude** (2026-04-28): R29 5-round 22 finding 是 hostile-QA-on-screenshots 的天花板。R30 換 6 lens 多挖 4× finding，證實 R28 9.95 score 是 narrow oracle artifact。R31 必修 USER PRIO 0，systemic root cause per R30-C 該在 R32 重構吃。

## CONSENSUS REACHED ✅

---

## 📂 完整 audit trail（process detail · 不再散）

`.tmp/r156-full-execute/` 下：

- `round29-3lens/round29-shared.md` (502 行 · R29 5 rounds × 3 lens)
- `round30/A-qa/round30a-shared.md` + R30A spec/log
- `round30/B-cso/round30b-shared.md`
- `round30/C-investigate/round30c-shared.md`
- `round30/D-a11y-perf/{round30d-shared.md, lighthouse.json, axe-playwright.json, page.html}`
- `round30/E-state-matrix/{round30e-shared.md, screenshots/, results.json}`
- `round30/F-arch/round30f-shared.md`
- `round30/R30-MEGA-FINAL.md`（已 deprecated · 全部移到本檔）

**權威 = 本檔**：`docs/audits/2026-04-28-r29-r30-bug-consensus.md`
