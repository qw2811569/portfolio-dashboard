# STALE-AUDIT · 2026-04-19

基準：

- `docs/` 共 106 份 markdown
- Canonical：43
- Non-canonical：63

## To DELETE (5 files)

- `research/portfolio-olive-impl-brief.md` · 一次性 shipped brief；新 palette 已由 SA/SD + theme tokens 承接
- `research/design-palette-completion-brief.md` · 一次性補完 brief；不再是設計真相
- `research/vm-utilization/round1/codex-brief.md` · 只是一輪提問 brief，無 current truth
- `research/vm-utilization/round1/gemini-brief.md` · 同上
- `research/vm-utilization/round1/qwen-brief.md` · 同上

## To MERGE (5 files)

- `PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md` → `specs/2026-04-18-portfolio-dashboard-sa.md`
- `2026-03-23-target-collection-strategy.md` → `2026-04-16` 目標價來源 ADR
- `2026-04-15-target-price-pipeline-fix.md` → `2026-04-16` 目標價來源 ADR
- `decisions/README.md` → `decisions/index.md`
- `2026-03-24-holding-dossier-and-refresh-architecture.md` → `decisions/2026-04-18-appshell-state-ownership.md`

## To KEEP-AS-MIRROR (2 files)

- `docs/portfolio-spec-report/sa.md` · duplicate mirror of `docs/specs/2026-04-18-portfolio-dashboard-sa.md`; `sa.html` 直接載入
- `docs/portfolio-spec-report/sd.md` · duplicate mirror of `docs/specs/2026-04-18-portfolio-dashboard-sd.md`; `sd.html` 直接載入

## To ARCHIVE (51 files)

### Root / General

- `6862-verification-report.md`
- `AI_COLLABORATION_DISCUSSION.md`
- `MY_TW_COVERAGE_ANALYSIS.md`
- `PROMPT_TEMPLATES.md`
- `THREE_KEY_POINTS_DISCUSSION.md`
- `USER_GUIDE_COMPLETE.md`
- `deployment-and-api-strategy.md`
- `finmind-business-case.md`
- `phase0-implementation.md`
- `podcast-6862-三集瑞-KY-thread版.md`
- `podcast-6862-三集瑞-KY-深度分析.md`
- `stock-selection-strategy.md`
- `threads-3013-晟銘電-主力進場.md`

### Decisions / Historical

- `docs/decisions/2026-04-15-no-gemini-data-scraping.md`

### Gemini / Planning

- `docs/gemini-research/README.md`
- `docs/plans/2026-03-23-multi-portfolio-event-tracking-implementation-plan.md`
- `docs/plans/2026-03-28-phase-a-data-foundation.md`
- `docs/plans/2026-03-29-phase-b-workflow-upgrade.md`
- `docs/plans/2026-03-29-phase-c-morning-note.md`

### Product / Report History

- `docs/portfolio-spec-report/spec.md`
- `docs/product/portfolio-dashboard-spec.md`

### Research

- `docs/research/agent-bridge-pm-design-review.md`
- `docs/research/cloudflare-setup-guide.md`
- `docs/research/gemini-vm-migration-blindspot.md`
- `docs/research/infra-03-vm-orchestrator-brief.md`
- `docs/research/morning-brief-2026-04-16.md`
- `docs/research/taiwan-stock-data-sources-v2.md`
- `docs/research/vm-full-migration-brief.md`
- `docs/research/vm-utilization/claude-baseline.md`

### Older Specs

- `docs/specs/2026-03-23-multi-portfolio-event-tracking-design.md`
- `docs/specs/2026-03-24-claude-tw-stock-analysis-tooling-guide.md`
- `docs/specs/2026-03-24-client-report-production-playbook.md`
- `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md`
- `docs/specs/four-persona-analysis-design.md`
- `docs/specs/streaming-analysis-design.md`

### Status / Historical Snapshots

- `docs/status/PROJECT_ENTRY.md`
- `docs/status/auto-evolve-tasks.md`
- `docs/status/auto-loop-result.md`
- `docs/status/backtest-plan.md`
- `docs/status/backtest-results.md`
- `docs/status/design-review-2026-04-04.md`
- `docs/status/feature-implementation-plan.md`
- `docs/status/knowledge-gap-report.md`
- `docs/status/llm-capability-review-2026-04-03.md`
- `docs/status/loop-conversation.md`
- `docs/status/product-review-2026-04-04.md`
- `docs/status/session-handoff-2026-04-02-v2.md`
- `docs/status/session-summary-2026-04-04.md`
- `docs/status/todo-live.md`

### Other Historical Design / Test Artifacts

- `docs/superpowers/specs/2026-03-31-kb-evolution-design.md`
- `docs/testing/FUNCTIONAL_TEST_REPORT.md`

## Coordination / Memory Notes

- `coordination/llm-bus/board.md` · stale; Gemini role 與主線分工落後於 2026-04-15 decision
- `coordination/llm-bus/runs/20260411-*/consensus.md` · historical run artifacts；已收斂進 `docs/decisions/2026-04-11-staged-daily-analysis.md`
- `memory/*.md` · 不動；目前只有到 2026-04-13，index 不新

## Recommended Archive Target

- `docs/archive/2026-Q2/`
- 子分類建議：
  - `product-history/`
  - `research-history/`
  - `status-history/`
  - `planning-history/`
  - `single-stock-cases/`
