# AI 共享狀態系統使用指南

> 2026-03-30 更新
>
> - `docs/status/current-work.md` 是唯一 canonical 任務 checkpoint 真相
> - `docs/status/ai-activity.json` 是 canonical AI 即時工作狀態真相
> - `docs/status/ai-activity-log.json` 是 canonical AI 即時活動 feed 真相
> - `docs-site/state.json` 現在是由 `bash scripts/sync-state.sh` 從 `current-work.md` 自動生成的展示檔
> - 不要再把 `state.json` 當成獨立黑板手動維護
> - 正確流程是：用 `scripts/ai-status.sh` / `scripts/ai-state.sh` 更新 AI 狀態、activity feed 與 checkpoint，再執行 `bash scripts/sync-state.sh`
> - 目前推薦的變更歸因組合是：`GitLens + BlamePrompt + ai-status/launcher + ai-commit.sh`
> - 若需要連 build / lint / tests 健康狀態一起重刷，改用 `bash scripts/sync-state.sh --full`

## 🎯 核心概念

```
┌──────────────────────────────────────────────┐
│  current-work.md + ai-activity.json          │
│                                              │
│   這是 AI 協作的 canonical 真相層             │
│   • AI 開始/完成 → ai-status.sh / ai-state.sh │
│   • checkpoint → current-work.md             │
│   • 同步儀表板 → bash scripts/sync-state.sh   │
│   • HTML 讀取 → 透過「立即刷新」讀取展示檔      │
└──────────────────────────────────────────────┘
           ↑                    ↑
           │                    │
    ┌──────┴──────┐      ┌─────┴──────┐
    │  sync-state │      │ docs-site  │
    │  產生展示檔 │      │  讀取 state │
    └─────────────┘      └────────────┘
```

---

## 📋 AI 工作流程

### 1. 開始工作前 - 查詢當前狀態

```bash
# 查看完整狀態
./scripts/ai-state.sh status

# 查看最近進度（最近 5 筆）
./scripts/ai-state.sh timeline

# 查看交接訊息（上個 AI 留下了什麼）
./scripts/ai-state.sh handover

# 查看下一步建議
./scripts/ai-state.sh next-step

# 查看 AI 團隊狀態（誰在工作）
./scripts/ai-state.sh ai-status

# 查看程式碼指標
./scripts/ai-state.sh metrics
```

### 2. 完成一個 checkpoint 後

```bash
# 直接用 ai-status 寫入 checkpoint + 同步 docs-site
  AI_NAME=Qwen ./scripts/ai-status.sh progress "正在整理 citations"
  AI_NAME=Qwen ./scripts/ai-status.sh done "完成 knowledge-base 第一批整理"
```

### 3. 若需要重刷健康狀態

```bash
# 會重新檢查 build / lint / tests，再更新 docs-site/state.json
bash scripts/sync-state.sh --full
```

---

## 📊 完整命令參考

### 查詢類（只讀）

| 命令        | 說明              | 輸出範例                                       |
| ----------- | ----------------- | ---------------------------------------------- |
| `status`    | 查看完整狀態      | 最後更新、指標、Phase 進度、交接訊息、健康狀態 |
| `timeline`  | 查看最近 5 筆進度 | 時間、AI、完成項目、影響                       |
| `handover`  | 查看交接訊息      | 來自誰、訊息、下一步、優化建議                 |
| `ai-status` | 查看 AI 團隊狀態  | 每個 AI 的角色、狀態、完成任務數               |
| `metrics`   | 查看程式碼指標    | App.jsx 行數、測試數量、健康狀態               |
| `next-step` | 查看下一步建議    | 下一步、Phase 進度、交接訊息                   |

### 更新類（寫入 canonical 狀態）

| 命令                      | 說明       | 更新內容                                                |
| ------------------------- | ---------- | ------------------------------------------------------- |
| `start`                   | 開始新任務 | 更新 `docs/status/ai-activity.json`                     |
| `done`                    | 完成任務   | 寫入 `current-work.md` checkpoint 並同步 docs-site      |
| `handover-msg / handover` | 留下交接   | 寫入 `current-work.md` checkpoint 並同步 docs-site      |
| `suggest`                 | 添加建議   | 寫入 `current-work.md` 建議 checkpoint 並同步 docs-site |
| `blocker`                 | 記錄阻礙   | 寫入 `current-work.md` 阻礙 checkpoint 並同步 docs-site |
| `sync`                    | 同步程式碼 | 由 `current-work.md` 重新生成 docs-site 展示狀態        |

---

## 🔄 實際工作範例

### 範例 1：Qwen 完成 UI 重構

```bash
# 1. 開始前查看狀態
./scripts/ai-state.sh status

# 2. 開始工作
AI_NAME=Qwen ./scripts/ai-state.sh start "重構 UI 組件"

# ... 實際工作 ...

# 3. 完成工作
AI_NAME=Qwen ./scripts/ai-state.sh done "完成所有 UI 組件提取"

# 4. 留下交接
AI_NAME=Qwen ./scripts/ai-state.sh handover-msg "完成 UI 整理，需要 Codex 審查架構"

# 5. 留下建議
AI_NAME=Qwen ./scripts/ai-state.sh suggest "可以考慮把 Button 組件獨立成 package"
```

### 範例 2：Codex 接手工作

```bash
# 1. 查看交接訊息
./scripts/ai-state.sh handover

# 輸出：
# =====================================
#      AI 交接筆記
# =====================================
#
# 來自：Qwen
# 時間：2026-03-29T14:30:00+08:00
#
# 📝 訊息：
# 完成 UI 整理，需要 Codex 審查架構
#
# ➡️ 下一步：
# 審查 UI 組件架構
#
# 💡 優化建議：
#   • 可以考慮把 Button 組件獨立成 package

# 2. 查看最近進度
./scripts/ai-state.sh timeline

# 3. 開始工作
AI_NAME=Codex ./scripts/ai-state.sh start "審查 UI 架構"

# ... 審查工作 ...

# 4. 完成
AI_NAME=Codex ./scripts/ai-state.sh done "完成 UI 架構審查，通過"
```

---

## 📁 state.json 結構

```json
{
  "lastUpdated": "2026-03-29T14:30:00+08:00",

  "project": {
    "name": "台股投資決策工作台",
    "version": "1.0.0"
  },

  "metrics": {
    "appJsxLines": 1004,
    "appJsxLinesChange": -150,
    "testCases": 163,
    "completedTasks": 19,
    "inProgressTasks": 3
  },

  "phases": {
    "phaseB": {
      "name": "工作流升級",
      "progress": 60,
      "status": "in-progress",
      "tasks": [
        { "name": "任務 1", "status": "done" },
        { "name": "任務 2", "status": "doing" }
      ]
    }
  },

  "timeline": [
    {
      "time": "14:30",
      "ai": "Qwen",
      "title": "完成所有 UI 組件提取",
      "status": "done"
    }
  ],

  "aiTeam": {
    "current": "Qwen",
    "members": [
      {
        "name": "Qwen",
        "role": "低風險實作",
        "status": "working",
        "tasksCompleted": 9
      }
    ]
  },

  "handover": {
    "from": "Qwen",
    "time": "2026-03-29T14:30:00+08:00",
    "message": "完成 UI 整理，需要 Codex 審查架構",
    "nextStep": "審查 UI 組件架構",
    "blockers": [],
    "optimizationSuggestions": ["可以考慮把 Button 組件獨立成 package"]
  },

  "health": {
    "overall": "healthy",
    "build": "passing",
    "lint": "passing",
    "tests": "passing"
  }
}
```

---

## 🌐 HTML 儀表板

### 人類查看方式

1. 啟動網站：`bash scripts/launch-docs-site.sh`
2. 打開瀏覽器：`http://localhost:8080`
3. 查看視覺化儀表板

### 更新機制

- **手動立即刷新**
- **讀取衍生展示檔** - 顯示最新 `docs-site/state.json`
- **若剛更新 `current-work.md`** - 執行 `bash scripts/sync-state.sh`

### 儀表板內容

- 今日總結、本週進度
- 關鍵指標（App.jsx 行數、測試數量）
- Phase 進度條
- AI 團隊狀態
- 交接筆記
- 時間軸

---

## 💡 最佳實踐

### 給 AI

1. **開始前查詢** - 用 `status` 或 `handover` 了解現況
2. **開始任務就更新 live status** - 用 `AI_NAME=<Name> ./scripts/ai-status.sh start "..."`
3. **完成任務就寫 checkpoint** - 用 `AI_NAME=<Name> ./scripts/ai-status.sh done "..."`
4. **同步展示** - `done / handover / suggest / blocker` 會自動執行 `sync-state.sh`
5. **需要重刷健康狀態時** - 再執行 `bash scripts/sync-state.sh --full`
6. **不要手動編輯 `state.json`** - 它是衍生檔，不是黑板

### 給人類

1. **查看儀表板** - 打開瀏覽器看視覺化進度
2. **查看命令輸出** - 用 `./scripts/ai-state.sh status` 看詳細資訊
3. **不需要懂技術** - 看總結和進度條就好

---

## 🆘 常見問題

### Q: AI 如何知道彼此的工作？

A: 所有 checkpoint 都先寫到 `docs/status/current-work.md`，其他 AI 再透過 `bash scripts/ai-state.sh status` 或 docs-site 讀取衍生狀態。

### Q: HTML 儀表板多久更新一次？

A: 現在改成手動按「立即刷新」；若資料還是舊的，通常代表還沒執行 `bash scripts/sync-state.sh`。

### Q: 如何添加新的 AI 成員？

A: 編輯 `state.json` 的 `aiTeam.members` 陣列。

### Q: 如何修改進度百分比？

A: 調整真正的來源文件或協作文件後，再重建 `state.json`；不要把展示檔當成主資料層直接編輯。

---

## 🔗 相關腳本

- `scripts/ai-state.sh` - AI 共享狀態查詢（寫入命令已停用）
- `scripts/sync-state.sh` - 由 `current-work.md` 重建 docs-site 展示狀態
- `scripts/launch-docs-site.sh` - 啟動 HTML 儀表板
