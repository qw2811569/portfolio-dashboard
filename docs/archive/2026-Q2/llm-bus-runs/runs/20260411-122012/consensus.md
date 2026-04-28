# Consensus

## Result

Adopt staged same-day daily analysis:

- `T0` = `收盤快版`
- `T1` = `資料確認版`

## Why

- the app already mixes immediate price-change math with best-effort FinMind hydration
- same-day reruns can therefore change the thesis even if price action is unchanged
- pretending this is one monolithic report is worse than admitting the stage boundary

## Landed Scope

- daily reports now record:
  - `analysisStage`
  - `analysisStageLabel`
  - `analysisVersion`
  - `rerunReason`
  - `finmindConfirmation`
- same-day reruns bypass the local FinMind cache when the previous report is not already confirmed
- `analysisHistory` keeps both T0 and T1 instead of collapsing to one same-day entry
- `DailyReportPanel` shows the stage explicitly and renames the rerun CTA to `跑資料確認版` when applicable

## Non-goals In This Wave

- no background scheduler yet
- no automatic T1 trigger yet
- no diff viewer between T0 and T1 yet
