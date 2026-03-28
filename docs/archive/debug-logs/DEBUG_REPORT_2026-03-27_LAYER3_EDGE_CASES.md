# 第三層 Debug 報告

最後更新：2026-03-27  
範圍：hook edge cases、malformed payload hardening、dossier rebuild guardrails  
狀態：已完成，未發現新的 blocker

---

## 1. 本輪做了什麼

第三層不是擴大 scope，而是補最細的 lifecycle 邊界：

- `holdingDossiers` rebuild 差異測試
- analysis / research 的 malformed payload 防呆
- bootstrap full sync 的 malformed cloud payload 防呆

這輪除了補測試，也順手強化了 production hook 的 defensive logic。

---

## 2. 本輪 production hardening

已更新：

- [usePortfolioPersistence.js](/Users/chenkuichen/APP/test/src/hooks/usePortfolioPersistence.js)
- [usePortfolioBootstrap.js](/Users/chenkuichen/APP/test/src/hooks/usePortfolioBootstrap.js)

### 實際強化內容

1. analysis history pull 現在只接受 array payload
   - `data.history` 若不是 array，直接忽略

2. research history pull 現在只接受 array payload
   - `data.reports` 若不是 array，直接忽略

3. bootstrap full sync 的 events / holdings / history / research 只接受正確陣列
   - 避免 malformed payload 被誤當成可 merge 的資料
   - 避免把空陣列或錯誤格式回寫進 persistence

---

## 3. 本輪新增測試

### Hook tests

更新：

- [tests/hooks/usePortfolioBootstrap.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/usePortfolioBootstrap.test.jsx)
- [tests/hooks/usePortfolioPersistence.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/usePortfolioPersistence.test.jsx)

### 新補的情境

#### `usePortfolioPersistence`

1. `holdingDossiers` 只在 derived payload 真的變動時才 `setHoldingDossiers`
2. analysis history 遇到 malformed payload 時不應污染 state / persistence
3. research history 遇到 malformed payload 時不應污染 state / persistence

#### `usePortfolioBootstrap`

1. owner full sync 遇到 malformed cloud payload 時，只保留 cloud sync 自身狀態更新
2. 不應把壞的 events / history / reports / holdings 寫進本地 state 或 persistence

---

## 4. 驗證結果

- hook tests：`2 files / 12 tests` 全通過
- 全量 Vitest：`7 files / 55 tests` 全通過
- `npm run lint` 通過
- `npm run verify:local` 通過

---

## 5. 本輪結論

第三層補完後，目前 `boot / persistence / cloud sync` 這條線已經不只是 smoke level 可用，而是對幾個常見 edge cases 有明確保護：

- 不會因 payload shape 異常把垃圾資料寫進本地
- 不會因 dossier 無實際差異而重複觸發 rebuild
- 不會因 malformed cloud payload 造成額外 state 汙染

目前沒有打出新的 blocker。

---

## 6. 下一步建議

如果還要做第四層，建議不要再往 hook 本體加更多條件，而是改補更細的行為驗證：

1. `setSaved` / toast 成功訊號的 lifecycle
2. cloud save / cloud pull 的 partial-success payload
3. 更接近真實資料的 integration-style fixture 測試
