# 功能測試報告

狀態：歷史測試紀錄，已過期  
最後更新：2026-03-29

---

這份文件原本記錄的是舊的 route/Vite 測試草稿，內文中的 `127.0.0.1:5173` 與相關手動測試步驟，已不適用於目前的 canonical local runtime。

目前應以以下規則為準：

- 啟動：`vercel dev`
- URL：`http://127.0.0.1:3002`
- 驗證：
  - `npm run healthcheck`
  - `npm run smoke:ui`
  - `npm run verify:local`

請改讀：

1. `docs/AI_COLLABORATION_GUIDE.md`
2. `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`

如果需要新的功能測試報告，請基於目前真正在跑的 `src/main.jsx -> src/App.jsx` runtime 重新產生，不要沿用這份舊草稿。
