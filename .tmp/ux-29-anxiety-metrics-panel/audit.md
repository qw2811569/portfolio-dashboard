# UX-29 · Anxiety Metrics Audit

Source anchors:
- SA §6.8 `docs/specs/2026-04-18-portfolio-dashboard-sa.md:262`
- SA §5.2 accept gate `docs/specs/2026-04-18-portfolio-dashboard-sa.md:515`
- SD §4.1.1 Dashboard main blocks `docs/specs/2026-04-18-portfolio-dashboard-sd.md:294`
- SD Phase 1 must: clear UI contract for 5 anxiety metrics `docs/specs/2026-04-18-portfolio-dashboard-sd.md:655`

## Summary

| X | Status | Current state |
| --- | --- | --- |
| X1 | 🔴 完全無 | repo 沒有 7-day 相對大盤 z-score，也沒有 user-facing contract |
| X2 | 🟢 已有 UI + 資料 | `HoldingDossier.thesis.pillars` 已進 Holdings table / drill pane |
| X3 | 🟡 資料有 · UI 缺 | `finmind.institutional` / `institutionalFlow5d` 已存在，但沒有 5-day sparkline UI |
| X4 | 🟢 已有 UI + 資料 | `ConcentrationDashboard` + `calculateConcentration()` 已上線 |
| X5 | 🟡 資料有 · UI 缺 | `useAutoEventCalendar` + `newsEvents` 有資料，Dashboard 只做今明兩天待處理卡，沒有 spec 要求的統一 3-day metric |

## Raw grep evidence

### X1 · 7-day z-score

Command:

```bash
grep -rn "z-score\|zScore\|7-day.*market\|相對大盤" src/ 2>/dev/null | head -20
```

Result: no hits.

Adjacent but non-spec evidence:
- `src/hooks/useDailyAnalysisWorkflow.js:209-213` only builds same-day `marketContext` string for AI prompt input.
- `src/lib/peerRanking.js:7-16,153` only has single-day stub benchmark (`0050` / `0052`) and explicit TODO; not 7-day z-score.

Audit call:
- `🔴` for SA §6.8 exact contract.
- No canonical data source, no UI, no persisted report field.

### X2 · Thesis pillar status

Command:

```bash
grep -rn "pillar.*status\|pillarStatus\|thesis.*pillar" src/ 2>/dev/null | head -20
```

Hits include:
- `src/components/holdings/HoldingDrillPane.jsx:306-346`
- `src/components/holdings/HoldingDrillPane.jsx:691-699`
- `src/components/holdings/HoldingsTable.jsx:82-83`
- `src/hooks/useThesisTracking.js:26-27`

Audit call:
- `🟢`
- Data source exists in `HoldingDossier.thesis.pillars`.
- User-facing UI already exists in Holdings drill pane and table-level thesis surfaces.
- Missing part is only cross-route cohesion, not the metric itself.

### X3 · 5-day institutional sparkline

Command:

```bash
grep -rn "institutional\|法人買賣超\|chip.*flow\|InstFlow" src/ 2>/dev/null | head -20
```

Hits include:
- `src/hooks/useDailyAnalysisWorkflow.js:336-338`
- `src/lib/dossierUtils.js:121-126`
- `src/lib/dailyAnalysisRuntime.js:422-438`
- `src/lib/dataUtils.js:343-361`

Audit call:
- `🟡`
- Data exists in `dossier.finmind.institutional` and derived `institutionalFlow5d`.
- No current user-facing 5-day sparkline component tied to holdings/dashboard.
- Existing sparkline component in repo is price-only: `src/components/holdings/HoldingSparkline.jsx`.

### X4 · concentration / Herfindahl

Command:

```bash
grep -rn "concentration\|herfindahl\|ConcentrationDashboard" src/ 2>/dev/null | head -20
```

Hits include:
- `src/components/overview/ConcentrationDashboard.jsx:4-265`
- `src/lib/concentrationMetrics.js:1-128`
- `src/components/overview/OverviewPanel.jsx:601`

Audit call:
- `🟢`
- Data and UI both ship today.
- Gap is discoverability from Dashboard, not metric implementation.

### X5 · upcoming 3-day events

Command:

```bash
grep -rn "upcoming.*events\|3-day.*events\|EventsTimeline.*upcoming" src/ 2>/dev/null | head -20
```

Result: no hits.

Adjacent but relevant evidence:
- `src/hooks/useAutoEventCalendar.js:1-83` hydrates canonical event data.
- `src/lib/eventCountdown.js:1-63` already defines `imminent` when `daysUntil <= 3`.
- `src/components/overview/DashboardPanel.jsx:1712-1849` only renders `PendingEventsCard` for today/tomorrow.

Audit call:
- `🟡`
- Data source exists and 3-day countdown logic exists.
- Missing is the cohesive spec surface: a unified X5 metric card and 3-day summary/handoff.

## Blockers before cohesive delivery

1. X1 is the only true hard blocker for full data parity.
   Current repo does not hold a trustworthy 7-day market-relative series in `PortfolioPanelsContext`.
2. X3 and X5 are classic "data exists, UI contract missing".
3. X4 already exists but only on Overview, so Dashboard still fails SA §5.2 "five indicators have clear UI contract".

## Implementation posture for UX-29

1. Ship one unified Dashboard panel under the hero/compare strip.
2. Reuse current canonical sources for X2/X3/X4/X5.
3. For X1, do not fabricate a number.
   Use a soft placeholder until a real 7-day benchmark series is wired in.
