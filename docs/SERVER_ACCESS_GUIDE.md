# 本地開發伺服器訪問指南

狀態：有效
最後更新：2026-04-03

---

這份文件只說「怎麼從這台 Mac mini 本機與另一台 MacBook 連到同一個本地開發服務」，不再混用 `vite`、`localhost`、production URL。

## 正確啟動方式

- 啟動命令：`bash scripts/redeploy-local.sh`
- 實際服務：`npx vercel dev --listen 0.0.0.0:3002`
- 完整驗證：`npm run verify:local`

## 兩組可用網址

- Mac mini 本機瀏覽器用：
  - `http://127.0.0.1:3002`
- 另一台 MacBook 透過 Tailscale 用：
  - `http://mac-mini.taila0e378.ts.net:3002`
  - 或 `http://100.80.250.41:3002`

## 不要再混用的入口

- `npm run dev`
- `vite`
- `http://localhost:3002`
- `http://127.0.0.1:5173`
- 任意新的 `*.vercel.app` 臨時網址來當本地開發入口

原因：

- `vite` 只保證前端，不代表 repo 內 API 一定可用
- `localhost:3002` 和 `127.0.0.1:3002` 是不同 origin，會讓同一台機器上的 localStorage 分裂
- production `vercel.app` 是正式部署，不是本地開發入口

## 一個重要限制

遠端 MacBook 雖然可以打開這台 Mac mini 的本地服務，但因為它是另一個瀏覽器 origin / 裝置：

- 不會自動共用這台 Mac mini 瀏覽器裡的 localStorage
- 如果需要同一份投資資料，請走 app 內的雲端同步 / 匯入匯出流程，不要假設遠端瀏覽器會直接看到本機瀏覽器狀態
