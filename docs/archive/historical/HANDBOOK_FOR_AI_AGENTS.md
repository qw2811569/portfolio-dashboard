# AI Agent Handbook

最後更新：2026-03-27  
狀態：歷史入口，非 canonical 規則文件

---

這份文件過去混合了重構紀錄、架構摘要與 AI 操作守則，現在容易與實際 repo 狀態脫節。

為了避免所有 AI 各讀各的版本，請改以以下順序為準：

1. `docs/AI_COLLABORATION_GUIDE.md`
2. `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`
3. `docs/superpowers/status/current-work.md`（只有在接手進行中的工作時）

## 保留這份檔案的唯一目的

- 提醒接手者這裡曾經有大型重構脈絡
- 避免舊連結直接失效
- 明確告知這裡不是 runtime 與操作規則的真相來源

## 目前最重要的歷史澄清

- repo 曾規劃朝 route-driven 架構前進
- 但目前實際執行入口仍是 `src/main.jsx -> src/App.jsx`
- 本地完整模式仍是 `vercel dev`
- 本地固定網址仍是 `http://127.0.0.1:3002`
