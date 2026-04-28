# Gemini CLI Operating Notes

Date: 2026-04-09
Run: `20260409-221610`

## What works reliably

- Launch Gemini through `bash scripts/launch-gemini.sh`, not raw `gemini`
- The wrapper loads Node 24 via `nvm`, reads `~/.gemini/.env`, and uses cached credentials if available
- Stable headless pattern for consensus / review:

```bash
bash scripts/launch-gemini.sh \
  -m gemini-2.5-flash \
  --approval-mode plan \
  -p '你的短任務...' \
  -o text
```

- Session management works:

```bash
bash scripts/launch-gemini.sh --list-sessions
bash scripts/launch-gemini.sh --resume latest
```

## Model notes

- `gemini-2.5-flash`
  - Current best default for small blind-spot reviews
  - Confirmed working tonight in headless `plan` mode
- `gemini-3.1-flash-lite-preview`
  - Better kept as optional scout lane
  - Hit `429 MODEL_CAPACITY_EXHAUSTED` tonight

## Wrapper notes

- `scripts/launch-gemini.sh`
  - General-purpose wrapper
  - Best for controlled prompts, model selection, `plan` mode, JSON/text output
- `scripts/launch-gemini-research-scout.sh`
  - Best for the fixed "public research scout" role
  - In headless mode it always folds arguments into one task string and runs `--yolo --sandbox false`
  - Do not use it for strict consensus prompts or when you need tight flag control

## Prompting guidance

- Keep prompts short, single-purpose, and explicit about role boundaries
- Best ask shape:
  - ask for blind spots, missing checks, freshness risks, citation risks, or external-truth gaps
  - forbid architecture migration, final strategy judgment, or code ownership decisions
- Good example:

```text
只找我忽略的外部真值缺口。不要提架構，不要提 buy/sell，
只回覆 3 點：缺口、為什麼重要、最小驗證方式。
```

## Failure handling

- If Gemini returns `429`, downgrade it to a non-blocking lane for that round
- Record the missing Gemini vote in consensus notes instead of blocking the full decision
- Retry later with:
  - a smaller prompt
  - `gemini-2.5-flash`
  - a non-urgent scout task

## Current caveats

- CLI prints noisy hook warnings:
  - `Invalid hook event name: "Stop"`
  - `Invalid hook event name: "SubagentStart"`
  - `Invalid hook event name: "SubagentStop"`
  - `Invalid hook event name: "UserPromptSubmit"`
- These warnings did not block successful output tonight, but the hook config should be cleaned up later

## Dispatch rule for this project

- Use Gemini for:
  - blind-spot review
  - public-data freshness checks
  - citation quality review
  - external truth gaps that other coding-first LLMs may miss
- Do not use Gemini for:
  - canonical architecture selection
  - direct source-code ownership
  - final portfolio or trading decisions
