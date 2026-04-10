# Runtime Execution Plan

Last updated: 2026-04-10
Status: active
Owner: Codex main session

## Read-First Rule

- Read this file before any substantial project work in this repo.
- Treat this file as the live execution ledger for runtime stabilization and Agent Bridge orchestration.
- When a step is completed, convert it to strikethrough instead of deleting it.
- When scope changes or new work appears, append it to the relevant section in this file.
- Major architecture or workflow decisions must go through multi-LLM consensus before implementation.

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

## Completed

- ~~Aligned local dev runtime to `127.0.0.1:3002` and added a runtime-entry guard so `src/main.jsx` cannot silently drift away from `src/App.jsx`.~~
- ~~Updated quick-start documentation so `App.routes.jsx` is clearly described as migration-only, not the current production runtime.~~
- ~~Fixed compact knowledge-base injection for the event-review holding dossier path and added regression coverage.~~
- ~~Added a shared, read-only `operating context` so holdings, watchlist, events, news, daily analysis, and research now show the same top-level portfolio narrative.~~
- ~~Wired Events and News empty-state CTA flows into the daily-analysis tab without auto-triggering new API work.~~
- ~~Verified the current wave with targeted test coverage, lint, build, and UI smoke on the canonical local runtime.~~

## Active Execution Waves

## Active Delegation

- Codex:
  - owner: live runtime coherence and containment integration
  - current task: expand from Wave 2 into Wave 3 by identifying the smallest route-shell containment guard that does not widen product scope
- Claude:
  - owner: route-shell architecture audit
  - latest useful output: choose isolation over fake parity; add route-shell markers and warnings before doing any shared-language convergence
  - status: temporarily occupied by user-driven work outside this lane; latest usable vote already captured
- Qwen:
  - owner: route-shell test gap audit
  - current task: identify route tests that only validate route-local state / localStorage without proving any main-runtime propagation
  - latest useful output: priority gap is `daily -> shared`, followed by `news review -> shared events`, then `research history / analyst reports -> shared runtime`
- Gemini:
  - owner: non-blocking user blind-spot lane
  - status: blocked by quota exhaustion; not on the critical path for the current batch

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

Wave 3 early findings:

- route pages reuse the same panel components as the live AppShell, but the route hooks do not supply the shared `operatingContext` or the main `PortfolioPanelsProvider` data/action layer
- route-page actions currently write through route-local context plus localStorage, so they can appear functional without proving any propagation back to the live AppShell runtime
- existing route tests focus on local storage persistence and mocked callbacks, not cross-runtime truth

### Wave 3: Route-Shell Containment

Goal: prevent migration code from masquerading as live runtime.

1. List route-shell state and action paths that can diverge from the main AppShell runtime.
2. Identify which route tests validate only local storage or local context, not real propagation.
   ~~3. Add machine guards that prevent accidental promotion of `src/App.routes.jsx`.~~
3. Downgrade or isolate route-only behavior until parity is real.

Definition of done:

- Route migration code cannot be mistaken for the canonical runtime, either by docs, scripts, or code entrypoints.

Wave 3 progress:

- route portfolio layout now renders a visible migration-shell notice instead of silently masquerading as another finished runtime
- route portfolio layout root now carries `data-route-shell="true"` for browser tracing and machine checks
- local dev now emits a route-shell warning when that layout mounts, making accidental work in the wrong runtime easier to notice
- `scripts/check-runtime-entry.mjs` now guards the route-shell warning markers in addition to the canonical entrypoint rules
- `tests/routes/portfolioLayout.routes.test.jsx` now verifies the route-shell marker and warning behavior

### Wave 4: Operability and Perceived Stability

Goal: remove the “the page looks broken when it opens” feeling.

1. Trace the current startup path responsible for the long `載入中...` phase.
2. Distinguish between:
   - real runtime slowness
   - avoidable initialization work
   - weak loading UX
3. Run a consensus round on the smallest safe fix:
   - performance first
   - loading experience first
   - or a mixed approach
4. Implement the smallest stabilization patch and re-measure.

Definition of done:

- Opening the app no longer creates the immediate impression that it is stuck or half-broken.

### Wave 5: Agent Bridge Dispatcher Upgrade

Goal: turn Agent Bridge into a real orchestration layer for multi-LLM collaboration.

1. Introduce a task model on top of sessions:
   - `task_id`
   - `owner`
   - `write_scope`
   - `depends_on`
   - `status`
   - `evidence`
2. Make the shared execution brief part of the dispatch protocol.
3. Add a consensus gate before major runtime or architecture changes.
4. Add a verify gate requiring:
   - changed files
   - risks
   - verification run
   - next step
5. Update `docs/vscode-agent-bridge/README.md` and related docs to reflect the dispatcher model instead of terminal-only control.

Definition of done:

- Multi-LLM work is coordinated through explicit tasks, shared context, consensus checkpoints, and verification evidence.

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
