# Internal Beta Checklist

## Ship Gate

- scope: internal beta only; no external invite until owner signoff and release notes are attached.
- disclaimer: this build is for evaluation, may contain incomplete data paths, and must not be treated as production-grade investment tooling.
- privacy: verify backup files, exported reports, and copied clipboard content do not include unintended personal data or hidden debug payloads.
- residency: confirm operational data, screenshots, and backup artifacts stay within the approved storage residency path before sharing.
- audit: keep one dated evidence bundle per beta cut with verifier, timestamp, changed files, and verify commands.

## Required Artifacts

- release note summary with round id, shipped T/Q items, and blocked manual gates.
- verify evidence:
  - `npm run build`
  - targeted vitest files for shipped logic
  - grep checks for docs / compliance strings where applicable
- rollback note with the exact `git checkout -- ...` commands for this wave.

## Data Handling

- backup import / export: confirm only trusted local files are used and schemaVersion checks stay enabled.
- clipboard / podcast prep: review copied weekly material before sending it outside the core team.
- screenshots / demo recordings: redact account identifiers, portfolio names, and any non-demo secrets.

## Remaining Manual Gates

- `T64` restore drill / rollback / MDD recovery: blocked until user runs the rehearsal and stores evidence.
- `Q06` cross-browser matrix with iOS Safari: blocked until real-device pass/fail evidence is captured.

## Audit Pack Template

- release id:
- verifier:
- verify run timestamp:
- commands executed:
- result summary:
- blocked items:
- linked screenshots / docs:
