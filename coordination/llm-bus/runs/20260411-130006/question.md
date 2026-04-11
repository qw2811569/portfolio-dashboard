# Question

Read `coordination/llm-bus/runtime-execution-plan.md` and `coordination/llm-bus/runtime-stabilization-brief.md` first.

Now that same-day T0/T1 diff is visible, what is the smallest safe automatic T1 trigger?

Choose exactly one of:

- `A)` when `DailyReportPanel` mounts with a same-day preliminary report, do one cooldown-gated FinMind probe; if all pending daily datasets are now confirmed, auto-run the confirmed rerun
- `B)` start a background timer/poller after every T0 and keep probing until confirmation arrives
- `C)` no auto-run, only show a stronger ready cue

Reply in this exact format only:

```text
CHOICE: <A|B|C>
WHY: <2 short sentences>
RISKS: <comma-separated short list>
TESTS: <comma-separated short list>
```
