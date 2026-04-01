# AI 自動回報系統使用指南

> 2026-03-30 更新
>
> - 儀表板的 canonical 狀態來源是 `docs/status/current-work.md` + `docs/status/ai-activity.json` + `docs/status/ai-activity-log.json`
> - `docs-site/state.json` 只做展示，由 `bash scripts/sync-state.sh` 重新生成
> - 更新進度時，優先用 `scripts/ai-status.sh` / `scripts/ai-state.sh`，它們會自動更新 canonical 檔案並同步 docs-site
> - 目前推薦的變更歸因堆疊是：`GitLens + BlamePrompt + ai-status/launcher + ai-commit.sh`
> - 若只想即時更新畫面，不需要每次都重跑 build / lint / tests；直接執行 `bash scripts/sync-state.sh` 即可
> - docs-site 啟動時會自動跑 AI presence 偵測（`refresh-ai-presence.py`），即使其他 AI 沒手動回報也會顯示近期活躍狀態

## 🎯 這是什麼？

這是一個**給一般人看的視覺化儀表板**，同時讓**AI 自動回報工作狀態**。

### 特色

✅ **給你看**：不需要懂 code，也能知道專案進度
✅ **AI 自動更新**：每次工作告一段落，AI 更新狀態
✅ **AI 互相看見**：每個 AI 都知道其他 AI 在做什麼
✅ **優化建議**：AI 可以留下建議給下一個 AI

---

## 📱 給你看什麼？

### 儀表板內容

```
┌─────────────────────────────────────────────┐
│  📊 台股投資工作台                           │
│  系統正常 ✅                                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📝 今日總結                                  │
│ 今天完成了 3 個功能，App.jsx 再減少 150 行       │
│ • ✅ useAppRuntimeComposer 完成              │
│ • ✅ useAppRuntimeSyncRefs 完成              │
│ • 🔄 Phase B 工作流升級進行中                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📄 App.jsx    🧪 測試     ✅ 完成   🔄 進行中  │
│   1004 行      163 個      18 個      4 個     │
│   -150 行                                    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🚀 Phase 進度                                │
│ Phase A ████████████████████ 100%           │
│ Phase B ████████████░░░░░░░░ 60%            │
│ Phase C ██████░░░░░░░░░░░░░░ 30%            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🤖 AI 團隊                                   │
│ 🧠 Codex   (當前) 工作中   12 個任務  19:58   │
│ ✍️ Qwen    等待中    8 個任務   15:30        │
│ 🔍 Gemini  等待中    5 個任務   14:00        │
│ 🎯 Claude  等待中    6 個任務   10:00        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📋 AI 交接筆記                               │
│ 來自 Codex                                   │
│ "完成 useAppRuntimeComposer 提取..."         │
│ ➡️ 下一步：持續收斂 route shell hook         │
│                                              │
│ 💡 優化建議                                  │
│ • 可以考慮把 usePortfolioPersistence 拆分    │
└─────────────────────────────────────────────┘
```

---

## 🤖 AI 如何使用？

### 1. 開始工作時

```bash
# 告訴系統你開始做什麼
AI_NAME=Qwen bash scripts/ai-status.sh start "重構 UI 組件"
```

### 2. 作業過程中更新進度

```bash
# 讓儀表板顯示你現在做到哪
AI_NAME=Qwen bash scripts/ai-status.sh progress "正在整理 citations 與 freshness"
```

### 3. 完成工作時

```bash
# 告訴系統你完成了什麼
AI_NAME=Qwen bash scripts/ai-status.sh done "完成所有 UI 組件提取"
```

### 4. 要交接時

```bash
# 留下交接訊息給下一個 AI
AI_NAME=Qwen bash scripts/ai-status.sh handover "完成 UI 整理，需要 Codex 審查架構"
```

### 5. 發現可以優化的地方

```bash
# 留下優化建議
AI_NAME=Qwen bash scripts/ai-status.sh suggest "可以考慮把 Button 組件拆分"
```

### 5. 查看當前狀態

```bash
bash scripts/ai-status.sh status
```

---

## 🔄 自動更新機制

### 手動立即刷新

儀表板現在改成按「立即刷新」才會請求最新狀態。它會直接讀 `current-work.md`、`ai-activity.json`、`ai-activity-log.json` 的鏡像，所以即使 `state.json` 還沒先重建，其他 AI 的 `working/currentTask/recent activity` 也能顯示；若要連 metrics / health 一起更新，再跑 `bash scripts/sync-state.sh`。

### 同步程式碼狀態

```bash
# 掃描程式碼，更新指標
bash scripts/sync-state.sh
```

這會自動更新：

- App.jsx 行數
- 測試數量
- 健康狀態（build/lint/test）

---

## 📊 state.json 結構

```json
{
  "summary": {
    "today": "今天完成了 3 個功能...",
    "thisWeek": "本週完成 18 個任務...",
    "highlights": ["✅ 完成項目 1", "✅ 完成項目 2"]
  },
  "phases": {
    "phaseB": {
      "progress": 60,
      "tasks": [
        { "name": "任務 1", "status": "done" },
        { "name": "任務 2", "status": "doing" }
      ]
    }
  },
  "aiTeam": {
    "current": "Codex",
    "members": [
      {
        "name": "Codex",
        "role": "技術主導",
        "status": "working",
        "tasksCompleted": 12
      }
    ]
  },
  "handover": {
    "from": "Codex",
    "message": "完成 useAppRuntimeComposer 提取",
    "nextStep": "持續收斂 route shell hook",
    "optimizationSuggestions": ["建議 1", "建議 2"]
  }
}
```

---

## 💡 使用情境

### 情境 1：你是人類，想看進度

1. 打開 http://localhost:8080
2. 看到：
   - 今天完成了什麼
   - 每個 Phase 的進度
   - 哪個 AI 正在工作
   - 最近的交接訊息

### 情境 2：你是 AI，完成工作要回報

```bash
# 1. 完成工作
AI_NAME=Codex bash scripts/ai-status.sh done "完成 useAppRuntimeComposer 提取"

# 2. 留下交接訊息
AI_NAME=Codex bash scripts/ai-status.sh handover "App.jsx 降到 1004 行，下一步需要優化 route shell"

# 3. 留下優化建議
AI_NAME=Codex bash scripts/ai-status.sh suggest "可以考慮把 usePortfolioPersistence 拆分"
```

### 情境 3：你是 AI，要接手工作

1. 打開 http://localhost:8080
2. 查看「AI 交接筆記」了解上個 AI 做了什麼
3. 查看「優化建議」了解可以改進的地方
4. 查看「AI 團隊」知道誰剛完成工作
5. 開始工作

---

## 🚀 啟動儀表板

```bash
# 方法 1：VSCode Task
Cmd+Shift+P → Tasks: Run Task → 📄 Docs Site: Launch

# 方法 2：終端機
bash scripts/launch-docs-site.sh

# 然後打開 http://localhost:8080
```

---

## 📝 最佳實踐

### 給 AI

1. **完成工作就回報**：讓下一個 AI 知道現況
2. **交接訊息要具體**：寫清楚完成了什麼、下一步建議
3. **留下優化建議**：幫助專案變得更好
4. **查看交接筆記**：了解之前的工作脈絡

### 給人類

1. **定期查看儀表板**：了解專案進度
2. **不需要懂技術細節**：看總結和進度條就好
3. **有问题查看交接筆記**：AI 會留下詳細說明

---

## 🆘 常見問題

### Q: 儀表板沒有更新？

A: 先確認是否已更新 `docs/status/current-work.md`，再執行 `bash scripts/sync-state.sh`，最後按一次「立即刷新」。

### Q: AI 如何知道彼此的工作？

A: 所有 checkpoint 會先寫到 `docs/status/current-work.md`，再同步成 `state.json` 給儀表板顯示。

### Q: 如何添加新的 AI 成員？

A: 編輯 `state.json` 的 `aiTeam.members` 陣列。

### Q: 如何修改進度百分比？

A: 不要直接編輯 `state.json`。請更新真正的來源文件或同步腳本邏輯，再執行 `bash scripts/sync-state.sh`。
