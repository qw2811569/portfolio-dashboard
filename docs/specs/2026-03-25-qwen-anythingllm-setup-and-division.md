# Qwen Code + AnythingLLM + Gemini Setup And Division

## Goal

Use `Qwen Code` as the coding agent, `AnythingLLM` as the document workspace, and `Gemini CLI` as the public-web research scout, while keeping higher-risk architecture and final QA on Codex.

## Installed On This Mac

- `Qwen Code` CLI
- `Qwen Code Companion` VSCode extension
- `AnythingLLM` desktop app
- `Gemini CLI`

## Current State

- `Qwen Code` is kept as a plain CLI tool
- `Gemini CLI` is kept for public-web scouting
- local `Ollama` runtime and local coding models have been removed
- `AnythingLLM` remains installed as a document workspace

## VSCode Entry Points

In this repo, open the command palette or `Terminal -> Run Task` and use:

- `Gemini CLI: Launch In Repo`
- `Gemini CLI: Launch Taiwan Scout`
- `Qwen Code: Launch In Repo`
- `AnythingLLM: Open Desktop App`

## Gemini CLI

This repo now includes two Gemini launchers:

- `scripts/launch-gemini.sh`
- `scripts/launch-gemini-research-scout.sh`

Current repo default model:

- `gemini-3-flash-preview`

Default usage:

- `Gemini CLI: Launch In Repo`
  - plain Gemini CLI in this workspace
- `Gemini CLI: Launch Taiwan Scout`
  - bounded mode for Taiwan-stock public research scouting

Recommended role:

- use Gemini for public web research, source collection, and citation gathering
- keep it focused on recent public information
- do not let it directly decide final target prices, fundamentals truth, or strategy-brain writes

First run:

1. Launch `Gemini CLI: Launch In Repo`
2. Prefer `GEMINI_API_KEY`; OAuth may authenticate successfully but still lack a usable Code Assist entitlement
3. Let Gemini read `GEMINI.md` in this repo
4. Prefer the Taiwan Scout launcher for stock-research tasks

## First Run

### Qwen Code

1. Run `Qwen Code: Launch In Repo`
2. Complete `qwen auth`
3. Trust this repo folder when prompted
4. Let Qwen read `QWEN.md` and `CLAUDE.md` before large tasks

### AnythingLLM

1. Open `AnythingLLM: Open Desktop App`
2. On first setup, choose local / self-managed mode
3. Choose the provider you actually want to use later
4. Start with document workspaces first, not coding workspaces

### Gemini CLI

- For the quickest setup, sign in with Google on first run
- If you prefer key-based auth, use `GEMINI_API_KEY`
- Treat Gemini as a research scout, not as a source-of-truth database

## Recommended Division Of Work

### Use Qwen Code for

- routine React / Node edits
- smaller refactors
- writing tests
- code cleanup
- first-pass code review
- repetitive implementation work after the architecture is already decided
- note: this repo now launches plain `qwen` CLI only, without local Ollama routing

### Use Gemini CLI for

- public news and announcement scans
- law conference / earnings / company-IR source collection
- public target-price article indexing
- citation gathering for dossier updates
- freshness checks on external information

### Do not use Gemini CLI for

- final numerical truth for fundamentals
- direct `strategyBrain` updates
- final target-price confirmation
- client-facing numerical sign-off

### Use AnythingLLM for

- reading PDFs
- storing client reports
- storing specs, playbooks, and investment notes
- querying past analysis decisions
- comparing multiple documents inside one workspace
- RAG-style retrieval from your own files

### Keep Codex for

- high-risk data flow changes
- architecture decisions
- debugging tricky regressions
- investment workflow logic
- final review before client-facing delivery

## Practical Workflow

### 1. Coding task

1. Start `Qwen Code: Launch In Repo`
2. Let Qwen handle the first implementation pass
3. Bring the result back to Codex for deeper review when the change affects:
   - portfolio persistence
   - strategy brain logic
   - client report output
   - AI prompt / analysis quality

### 2. Document-heavy task

1. Open `AnythingLLM: Open Desktop App`
2. Create these workspaces first:
   - `Product Specs`
   - `Strategy Brain`
   - `Client Reports`
3. Import PDFs, specs, and report drafts there
4. Use AnythingLLM to retrieve, summarize, and compare source material
5. Bring only the final distilled conclusions back into the app or into Codex

### 3. Mixed task

Use `AnythingLLM` first to digest internal documents, then use `Gemini CLI` to pull recent public facts and citations, then use `Qwen Code` for implementation, then use `Codex` for final correctness and polish.

## Recommended First Workspaces In AnythingLLM

### Product Specs

- `CLAUDE.md`
- `docs/superpowers/specs/*`
- `docs/superpowers/plans/*`

### Strategy Brain

- strategy notes
- research exports
- post-market analysis notes
- client-specific investment rules

### Client Reports

- client holding PDFs
- generated HTML reports
- generated PDF reports
- report production playbook

## Suggested Usage Policy

- Default coding: `Qwen Code`
- Default public-web research scout: `Gemini CLI`
- Default low-cost drafting: `Qwen Code`
- Default document retrieval: `AnythingLLM`
- Final validation: `Codex`

That keeps cost low without pushing critical judgment onto the cheapest model.
