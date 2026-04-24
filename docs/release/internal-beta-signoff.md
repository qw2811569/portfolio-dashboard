# Internal Beta Owner Signoff

Status: `pending-signoff`

- release: `R127-L8 / T72b`
- prepared_at: `2026-04-18`
- source_of_truth:
  - `docs/portfolio-spec-report/progress.json`
  - `docs/release/internal-beta-checklist.md`
  - `docs/release/demo-path.md`
  - `docs/release/invite-feedback-flow.md`

## 身份確認

- owner account: 小奎 / `xiaokui`
- beta portfolio: 金聯成董座 / `jinliancheng`
- cust_id: `7865`
- compliance mode: `insider`
- candidate version: `1.0.0`
- candidate sha: `509c3df` (current committed HEAD on this branch)
- candidate note: includes `f94e77d` (UX-25-bug-4 fixture), `3b2584d` (markdown render), `509c3df` (thesis empty hide + write-reason CTA); excludes later uncommitted local WIP

## Ship-Before 30 條 Checklist

Generated from `docs/portfolio-spec-report/progress.json` snapshot on `2026-04-18`.

- [x] `T01` Surface Morning Note on Dashboard with deep-links · `done` · `2026-04-18` · `6h`
- [x] `T02` Build Dashboard `Today in Markets` module · `done` · `2026-04-18` · `8h`
- [x] `T04` Add post-close ritual mode + tomorrow-action editorial card · `done` · `2026-04-18` · `8h`
- [x] `T22` Deliver weekly export narrative + insider section; true PDF/cover later · `done` · `2026-04-18` · `12h`
- [x] `T37` Strip insider buy/sell language in analyze/brain/analyst-reports/research · `done` · `2026-04-18` · `6h`
- [x] `T38` Enforce Accuracy Gate in all prompt builders · `done` · `2026-04-18` · `8h`
- [x] `T40` Roll out `analysisStage` t0/t1 lifecycle and auto-confirm logic · `done` · `2026-04-18` · `6h`
- [x] `T46` Add shared API auth middleware, fail-closed defaults, remove open CORS · `done` · `2026-04-18` · `6h`
- [x] `T47` Add server-side `requirePortfolio` / RBAC authZ · `done` · `2026-04-18` · `8h`
- [x] `T49` Regrade Blob ACLs: private brain/research/snapshot, telemetry exception · `done` · `2026-04-18` · `8h`
- [x] `T50` Add canonical contracts in `src/lib/contracts` + parse boundaries · `done` · `2026-04-18` · `8h`
- [x] `T57` Add backup import trust boundary (allowlist/schema/confirm) · `done` · `2026-04-18` · `4h`
- [x] `T71` Add CSP/security headers + XSS/prompt-injection review · `done` · `2026-04-18` · `8h`
- [x] `M15` Build shared `<StaleBadge>` component as the stale/freshness UI primitive · `done` · `2026-04-18` · `4h`
- [x] `T27` Fix FinMind `319 call-method-error` availability gap · `done` · `2026-04-18` · `10h`
- [x] `T28` Build authoritative FinMind dataset map + method registry · `done` · `2026-04-18` · `8h`
- [x] `T30` Correct monthly revenue announced-month semantics end-to-end · `done` · `2026-04-18` · `6h`
- [x] `T31` Correct quarter/H1/H2 financial semantics and derived standalone logic · `done` · `2026-04-18` · `8h`
- [x] `T32` Harden MOPS revenue/announcement ingestion and fallback contract · `done` · `2026-04-18` · `6h`
- [x] `T33` Add macro / 央行 / calendar feed for `Today in Markets` · `done` · `2026-04-18` · `6h`
- [x] `T48` Rotate secrets, add inventory, Secret Manager, and launch-script cleanup · <span style="color:#7a5c00"><strong>deferred-per-decision</strong></span> · `6h` · reason: `docs/decisions/2026-04-24-r120-scope-batch.md` Q-I1 overrides 90d default — internal beta 不 rotate；正式產品上線前用戶親手換
- [x] `T60` Add cron last-success markers and lateness alerts · `done` · `2026-04-18` · `6h`
- [x] `T62` Extend checkpoint/backup contract to include localStorage · `done` · `2026-04-18` · `8h`
- [ ] `T64` Run restore drill, rollback test, and MDD recovery test · <span style="color:#b42318"><strong>blocked</strong></span> · `5h`
- [ ] `M04` Add Agent Bridge dashboard auth injection so T46 does not cause silent 401s · <span style="color:#b42318"><strong>blocked</strong></span> · `3h`
- [x] `T66` Add GitHub CI workflow + `verify:local` gate · `done` · `2026-04-18` · `4h`
- [x] `T67` Expand `.env.example`, clean launch scripts/inventory, add preflight, remove stale refs · `done` · `2026-04-18` · `6h`
- [x] `T72a` Finish internal-beta minimal legal/docs pack: disclaimer, privacy-lite, data residency, audit schema, release checklist · `done` · `2026-04-18` · `5h`
- [ ] `T72b` Finish beta ship gate: smoke, owner signoff, demo path, invite/feedback readiness · <span style="color:#b54708"><strong>pending-signoff</strong></span> · `4h`
- [ ] `M09` Promote the 2026-04-11 staged-daily consensus into ADR/index so onboarding sees the true runtime contract · <span style="color:#b42318"><strong>blocked</strong></span> · `2h`

Summary:

- done: `25 / 30`
- deferred-per-decision: `T48` (R120 Q-I1 · 不 rotate)
- blocked: `T64` `M04` `M09`（ship 後收口 · 非 block ship）
- pending-signoff: `T72b`

## Manual 演練記錄

| Gate                                | 用途                                   | 演練日期     | 結果                                                    | 證據 path                                                   | 備註                                                                                                             |
| ----------------------------------- | -------------------------------------- | ------------ | ------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `T64` restore drill                 | restore / rollback / MDD recovery      |              |                                                         | `docs/runbooks/restore-drill.md`（runbook · L8-e）          | runbook 完成 · 實跑推 ship 後 monthly rehearsal（R120 Q-I3）                                                     |
| `Q06` iOS Safari                    | owner 實機 smoke                       | `2026-04-24` | emulation evidence logged; true-device decision pending | `.tmp/m-u3-iphone-smoke/findings.md` + screenshots（L8 派） | 已有 3 critical route findings，但這輪明確只有 Playwright iPhone emulation；是否仍要求 owner 真機證據待決策      |
| `M-U1` cert / secret rotate confirm | external ops confirmation for beta cut | `2026-04-24` | `n/a`                                                   | `docs/decisions/2026-04-24-r120-scope-batch.md`（Q-I1）     | 依 R120 Q-I1 + `memory/project_secret_rotation_deferred.md`：內部 beta 不 rotate · 正式產品上線前由 owner 親手換 |

## 自動 QA 證據

- run date: `2026-04-18`
- Playwright summary: `6 passed / 0 failed / 0 skipped / 6 total`
- console errors: `0`
- ignored known pageerror noise: `503`
- ignored known response noise: `51`
- HTML report: `../qa/playwright-report-2026-04-18/index.html`
- [x] `Q06` Playwright webkit + iOS viewport cover 90% · 剩實機 10% pending
- screenshot evidence:
- `tests/e2e/snapshots/chromium/01-home.png`
- `tests/e2e/snapshots/chromium/02-owner-holdings.png`
- `tests/e2e/snapshots/chromium/03-research.png`
- `tests/e2e/snapshots/chromium/04-events.png`
- `tests/e2e/snapshots/chromium/05-news.png`
- `tests/e2e/snapshots/chromium/06-daily.png`
- `tests/e2e/snapshots/chromium/07-trade-log.png`
- `tests/e2e/snapshots/chromium/08-upload-log.png`
- `tests/e2e/snapshots/chromium/09-logout.png`
- `tests/e2e/snapshots/chromium/agent-01-hero.png`
- `tests/e2e/snapshots/chromium/agent-02-focus.png`
- `tests/e2e/snapshots/chromium/agent-03-week.png`
- `tests/e2e/snapshots/ios-safari/01-home.png`
- `tests/e2e/snapshots/ios-safari/02-owner-holdings.png`
- `tests/e2e/snapshots/ios-safari/03-research.png`
- `tests/e2e/snapshots/ios-safari/04-events.png`
- `tests/e2e/snapshots/ios-safari/05-news.png`
- `tests/e2e/snapshots/ios-safari/06-daily.png`
- `tests/e2e/snapshots/ios-safari/07-trade-log.png`
- `tests/e2e/snapshots/ios-safari/08-upload-log.png`
- `tests/e2e/snapshots/ios-safari/09-logout.png`
- `tests/e2e/snapshots/ios-safari/agent-01-hero.png`
- `tests/e2e/snapshots/ios-safari/agent-02-focus.png`
- `tests/e2e/snapshots/ios-safari/agent-03-week.png`
- `tests/e2e/snapshots/webkit/01-home.png`
- `tests/e2e/snapshots/webkit/02-owner-holdings.png`
- `tests/e2e/snapshots/webkit/03-research.png`
- `tests/e2e/snapshots/webkit/04-events.png`
- `tests/e2e/snapshots/webkit/05-news.png`
- `tests/e2e/snapshots/webkit/06-daily.png`
- `tests/e2e/snapshots/webkit/07-trade-log.png`
- `tests/e2e/snapshots/webkit/08-upload-log.png`
- `tests/e2e/snapshots/webkit/09-logout.png`
- `tests/e2e/snapshots/webkit/agent-01-hero.png`
- `tests/e2e/snapshots/webkit/agent-02-focus.png`
- `tests/e2e/snapshots/webkit/agent-03-week.png`

## UX-25 Real-User Evidence

- evidence bundle: `.tmp/ux-25-e2e-real-user-sim/evidence-20260423T204857Z`
- base URL: `https://35.236.155.62.sslip.io/`
- Playwright projects: `chromium` / `webkit` / `ios-safari`
- step totals: `25 passed / 0 failed / 3 blocked / 2 skipped`
- runtime summary: `0 console errors / 0 pageerrors / 267 network 4xx/5xx`
- feature correctness: weekly export passed as structured clipboard markdown, backup export passed as JSON, backup import passed after 2-step confirm, iOS portrait + landscape stayed single-column with sticky height `99.39px`
- fixed during UX-25:
  - `UX-25-bug-1` iOS mobile header lost stickiness during scroll → fixed in `src/components/Header.jsx`
  - `UX-25-bug-2` analyst report refresh emitted `console.error` on expected misses → fixed in `src/hooks/useReportRefreshWorkflow.js`
  - `UX-25-bug-3` backup import dialog emitted React key warning → fixed in `src/components/common/Dialogs.jsx`
- issues captured in the 2026-04-23 evidence bundle:
  - `UX-25-bug-4` live `daily-diff-toggle` absent for 金聯成 flow across all three projects; this was later fixed in `f94e77d`, so the captured bundle is now historically useful but not the latest truth
  - live API noise remains in `network-errors.jsonl`: `finmind 503`, `target-prices 500/503`, `news-feed 500`, `tracked-stocks 404`, `brain 503`, `research 503`
- summary: `.tmp/ux-25-e2e-real-user-sim/evidence-20260423T204857Z/summary.md`

## Legal 勾選

- [ ] Disclaimer 已確認
  - 參照：[Ship Gate](./internal-beta-checklist.md#ship-gate)
  - 草稿：本 app 不構成投資建議；所有 AI 分析為輔助參考 · 投資決策由用戶自行負責（SA §2.4 非目標）
- [ ] Privacy 已確認
  - 參照：[Ship Gate](./internal-beta-checklist.md#ship-gate) / [Data Handling](./internal-beta-checklist.md#data-handling)
  - 草稿：內部 beta 僅 owner + 金聯成董座二人使用；持股資料存 private Vercel Blob（R134c + architecture §6）+ localStorage checkpoint；無對外第三方分享
- [ ] Residency 已確認
  - 參照：[Ship Gate](./internal-beta-checklist.md#ship-gate)
  - 草稿：Vercel（美國 region）+ GCP VM（asia-east1 / 台灣）· FinMind 資料 API 走亞太；內部 beta 階段不涉跨境監管要求
- [ ] Audit pack 已附齊
  - 參照：[Audit Pack Template](./internal-beta-checklist.md#audit-pack-template)
  - 附件：本檔 + `internal-beta-v1.md` release note + `cross-browser-matrix.md`（L8-d）+ `restore-drill.md`（L8-e）+ M-U3 findings + 本輪 commit list (`ab20a48` .. `509c3df`)

## Signoff Block

- signoff date:（owner 填）
- owner signature:（owner 填）
- signed version: `1.0.0`
- signed sha: 預設 `509c3df`（current committed HEAD；若 signoff 前再落新 commit，需同步更新）
- demo evidence bundle: `docs/release/internal-beta-v1.md` §8 + `.tmp/m-u3-iphone-smoke/screenshots/`
- decision: `ship` / `hold`（owner 填）

## Rollback Trigger

Owner must halt beta invite immediately if any of these happens:

- `node scripts/full-smoke.mjs` 任一步驟失敗。
- `docs/release/demo-path.md` 任一步驟與預期畫面不一致，且 refresh 一次後仍未恢復。
- `T64` / `Q06` / `M-U1` 任一證據缺失、失敗、或無法解釋。
- live route 出現非預期 `401` / `403` / portfolio data bleed。
- `7865` insider path 又出現買賣建議語氣。
- privacy / residency / audit 任一欄無法勾選。
- 上傳成交或交易日誌寫入錯 portfolio、重複寫入、或 evidence 路徑找不到。

## Owner 下一步

1. 跑 `node scripts/full-smoke.mjs`。
2. 按 `docs/release/demo-path.md` 走完整 golden path。
3. 補齊 manual rehearsal 三列與 legal 四列。
4. 填完 signoff block；若任何一項失敗，維持 `pending-signoff` 並停止 ship。
