# DEBUG REPORT 2026-03-28: Fast Refresh Boundary Convergence

## summary

- `src/App.jsx` 目前已回到 default-only export，`npm run check:fast-refresh` 通過
- `.tmp/vercel-dev.log` 內先前的 `Could not Fast Refresh ("BACKUP_GLOBAL_KEYS" export is incompatible)` 屬於歷史事件
- 最新 `App.jsx` Vite 事件已回到正常 `hmr update`

## why this follow-up was needed

- 雖然主因已修正，但 `src/App.jsx` 內仍保留大量與 `src/constants.js` 重複的 top-level 常數
- 這種狀態容易讓後續 refactor 再次把 `App.jsx` 往 mixed boundary 推回去
- 使用者根據舊 log 提出疑慮是合理的，因此這輪目標不是只說「已經好了」，而是把結構再收斂一層

## changes

- 新增 `src/lib/watchlistUtils.js`
  - 抽出 `normalizeWatchlist()`
- 更新 `src/constants.js`
  - `PORTFOLIO_STORAGE_FIELDS.watchlist` 改為使用 `normalizeWatchlist(INIT_WATCHLIST)`
- 更新 `src/App.jsx`
  - 直接從 `src/constants.js` import `MEMO_Q`、`PARSE_PROMPT`、storage keys、review defaults、portfolio storage metadata
  - 移除本地重複定義的常數區塊
  - 移除本地 `normalizeWatchlist()`，改走 `src/lib/watchlistUtils.js`
- 更新 `src/lib/index.js`
  - re-export `watchlistUtils`

## validation

- `npm run check:fast-refresh`
- `npm run lint`
- `npm run build`

## current conclusion

- `App.jsx` 現在更接近純 orchestration shell，而不是混合 constants / helper barrel
- 從結構上已進一步降低 Fast Refresh regression 風險
- 若未來再次看到 `.tmp/vercel-dev.log` 出現 invalidation，應先看「最新一筆」`App.jsx` Vite 事件，不要直接把整段歷史 log 當現況
