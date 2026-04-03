Generate a Vitest test file for the currently open file.

Rules:

- Test file goes in `tests/` mirroring the source path (e.g., `src/lib/foo.js` → `tests/lib/foo.test.js`)
- Import from vitest: `{ describe, it, expect, vi, beforeEach }`
- For hooks: use `renderHook` from `@testing-library/react`
- Mock external dependencies with `vi.fn()` — pass them as function parameters
- Test names in English, comments in Traditional Chinese if needed
- Cover: normal case, edge cases, error handling
- Do NOT import from node_modules internals
