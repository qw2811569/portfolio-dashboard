# Accessibility Checklist

## WCAG AA Smoke Pack

This is a lightweight ship-before checklist. It is not a substitute for a full audit, but it keeps the obvious regressions visible before demo or beta handoff.

## Manual Checks

- keyboard:
  - tab order reaches primary actions in header, daily panel, research panel, and dialogs.
  - focus is visible on every interactive control.
  - escape closes modal-style surfaces without trapping focus.
- contrast:
  - primary text, badges, and warning states remain readable against their background.
  - small helper text still clears the intended contrast threshold in light mode.
- screen reader:
  - buttons expose meaningful names.
  - dialog surfaces keep `aria-modal` / readable labels.
  - icon-only affordances are either hidden or labeled.

## Automatic Smoke Test

- file: `tests/components/accessibilitySmoke.test.jsx`
- scope:
  - daily empty state primary buttons stay discoverable by role/name
  - populated daily panel keeps readable labels for ritual card and follow-up actions
- run:
  - `npx vitest run tests/components/accessibilitySmoke.test.jsx`

## Evidence Checklist

- screenshot of keyboard focus on the primary CTA
- screenshot or note for at least one contrast-sensitive badge/card
- screen reader note confirming the main actions are announced correctly
- link to the automatic smoke test result
