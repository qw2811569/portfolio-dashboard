# Qwen Repo Guide

## Read First

If you need deeper project context, read `CLAUDE.md` first. This file is the short version for Qwen Code.

## Project Summary

This repo is a Taiwan stock portfolio management app with:

- multi-portfolio management
- event tracking with `pending / tracking / closed`
- owner-only cloud sync
- strategy brain with structured rules, candidate rules, and checklists
- holding dossiers for research and post-market analysis
- client-facing HTML/PDF report generation

Main frontend is still concentrated in `src/App.jsx`.

## Important Files

- `src/App.jsx`
- `api/_lib/ai-provider.js`
- `api/analyze.js`
- `api/parse.js`
- `api/research.js`
- `api/brain.js`
- `CLAUDE.md`
- `docs/superpowers/specs/2026-03-24-holding-dossier-and-refresh-architecture.md`
- `docs/superpowers/specs/2026-03-24-client-report-production-playbook.md`

## Safe Default Working Style

- prefer small, localized changes
- keep backward compatibility with existing localStorage data
- do not break multi-portfolio storage keys
- do not remove owner-only cloud gating
- do not overwrite client-facing report assets casually

## Use Qwen Code For

- routine implementation
- mechanical refactors
- test writing
- smaller UI cleanup
- first-pass code review

## Hand Back To Codex For

- strategy brain logic changes
- cloud sync changes
- holding dossier schema changes
- AI prompt / output quality changes
- client-facing report correctness

## Coordination Rule

- Read `docs/superpowers/status/current-work.md` before starting.
- Only take slices that are clearly low-risk implementation work.
- After each batch, write back:
  - `started`
  - `changed files`
  - `ready for review`
- If the user says stop, finish the current small batch only and leave the next exact edit target in `current-work.md`.

## Local Dev Notes

- full app mode: `vercel dev`
- frontend-only mode: `npm run dev`
- build check: `npm run build`

## Current Priority

Default to cost-saving support work:

- implementation help
- code cleanup
- smaller review tasks

Keep final correctness review and high-risk architectural work for Codex.
