# Qwen Task - P1 Diff Audit

You are Qwen in read-only / plan mode.

Goal: produce a precise diff audit between the live repo and `docs/mac-mini-handoff`, so the team can decide canonical truth before any fixes land.

## Files to compare

- `src/seedData.js`
- `src/data/companyProfiles.json`
- `src/lib/knowledgeBase.js`
- `src/lib/dossierUtils.js`
- `src/lib/knowledge-base/industry-trends.json`
- `src/lib/knowledge-base/fundamental-analysis.json`
- `src/lib/knowledge-base/news-correlation.json`

against

- `docs/mac-mini-handoff/07-source-code-changes/*`

## Also verify

- whether `docs/mac-mini-handoff/99-scripts/run-1717-pipeline.mjs` matches the live repo paths and assumptions
- whether `docs/mac-mini-handoff/00-START-HERE/READ-ME-FIRST.md` reflects the live repo reality or a separate branch/worktree reality

## Required output format

P1_DIFF_AUDIT

summary:

- <3-5 bullets max>

file_status:

- <path> :: same | drifted | missing_in_bundle | missing_in_repo

high_signal_diffs:

- <only meaningful behavior differences, not formatting noise>

canonical_recommendation:

- <which side should be treated as truth for this wave, and why>

blocking_risks:

- <up to 3 items>

next_best_step:

- <one concrete next step>

## Constraints

- read-only only
- do not propose big architecture changes
- focus on decision-enabling differences
