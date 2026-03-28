# PERFORMANCE REPORT 2026-03-28: Memory Pressure Reduction

## observed state

- 當前高記憶體不是單一 app runtime 爆掉，而是 VS Code 多個 renderer / webview / extension process 疊加
- repo 內有多個大型歷史快照仍放在 `src/`：
  - `src/App.jsx.backup`
  - `src/App.jsx.watchlist-backup`
  - `src/App.jsx.bak`
  - `src/App.jsx.phase4-backup`
  - `src/App.jsx.before-opt`
  - `src/App.jsx.bak2`
  - `src/App.jsx.bak3`
- 這些檔案雖然不是 runtime 主線，但會增加 VS Code、搜尋、watcher、ESLint、以及 Vite dev watch 的負擔

## done

- 將大型歷史快照從 `src/` 移到 `.archive/source-snapshots/`
- 補上 `vite.config.js` watcher ignore 規則，避免 dev server 盯住 archive / backup patterns
- 新增 workspace `.vscode/settings.json`
  - 隱藏 archive / backup files
  - 排除搜尋與 watcher
  - 排除 `.tmp` 與 `dist`
  - 關閉 automatic type acquisition
  - 將 `typescript.tsserver.maxTsServerMemory` 限制為 `2048`
- 新增 `jsconfig.json`
  - 明確限制 JS/JSX project include 範圍
  - 排除 `.archive`、`.tmp`、`dist`、`docs`、`node_modules`
  - 將 `maxNodeModuleJsDepth` 壓到 `0`，避免 tsserver 深入掃描 `node_modules` JS 原始碼

## changed files

- `vite.config.js`
- `jsconfig.json`
- `.vscode/settings.json`
- `.archive/source-snapshots/src/App.jsx.backup`
- `.archive/source-snapshots/src/App.jsx.bak`
- `.archive/source-snapshots/src/App.jsx.bak2`
- `.archive/source-snapshots/src/App.jsx.bak3`
- `.archive/source-snapshots/src/App.jsx.before-opt`
- `.archive/source-snapshots/src/App.jsx.phase4-backup`
- `.archive/source-snapshots/src/App.jsx.watchlist-backup`
- `.archive/source-snapshots/src/components/Header.jsx.broken`
- `.archive/source-snapshots/src/components/Header.jsx.fixed`

## why this helps

- `src/` 下的超大快照會被 IDE 與工具鏈視為活躍程式碼樹的一部分
- 沒有 `jsconfig.json` 時，VS Code 容易把整個 workspace 當成較鬆散的 inferred JS project，導致 tsserver 索引範圍偏大
- 即使沒有 import，它們仍可能被：
  - VS Code 檔案 watcher 掃描
  - 搜尋索引
  - JS/TS project service 建索引
  - Vite dev watcher 監看
- 把它們搬出活躍 source tree，再配合 watcher exclude、`jsconfig.json` 專案邊界與 tsserver 設定，能明顯減少背景記憶體與 CPU 噪音

## note

- 目前 `ps` 看到最高的記憶體進程主要是 VS Code renderer / webview，不是 `vite` 或 `vercel dev`
- 所以這次是優先處理「repo 讓 IDE 變胖」的問題，而不是誤砍 runtime feature

## next best step

- 若記憶體仍偏高，下一步先關閉不必要的 VS Code webview / AI extension 視窗，再重新載入 workspace
- 若還要更進一步，可以把 `.archive/` 直接移出 repo，做成外部備份資料夾
