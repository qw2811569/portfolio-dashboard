# DEBUG REPORT 2026-03-27: Fast Refresh Invalidation Fix

## done

- 定位 `src/App.jsx` 被 Vite 反覆 `hmr invalidate` 的根因是 mixed export shape
- 移除 `src/App.jsx` 所有 named exports，改為只保留 default export `App`
- 清掉 export 收斂後暴露出的 dead helpers / unused constants
- 強化 `scripts/healthcheck.sh`，改看最新一筆 `App.jsx` Vite 事件，而不是被歷史 invalidation 汙染
- 更新 canonical guide，明確寫下 `App.jsx` 的 Fast Refresh export 規則

## changed files

- `src/App.jsx`
- `scripts/healthcheck.sh`
- `docs/AI_COLLABORATION_GUIDE.md`
- `docs/superpowers/status/current-work.md`

## root cause

- `src/App.jsx` 之前同時承擔 React component 與 shared helper barrel 的角色
- Vite React Fast Refresh 要求 component module 維持一致的 component export 形狀
- 當 `App.jsx` 的 named exports 被增刪或改動時，Vite 會判定：
  - `Could not Fast Refresh ("BACKUP_GLOBAL_KEYS" export is incompatible)`
  - `Could not Fast Refresh (export removed)`
- 結果不是單純 HMR update，而是直接 `hmr invalidate` + `page reload`

## verification

- `npm run lint`
- `npm run healthcheck`
- `npm run verify:local`

最新 `.tmp/vercel-dev.log` 已顯示後續 `src/App.jsx` 事件回到 `hmr update`，`healthcheck` 也會回報：

- `✅ Latest App.jsx Vite event is healthy: Fast Refresh signal looks normal.`

## risks

- `src/App.jsx` 仍然是大型 orchestration shell；若之後再把 helper / constants 直接加回這個檔案頂層 export，Fast Refresh invalidation 可能復發
- `.tmp/vercel-dev.log` 是開發期訊號，不是 production 指標；若 `vercel dev` 重啟過，仍要以最新事件為準

## next best step

- 繼續把可共用的 pure helper 往 `src/lib/*` 與 `src/hooks/*` 抽，避免 `App.jsx` 再次膨脹成 implicit barrel
- 若之後還觀察到 HMR 異常，優先檢查是否有其他 component entry file 出現 mixed exports
