# NOW

Last updated: 2026-04-28 23:50（R32 R14 收尾）
Last commit topic: R32 docs cleanup R12-R14（自決 4 條 + 補 11 條 + 補 5 條收尾）

Purpose: one-page current truth for handoff. Keep this under 200 lines; link out instead of copying long histories.

## Last Sprint

- **R31** R29/R30 bug consensus: 19/19 HIGH closed, LCP 30.6s→3.31s, 1349/1349 tests
  - Source audit: `docs/audits/2026-04-28-r29-r30-bug-consensus.md`
  - Sprint trail: `.tmp/r31-fix/r31-shared.md`（不 promote · sprint trail only）
- **R32** docs cleanup（剛收）:
  - 168 active md → **111 active md**（33% ↓）
  - 8 個 per-dir INDEX 全建（audits / decisions / specs / runbooks / release / qa / research / dashboard-redesign）
  - 0 broken links / 100% INDEX coverage / 0 path-aware orphan
  - 14 round Claude+Codex mutual QA · trail in `.tmp/r32-docs/r32-shared.md`

## Active Sprints

- Dashboard redesign: Round 1-20 multi-LLM 研究 done · spec 草案 in `docs/specs/2026-04-28-dashboard-redesign-spec.md` · decision 草案 in `docs/decisions/2026-04-28-dashboard-redesign.md`
- Runtime sovereignty burn-in: Vercel hosting disconnected 2026-04-28 · VM + nginx + GCS + systemd 為現行 operating model · 1-2 週 burn-in 後砍 `@vercel/blob` dep

## Active VM / Runtime

- Architecture truth: `agent-bridge-standalone/project-status.json`
- Human/AI operating rules: `claude.md`
- Runtime execution ledger: `coordination/llm-bus/runtime-execution-plan.md`
- Runtime stabilization brief: `coordination/llm-bus/runtime-stabilization-brief.md`
- Current model: each dev VM is a sovereign full stack with nginx, Agent Bridge, Express API, deploy webhook, systemd timers, and GCS primary storage.
- Vercel: disconnected from active hosting; legacy Blob remains shadow/cold backup during burn-in.

## Recent Decisions

- `docs/decisions/2026-04-25-vercel-full-decoupling.md` — VM/GCS/systemd replaces Vercel as active platform.
- `docs/decisions/2026-04-24-runtime-status-file-policy.md` — generated status JSON and data coverage snapshots must not become manual docs.
- `docs/decisions/2026-04-28-dashboard-redesign.md` — dashboard redesign draft decision; use with the 2026-04-28 redesign spec.
- `docs/decisions/index.md` remains the full decision log.

## Open Questions（**user 拍板等級** · LLM 不能自決）

**Active debt list**: `docs/status/active-debt-2026-04-28.md` (R139-R141 sprint trail merged · 4 ship blockers · 5 follow-ups · backlog · R147 6 carry-over)

R31+ ship blockers (from active-debt-2026-04-28.md · 都需要 user/owner 拍板):

- **Q06 / M-U3 driving oracle**: real-device manual gate vs Playwright sim — pick one, signoff docs must align
- **Route-shell contract**: docs say "limited" but trade route still live-write — pick one
- **Holdings multi-level filter + detail pane (R141 #3)**: 4th time slipped past spec — must split to R141b filter / R141c pane
- **Release docs SHA refresh**: signoff/v1/cross-browser-matrix were stale at `509c3df`, refreshed by R32 to `30b5ae2` ✅

**R32 docs scope · LLM 已決定**：

- ✅ `coordination/llm-bus/board.md` 保留（scope = LLM coordination ephemeral · 跟 NOW.md sprint sticky 互補不重疊）
- ✅ `docs-site/` 維護（`scripts/build-docs-state.mjs` + `sync-state.sh` 仍在跑）· README 已加 "不要手動 edit" warning
- ✅ `portfolio-spec-report/` HTML portal 已 archive（無 launch task / VSCode task / package.json 引用 · 6 個 portal HTML 移到 `archive/2026-Q2/spec-report-publish/`）· `pages/*.html` + `assets/` 保留（render scripts 用）

## How To Run

- Local app: `npm run dev` then open `http://127.0.0.1:3002`
- Local verification: `npm run verify:local`
- Server access and env setup: `docs/SERVER_ACCESS_GUIDE.md`
- One-minute setup: `docs/QUICK_START.md`

## How To Dispatch Agents

- Startup required reads: `claude.md`, `memory/MEMORY.md`, `agent-bridge-standalone/project-status.json`, `coordination/llm-bus/agent-bridge-tasks.json`, `docs/decisions/index.md`, `docs/audits/INDEX.md`
- Do not dispatch from archived docs unless an active index points there for historical evidence.
- Generated runtime artifacts are not planning truth: status activity JSON and data coverage snapshots should be ignored for strategy unless a current decision says otherwise.

## Indexes

- Canonical docs: `docs/CANONICAL-INDEX.md`
- Audits: `docs/audits/INDEX.md`
- Decisions: `docs/decisions/index.md`
- Current live work log: `docs/status/current-work.md`
