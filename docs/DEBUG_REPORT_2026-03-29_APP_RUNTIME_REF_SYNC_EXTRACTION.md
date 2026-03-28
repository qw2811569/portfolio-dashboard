# App Runtime Ref Sync Extraction

最後更新：2026-03-29

## 本輪目標

把 `src/App.jsx` 內部的 `state -> ref` 同步樣板收成小 hook，減少主檔重複 effect 與 ref wiring。

## 已完成

- 新增 [src/hooks/useAppRuntimeSyncRefs.js](/Users/chenkuichen/APP/test/src/hooks/useAppRuntimeSyncRefs.js)
- [src/App.jsx](/Users/chenkuichen/APP/test/src/App.jsx) 已改為透過這個 hook 同步：
  - `activePortfolioIdRef`
  - `viewModeRef`
  - `portfoliosRef`
  - `portfolioSetterRef`
  - `bootRuntimeRef`
- 移除未實際使用的 `canUseCloudRef`

## 這輪修掉的風險

- `App.jsx` 不再自己維護多段相似的 ref sync effect，降低後續新增欄位時漏改某一段的風險
- `bootRuntimeRef` 的同步邊界變成單一 source of truth，供 `usePortfolioBootstrap()` 讀取
- 未使用 dead ref 已清掉，避免未來誤以為仍有 active dependency

## 驗證

- `npm run verify:local`
- 新增測試 [tests/hooks/useAppRuntimeSyncRefs.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/useAppRuntimeSyncRefs.test.jsx)

全部通過。
