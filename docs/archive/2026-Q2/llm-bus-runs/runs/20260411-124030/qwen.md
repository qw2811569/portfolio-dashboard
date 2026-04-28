Now I have enough context. The T0/T1 staged daily review has landed: reports have `analysisStage`, `analysisVersion`, `finmindConfirmation`, and there is already an `AnalysisStageCard` showing the stage badge. But there is no diff between versions and no history picker yet.

CHOICE: A
WHY: Users already have T0 and T1 versions stored in `analysisHistory` with `analysisVersion` tracking, so the smallest trust-building patch is an inline diff card in `DailyReportPanel` that surfaces what changed between the current same-day report and the previous version without adding new navigation or API work. A history picker is larger scope and badge-only is already partially covered by the existing stage card but still does not answer what actually changed.
RISKS: diff text may be noisy if reports are long and needs careful summarization, edge case when no previous version exists, must not trigger new API calls
TESTS: unit test for diff extraction logic, test for inline diff card rendering with T0 -> T1 pair, test for graceful fallback when only one version exists, regression test on `DailyReportPanel`
