# NOW

Last updated: 2026-04-28 18:00

Purpose: one-page current truth for handoff. Keep this under 200 lines; link out instead of copying long histories.

## Last Sprint

- R31 closed the R29/R30 bug consensus: 19/19 HIGH blockers closed, LCP improved 30.6s to 3.31s, and 1349/1349 tests passed.
- Source audit: `docs/audits/2026-04-28-r29-r30-bug-consensus.md`
- Sprint trail stays in `.tmp/r31-fix/r31-shared.md`; do not promote it wholesale unless a decision/spec needs exact history.

## Active Sprints

- R32 docs cleanup: Round 2 classified active/stale/generated docs; Round 3 is archiving low-risk stale docs and updating entry indexes.
- Dashboard redesign: Round 1-20 research complete; spec and decision are draft/current review inputs.
- Runtime sovereignty burn-in: Vercel hosting is disconnected; VM + nginx + GCS + systemd is current operating model.

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

## Open Questions

**Active debt list**: `docs/status/active-debt-2026-04-28.md` (R139-R141 sprint trail merged · 4 ship blockers · 5 follow-ups · backlog)

R32 docs cleanup specific:

- Decide whether `coordination/llm-bus/board.md` survives after NOW becomes the active current-work doorway.
- Decide whether `docs-site/` is still maintained. If yes, refresh docs-site README around generated state; if no, archive the site output and keep only source documentation.

R31+ ship blockers (from active-debt-2026-04-28.md):

- **Q06 / M-U3 driving oracle**: real-device manual gate vs Playwright sim — pick one, signoff docs must align
- **Route-shell contract**: docs say "limited" but trade route still live-write — pick one
- **Holdings multi-level filter + detail pane (R141 #3)**: 4th time slipped past spec — must split to R141b filter / R141c pane
- **Release docs SHA refresh**: signoff/v1/cross-browser-matrix were stale at `509c3df`, refreshed by R32 to `30b5ae2`

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
