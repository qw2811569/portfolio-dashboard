# Runtime Stabilization Brief

Last updated: 2026-04-11
Status: active
Goal: make the project feel operable and coherent when the user opens the web app, instead of "loads but feels broken"

## Protocol

- Canonical code truth: live repo
- Canonical runtime entry: `src/main.jsx -> src/App.jsx`
- Route migration shell: `src/App.routes.jsx` + `src/pages/*` + `src/hooks/useRoute*`
- Do not treat handoff docs as runtime truth in this lane
- The old `docs/mac-mini-handoff/` bundle has been removed from the workspace after extracting its useful design intent, so future sessions cannot drift back to it
- Each LLM should read this file first, then answer only within its lane
- Claude lane: architecture, browser tracing, runtime boundary decisions
- Qwen lane: mechanical consistency, tests, local state / persistence gaps
- Gemini lane: user-entry blind spots, docs / scripts / startup confusion
- Codex lane: integrates findings and applies the smallest safe patch set

## Current Evidence

### Local verification

- `vercel dev` can serve the app at `http://127.0.0.1:3002/`
- `APP_URL=http://127.0.0.1:3002 bun run smoke:ui` passes
- earlier browser probe showed the homepage staying on `載入中...` for roughly 4.5-5.0 seconds before becoming interactive
- latest browser probe after the Wave 4 patch shows `ready` around `2420ms`
- After the main shell loads, primary tabs in the live AppShell runtime can switch:
  - `觀察股`
  - `事件`
  - `新聞追蹤`
  - `收盤分析`
  - `深度研究`
- AppShell already has a shared data/action layer through:
  - `PortfolioPanelsProvider`
  - `usePortfolioPanelsContextComposer`
- Recent stabilization work already landed:
  - Events and News empty-state CTA now navigate into the daily-analysis tab instead of dead-ending
  - a shared `operating context` card now appears in holdings / watchlist / events / news / daily / research
- Current continuity gap is no longer only visual:
  - we still need proof that panel actions propagate through shared runtime truth instead of only looking coherent

### Independent findings already collected

- Gemini:
  - entrypoint role confusion between `src/App.jsx` and `src/App.routes.jsx`
  - `package.json` used `3003` while `vite.config.js` / docs / healthcheck / smoke expect `127.0.0.1:3002`
  - `healthcheck.sh` behavior is optimized for `vercel dev`, not generic `npm run dev`
- Claude:
  - dual runtime problem: `App.jsx` uses `useAppRuntime`, while route migration keeps a separate `useRoutePortfolioRuntime`
  - migration gate is only a comment, not a machine guard
- Qwen:
  - route pages rely on route-local context and local storage writes, so they can appear to work while not updating the main runtime
  - existing route tests mostly validate modal flow + localStorage writes, not cross-runtime propagation

## Active Decision: Wave 3 Route-Shell Trust Cues

We needed to decide whether the next route-shell patch should disable behavior or tighten the negative-parity evidence around route-local actions.

### Decision result

- Claude:
  - chose stronger negative-parity guards over disabling behavior immediately
  - highlighted the route research action test as the sharpest edge because it looks like a successful end-to-end integration while proving only local storage writes
- Gemini:
  - not reliable this round because of quota/capacity churn
  - prior user-feel feedback still pointed at making limitations more visible, not more magical

### Applied result

- route-shell notice now explicitly warns that some actions stay route-local and do not sync back to the main AppShell
- route shell root now also carries `data-route-shell-limited="true"` for clearer machine/browser tracing
- `tests/routes/routePages.actions.test.jsx` now proves route research history stays route-local and does not touch the shared reports store
- verification passed:
  - `bunx vitest run tests/routes/portfolioLayout.routes.test.jsx tests/routes/routePages.actions.test.jsx`
  - `bun run lint`
  - `bun scripts/ui-smoke.cjs`

## Active Decision: Wave 5 Soft Verify Gate

We needed the smallest Agent Bridge patch that would make task completion less hand-wavy without breaking the current dispatcher flow.

### Decision result

- Qwen:
  - chose a soft verify gate instead of hard global enforcement
  - required completion evidence with changed files and verification runs, but recommended keeping generic `PATCH` available for draft / override paths

### Applied result

- Agent Bridge tasks now support:
  - `evidence.changedFiles`
  - `evidence.verificationRuns`
  - `evidence.risksNoted`
  - `evidence.nextStep`
  - `completedAt`
  - `consensusState`
- added `POST /api/tasks/:id/complete` and matching WebSocket `task:complete`
- dashboard now distinguishes open tasks from `草稿完成`, `待共識`, and `已驗證`
- verification passed:
  - `npm run compile` in `docs/vscode-agent-bridge`
  - `coordination/llm-bus/agent-bridge-tasks.json` parse check

## Active Decision: Wave 4 Startup Stabilization

We needed to decide whether to stop at loading UX polish, or to move the measured blocking maintenance step out of the pre-ready gate.

Measured facts:

- first startup trace:
  - `ready` around `4457ms`
  - `trade-backfill` step duration around `3093ms`
  - `load-snapshot` around `1ms`
  - `ensure-registry` near `0ms`
- this proved the bottleneck was `applyTradeBackfillPatchesIfNeeded()`, not snapshot loading

### Round 1: smallest safe patch

- Claude:
  - approved instrumentation + staged boot shell + route daily negative-parity guard as the smallest safe first patch
  - warned that maintenance work inside pre-ready must be measured explicitly, especially any network path
- Qwen:
  - approved the same patch
  - asked for a readiness-vs-cloud-sync test so the app can be considered usable before background sync finishes
- Gemini:
  - confirmed the first user-facing failure is the almost blank `載入中...` gate
  - supported a more explicit boot shell and said deeper perf surgery could wait for the next patch

### Round 2: move trade backfill post-ready?

- Claude:
  - approved moving `applyTradeBackfillPatchesIfNeeded()` out of the pre-ready gate
  - required a guard so cloud holdings adoption uses the refreshed snapshot after backfill, not stale pre-backfill holdings
- Qwen:
  - approved moving the maintenance step post-ready immediately
  - required a regression test for the `changed > 0` path, proving the live runtime refreshes after the patch
- Gemini:
  - approved landing the change now
  - noted the only user-facing risk is a brief moment of stale trade data before the background correction finishes

### Applied result

- added bootstrap diagnostics and a staged boot shell
- moved `applyTradeBackfillPatchesIfNeeded()` out of the pre-ready gate
- if the post-ready backfill changes persisted data, the live runtime now reloads the snapshot before cloud holdings adoption logic runs
- added regression coverage for:
  - staged boot shell rendering
  - bootstrap phase emission
  - route daily negative parity
  - post-ready backfill refresh on `changed > 0`
- verification passed:
  - `bunx vitest run tests/hooks/usePortfolioBootstrap.test.jsx tests/components/AppShellFrame.test.jsx tests/hooks/useRouteDailyPage.test.jsx tests/hooks/useAppRuntimeComposer.test.jsx`
  - `bun run lint`
  - `bun run build`
  - `bun scripts/ui-smoke.cjs`

## Active Questions

1. What is the smallest stabilization wave that improves operability without widening blast radius?
2. Which issues are user-facing right now vs. architecture debt that mainly pollutes future work?
3. What guard should prevent accidental promotion of the route shell before parity is real?
4. What is the smallest coherence wave that makes pages feel like one product without adding more API usage?

## Active Decision: Wave 1 Propagation Chain

We need to choose the first cross-page propagation chain to protect with tests and the smallest safe patch set.

Candidate chains:

- `A: daily -> holdings/research narrative`
  - action: `runDailyAnalysis`
  - shared truth: `dailyReport`
  - user-visible propagation: holdings / daily / research operating context should reflect the latest analysis insight
- `B: news review -> daily event context`
  - action: `submitReview`
  - shared truth: `newsEvents`
  - user-visible propagation: daily analysis should see reviewed event state instead of stale pending state
- `C: research refresh -> holdings/research readiness narrative`
  - action: `refreshAnalystReports` or `runResearch`
  - shared truth: analyst reports / research results / refresh backlog
  - user-visible propagation: research readiness and holdings narrative should converge on the same next step

Decision constraints:

- choose the smallest user-visible chain first
- prefer main AppShell runtime over route-shell paths
- do not add automatic API work just to prove linkage
- prefer a chain that can be protected with deterministic tests

### Decision Result

- Claude:
  - chose `A`
  - reason: `dailyReport` is a single-hop shared write that already fans into the shared `operatingContext`
- Qwen:
  - chose `A`
  - reason: it is the simplest deterministic chain with the clearest user-visible cross-page effect
- Gemini:
  - no usable vote this round
  - `gemini-2.5-flash` hit `QUOTA_EXHAUSTED`, which is non-blocking per board policy

### Applied Result

- selected `A: daily -> holdings/research narrative`
- added a propagation harness in `tests/components/AppPanels.contexts.test.jsx`
- the guard proves:
  - clicking `開始今日收盤分析` updates `dailyReport`
  - holdings and research panels then surface the new insight through the shared `operatingContext`
- verification passed:
  - `bunx vitest run tests/components/AppPanels.contexts.test.jsx`
  - `bun run lint`
  - `bun run build`
  - `APP_URL=http://127.0.0.1:3002 bun run smoke:ui`

## Active Decision: Wave 2 Workflow Coherence

We need the first workflow-coherence normalization that improves page logic without widening API usage.

Candidate fixes:

- `A: research data-refresh CTA honesty`
  - current issue: `ResearchPanel -> DataRefreshCenter` tells the user to补齊資料, but row CTA is `先研究這檔` and currently calls `onResearch('single', holding)`
  - concern: this jumps into deeper research before the data baseline is refreshed
- `B: daily -> research next step clarity`
  - current issue: after daily analysis finishes, the app updates shared narrative but does not clearly expose the next research step from the daily panel itself
  - concern: the workflow feels conceptually linked but operationally hidden
- `C: cross-page CTA language normalization`
  - current issue: `前往收盤分析`, `重新分析今日收盤`, `刷新公開報告`, `先研究這檔`, `前往復盤`, `前往結案` mix navigation, refresh, and analysis work without one clear vocabulary
  - concern: users cannot easily tell which buttons navigate and which ones trigger expensive work

Decision constraints:

- prefer the smallest user-visible fix first
- avoid adding new API behavior unless it removes a larger source of waste or confusion
- prefer honest CTA/action alignment over feature expansion

### Round 1

- Claude:
  - chose `B`
  - reason: daily analysis already updates the shared narrative, but the handoff into research is still operationally hidden
- Qwen:
  - chose `A`
  - reason: `資料更新中心` says "補資料" while its CTA triggers deep research and can waste API work
- Gemini:
  - no usable vote this round
  - `gemini-2.5-flash` hit `QUOTA_EXHAUSTED`

### Narrowing round

Given the user's explicit priorities:

- pages should feel logically connected
- API should not be wasted
- CTA wording should be honest

Result:

- Claude:
  - changed to `A`
  - reason: behavior deception is more urgent than an invisible next step
- Qwen:
  - stayed on `A`
  - reason: button text and actual action must align before deeper workflow polish

### Applied result

- selected `A: research data-refresh CTA honesty` as the first Wave 2 coherence fix
- removed the misleading `先研究這檔` action from `ResearchPanel -> DataRefreshCenter`
- kept report refresh on the existing top-level `刷新公開報告` button
- added explicit guidance telling the user to refresh report/data baseline before running stock or portfolio research
- verification passed:
  - `bunx vitest run tests/components/AppPanels.contexts.test.jsx`
  - `bun run lint`
  - `bun run build`
  - `APP_URL=http://127.0.0.1:3002 bun run smoke:ui`

## Active Decision: Daily -> Research Handoff Cue

After daily analysis completes, the shared narrative updates across pages, but the daily panel still lacks an explicit handoff into research.

Candidate fixes:

- `A: simple navigation CTA`
  - add a visible button in `DailyReportPanel` after analysis is available
  - behavior: `setTab('research')`
  - no new state, no new API
- `B: contextual next-step card`
  - add a richer card under the daily report using existing `operatingContext.nextActionLabel` and `nextActionReason`
  - behavior: may include one or more navigation-only actions
- `C: no new daily CTA yet`
  - rely on the shared `operatingContext` that already updates across pages
  - defer visible daily-panel handoff until more workflow pieces are aligned

Decision constraints:

- do not add automatic API work
- prefer an honest, low-blast-radius handoff
- improve operational continuity, not just aesthetics

### Round 1

- Claude:
  - no stable headless output in this round
  - prior Wave 2 reasoning still pointed at making the daily-to-research handoff more explicit
- Qwen:
  - chose `B`
  - reason: the daily panel should expose the next step with existing context and navigation only

### Applied result

- implemented the low-blast-radius handoff:
  - added a navigation-only `前往深度研究` CTA in `DailyReportPanel`
  - behavior uses the existing `setTab('research')`
  - no new state and no new API work
- verification passed:
  - `bunx vitest run tests/components/AppPanels.contexts.test.jsx`
  - `bun run lint`
  - `bun run build`
  - `APP_URL=http://127.0.0.1:3002 bun run smoke:ui`

## Active Decision: Header Workflow Cue

We needed the smallest next AppShell coherence patch after the daily/research handoff, under these constraints:

- avoid wasted API
- do not expand route-shell responsibility
- prefer canonical AppShell coherence over new infrastructure

### Decision result

- Claude:
  - chose a header-level workflow cue using existing derived state and navigation-only links
  - explicitly rejected route read-through as too close to widening the route shell
- Gemini:
  - chose the same header-level workflow cue
  - reason: smallest visible coherence win with no extra fetches
- Explorer lane:
  - confirmed the smallest safe path is to reuse `portfolioPanelsData.holdings.operatingContext` and thread a header-only `workflowCue` prop through the existing header composer path

### Applied result

- canonical `Header` now shows a slim workflow cue above the tab strip using the same shared `operatingContext` already visible in the panels
- the cue is navigation-only:
  - `前往補資料`
  - `前往事件`
  - `前往焦點標的`
  - `前往收盤分析`
  depending on the current shared runtime truth
- no new API work, stores, or route-shell logic were added
- verification passed:
  - `bunx vitest run tests/components/Header.test.jsx tests/hooks/useAppRuntimeHeaderProps.test.js tests/hooks/useAppRuntimeComposer.test.jsx`

## Active Decision: Agent Bridge Consensus Gate

We needed the smallest patch that would turn `consensusState` from a writable label into an actual coordination gate for major tasks.

### Decision result

- Claude:
  - wanted explicit multi-agent votes instead of a freely writable `consensusState`
  - warned that next-wave work should not dispatch while an upstream major task is still waiting for consensus
- Gemini:
  - wanted an explicit major-task approval mechanism, but without adding heavy infrastructure
- Explorer lane:
  - converged on:
    - `requiresConsensus`
    - `consensusReviews[]`
    - `POST /api/tasks/:id/consensus`
    - no direct consensus edits through generic PATCH / update routes

### Applied result

- Agent Bridge tasks can now declare `requiresConsensus`
- consensus is now derived from explicit `consensusReviews[]` instead of trusting caller-provided `consensusState`
- added `POST /api/tasks/:id/consensus` and matching WebSocket `task:consensus`
- dashboard now shows:
  - `共識 0/2`, `共識 1/2`, etc.
  - review chips like `claude ✓` or `qwen ✗`
  - `共識退回` when a review rejects the task
- downstream task dispatch now stops if a dependency is completed but still waiting for consensus
- verification passed:
  - `npm run compile` in `docs/vscode-agent-bridge`

## Active Decision: Review Backlog Guard Before Daily Analysis

We needed the next highest-leverage coherence fix after the header workflow cue, under these constraints:

- avoid wasted API
- make pages feel like one workflow instead of parallel screens
- prefer canonical AppShell runtime over route-shell work

Candidate directions were:

- header-level workflow stepper
- event/news review state feeding the daily-analysis entry point more explicitly
- further route-shell isolation

### Decision result

- Claude:
  - chose the event/news review -> daily-analysis guard
  - reason: the most expensive mistake left was still firing daily analysis while old events remained unreviewed
- Gemini:
  - chose the same guard
  - reason: it improves workflow continuity and avoids redundant API work more directly than a visual stepper
- Qwen:
  - no usable answer in time for this round
  - proceeded with Claude + Gemini agreement because the patch stayed inside the canonical AppShell and had low blast radius

### Applied result

- `DailyReportPanel` now derives live `needsReview` candidates from the same `buildDailyEventCollections(...)` logic used by the daily-analysis workflow
- when review backlog exists, the daily panel now:
  - shows a `待復盤事件` warning card
  - routes `先前往復盤` into the `新聞追蹤` tab and expands the exact pending event
  - keeps a manual `仍要分析` / `仍要重新分析` escape hatch instead of hard-blocking the user
- this makes the expensive workflow more honest:
  - review first when context is stale
  - analyze anyway only as an explicit override
- verification passed:
  - `bunx vitest run tests/components/AppPanels.contexts.test.jsx tests/lib/dailyAnalysisRuntime.test.js`
  - `bun run lint`
  - `bun run build`
  - `bun scripts/ui-smoke.cjs`

## Proposed Wave A

## Active Decision: Route-Shell Parity Illusion

We need to decide whether the next smallest Wave 3 patch should make route pages look more like the main runtime, or make the migration boundary more explicit.

Candidate fixes:

- `A: isolate route shell more clearly`
  - add machine-readable markers and a user-facing migration notice
  - keep route shell visibly non-canonical while the data boundary is still separate
- `B: reuse operating-context language inside route hooks`
  - make route pages look more like the main runtime without adding API calls
  - risk: route pages feel coherent while still using a different truth boundary

Decision constraints:

- do not widen route-shell product scope
- do not make parity look more real than it is
- prefer guardrails over cosmetic convergence when the runtime boundary is still split

### Round 1

- Claude:
  - chose `A`
  - reason: route hooks still read route-local truth, so making them look more like the main runtime would strengthen the illusion of parity before the boundary is real
- Qwen:
  - prior audit aligned with `A`
  - reason: route tests currently prove local storage and route-local writes, not main-runtime propagation
- Gemini:
  - no usable vote this round
  - blocked by `QUOTA_EXHAUSTED`

### Applied result

- selected `A: isolate route shell more clearly`
- added a visible migration-shell notice in `src/pages/PortfolioLayout.jsx`
- added `data-route-shell="true"` for browser tracing and machine checks
- added a dev-only console warning so route-shell usage is explicit during local work
- expanded `scripts/check-runtime-entry.mjs` so route-shell warning markers are part of the guardrail
- added route-layout test coverage in `tests/routes/portfolioLayout.routes.test.jsx`
- verification passed:
  - `bunx vitest run tests/routes/portfolioLayout.routes.test.jsx`
  - `bun run check:runtime-entry`
  - `bun run lint`
  - `bun run build`
  - `APP_URL=http://127.0.0.1:3002 bun run smoke:ui`

- align canonical local dev port/origin with `127.0.0.1:3002`
- keep `src/main.jsx -> src/App.jsx` as machine-checked truth
- clarify `App.routes.jsx` as migration-only in quick-start docs

## Claude Notes

- pending: use browser tracing / runtime inspection to identify any state reset or shell mismatch the user can actually feel today
- pending: choose Wave 1 propagation chain with architecture-first reasoning

## Qwen Notes

- completed:
  - current tests do not verify that route-page writes propagate back to the main `useAppRuntime` tree
  - Wave A still lacks a machine-enforced parity / promotion guard for `App.routes.jsx`
- pending:
  - choose the most deterministic Wave 1 propagation chain and minimum test shape
  - completed Wave 2 first fix by removing a misleading deep-research CTA from the data-refresh lane
  - completed the explicit daily -> research handoff with a navigation-only CTA
  - route-shell gap audit result:
    - `useRouteDailyPage` tests do not prove any propagation beyond route-local state and storage
    - `useRouteNewsPage` tests only prove `updateEvent` callback usage, not shared event truth
    - `useRouteResearchPage` tests only prove prop forwarding, not shared research/report truth

## Gemini Notes

- completed:
  - startup confusion is a real user-entry problem
  - port drift and runtime-role drift are immediate sources of "it feels broken"
  - the 6-second `載入中...` state should be tracked as a user-facing issue, not just a technical observation
  - even before fixing the latency itself, the app should present a clearer loading experience to reduce the feeling that it is broken
- pending:
  - choose which propagation break a user would notice first when switching between pages
  - still unavailable due to quota exhaustion during Wave 2 rounds

## Codex Integration Notes

- in progress:
  - align `package.json` dev port to `3002`
  - add a machine-readable runtime-entry guard
  - update `docs/QUICK_START.md` to reflect current runtime truth
  - completed a read-only, zero-API shared operating context in the main AppShell so holdings / watchlist / events / news / daily / research now show the same top-level portfolio narrative
  - completed empty-state CTA wiring for Events / News into the daily-analysis tab without auto-triggering API work
  - note: live E2E cannot always click those CTA buttons because the current seeded portfolio often has non-empty Events / News states; this path is currently protected by component tests
- next: choose the first propagation chain and add a regression guard proving that an action in one panel updates shared truth used by another panel
  - completed Wave 1 with the `daily -> holdings/research narrative` propagation guard
  - completed Wave 2 first fix by making `ResearchPanel -> DataRefreshCenter` CTA intent honest
  - completed the smallest daily -> research handoff cue with a navigation-only CTA
  - next: continue CTA-language normalization or move to Wave 3 route-shell containment once page-level coherence feels stable enough
  - local Wave 3 finding:
    - route pages render the same panel components as the live AppShell, but route hooks do not provide the shared `operatingContext`
    - this creates a high-risk illusion of parity because the UI looks similar while data truth is different
