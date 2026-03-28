# 優化落地報告

最後更新：2026-03-27  
範圍：測試防禦、TypeScript 漸進基線、healthcheck 強化  
狀態：已完成

---

## 1. 這輪落地了什麼

這輪是依照三個優化方向直接落地，而不是只留下建議：

1. 強化測試覆蓋
2. 引入漸進式 TypeScript 基線
3. 強化 `healthcheck.sh`

---

## 2. 測試防禦升級

### 已完成

- hooks edge-case 測試已持續補強
- `holdings` 純邏輯測試也一起補強

### 本輪新增/更新

- [tests/lib/holdings.test.js](/Users/chenkuichen/APP/test/tests/lib/holdings.test.js)
- [tests/hooks/usePortfolioBootstrap.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/usePortfolioBootstrap.test.jsx)
- [tests/hooks/usePortfolioPersistence.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/usePortfolioPersistence.test.jsx)

### 本輪特別收掉的點

- 修正 `normalizeHoldingMetrics()` 的報酬率計算，分母改回正確的 cost basis
- 新增 `calculateTotalMarketValue()` 測試，驗證價格表缺值時會回退成本價
- hook edge-case 仍維持全綠

### 目前結果

- 全量測試：`7 files / 56 tests` 通過

---

## 3. TypeScript 漸進基線

### 已新增

- [tsconfig.json](/Users/chenkuichen/APP/test/tsconfig.json)
- [holdingMath.ts](/Users/chenkuichen/APP/test/src/lib/holdingMath.ts)

### 目前做法

- 沒有硬推整個 repo 一次轉成 TS
- 先從穩定、純邏輯、低風險的 holdings math 開始
- 由 JS runtime 模組 [holdings.js](/Users/chenkuichen/APP/test/src/lib/holdings.js) 直接吃 typed helper

### 新增指令

- `npm run typecheck`

### 驗證鏈更新

- `npm run verify:local` 現在已納入 `npm run typecheck`

---

## 4. Healthcheck 強化

已更新：

- [healthcheck.sh](/Users/chenkuichen/APP/test/scripts/healthcheck.sh)

### 目前改善

- 若 `.tmp/vercel-dev.log` 不存在或為空，會明確提示
- 不再只檢查單一字串 `Vite ready`
- 會讀最近的 Vite log signal，例如 `hmr update` / `page reload`
- 若最近 log 出現 `Could not Fast Refresh` 或 `hmr invalidate`，會主動警告

### 目前實際效果

這輪驗證時，腳本成功回報：

- server 正常
- Vite frontend log signal detected
- 近期存在 HMR invalidation 警告

這讓 healthcheck 不只是 port 探活，而是更接近開發態健康檢查。

---

## 5. 驗證結果

- `npm run lint` 通過
- `npm run typecheck` 通過
- `npm run test:run` 通過
- `npm run build` 通過
- `npm run verify:local` 通過

---

## 6. 尚未做的事

這輪沒有直接導入 Storybook。

原因：

- 目前最急迫、最有報酬的是把 runtime / hook / 純邏輯的防禦補齊
- Storybook 會是另一條工具鏈，值得做，但不應和這輪 runtime hardening 混在一起

---

## 7. 建議下一步

1. 若要繼續 TypeScript，下一站優先是 `stores/` 或更多 `lib/` 純函式
2. 若要繼續測試升級，可考慮導入 component-level isolated tests，再評估是否要上 Storybook
3. healthcheck 已能提示 HMR invalidation；若要再往前走，下一步是處理 `App.jsx` 開發期 Fast Refresh 警告來源
