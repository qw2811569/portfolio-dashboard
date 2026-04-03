# Gemini Code Assist Styleguide

## Project Overview

This is a **Taiwan stock investment decision dashboard** (台股投資決策工作台).

- Stack: React 18 + Vite + Zustand + Vercel Serverless Functions
- Language: JavaScript (.js/.jsx), no TypeScript
- Module system: ESM (`"type": "module"` in package.json)
- All UI text and comments are in **Traditional Chinese (繁體中文)**
- Target market: Taiwan Stock Exchange (TWSE)

## Architecture

```
src/
  components/   — React UI components (.jsx), grouped by feature
  hooks/        — React hooks (useXxx.js), business logic lives here
  lib/          — Pure utility/runtime modules, no React dependency
  stores/       — Zustand stores (xxxStore.js), global state
  constants.js  — All app-wide constants and API endpoints
  seedData.js   — STOCK_META, INIT_TARGETS, default data
api/            — Vercel serverless functions (each file = one endpoint)
tests/          — Mirrors src/ structure (tests/lib/, tests/hooks/, etc.)
scripts/        — Shell scripts for automation, QA, deployment
docs/           — Architecture docs, status reports, specs
data/           — Static data (persona map, FinMind cache)
src/lib/knowledge-base/ — 600+ investment rules in 7 JSON files
```

### Key Patterns

- **hooks as business logic**: `useXxxWorkflow.js` files contain the core logic (analysis, research, event management). Components are thin UI wrappers.
- **Runtime modules**: `src/lib/xxxRuntime.js` files are pure functions that hooks call. They have NO React imports and are independently testable.
- **Stores**: Zustand stores in `src/stores/` — flat state, no nested reducers. Actions are defined inline in `create()`.
- **API routes**: `api/*.js` are Vercel serverless functions. They export a default `handler(req, res)`. Use `req.method`, `req.body`, `req.query`.

## Coding Conventions

### JavaScript Style

- **No TypeScript** — this project uses plain JS with JSDoc where needed
- **ES modules only** — use `import/export`, never `require()`
- **`const` by default**, `let` only when reassignment is needed, never `var`
- **Arrow functions** for callbacks and short functions
- **Named exports** preferred over default exports (except API routes and React components)
- **Destructuring** for function parameters and imports
- **Template literals** over string concatenation
- **Optional chaining** (`?.`) and nullish coalescing (`??`) encouraged
- Unused variables: prefix with `_` (e.g., `_unused`)

### Naming

- Files: `camelCase.js` for lib/hooks, `PascalCase.jsx` for components
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- React components: `PascalCase`
- Hooks: `useXxx`
- Stores: `useXxxStore` (Zustand convention)
- Test files: mirror source path, e.g., `tests/lib/personaEngine.test.js`
- Knowledge base IDs: `xx-NNN` format (e.g., `fa-047`, `ta-012`, `it-051`)

### React Patterns

- Functional components only, no class components
- `useCallback` for functions passed as props or in dependency arrays
- `useState` for local state, Zustand for shared state
- No prop-types (disabled in ESLint)
- No `React.` prefix needed (auto-import JSX transform)

### Error Handling

- API routes: return `{ error: "message" }` with appropriate HTTP status
- Hooks: use try/catch, surface errors via state (e.g., `setError(msg)`)
- Never swallow errors silently — at minimum `console.error()`
- User-facing messages in Traditional Chinese

### Testing (Vitest)

- Test framework: Vitest + @testing-library/react
- Test files go in `tests/` (not `__tests__/`)
- Mock pattern: pass dependencies as function parameters for easy testing
- Hooks use `renderHook()` from `@testing-library/react`
- Run: `npx vitest run` (all), `npx vitest run tests/lib/xxx.test.js` (single)
- Current: 71 test files, 369 tests passing

## Domain Knowledge

### Four-Persona System

The analysis engine uses 4 investor personas based on time horizon:

- **scalper** (極短線客): 1-2 weeks, technical analysis, warrants
- **swing** (波段手): 1-2 months, chip analysis, institutional flow
- **trend** (趨勢者): 3-6 months, fundamental + growth, earnings
- **value** (價值者): 1-5 years, ROE, cash flow, dividends

Key files: `src/lib/personaEngine.js`, `data/persona-knowledge-map.json`

### Analysis Framework

6 analysis modes: event-driven, cyclical, compounder, turnaround, income, balanced.
Each stock is assigned a mode based on its characteristics in `STOCK_META`.

Key file: `src/lib/analysisFramework.js`

### Data Flow

```
FinMind API (paid) → api/finmind.js → dossierByCode (Map)
                                         ↓
Holdings + Dossiers + Events → useDailyAnalysisWorkflow → api/analyze → Claude AI
                                         ↓
                              Analysis Results → UI (NewsPanel, OverviewPanel)

Holdings + Dossiers → useResearchWorkflow → api/research → Claude AI (multi-round)
                                         ↓
                              Research Results + Brain Proposal → UI (ResearchPanel)
```

### Knowledge Base

- 600+ rules in `src/lib/knowledge-base/*.json`
- 7 categories: technical, fundamental, chip, industry, news, risk, strategy
- Each rule: `{ id, title, fact, interpretation, action, confidence, tags }`
- Persona-mapped via `data/persona-knowledge-map.json`
- Retrieved by `src/lib/knowledgeBase.js` with persona-weighted boosting

### Event System

- Events stored in Zustand `eventStore.js`
- Auto-prediction via `src/lib/eventPredictionEngine.js` (no AI, uses knowledge base)
- Calendar auto-generated from FinMind data + MOPS announcements

## External Services

- **FinMind API**: ALL stock data (price, revenue, institutional, PER, etc.). Token in `.env`
- **Claude API**: Analysis and research AI calls. Through Vercel serverless.
- **Vercel Blob**: Cloud storage for brain/holdings persistence
- **TWSE API**: Real-time market prices via `api/twse.js`

## What NOT To Do

- Do NOT add TypeScript to this project
- Do NOT use `require()` or CommonJS
- Do NOT add new npm dependencies without strong justification
- Do NOT create documentation/README files unless asked
- Do NOT refactor working code that you weren't asked to change
- Do NOT use `console.log` — use `console.warn` or `console.error`
- Do NOT hardcode stock codes — use `STOCK_META` from `seedData.js`
- Do NOT call external APIs directly from components — go through `api/` routes or hooks

## Multi-AI Collaboration

This project uses multiple AI agents. Each has a role file:

- `CLAUDE.md` — architect, reviewer (you don't need to read this)
- `QWEN.md` — engineer + QA (batch implementation, testing)
- `GEMINI.md` — web research scout
- `AGENTS.md` — OpenClaw agent framework

**Your role as Gemini Code Assist**: IDE daily coding assistant.

- Inline completions while writing code
- Quick bug fixes in the current file
- Generate unit tests for functions
- Explain code when asked
- Follow the patterns in surrounding code

When generating code, match the style of the file you're editing. Look at adjacent functions for patterns.
