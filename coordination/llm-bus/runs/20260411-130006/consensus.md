# Consensus

Decision: `A` mount-triggered cooldown-gated probe

Quorum:

- Claude: `A`
- Qwen: `A`
- Gemini: `A`

Why this won:

- it keeps automation inside the daily panel the user is already viewing
- it reuses the existing `pendingCodes` / data-presence gating instead of inventing a timer
- it avoids background polling and unnecessary API burn

Non-blocking caveats:

- cooldown is currently session-local, not persisted across full reloads
- this is intentionally not a background poller
- Gemini required a retry before producing a usable vote
