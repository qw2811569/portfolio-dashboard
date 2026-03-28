# DEBUG REPORT 2026-03-28: Dossier / Report Utils Extraction

## summary

- `src/lib/reportUtils.js` 與 `src/lib/dossierUtils.js` 已從空檔補成真正可用的 utility module
- `src/App.jsx` 已改為直接使用這兩個 module，不再內嵌同一批 normalize / prompt builder / dossier assembly helper
- 這輪同時修掉 `src/hooks/useReports.js` 指向錯誤 `./utils.js` 的潛在 import bug

## what moved

### report utils

- `normalizeDailyReportEntry`
- `normalizeAnalysisHistoryEntries`
- `normalizeAnalystReportItem`
- `normalizeAnalystReportsStore`
- `normalizeReportRefreshMeta`
- `mergeAnalystReportItems`
- `mergeTargetReports`
- `averageTargetFromEntry`
- `extractResearchConclusion`
- `summarizeTargetReportsForPrompt`

### dossier utils

- `normalizeFundamentalsEntry`
- `normalizeFundamentalsStore`
- `formatFundamentalsSummary`
- `buildHoldingDossiers`
- `buildDailyHoldingDossierContext`
- `buildResearchHoldingDossierContext`
- `buildEventReviewDossiers`
- `normalizeTaiwanValidationSignalStatus`
- `formatTaiwanValidationSignalLabel`
- `listTaiwanHardGateIssues`
- `buildTaiwanHardGateEvidenceRefs`
- `formatTaiwanHardGateIssueList`

## integration notes

- `src/lib/index.js` 已補上 `reportUtils` / `dossierUtils` export
- `src/utils.js` 已補 legacy re-export，避免舊路徑斷裂
- `src/App.jsx` 仍保留 orchestration、brain validation lifecycle、storage、UI wiring
- `buildHoldingPriceHints()` 這次也改直接走既有的 `src/lib/holdings.js`

## validation

- `npm run check:fast-refresh`
- `npm run lint`
- `npm run build`

## current outcome

- `App.jsx` 再瘦一輪，重複 helper 顯著減少
- `dossier` 與 `report` 現在有清楚的 utility 邊界
- 後續若要再拆 `App.jsx`，優先延續這兩個 module，而不是把 prompt / normalize 邏輯放回 `App.jsx`
