Gemini CLI needed one quota retry before producing a usable answer.

CHOICE: A
WHY: An inline diff provides immediate context for T0 vs T1 changes, which directly addresses trustworthiness without requiring additional user actions. It is the most direct way to show the difference.
RISKS: visual clutter, implementation complexity for precise diffing, potential for large diffs overwhelming the UI, performance impact on rendering
TESTS: unit tests for diffing logic, integration tests for rendering diff in DailyReportPanel, E2E tests for visual verification
