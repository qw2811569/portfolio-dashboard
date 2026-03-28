# 全面 Debug 報告

最後更新：2026-03-27  
範圍：runtime、驗證鏈、測試、AI 交接資訊  
狀態：本輪已完成，未發現新的 blocker

---

## 1. 本輪做了什麼

這輪不是只跑單一命令，而是把目前 repo 視為一次完整驗收。

已執行：

- `npm run lint`
- `npm run test:run`
- `npm run build`
- `npm run healthcheck`
- `npm run smoke:ui`
- `npm run verify:local`

結果：

- 全部通過
- 未再出現新的 `ReferenceError`、`TypeError`、白頁或 test failure

---

## 2. 這輪確認到的事

### Runtime 狀態

- 目前真正執行入口仍是 `src/main.jsx -> src/App.jsx`
- `src/App.jsx` 已從單體檔案進一步拆出 boot 與 persistence lifecycle
- 關鍵 runtime 邊界目前是：
  - `src/hooks/usePortfolioManagement.js`
  - `src/hooks/usePortfolioDerivedData.js`
  - `src/hooks/usePortfolioBootstrap.js`
  - `src/hooks/usePortfolioPersistence.js`
  - `src/lib/brainRuntime.js`

### 驗證鏈缺口

本輪發現一個流程層問題：

- 原本 `npm run verify:local` 只做 `build + healthcheck + smoke`
- 這代表 repo 可能在 `lint` 或 `test` 已壞掉時，仍然被誤判成「本地驗證通過」

這不是當下的 runtime bug，但屬於很容易放大團隊誤判的 debug gap。

---

## 3. 本輪實際修正

### 驗證腳本

已更新 [package.json](/Users/chenkuichen/APP/test/package.json)：

- `npm run verify:local` 現在會依序執行：
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
  - `npm run healthcheck`
  - `npm run smoke:ui`

### 文件同步

已更新以下文件，讓其他 AI 不會再沿用舊的驗證假設：

- [docs/AI_COLLABORATION_GUIDE.md](/Users/chenkuichen/APP/test/docs/AI_COLLABORATION_GUIDE.md)
- [docs/QUICK_START.md](/Users/chenkuichen/APP/test/docs/QUICK_START.md)
- [docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md](/Users/chenkuichen/APP/test/docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md)

---

## 4. 驗證結果

### 自動驗證

- `npm run lint`：通過
- `npm run test:run`：通過
- `npm run build`：通過
- `npm run healthcheck`：通過
- `npm run smoke:ui`：通過
- `npm run verify:local`：通過

### 測試狀態

- Vitest：`5 files / 43 tests` 全數通過

### UI smoke 結果

- 頁面可正常渲染
- marker：
  - `持倉看板`
  - `持倉`
  - `深度研究`
- 未捕獲新的 page error 或 `ReferenceError` / `TypeError`

---

## 5. 給下一個 AI 的結論

這輪沒有新的 blocker 要立即修。

如果你下一步要繼續 debug 或重構，請先假設：

1. 目前基線是健康的，先不要把舊問題當成還沒修。
2. 新改動若沒跑 `npm run verify:local`，就不算完整驗證。
3. 下一個高價值檢查點，不是再重跑一遍 build，而是針對你要改的 slice 補更深的測試或場景驗證。

---

## 6. 建議的下一步

- 若繼續拆 `App.jsx`，優先收斂仍殘留在主檔內、且和 `src/utils.js` 有重疊的 storage/runtime helpers
- 若繼續做 debug 強化，優先補 `boot / persistence / cloud sync` 的 hook 級測試
- 若要做客戶展示前驗收，保留 `verify:local + smoke:ui` 作為最低門檻
