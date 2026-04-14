# Runtime Execution Plan

Last updated: 2026-04-11
Status: active
Owner: Codex main session

## Read-First Rule

- Read this file before any substantial project work in this repo.
- Treat this file as the live execution ledger for runtime stabilization and Agent Bridge orchestration.
- When a step is completed, convert it to strikethrough instead of deleting it.
- When scope changes or new work appears, append it to the relevant section in this file.
- Major architecture or workflow decisions must go through multi-LLM consensus before implementation.
- Multi-LLM delegation is the default, not an optional reminder: each meaningful wave should open Codex + Claude + Qwen lanes, and Gemini too when quota is available.

## Mission

Make the project feel like one coherent operating system instead of disconnected pages:

- pages should share the same runtime truth
- page-to-page actions should follow one workflow chain
- state updates should propagate across the main AppShell
- route-shell migration code must not pollute or replace the live runtime
- API work should only happen when it is truly needed
- Agent Bridge should evolve from a terminal bus into a disciplined dispatcher

## Ground Truth

- Canonical runtime entry: `src/main.jsx -> src/App.jsx`
- Canonical live runtime: `useAppRuntime -> AppShellFrame -> PortfolioPanelsProvider -> AppPanels`
- Route migration shell: `src/App.routes.jsx` and `src/pages/*`
- Canonical local origin: `http://127.0.0.1:3002`
- Canonical code truth: live repo, not handoff docs
- Machine-readable task queue: `coordination/llm-bus/agent-bridge-tasks.json`

## Completed

- ~~Aligned local dev runtime to `127.0.0.1:3002` and added a runtime-entry guard so `src/main.jsx` cannot silently drift away from `src/App.jsx`.~~
- ~~Updated quick-start documentation so `App.routes.jsx` is clearly described as migration-only, not the current production runtime.~~
- ~~Fixed compact knowledge-base injection for the event-review holding dossier path and added regression coverage.~~
- ~~Added a shared, read-only `operating context` so holdings, watchlist, events, news, daily analysis, and research now show the same top-level portfolio narrative.~~
- ~~Wired Events and News empty-state CTA flows into the daily-analysis tab without auto-triggering new API work.~~
- ~~Verified the current wave with targeted test coverage, lint, build, and UI smoke on the canonical local runtime.~~
- ~~Removed the old `docs/mac-mini-handoff/` bundle from the live workspace once its design intent had been distilled into the plan and brief, so future sessions cannot read stale handoff files as runtime truth.~~
- ~~Introduced staged daily-analysis labeling so same-day reports now distinguish `收盤快版` from `資料確認版`, and same-day confirmation reruns can bypass stale FinMind cache without overwriting history.~~
- ~~Added an inline same-day diff card so the daily panel can compare current T1 output against the previous same-day version from `analysisHistory` without extra navigation or API work.~~
- ~~Added a cooldown-gated automatic T1 probe so opening the daily panel can auto-check FinMind readiness and auto-rerun a same-day confirmed report only when the pending datasets are actually available.~~

## Active Execution Waves

## Active Delegation

- Codex:
  - owner: live runtime coherence and containment integration
  - current task: Wave 4 startup trace and integration
- Claude:
  - owner: architecture / consensus lane
  - default responsibility: every major wave must ask Claude for boundary/tradeoff review before landing the patch
- Qwen:
  - owner: verification / mechanical gap lane
  - default responsibility: every major wave must ask Qwen for test gap / regression / local-state risk review
- Gemini:
  - owner: user blind-spot / entry confusion lane
  - default responsibility: every major wave should ask Gemini for user-feel blind spots when quota is available; if blocked, mark explicitly and continue

### Wave 1: Cross-Page Propagation Guard

Goal: prove that shared context reflects real shared state, not parallel local views.

~~1. Map the main AppShell shared truth boundaries in:~~

- `src/hooks/useAppRuntime.js`
- `src/hooks/useAppRuntimeWorkflows.js`
- `src/hooks/usePortfolioPanelsContextComposer.js`
  ~~2. Select the first propagation chain to protect:~~
- preferred candidates: `events -> daily`, `news -> daily`, `daily -> research`, `research -> holdings narrative`
  ~~3. Run a consensus round:~~
- Claude: which chain best represents runtime coherence
- Qwen: which chain is most testable and least ambiguous
- Gemini: which chain users will immediately feel when it breaks
  ~~4. Add propagation-oriented tests proving that one panel action updates shared truth used by another panel.~~
  ~~5. Re-run:~~
- `bun run lint`
- targeted `vitest`
- `bun run build`
- `APP_URL=http://127.0.0.1:3002 bun run smoke:ui`

Definition of done:

- ~~We can point to at least one panel action whose effects are proven to surface in another panel through the main runtime, not local-only state.~~

Wave 1 result:

- selected `daily -> holdings/research narrative` as the first guarded propagation chain
- protected it with a component-level runtime harness in `tests/components/AppPanels.contexts.test.jsx`
- proved that `runDailyAnalysis` can update shared truth consumed by other main AppShell panels without adding new API work

### Wave 2: Workflow Coherence Across Pages

Goal: make the app feel like one operating flow instead of separate screens.

1. Normalize CTA language and intent across holdings, events, news, daily, and research.
   - completed substep: removed the misleading `先研究這檔` CTA from `ResearchPanel -> DataRefreshCenter` so stale-data guidance no longer jumps straight into deep research
2. Ensure each page exposes the next meaningful step in the same workflow chain.
   - completed substep: `DailyReportPanel` now exposes a navigation-only `前往深度研究` CTA after analysis results are available
3. Keep derived summary logic centralized in `usePortfolioPanelsContextComposer`.
4. Run a consensus round on API-trigger rules:
   - which actions should navigate only
   - which actions may trigger analysis or refresh
5. Add UI-level coherence tests for tab switching and continuity of narrative.

Definition of done:

- A user can move between the main portfolio pages and consistently understand what the current situation is, what the next step is, and why.

Wave 2 progress:

- made `ResearchPanel -> DataRefreshCenter` CTA intent honest by removing a misleading deep-research action from the stale-data lane
- added a navigation-only daily -> research handoff CTA so users do not have to infer the next step after daily analysis
- expanded `tests/components/AppPanels.contexts.test.jsx` to guard both coherence fixes
- canonical `Header` now reuses the shared `operatingContext` as a navigation-only workflow cue, so the app shell itself tells the user what the next step is and which tab to open
- `tests/components/Header.test.jsx` now proves the workflow cue only calls `setTab(...)` and does not trigger API work
- `DailyReportPanel` now soft-routes the user back into `新聞追蹤 / 復盤` when live events are already due for review, while still keeping a manual `仍要分析` escape hatch
- `tests/components/AppPanels.contexts.test.jsx` now proves the review guard navigates to the exact pending event instead of blindly burning a new daily-analysis call
- daily analysis now records `analysisStage / analysisVersion / finmindConfirmation`, so users can see whether they are reading a same-day fast close read or a confirmed FinMind-backed rerun
- same-day reruns now bypass the local FinMind cache when the previous report is not yet confirmed, and `analysisHistory` keeps both T0/T1 versions instead of collapsing them to one entry per date
- `DailyReportPanel` now shows an inline same-day diff card when a confirmed report has a previous same-day version, so users can see exactly what changed between `收盤快版` and `資料確認版`
- `src/lib/dailyReportDiff.js` now centralizes same-day version lookup plus whitespace-tolerant diff extraction, and the new tests prove the card appears only when a real same-day pair exists
- opening the daily panel with a same-day `收盤快版` now performs one cooldown-gated FinMind probe; if all pending daily datasets are available, the app auto-runs `資料確認版`
- the automatic rerun stays inside the daily panel surface, keeps the same-day diff visible, and avoids background polling or blind quota burn
- Wave 2 is now functionally closed for this stabilization lane: the page chain is coherent, same-day confirmation is explicit, and the T0/T1 upgrade path is both visible and automatic when data is ready

Wave 3 early findings:

- route pages reuse the same panel components as the live AppShell, but the route hooks do not supply the shared `operatingContext` or the main `PortfolioPanelsProvider` data/action layer
- route-page actions currently write through route-local context plus localStorage, so they can appear functional without proving any propagation back to the live AppShell runtime
- existing route tests focus on local storage persistence and mocked callbacks, not cross-runtime truth

### Wave 3: Route-Shell Containment

Goal: prevent migration code from masquerading as live runtime.

1. List route-shell state and action paths that can diverge from the main AppShell runtime.
2. Identify which route tests validate only local storage or local context, not real propagation.
   ~~3. Add machine guards that prevent accidental promotion of `src/App.routes.jsx`.~~
   ~~3. Downgrade or isolate route-only behavior until parity is real.~~

Definition of done:

- Route migration code cannot be mistaken for the canonical runtime, either by docs, scripts, or code entrypoints.

Wave 3 progress:

- route portfolio layout now renders a visible migration-shell notice instead of silently masquerading as another finished runtime
- route portfolio layout root now carries `data-route-shell="true"` for browser tracing and machine checks
- local dev now emits a route-shell warning when that layout mounts, making accidental work in the wrong runtime easier to notice
- `scripts/check-runtime-entry.mjs` now guards the route-shell warning markers in addition to the canonical entrypoint rules
- `tests/routes/portfolioLayout.routes.test.jsx` now verifies the route-shell marker and warning behavior
- `tests/hooks/useRouteDailyPage.test.jsx` now contains a negative-parity guard proving route daily still does not expose the main-runtime `operatingContext`
- route-shell notice now explicitly says some actions remain route-local and do not sync back to the main AppShell
- `tests/routes/routePages.actions.test.jsx` now proves route research writes local history without touching the shared reports store, reducing the illusion that route-shell actions propagate into the canonical runtime
- route-shell write mutators are now **behaviorally** isolated: 20 data-write actions across 6 `useRoute*Page` hooks (daily / holdings / news / research / trade / watchlist) are replaced with no-op wrappers that emit a dev-only `[route-shell] write blocked` warning instead of silently mutating localStorage or shared stores; view-state setters (expanded, filter, sort, review draft, trade upload staging) are kept route-local by design
- per-hook tests now assert: no localStorage write, no shared-store mutation, and dev-warning emission for each blocked mutator (`tests/hooks/useRoute*Page.test.jsx` + `tests/routes/routePages.actions.test.jsx`)
- Wave 3 Step 4 closes the header-level portfolio mutator gap: `createPortfolio`, `renamePortfolio`, and `deletePortfolio` in `useRoutePortfolioRuntime.js` are now `warnBlockedRouteWrite + return false` no-ops
- multi-LLM consensus (Codex + Qwen + Gemini) unanimous on blocking at mutator definition instead of at `submitPortfolioEditor/Delete` level, so no surface can bypass containment
- regression tests: `tests/hooks/useRoutePortfolioRuntime.test.jsx` asserts no setItem / removeItem / navigate on each mutator + dev warning + graceful `submitPortfolioEditor` degrade; `tests/routes/routePages.actions.test.jsx` now asserts the header modal/dialog UI flow emits the block warning and leaves `PORTFOLIOS_KEY` + combobox unchanged
- follow-up landed: `switchPortfolio`, `openOverview`, `exitOverview` now strip the `save(ACTIVE_PORTFOLIO_KEY / VIEW_MODE_KEY)` calls while keeping `navigate(...)` and emit dev-only `[route-shell] write blocked: <name>:<field>-save` warnings. Qwen and Gemini's concern about canonical session-state pollution is resolved; Codex's concern about route-shell URL switching is preserved (navigation still works because `routePortfolioId` is read from the URL param, not from `ACTIVE_PORTFOLIO_KEY`). Regression tests in `tests/hooks/useRoutePortfolioRuntime.test.jsx` assert no setItem on the blocked keys + navigate still fired + dev warning emitted + empty-id safe no-op.

### Wave 4: Operability and Perceived Stability

Goal: remove the “the page looks broken when it opens” feeling.

~~1. Trace the current startup path responsible for the long `載入中...` phase.~~
~~2. Distinguish between:~~

- real runtime slowness
- avoidable initialization work
- weak loading UX
  ~~3. Run a consensus round on the smallest safe fix:~~
- performance first
- loading experience first
- or a mixed approach
  ~~4. Implement the smallest stabilization patch and re-measure.~~

Definition of done:

- Opening the app no longer creates the immediate impression that it is stuck or half-broken.

Wave 4 result:

- added bootstrap-phase diagnostics in `usePortfolioBootstrap` so startup is measurable instead of anecdotal
- replaced the naked full-screen `載入中...` gate with a staged boot shell in `AppShellFrame`
- measured the real pre-ready bottleneck:
  - initial probe: `ready` around `4457ms`
  - culprit: `applyTradeBackfillPatchesIfNeeded()` blocking pre-ready for about `3093ms`
- ran a second consensus round with Claude / Qwen / Gemini on whether that maintenance step should move post-ready
- moved trade backfill out of the pre-ready gate and refreshed the live snapshot if it changed holdings or trade log
- re-measured after the patch:
  - `ready` dropped to about `2420ms`
  - diagnostics now show `trade-backfill-post-ready` with `changed: 1`
- verification passed:
  - `bunx vitest run tests/hooks/usePortfolioBootstrap.test.jsx tests/components/AppShellFrame.test.jsx tests/hooks/useRouteDailyPage.test.jsx tests/hooks/useAppRuntimeComposer.test.jsx`
  - `bun run lint`
  - `bun run build`
  - `bun scripts/ui-smoke.cjs`

### Wave 5: Agent Bridge Dispatcher Upgrade

Goal: turn Agent Bridge into a real orchestration layer for multi-LLM collaboration.

~~1. Introduce a task model on top of sessions:~~

- `task_id`
- `owner`
- `write_scope`
- `depends_on`
- `status`
- `evidence`
  ~~2. Make the shared execution brief part of the dispatch protocol.~~

~~3. Add a consensus gate before major runtime or architecture changes.~~
~~4. Add a verify gate requiring:~~

- ~~changed files~~
- ~~risks~~
- ~~verification run~~
- ~~next step~~
  ~~5. Update `docs/vscode-agent-bridge/README.md` and related docs to reflect the dispatcher model instead of terminal-only control.~~

Definition of done:

- Multi-LLM work is coordinated through explicit tasks, shared context, consensus checkpoints, and verification evidence.

Wave 5 progress:

- Agent Bridge now has a machine-readable task seed file at `coordination/llm-bus/agent-bridge-tasks.json`
- the VS Code extension now tracks task state alongside session state
- dashboard can now show a compact task board and dispatch a task to the recommended agent session
- task data can be listed, updated, dispatched, and re-synced through `/api/tasks*`
- Agent Bridge now supports a soft verify gate through `POST /api/tasks/:id/complete`
- completion evidence now carries changed files, verification runs, risks noted, and next step metadata
- completed tasks now surface `draft / 待共識 / 已驗證` style states in the dashboard instead of looking equally done
- major tasks can now declare `requiresConsensus`, collect explicit reviews through `/api/tasks/:id/consensus`, and show review chips in the dashboard
- generic `PATCH` / `task:update` can no longer bypass consensus fields directly
- downstream tasks now refuse to dispatch when a dependency is still waiting for consensus
- hard verify gate now enforces full completion evidence at **both** completion entry points (`PATCH /api/tasks/:id` and `POST /api/tasks/:id/complete`); returns HTTP 400 with `{ok:false, error, missing:[]}` when any of `changedFiles / verificationRuns / risksNoted / nextStep` is empty
- hard consensus gate now blocks `status="completed"` transitions when `requiresConsensus:true` and `consensusState !== 'approved'`; returns HTTP 409 with `{ok:false, error, reason}`
- both gates share the **`AGENT_BRIDGE_HARD_GATES`** env flag and **default OFF** — the existing soft `verificationState` chip derivation stays untouched; operator flips the env var to `1` to enable hardening after verifying nothing breaks
- `GET /api/status` now includes `hardGates: { enabled, envVar }` so operators can see at a glance whether hardening is live
- break-glass mechanism: unset the env var and restart the VS Code extension — no per-request bypass by design, so all overrides are auditable at the env layer
- new smoke script `docs/vscode-agent-bridge/scripts/hard-gate-smoke.cjs` exercises the validator (empty evidence rejected, full evidence passed, consensus 'none' rejected, consensus 'approved' passed)
- new end-to-end harness `docs/vscode-agent-bridge/scripts/hard-gate-e2e.cjs` boots the extension in a fake-vscode shim with `AGENT_BRIDGE_HARD_GATES=1`, starts the HTTP server on port 19527, and drives real HTTP requests through `/api/status`, `POST /api/tasks`, `POST /api/tasks/:id/complete`, `POST /api/tasks/:id/consensus` to assert end-to-end: `hardGates.enabled=true` surface, empty-evidence 400 with `missing[]`, full-evidence 200, consensus-required + not-approved 409 with `reason`, and approved + full-evidence 200 after the 2-reviewer quorum is met. Complements the unit-level `hard-gate-smoke.cjs` with integration coverage of the actual HTTP wiring.
- extension's `README.md` now has a dedicated "Hard Gates（選用強制門檻）" section documenting the opt-in behavior, both error shapes, the `/api/status` surface, and the emergency escape hatch

## Consensus Protocol

For every major decision:

1. Write the decision question into `coordination/llm-bus/runtime-stabilization-brief.md`.
2. Collect one response from each lane:
   - Claude: architecture and runtime boundary
   - Qwen: tests, consistency, mechanical risk
   - Gemini: user-facing blind spots and entry confusion
3. If answers materially conflict, run one more narrowing round before implementation.
4. Only then patch code.

## Verification Protocol

Minimum verification per wave:

- `bun run lint`
- targeted tests for touched runtime or components
- `bun run build`
- `APP_URL=http://127.0.0.1:3002 bun run smoke:ui`

If browser-feel is part of the wave, also capture a direct browser check against the running app.

## Notes For Future Sessions

- Do not treat handoff docs as live runtime truth.
- Do not let route-shell work expand until the main AppShell data flow is stable.
- Prefer main-runtime coherence over adding new features.
- If a new task does not clearly improve coherence, propagation, containment, operability, or orchestration, question whether it belongs in this lane.
- Keep `runtime-execution-plan.md` human-readable and `agent-bridge-tasks.json` machine-readable; they should describe the same active batch from different angles.

## Scope Changes

- 2026-04-13: ad hoc validation lane for `docs/podcast-6862-三集瑞-KY-深度分析.md`
  - goal: cross-check FinMind-verifiable claims (price, monthly revenue, quarterly statement figures, institutional flow, margin) before reusing the report as podcast/script source material
  - notable finding: `/api/finmind?dataset=institutional` had partial English-label support but still missed `Foreign_Dealer_Self` and had no regression test, so future scripts could undercount foreign flow when that bucket was non-zero
- 2026-04-13: ad hoc Yahoo intraday validation for 6862 `2026-04-13`
  - goal: verify a Qwen-produced "today limit-up replay" against live Yahoo Taiwan quote-page embedded chart data before reusing the narration in podcast / script copy
  - notable finding: the Yahoo page snapshot was fetched at `2026-04-13 11:52 CST`, while Taiwan cash equities close at `2026-04-13 13:30 CST`, so any phrasing like `收盤 198.5` / `全天成交量 1,431 張` was premature and should be treated as an intraday snapshot rather than end-of-day fact

## Scope Change Log

- 2026-04-14: Agent Bridge standalone dashboard visual redesign wave requested. Constraint: only edit `agent-bridge-standalone/dashboard/index.html` `<style>` block. Direction: move away from muted cream/paper palette toward a higher-contrast \*The End of the F*\*\*ing World* reading with stronger red/blue/night-road tension and less polite UI chrome.
- 2026-04-14: Agent Bridge dashboard needs a portfolio-product feature map inside the Project Panel, plus Project Panel compression / hierarchy cleanup for `390x844` portrait.
  - goal: make the admin bridge visually explain the actual portfolio dashboard product surface (`Overview / Holdings / Watchlist / Events / Daily / Research / Trade / Log / News`) without turning the panel into a long text dump
  - constraints: do not edit `server.mjs`, WebSocket flow, or existing HTML class/id hooks; prefer data embedded in `dashboard/index.html` because the standalone server does not currently expose arbitrary static JSON assets
  - planned shape: add a new product-map section with nine tab cards, shared `OperatingContextCard` visualization, compact dependency badges/legend, and stronger empty/hover/active states while keeping the existing `Work Division / Improvements / Roadmap` sections readable on mobile

### Wave 6: Agent Bridge Dashboard Product Map + Mobile Compression

Goal: make the dashboard explain the portfolio product at a glance while reducing scroll fatigue and improving hierarchy on phone screens.

1. Add a dedicated product-map surface to the Project Panel for the live portfolio dashboard tabs.
2. Compress Work Division / Improvements / Roadmap so the panel reads as a dense briefing instead of a long backlog dump.
3. Rebalance typography, spacing, empty states, and interactive feedback around the darker `TEOTFW` mood.
4. Verify the dashboard on desktop plus `390x844` portrait before handing off.

Definition of done:

- The Project Panel can answer three questions at a glance:
  - what the portfolio product contains
  - which parts are live / partial / planned
  - what data sources and shared context tie the tabs together
- Mobile portrait no longer feels like an endless stack of equally weighted cards.
