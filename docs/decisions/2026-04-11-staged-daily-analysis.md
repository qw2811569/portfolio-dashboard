# Staged Daily Analysis

**日期**：2026-04-11  
**來源**：`coordination/llm-bus/runs/20260411-122012`、`20260411-124030`、`20260411-130006`  
**狀態**：✅ 決議並已成為 canonical runtime contract

## 決議

daily analysis 採 same-day staged model，而不是單一黑盒報告：

- `T0` = `收盤快版`
- `T1` = `資料確認版`

這不是 UX 文案調整，而是 runtime truth：

- 同日 rerun 可以因 FinMind 日資料補齊而改變 thesis
- `T0` 不能被靜默覆寫
- `T1` 必須 gate on data presence，不是固定延遲

## 2026-04-11 三份 consensus 濃縮

### 1. 122012 · staged same-day daily analysis

共識：採 `T0/T1` staged daily。

落地 contract：

- daily report 記錄 `analysisStage`
- 顯示 `analysisStageLabel`
- 記錄 `analysisVersion`
- 記錄 `rerunReason`
- 記錄 `finmindConfirmation`
- same-day rerun 若前一版尚未 confirmed，需 bypass stale FinMind cache
- `analysisHistory` 保留同日多版本，不再壓成單筆

### 2. 124030 · inline diff card

共識：最小可信任補強是 `DailyReportPanel` 同日版本差異卡。

原因：

- trust gap 發生在使用者正在看的 current report surface
- staged metadata 已足夠推導 deterministic same-day diff
- 不需要新增 API lane 或歷史頁導航

### 3. 130006 · automatic T1 trigger

共識：在 `DailyReportPanel` mount 時做一次 cooldown-gated probe。

原因：

- 觸發點留在使用者已打開的 daily surface
- 重用既有 `pendingCodes` / data-presence gating
- 避免 background polling 與無謂 API burn

## Canonical Runtime Contract

staged-daily 的 canonical contract 如下：

1. 使用者第一次盤後分析看到的是 `T0 收盤快版`，且 UI 必須明示它是 preliminary。
2. 當同日 FinMind pending datasets 補齊，系統可以在同頁自動或手動升級成 `T1 資料確認版`。
3. `analysisHistory` 必須保留 `T0 -> T1` 版本鏈。
4. `DailyReportPanel` 要能解釋「改了什麼」，而不只顯示 badge。
5. 任何自動確認都必須走 data-presence gate，不可假設時間到了就算 confirmed。

## Non-goals

2026-04-11 這輪明確不做：

- 背景 scheduler / background poller
- 自動 T1 的跨 session persistence
- 跨日期 diff viewer
- 新增獨立歷史比較頁

## 為什麼這份 ADR 要進 index

如果 onboarding 或後續 spec 仍把 daily analysis 寫成單次完成，會直接誤導：

- 使用者不知道 `T0` 與 `T1` 是不同 truth state
- 工程上會錯把 rerun 當成「覆寫舊報告」
- 後續 `T14/T15/T40` 的 UX 驗收會失去共同語言

因此從 2026-04-11 起，`staged-daily analysis` 視為正式 decision，而不是暫時實驗。
