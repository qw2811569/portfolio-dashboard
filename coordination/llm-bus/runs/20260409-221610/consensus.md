# LLM Consensus - Wave 1

Timestamp: 2026-04-09 22:16 CST
Scope: decide the first work wave for making the project smoother and less bug-prone
Out of scope: optimizing the 1717 report content itself

## Inputs

- Codex local review:
  - `docs/mac-mini-handoff` and live repo have drift
  - `buildResearchHoldingDossierContext()` lacks knowledge injection
  - `tests/lib/knowledge-base.test.js` has no 1717 golden regression
  - Agent Bridge is transport, not a dispatcher yet
- Qwen Round 1 + Round 2:
  - accepted source-of-truth convergence as Priority 1
  - wants a concrete 1717 golden regression and a validation gate
  - wants Qwen sign-off before Codex starts building on the baseline
- Claude Round 1 + Round 2:
  - P1 = 1717 golden regression
  - P2 = source-of-truth drift
  - P3 = prompt contract / traceability
  - warns that regression baseline must be built only after canonical truth is fixed
- Gemini:
  - CLI usage understood
  - current lane blocked by repeated `429 RESOURCE_EXHAUSTED / MODEL_CAPACITY_EXHAUSTED`
  - downgraded to non-blocking scout lane for this wave

## Consensus

### Priorities

1. Converge source of truth first.
   - Audit live repo vs `docs/mac-mini-handoff`
   - Decide canonical truth before any baseline or merge work
2. Add hard guards after canonical truth is known.
   - 1717 golden regression
   - minimal closed-loop health gate
3. Fix research-path traceability.
   - start with `buildResearchHoldingDossierContext()` knowledge injection
   - do not jump to large factPack / dispatcher work yet

### Role split

- Claude: architecture arbiter, canonical-truth decision, prompt-contract quality bar
- Codex: minimal, verifiable fixes after baseline is stable
- Qwen: diff audit, regression definition, validation sign-off
- Gemini: non-blocking blind-spot scout when capacity returns

### Avoid this wave

- Do not optimize 1717 report content
- Do not refactor Agent Bridge into a full dispatcher
- Do not start Phase 3 factPack implementation
- Do not mix bug fixing with opportunistic feature work

## Execution rule for Wave 1

- Qwen completes P1 diff audit first
- Claude/Codex decide canonical truth based on that audit
- Only then start P2 regression / health gate
- Only after P2 baseline exists, start P3 research-path fixes

## Blocking note

- Gemini is not part of the blocking path for this wave because both `gemini-2.5-flash` and `gemini-3.1-flash-lite-preview` hit capacity errors during this session

## Canonical Truth Decision

### Round 1

- Claude:
  - `VERDICT: A live-repo`
  - rationale: live repo is the newer code path; handoff drift makes it a bad code base
- Qwen:
  - `VERDICT: A live-repo`
  - rationale: live repo is architecturally ahead; handoff should not become the baseline
- Gemini:
  - `VERDICT: B handoff`
  - rationale: from Gemini's role perspective, handoff is the right delivery surface for structured scout outputs

### Candidate synthesis after Round 1

- `code canonical = live-repo`
- `handoff canonical only as docs/input lane, not code snapshot`
- `1717 deltas are cherry-picked selectively from handoff into live-repo`
- `no bulk sync of the 7 handoff source files`

### Round 2

- Claude:
  - `VERDICT: accept`
  - added guard: do not cherry-pick line-by-line; group 1717 deltas by dependency cluster first
- Qwen:
  - `VERDICT: accept`
  - added risk: isolated 1717 cherry-picks may miss dependent changes
- Gemini:
  - Round 2 prompt attempts did not produce a stable final text in headless mode tonight
  - its Round 1 blind spot was incorporated into the candidate by splitting `code truth` from `docs / patch lane`

### Decision

- `CANONICAL CODE BASE = live-repo`
- `HANDOFF ROLE = documentation + patch/input source only`
- `MERGE RULE = no bulk sync of handoff code; only selective, dependency-aware cherry-pick of relevant deltas`

### Immediate implication

- Before any code changes:
  - define the candidate 1717 delta clusters
  - decide which clusters are still relevant to live repo
  - only then open the next implementation wave

## Next Implementation Wave Decision

### Candidate clusters

- `A` handoff hygiene
  - script paths
  - handoff entry docs
  - output-dir / portability cleanup
- `B` runtime correctness
  - research-path KB injection
  - regression guard
- `C` 1717 data patch
  - stock meta / company profile / KB item deltas

### Round 1

- Claude:
  - chose `B`
  - reason: if KB injection path is broken, `A` and `C` do not matter yet
- Qwen:
  - chose `B`
  - reason: fixes the most user-visible core-path bug first
- Gemini:
  - pairwise vote `A vs B` -> `B`
  - pairwise vote `B vs C` -> `B`

### Round 2 candidate

- next wave = `B` only
- sequence:
  1. define regression baseline
  2. implement minimal research-path KB injection
  3. defer `A` and `C`

### Round 2 notes

- Claude:
  - `adjust (minor)`
  - keep the sequence
  - define `minimal` in writing before implementation starts
  - baseline must cover the full research-path read pipeline, not only final prompt output
- Qwen:
  - no clean final text in headless mode; repeatedly attempted tool use even with tighter prompting
- Gemini:
  - no stable Round 2 final text tonight; headless behavior remained inconsistent after multiple short-prompt retries

### Working decision

- `NEXT WAVE = B runtime correctness`
- scope guard:
  - baseline first
  - `minimal KB injection` must be explicitly bounded before code edits
  - defer `A` handoff hygiene and `C` 1717 data patch until after baseline + injection are stable

## Runtime Path Re-scope

### New local fact finding

- main deep research API already injects KB and FinMind through `api/research.js -> buildResearchDossierContext()`
- `tests/api/research.test.js` already asserts the single-stock research prompt contains `知識庫參考`
- `buildResearchHoldingDossierContext()` is not used by main deep research API
- its live call path is `eventReviewRuntime -> reviewDossierContext -> buildEventReviewBrainUserPrompt()`
- current event-review tests only checked stock identity, not KB presence

### Revised Round 1

- Claude:
  - chose `A`
  - reason: the real correctness gap is event-review / brain writeback, not main research API
- Qwen:
  - chose `A`
  - reason: event-review path is user-facing and silently missing KB context
- Gemini:
  - vote was noisy / unstable this round
  - one attempt returned role-contaminated output
  - later attempts hit `429` / capacity issues

### Revised Round 2 candidate

- redefine `B` as `event-review correctness`
- sequence:
  1. keep main API baseline in place
  2. add event-review regression for KB presence
  3. apply the smallest possible KB fix only for the event-review path
  4. continue to defer docs/handoff hygiene and 1717 data patch

### Revised Round 2 result

- Claude:
  - `ACCEPT`
  - adjust: baseline should also capture the negative case so regression has a full frame
- Qwen:
  - `ACCEPT`
  - adjust: baseline should keep covering main API too, not only event-review
- Gemini:
  - `Accept`
  - risk: other research initiatives may be delayed

### Revised working decision

- `B = event-review correctness`, not main deep research API work
- main API remains unchanged in this wave
- required baseline lanes:
  - main API prompt still contains KB
  - event-review path gains explicit KB coverage

## Implementation Boundary Decision

### Confirmed call-path fact

- `buildResearchHoldingDossierContext()` currently has one live call site:
  - `eventReviewRuntime`
- that call site always uses `compact: true`

### Boundary Round 1

- Claude:
  - chose `A`
  - reason: helper-layer compact-only fix is the right abstraction with minimal blast radius
- Qwen:
  - chose `A`
  - reason: touch only the actually used branch and back it with tests
- Gemini:
  - no usable vote; `429 MODEL_CAPACITY_EXHAUSTED`

### Boundary decision

- implement at the helper layer
- change only the `compact` branch
- leave verbose branch unchanged for this wave
- protect with regression tests instead of widening the implementation scope
