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
- candidate sha: `59f76fd`

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
- [ ] `T48` Rotate secrets, add inventory, Secret Manager, and launch-script cleanup · <span style="color:#b42318"><strong>blocked</strong></span> · `6h`
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
- blocked: `T48` `T64` `M04` `M09`
- pending-signoff: `T72b`

## Manual 演練記錄

| Gate                                | 用途                                   | 演練日期 | 結果 | 證據 path | 備註                                      |
| ----------------------------------- | -------------------------------------- | -------- | ---- | --------- | ----------------------------------------- |
| `T64` restore drill                 | restore / rollback / MDD recovery      |          |      |           | 跑完才可勾 signoff                        |
| `Q06` iOS Safari                    | owner 實機 smoke                       |          |      |           | 建議附 iPhone 截圖或短錄影                |
| `M-U1` cert / secret rotate confirm | external ops confirmation for beta cut |          |      |           | 若本輪判定 `n/a`，請明寫原因與 owner 決策 |

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

## Legal 勾選

- [ ] Disclaimer 已確認
  - 參照：[Ship Gate](./internal-beta-checklist.md#ship-gate)
- [ ] Privacy 已確認
  - 參照：[Ship Gate](./internal-beta-checklist.md#ship-gate) / [Data Handling](./internal-beta-checklist.md#data-handling)
- [ ] Residency 已確認
  - 參照：[Ship Gate](./internal-beta-checklist.md#ship-gate)
- [ ] Audit pack 已附齊
  - 參照：[Audit Pack Template](./internal-beta-checklist.md#audit-pack-template)

## Signoff Block

- signoff date:
- owner signature:
- signed version:
- signed sha:
- demo evidence bundle:
- decision: `ship` / `hold`

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
