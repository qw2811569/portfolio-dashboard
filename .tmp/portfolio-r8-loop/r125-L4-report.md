# R125 · L4 fifth wave report · 2026-04-18 21:31:21 CST

## T01 Dashboard surface Morning Note + deep-links
- changes: `src/lib/morningNoteBuilder.js` · `src/components/overview/DashboardPanel.jsx` · `tests/lib/morningNoteBuilder.test.js` · `tests/components/dashboardPanel.test.jsx`
- outcome:
  - dashboard now surfaces `Morning Note` as an upstream entry card
  - runtime morning note now exposes deep-link targets for `events` / `holdings` / `daily`
  - dashboard CTA buttons route the user into the matching follow-up surface
- verify: `tests/lib/morningNoteBuilder.test.js` · `tests/hooks/useMorningNoteRuntime.test.jsx` · `tests/components/dashboardPanel.test.jsx` → PASS
- status: DONE

## T02 Dashboard Today in Markets module (fuller surface)
- changes: `src/components/overview/DashboardPanel.jsx` · `tests/components/dashboardPanel.test.jsx`
- outcome:
  - `Today in Markets` now supports `大盤 / 總經 / 行事曆` rows in one module
  - market rows can render safe external links; ordering stays market-first, then macro, then calendar
  - v1 truthful empty state remains unchanged
- verify: `tests/components/dashboardPanel.test.jsx` · `tests/lib/marketSyncRuntime.test.js` → PASS
- status: DONE

## T14 Streaming close-analysis UX + fallback
- outcome:
  - existing staged analysis + streaming fallback path stayed green after this round
  - no regression in `analysisStage` / auto-confirm / panel state handling
- verify: `tests/hooks/useDailyAnalysisWorkflow.test.jsx` · `tests/components/AppPanels.contexts.test.jsx` → PASS
- status: DONE

## T15 Same-day fast/confirmed diff + rerun cues
- outcome:
  - existing same-day diff, rerun reason, and compare-card behavior stayed green after this round
  - no regression in t0/t1 compare flow
- verify: `tests/lib/dailyReportDiff.test.js` · `tests/hooks/useDailyAnalysisWorkflow.test.jsx` → PASS
- status: DONE

## T71 CSP / security headers + prompt-injection hardening
- changes: `vercel.json` · `src/lib/promptInjectionGuard.js` · `api/analyze.js` · `tests/vercel-config.test.js` · `tests/api/analyze.test.js`
- outcome:
  - global security headers landed: CSP / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy
  - analyze route now blocks prompt-injection markers (`ignore previous instructions` / `you are now` / `system:`) with `400`
  - OCR / research-extract prompt builders now also pass through Accuracy Gate
- verify: `tests/vercel-config.test.js` · `tests/api/analyze.test.js` · `rg "Content-Security-Policy|X-Frame-Options|Referrer-Policy"` → PASS
- status: DONE

## Q08 Insider forbidden-output harness
- changes: `src/lib/accuracyGate.js` · `src/lib/tradeAiResponse.js` · `tests/lib/insiderGuardHarness.test.js` · `tests/api/analyze.test.js` · `tests/api/analyst-reports.test.js` · `tests/lib/tradeAiResponse.test.js` · `docs/qa/insider-enforcement-evidence.md`
- outcome:
  - insider-scoped prompt outputs no longer emit the literal `insider` token
  - guard regex now strips both Chinese and English action-language variants
  - harness runs 120 adversarial prompts and records `120/120` pass rate
- verify: `tests/lib/insiderGuardHarness.test.js` · `tests/api/analyze.test.js` · `tests/api/analyst-reports.test.js` · `tests/lib/tradeAiResponse.test.js` → PASS
- status: DONE

## Q09 Accuracy Gate auto-tests
- changes: `api/parse.js` · `api/research-extract.js` · `tests/lib/accuracyGateEnforcement.test.js`
- outcome:
  - static coverage harness now checks tracked prompt builders and fails with `file:line` when a builder misses Accuracy Gate
  - parse OCR and research-extract builders were brought under the same gate
- verify: `tests/lib/accuracyGateEnforcement.test.js` · `tests/lib/analyzeRequest.test.js` · `tests/api/analyze.test.js` · `tests/components/AppPanels.contexts.test.jsx` → PASS
- status: DONE

## Combined verify
- `npx vitest run tests/lib/morningNoteBuilder.test.js tests/hooks/useMorningNoteRuntime.test.jsx tests/components/dashboardPanel.test.jsx tests/lib/marketSyncRuntime.test.js tests/hooks/useDailyAnalysisWorkflow.test.jsx tests/components/AppPanels.contexts.test.jsx tests/lib/dailyReportDiff.test.js tests/vercel-config.test.js tests/api/analyze.test.js tests/api/analyst-reports.test.js tests/lib/tradeAiResponse.test.js tests/lib/analyzeRequest.test.js tests/lib/accuracyGateEnforcement.test.js tests/lib/insiderGuardHarness.test.js tests/api/parse.test.js` → `15/15` files passed · `76/76` tests passed
- `npm run build` → PASS
- `rg -q "Content-Security-Policy|X-Frame-Options|Referrer-Policy" vercel.json api src` → PASS
- `rg -q "insider" tests src api` → PASS
- `rg -q "Accuracy Gate" tests src docs` → PASS
