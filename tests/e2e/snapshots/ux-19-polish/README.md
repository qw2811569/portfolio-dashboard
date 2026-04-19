# UX-19 Hero Polish

Desktop compare:

- `before-me-home-top.png`
- `after-me-home-top.png`
- `before-7865-home-top.png`
- `after-7865-home-top.png`

Mobile capture:

- `after-me-home-ios.png`
- `after-7865-home-ios.png`

Post-polish review:

- Designer: `8.6/10` — headline now uses display scale (`clamp(36px, 4.8vw, 56px)`), total value uses hero scale (`clamp(56px, 8vw, 76px)`), captions stay in the `11-12px` band, and hero card spacing is visibly looser.
- PM: `8.4/10` — first screen stays focused on one soft-language conclusion plus one dominant number, so the user can read the state in under 5 seconds.
- 小奎 persona: `8.5/10` — desktop first viewport now lands on a cleaner “headline + value + ring” composition that feels complete enough to screenshot without scrolling.
- 董座 persona: `8.2/10` — added bottom padding and ring breathing room reduce the “half-cut next section” feel; the hero reads as a self-contained summary card.

Notes:

- iOS baseline files from round 2 were not preserved in git, so this folder keeps the new mobile captures only.
- `uxSimulation.spec.mjs` still fails later in persona B due canonical holdings drift after the home screenshot step. The updated home screenshots above were written before that existing data-contract failure.
