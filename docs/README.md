# 文檔索引

最後更新：2026-03-28

---

## 🚀 快速開始

### 新使用者

1. [使用者指南](USER_GUIDE_COMPLETE.md) - 完整功能說明

### 新開發者/AI

1. [AI 協作指南](AI_COLLABORATION_GUIDE.md) - 協作規則
2. [系統架構](PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md) - 技術架構
3. [當前工作](superpowers/status/current-work.md) - 進行中任務

---

## 📚 核心文檔（必讀）

| 文檔                                                          | 用途                   | 讀者            |
| ------------------------------------------------------------- | ---------------------- | --------------- |
| [AI 協作指南](AI_COLLABORATION_GUIDE.md)                      | AI 協作規則、分工      | 所有 AI、開發者 |
| [系統架構](PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md)      | 技術架構、資料流       | 開發者、AI      |
| [使用者指南](USER_GUIDE_COMPLETE.md)                          | 功能說明、操作指南     | 使用者          |
| [當前工作](superpowers/status/current-work.md)                | 進行中任務、checkpoint | 開發者、AI      |
| [AI 角色分工](superpowers/status/ai-collaboration-channel.md) | AI 長期角色定位        | 所有 AI         |

---

## 📊 策略文檔

| 文檔                                                 | 用途                       |
| ---------------------------------------------------- | -------------------------- |
| [選股策略完整規格](stock-selection-strategy.md)      | 選股引擎設計與問題分析     |
| [付費/停損/籌碼討論](THREE_KEY_POINTS_DISCUSSION.md) | 付費機制、停損加倉、籌碼面 |
| [競品分析](MY_TW_COVERAGE_ANALYSIS.md)               | My-TW-Coverage 分析與借鏡  |
| [Phase 0 實作指南](phase0-implementation.md)         | 基礎建設實作總結           |

---

## 📁 目錄結構

```
docs/
├── README.md                      ← 你目前在這裡
├── AI_COLLABORATION_GUIDE.md     ← AI 協作規則
├── PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md  ← 系統架構
├── USER_GUIDE_COMPLETE.md        ← 使用者指南
├── stock-selection-strategy.md   ← 選股策略
├── phase0-implementation.md      ← Phase 0 實作
├── THREE_KEY_POINTS_DISCUSSION.md ← 策略討論
├── MY_TW_COVERAGE_ANALYSIS.md    ← 競品分析
├── DOCUMENT_CLEANUP_PROPOSAL.md  ← 文檔清理建議
│
├── superpowers/
│   ├── status/                   ← 狀態文件
│   │   ├── current-work.md       ← 當前工作
│   │   └── ai-collaboration-channel.md
│   ├── specs/                    ← 規格文件
│   └── plans/                    ← 計畫文件
│
├── archive/                      ← 歸檔區
│   ├── debug-logs/               ← Debug 報告
│   ├── optimization-logs/        ← 優化報告
│   ├── strategy/                 ← 策略歷史
│   └── historical/               ← 歷史文檔
│
├── evals/                        ← 評估框架
├── refactoring/                  ← 重構記錄
└── testing/                      ← 測試記錄
```

---

## 🔧 開發相關

### 驗證命令

```bash
# 完整驗證
npm run verify:local

# 單項檢查
npm run lint
npm run build
npm run test:run
npm run healthcheck
npm run smoke:ui
```

### 相關文檔

- [快速開始](QUICK_START.md)
- [本地開發配置](LOCAL_DEV_CONFIG_UPDATE.md)
- [伺服器訪問指南](SERVER_ACCESS_GUIDE.md)

---

## 📝 文檔清理記錄

**2026-03-28 清理：**

- 合併選股策略文檔（2 檔 → 1 檔）
- 合併 Phase 0-4 文檔（2 檔 → 1 檔）
- 歸檔 Debug 報告（6 檔 → archive）
- 歸檔 Optimization 報告（5 檔 → archive）
- 總減少：約 40% 文檔數量

詳見：[文檔清理建議](DOCUMENT_CLEANUP_PROPOSAL.md)

---

## 📞 問題回報

遇到問題？

1. 先查看 [AI 協作指南](AI_COLLABORATION_GUIDE.md)
2. 查看 [系統架構](PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md)
3. 查看 [當前工作](superpowers/status/current-work.md)
