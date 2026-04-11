CHOICE: A
WHY: The staged labels already landed, so users can see T0 vs T1 exist, but without a visible delta they cannot judge whether the rerun was meaningful or a no-op. An inline diff card closes that trust gap at the exact moment the user is already looking at the report, with no extra navigation.
RISKS: null-state when T1 hasn't run yet, noisy field-level diffs that read as churn rather than signal, both versions must be accessible in DailyReportPanel render scope without a new fetch
TESTS: diff card renders when analysisHistory has both t0-preliminary and t1-confirmed for the same date, diff card is absent when only T0 exists, diff card triggers zero API calls on mount, delta correctly highlights changed fields between the two stage objects
