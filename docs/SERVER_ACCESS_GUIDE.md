# 本地開發伺服器訪問指南

狀態：已過期，僅保留為歷史入口  
最後更新：2026-03-29

---

這份文件先前記錄的是舊的 Vite-only 本地訪問方式，內容中的 `5173`、`localhost`、`npm run dev` 已不再代表目前 repo 的完整本地模式。

目前唯一正確的本地規則是：

- 啟動命令：`vercel dev`
- canonical URL：`http://127.0.0.1:3002`
- 完整驗證：`npm run verify:local`

請改讀：

1. `docs/AI_COLLABORATION_GUIDE.md`
2. `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`

若看到任何舊截圖、舊聊天紀錄或舊文件仍提到：

- `http://127.0.0.1:5173`
- `http://localhost:5173`
- `npm run dev`
- `vite`

都應視為歷史資訊，不是目前真相。
