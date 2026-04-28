# Question

Should daily analysis stay single-pass, or adopt a staged same-day model:

- `T0`: immediate close read using available prices + best-effort FinMind hydration
- `T1`: rerun only after same-day FinMind daily datasets are actually present

Constraints:

- no silent overwrite of the earlier report
- no fake rerun that still reads the 4-hour browser cache
- keep the patch small enough for the current runtime stabilization wave
