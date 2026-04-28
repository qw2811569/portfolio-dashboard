# 本地開發伺服器訪問指南

狀態：有效
最後更新：2026-04-28（vercel 拆耦後修正）

---

這份文件說「怎麼從這台 Mac mini 本機與另一台 MacBook 連到同一個本地開發服務」。

## 正確啟動方式

- 啟動命令（任一）：
  - `npm run dev`（vite · `127.0.0.1:3002` · 純前端）
  - `bash scripts/redeploy-local.sh`（vite + 背景啟動 · 含 build · 0.0.0.0 listen 給 Tailscale 用）
- 完整驗證：`npm run verify:local`

> ~~舊版「`npx vercel dev --listen 0.0.0.0:3002`」已過時~~：2026-04-28 起前端純走 vite；API 則由各 dev VM 上的 `scripts/vercel-api-server.mjs`（Express）提供，本地 dev 走 vite proxy 到 VM 或本地起 Express。

## 兩組可用網址

- Mac mini 本機瀏覽器用：
  - `http://127.0.0.1:3002`
- 另一台 MacBook 透過 Tailscale 用：
  - `http://mac-mini.taila0e378.ts.net:3002`
  - 或 `http://100.80.250.41:3002`

## 不要再混用的入口

- `vercel dev`（已不適用 · 2026-04-28 拆耦後 Vercel CLI 不再是 active dev runner）
- `http://localhost:3002`（跟 `127.0.0.1:3002` 不同 origin · 會讓 localStorage 分裂）
- `http://127.0.0.1:5173`（vite 預設 port · 但本 repo 強制 3002）
- 任意 `*.vercel.app` URL（cold backup · 不是本地開發入口）

## 一個重要限制

遠端 MacBook 雖然可以打開這台 Mac mini 的本地服務，但因為它是另一個瀏覽器 origin / 裝置：

- 不會自動共用這台 Mac mini 瀏覽器裡的 localStorage
- 如果需要同一份投資資料，請走 app 內的雲端同步 / 匯入匯出流程，不要假設遠端瀏覽器會直接看到本機瀏覽器狀態
