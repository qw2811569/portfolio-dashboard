# 動態文檔系統使用指南

> 2026-03-30 更新
>
> - docs-site 的狀態來源已改成 `docs/status/current-work.md` + `docs/status/ai-activity.json` + `docs/status/ai-activity-log.json`
> - `docs-site/state.json` 不再是手動維護黑板，而是 `bash scripts/sync-state.sh` 的衍生輸出
> - 預設請用 `bash scripts/sync-state.sh` 快速同步進度
> - 只有需要重刷 build / lint / tests 健康狀態時，才用 `bash scripts/sync-state.sh --full`

## 🎯 系統說明

這不是一個靜態文檔網站，而是一個**動態協作平台**。AI 可以：

1. **讀取當前程式碼狀態**（App.jsx 行數、測試數量、健康狀態）
2. **從 `current-work.md` 同步最新進度**
3. **查看交接摘要**（來自衍生的 handover 區塊）
4. **同步後可手動立即刷新**（頁面會直接抓 canonical 鏡像；若還要重刷 metrics / health，再執行 `sync-state.sh`）

---

## 🚀 啟動網站

### 方法 1：VSCode Task（推薦）

1. `Cmd+Shift+P` → `Tasks: Run Task`
2. 選擇 `📄 Docs Site: Launch`
3. 開啟 http://localhost:8080

### 方法 2：終端機

```bash
bash scripts/launch-docs-site.sh
```

---

## 🤖 AI 交接流程

### 當你完成工作準備離開時

```bash
# 1) 先更新 canonical 狀態 / 即時活動
AI_NAME=Qwen bash scripts/ai-status.sh progress "正在整理 citations"

# 2) 完成 checkpoint 後再寫回 current-work.md 並同步 docs-site
AI_NAME=Qwen bash scripts/ai-status.sh done "完成第一批引用整理"
```

### 交接後會發生什麼事？

1. **current-work.md 成為最新真相**：
   - 最新 checkpoint 會進入 `Latest checkpoint`
   - `Last updated` 會反映最新狀態時間
   - objective / next step 會保留在同一份文件中

2. **docs-site/state.json 會被重建**：
   - summary / timeline / handover 會從 `current-work.md` 重新生成
   - metrics 會以實際 repo 狀態重算

3. **網站可手動立即顯示最新資料**：
   - 最新交接訊息
   - 當前進行中任務
   - 下一步建議

---

## 🔄 同步程式碼狀態

### 手動同步

```bash
bash scripts/sync-state.sh
```

這會掃描並更新：

- `App.jsx` 行數
- 測試文件數量
- 測試案例數量
- 文檔總數
- 目前展示用 summary / timeline / handover

若需要一起重刷 health：

```bash
bash scripts/sync-state.sh --full
```

### 自動同步（建議）

在 `package.json` 中加入：

```json
{
  "scripts": {
    "sync-state": "bash scripts/sync-state.sh"
  }
}
```

然後在 `npm run build` 或 `npm run test` 後自動執行。

---

## 📊 state.json 結構

```json
{
  "lastUpdated": "2026-03-29T19:58:00+08:00",
  "phases": {
    "phaseB": {
      "progress": 60,
      "status": "in-progress",
      "tasks": [...]
    }
  },
  "metrics": {
    "appJsxLines": 1004,
    "testFiles": 33,
    "testCases": 163
  },
  "aiHandover": {
    "lastAi": "Codex",
    "lastUpdate": "2026-03-29T19:58:00+08:00",
    "currentWork": "Phase B - 工作流升級",
    "nextStep": "完成 useAppRuntimeSyncRefs 的 route shell 對應 hook",
    "notes": "App.jsx 已降到 1004 行，持續收斂中"
  },
  "aiStatus": {
    "Codex": { "lastActive": "...", "tasksCompleted": 12 },
    "Qwen": { "lastActive": "...", "tasksCompleted": 8 },
    "Gemini": { "lastActive": "...", "tasksCompleted": 5 },
    "Claude": { "lastActive": "...", "tasksCompleted": 6 }
  },
  "healthCheck": {
    "build": "passing",
    "lint": "passing",
    "tests": "passing"
  }
}
```

---

## 💡 使用情境

### 情境 1：AI 完成工作要交接

```bash
# 1. 執行同步，更新程式碼指標
bash scripts/sync-state.sh

# 2. 留下交接訊息
bash scripts/ai-handover.sh Qwen "已完成所有 UI 組件提取，需要 Codex 審查架構"

# 3. 網站會自動顯示最新狀態（或刷新頁面）
```

### 情境 2：AI 接手新工作

```bash
# 1. 打開網站查看當前狀態
# 2. 查看 aiHandover.notes 了解上個 AI 做了什麼
# 3. 查看 timeline 了解最近進度
# 4. 開始工作
```

### 情境 3：查看健康狀態

網站會顯示：

- ✅ Build: passing
- ✅ Lint: passing
- ✅ Tests: passing
- ❌ 或 ⚠️ 如果有失敗

---

## 🔧 進階設定

### 修改 AI 清單

編輯 `state.json` 的 `aiStatus` 區塊：

```json
"aiStatus": {
  "YourAI": {
    "lastActive": "2026-03-29T20:00:00+08:00",
    "tasksCompleted": 0,
    "currentTask": "你的工作描述"
  }
}
```

### 新增 Phase

編輯 `state.json` 的 `phases` 區塊。

### 修改刷新方式

目前前端採手動「立即刷新」模式，邏輯在 `docs-site/script.js`。

---

## 📝 最佳實踐

1. **每次完成工作都要交接**：讓下一個 AI 知道現況
2. **交接訊息要具體**：寫清楚完成了什麼、卡在哪裡、下一步建議
3. **定期同步狀態**：確保指標反映真實程式碼
4. **查看時間軸**：了解專案歷史進度

---

## 🆘 常見問題

### Q: 網站沒有顯示最新狀態？

A: 先確認是否已執行 `bash scripts/sync-state.sh`，再按一次頁面右上角的「立即刷新」。

### Q: sync-state.sh 執行失敗？

A: quick 模式不需要先跑 build/lint/test；若 `--full` 失敗，再分別檢查 `npm run build`、`npm run lint`、`npm run test:run`。

### Q: 如何新增自訂指標？

A: 優先修改 `scripts/build-docs-state.mjs` 的生成邏輯，而不是手動編輯 `state.json`。
