# 分類狀態報告

**更新日期：** 2026-03-27  
**整體進度：** Phase 1 完成 (基礎架構) / Phase 2-4 待進行

## 目前狀態

### ✅ 已完成 (Phase 1)

| 模組 | 檔案 | 行數 | 說明 |
|------|------|------|------|
| **Holdings 工具** | `lib/holdings.js` | 365 行 | 持股計算、正規化、聚合 |
| **Brain 工具** | `lib/brain.js` | 426 行 | 策略規則、驗證、類比案例 |
| **日期時間** | `lib/datetime.js` | 197 行 | 日期解析、格式化、市場時鐘 |
| **市場資料** | `lib/market.js` | 181 行 | 報價快取、價格同步 |
| **通用元件** | `components/common/Base.jsx` | ~200 行 | Card, Button, Badge, MetricCard |
| **工具匯出** | `utils.js` | 355 行 | 向後相容 + storage helpers |

**小計：** ~1,724 行（已提取）

### ❌ 尚未提取 (仍在 App.jsx 內)

| 區塊 | 預估行數 | 優先級 | 說明 |
|------|----------|--------|------|
| **UI 元件** | ~4,000 行 | 🔴 高 | 各分頁的渲染邏輯（持股、選股、事件等） |
| **State 管理** | ~1,500 行 | 🔴 高 | useState, useEffect, 回調函數 |
| **API 調用** | ~800 行 | 🟡 中 | `/api/analyze`, `/api/research`, `/api/brain` |
| **事件追蹤** | ~600 行 | 🟡 中 | 事件 CRUD、狀態轉換、復盤 |
| **持股管理** | ~500 行 | 🟡 中 | 持股增刪改、memo 記錄 |
| **策略大腦** | ~800 行 | 🟡 中 | brain 狀態、規則生命週期 |
| **報告產生** | ~400 行 | 🟢 低 | 週報、日報、分析歷史 |
| **雲端同步** | ~300 行 | 🟡 中 | owner-only cloud gate |
| **其他工具** | ~400 行 | 🟢 低 | 各種 helper 函數 |

**小計：** ~9,300 行（待提取）

**總計：** App.jsx 目前 **9,519 行**

---

## 需要改進的地方

### 1. 🔴 高優先級 - 提取 Hooks

目前 `usePortfolioManagement.js` 已存在，但還有更多邏輯需要提取：

```
src/hooks/
├── usePortfolioManagement.js    ✅ 已存在
├── useCloudSync.js              ❌ 待提取（雲端同步邏輯）
├── useMarketData.js             ❌ 待提取（價格同步、報價）
├── useStrategyBrain.js          ❌ 待提取（brain 狀態、規則）
├── useEvents.js                 ❌ 待提取（事件追蹤）
├── useHoldings.js               ❌ 待提取（持股管理）
└── useReports.js                ❌ 待提取（報告產生）
```

**為什麼重要：**
- 減少 App.jsx 的 state 管理複雜度
- 讓邏輯可測試、可重用
- 方便未來功能擴展

---

### 2. 🔴 高優先級 - 提取 UI 元件

目前所有 UI 都在 App.jsx 內，應該按功能分組：

```
src/components/
├── holdings/
│   ├── HoldingsPanel.jsx        # 持股分頁主體
│   ├── HoldingsTable.jsx        # 持股表格
│   ├── HoldingRow.jsx           # 單一股持股列
│   ├── HoldingDetail.jsx        # 持股詳情（目標價、警報）
│   └── HoldingSummary.jsx       # 持股摘要卡片
│
├── watchlist/
│   ├── WatchlistPanel.jsx       # 選股清單主體
│   ├── WatchlistRow.jsx         # 選股列
│   └── RelayPlanCard.jsx        # 接力計畫卡片
│
├── events/
│   ├── EventsPanel.jsx          # 事件追蹤主體
│   ├── EventCard.jsx            # 事件卡片
│   ├── EventForm.jsx            # 事件表單（新增/編輯）
│   └── EventReviewModal.jsx     # 復盤對話框
│
├── reports/
│   ├── ReportsPanel.jsx         # 報告分頁主體
│   ├── DailyReportCard.jsx      # 日報卡片
│   ├── AnalysisHistoryList.jsx  # 分析歷史列表
│   └── ReportRefreshMeta.jsx    # 報告刷新元數據
│
├── brain/
│   ├── StrategyBrainPanel.jsx   # 策略大腦主體
│   ├── BrainRulesDisplay.jsx    # 規則顯示
│   ├── BrainChecklists.jsx      # 檢查清單
│   ├── BrainValidationPanel.jsx # 驗證案例
│   └── BrainRuleEditor.jsx      # 規則編輯器
│
└── overview/
    ├── OverviewPanel.jsx        # 總覽頁面
    └── PortfolioSummaryGrid.jsx # 組合摘要網格
```

**為什麼重要：**
- App.jsx 可減少 ~4,000 行
- UI 元件可獨立測試
- 更容易维护和修改特定功能

---

### 3. 🟡 中優先級 - 提取 API 層

目前 API 調用分散在 App.jsx 各處，應該集中管理：

```
src/lib/
├── api/
│   ├── analyze.js               # 收盤分析、策略大腦更新
│   ├── research.js              # 深度研究
│   ├── brain.js                 # 雲端同步、brain CRUD
│   ├── events.js                # 事件 API
│   └── twse.js                  # 股價同步
│
└── sync/
    ├── cloudSync.js             # 雲端同步邏輯
    ├── localBackup.js           # 本機備份/匯入
    └── migration.js             # 資料遷移
```

**為什麼重要：**
- API 邏輯集中，易於維護
- 方便添加錯誤處理、重試機制
- 可獨立測試 API 調用

---

### 4. 🟡 中優先級 - 改進工具模組

目前 `lib/` 中的模組還可以改進：

#### 4.1 添加 events.js
```javascript
// src/lib/events.js
export function normalizeEvent(event) { }
export function normalizeNewsEvents(events) { }
export function transitionEventStatus(event, newStatus) { }
export function buildEventReviewDossiers(event, dossiers) { }
export function classifyBrainValidationEventPhase(dossier) { }
```

#### 4.2 添加 reports.js
```javascript
// src/lib/reports.js
export function normalizeDailyReport(report) { }
export function normalizeAnalysisHistory(entries) { }
export function buildReportRefreshQueue(holdings, events, brain) { }
export function sortReportsByPriority(reports) { }
```

#### 4.3 改進現有模組
- `lib/brain.js` - 添加更多驗證邏輯
- `lib/holdings.js` - 添加持股分組、篩選邏輯
- `lib/datetime.js` - 添加台股交易日历

---

### 5. 🟢 低優先級 - 代碼品質改進

#### 5.1 添加 JSDoc 註解
目前大部分函數缺少文檔：
```javascript
/**
 * 解析持股價格（優先級：覆蓋價格 > 存儲價格 > 推算價格）
 * @param {Object} item - 持股物件
 * @param {number|null} overridePrice - 覆蓋價格（來自 API）
 * @returns {number} 解析後的價格
 */
export function resolveHoldingPrice(item, overridePrice = null) { ... }
```

#### 5.2 添加單元測試
```
tests/
├── lib/
│   ├── holdings.test.js
│   ├── brain.test.js
│   ├── datetime.test.js
│   └── market.test.js
└── components/
    ├── common/
    │   └── Base.test.js
    └── ...
```

#### 5.3 添加 PropTypes 或 TypeScript
目前使用純 JavaScript，可以考慮：
- 添加 PropTypes 進行運行時檢查
- 或遷移到 TypeScript 獲得靜態類型檢查

---

## 建議的下一步行動

### 第一段（1-2 週）
1. **提取 `useCloudSync.js`** - 減少 App.jsx 約 300 行
2. **提取 `useMarketData.js`** - 減少約 200 行
3. **提取 Holdings UI 元件** - 減少約 800 行
4. **修復 App.jsx 第 4105 行的重複宣告錯誤**

### 第二段（2-3 週）
1. **提取 Events UI 元件** - 減少約 600 行
2. **提取 Brain UI 元件** - 減少約 500 行
3. **提取 `useEvents.js`** - 減少約 400 行
4. **提取 `useStrategyBrain.js`** - 減少約 300 行

### 第三段（3-4 週）
1. **提取 Reports/Watchlist/Overview UI** - 減少約 1,500 行
2. **提取 API 層** - 集中所有 API 調用
3. **添加單元測試** - 覆蓋 lib/ 和 hooks/
4. **最終重構 App.jsx** - 減少到 ~500 行

---

## 目前檔案結構評分

| 維度 | 評分 | 說明 |
|------|------|------|
| **基礎架構** | ⭐⭐⭐⭐⭐ | lib/ 模組化完善 |
| **UI 元件** | ⭐⭐ | 只有 common/Base.jsx |
| **Hooks** | ⭐⭐ | 只有 usePortfolioManagement |
| **工具函數** | ⭐⭐⭐⭐ | holdings/brain/datetime/market 已提取 |
| **文檔** | ⭐⭐⭐⭐ | 有重構指南 |
| **測試** | ⭐ | 尚無單元測試 |

**總評：** ⭐⭐⭐ (3/5) - 基礎良好，但還有大量工作

---

## 結論

**已完成：**
- ✅ 基礎 lib/ 模組（~1,700 行）
- ✅ 通用 UI 元件
- ✅ 向後相容的 utils.js
- ✅ 重構文檔

**待完成：**
- ❌ 提取 6-7 個 custom hooks
- ❌ 提取 20+ 個 UI 元件
- ❌ 提取 API 層
- ❌ 添加單元測試
- ❌ App.jsx 從 9,519 行減少到 ~500 行

**預估工作量：** 4-6 週（全職）或 8-12 週（兼職）
