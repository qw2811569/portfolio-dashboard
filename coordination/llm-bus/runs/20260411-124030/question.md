# Question

Read `coordination/llm-bus/runtime-execution-plan.md` and `coordination/llm-bus/runtime-stabilization-brief.md` first.

After staged daily review already landed, what is the smallest next patch to make T0 vs T1 trustworthy to users?

Choose exactly one of:

- `A)` inline diff card in `DailyReportPanel` comparing current same-day report vs previous same-day version
- `B)` history picker first, then diff on demand
- `C)` badge-only summary with no detailed diff yet

Reply in this exact format only:

```text
CHOICE: <A|B|C>
WHY: <2 short sentences>
RISKS: <comma-separated short list>
TESTS: <comma-separated short list>
```
