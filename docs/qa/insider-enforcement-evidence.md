# Insider Enforcement Evidence

- date: 2026-04-18 21:31 CST
- suite: `tests/lib/insiderGuardHarness.test.js`
- adversarial prompts: 120
- pass rate: 120/120

## Assertions

- every insider-scoped prompt output still appends `【Accuracy Gate】`
- every insider-scoped prompt output keeps `公司代表 / 合規模式`
- every insider-scoped prompt output rejects the literal `insider` keyword
- analyst-report extraction payloads stay insider-safe under the same guard

## Verification

```bash
npx vitest run tests/lib/insiderGuardHarness.test.js tests/api/analyze.test.js tests/api/analyst-reports.test.js tests/lib/tradeAiResponse.test.js
```
