# 第二層 Debug 報告

最後更新：2026-03-27  
範圍：`boot / persistence / cloud sync` hook 級驗證  
狀態：已完成，基線穩定

---

## 1. 本輪目標

第一層 debug 已確認目前 app 可以正常跑起來，且 `verify:local` 全綠。

第二層的目標不是再抓一次白頁，而是把最容易回歸的 lifecycle 邊界補成可重複驗證的測試：

- `usePortfolioBootstrap`
- `usePortfolioPersistence`

---

## 2. 本輪新增的測試

### Hook tests

新增：

- [tests/hooks/usePortfolioBootstrap.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/usePortfolioBootstrap.test.jsx)
- [tests/hooks/usePortfolioPersistence.test.jsx](/Users/chenkuichen/APP/test/tests/hooks/usePortfolioPersistence.test.jsx)

### 覆蓋情境

#### `usePortfolioBootstrap`

1. non-owner portfolio 啟動
   - 只 hydrate 本地 snapshot
   - 不啟動 cloud sync
   - 不應發送雲端 fetch

2. owner portfolio full sync 啟動
   - 會抓 brain / events / holdings / history / research
   - 本地缺資料時會做雲端補缺
   - 會回寫 analysis / research / cloud sync timestamp
   - 會在缺 daily report 時從 analysis history 補一份

3. owner portfolio cooldown branch
   - TTL 未過時不跑 full sync
   - 只做 holdings-only cloud check
   - 若雲端 holdings 較新，會補進本地 state 與 persistence
   - 不應誤抓 brain / events / history / research

#### `usePortfolioPersistence`

1. holdings local persistence + debounced cloud save
   - 先寫本地
   - 再走 debounce 後雲端保存
   - 成功後更新 cloud sync timestamp

2. analysis history TTL pull
   - 只有在 `canUseCloud` 且 TTL 過期、tab 在 `daily/log` 時才抓
   - 合併結果會回寫 local persistence
   - 會更新 analysis cloud sync timestamp

3. research history TTL pull
   - 只有在 `canUseCloud` 且 TTL 過期、tab 在 `research` 時才抓
   - 會做 dedupe、依時間倒序排序，並保留最新結果
   - 會更新 research cloud sync timestamp

4. cloud save failure / cleanup timer
   - cloud save 失敗時不應污染本地 persistence
   - 不應寫入錯誤的 cloud sync timestamp
   - unmount 時要清理 pending timer，避免離頁後仍送出舊請求

---

## 3. 實際驗證結果

本輪結果：

- hook tests：`2 files / 8 tests` 全通過
- 全量 Vitest：`7 files / 51 tests` 全通過
- `npm run lint` 通過
- `npm run verify:local` 通過

---

## 4. 本輪沒有發現的新 blocker

這輪沒有挖到新的 runtime crash，也沒有測到新的 state corruption。

目前結論是：

- `App.jsx -> usePortfolioBootstrap/usePortfolioPersistence` 這條新切出的 lifecycle 邊界是可運作的
- 第一層驗證和第二層 hook 驗證之間沒有發現互相衝突

---

## 5. 剩餘風險

這輪原本列出的三條剩餘風險都已補上。

目前真正還沒覆蓋的，偏向更細的互動邊界：

1. success path 的 `setSaved` toast lifecycle
   - 目前已測成功與失敗的核心 persistence/sync
   - 尚未單獨驗證成功提示的 2 秒清除行為

2. `holdingDossiers` 的衍生重建節奏
   - 目前 persistence hook 已在全鏈驗證中運作正常
   - 但 dossier rebuild 的變更比較多，之後可補更細的差異測試

3. fetch partial payload edge cases
   - 例如 research/history 回傳空陣列、重複資料過多、單一 payload 格式異常
   - 目前主流程能穩定通過，但仍可補更硬的防呆測試

---

## 6. 給下一個 AI 的建議

如果你下一步要繼續第二層或第三層 debug，建議先從更細的 edge-case 測試下手，而不是重寫 hook。

目前最合理的下一步是：

1. 補 `setSaved` / toast lifecycle 測試
2. 補 dossier rebuild 差異測試
3. 補 partial payload / malformed payload 防呆測試
