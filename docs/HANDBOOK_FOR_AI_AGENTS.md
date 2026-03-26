# App.jsx 重構與架構文檔

**版本：** 1.0  
**最後更新：** 2026-03-27  
**狀態：** ✅ 完成  
**Build 狀態：** ✅ 通過 (380.90 KB, 1.07s)

---

## 📋 給接手 AI 的閱讀指南

### 必讀文件（按順序）

1. **本文檔** - 架構與重構結果（你正在閱讀的）
2. `CLAUDE.md` - 專案概述與本地啟動
3. `docs/refactoring/APP_REFACTORING_GUIDE.md` - 重構技術細節
4. `docs/refactoring/REFACTORING_DECISION_DOCUMENT.md` - 重構決策記錄

### 快速上手

```bash
# 本地啟動
npm run dev          # 前端開發模式
vercel dev           # 完整模式（含 API）

# 構建驗證
npm run build        # 必須通過

# 測試（待添加）
npm test
```

---

## 🎯 重構成果總結

### 前後對比

| 指標 | 重構前 | 重構後 | 改善 |
|------|--------|--------|------|
| App.jsx 行數 | 9,518 | 6,944 | **-27%** |
| 模組化代碼 | 0 | 7,171 行 | **+100%** |
| 可測試單元 | 0 | 50+ | **+100%** |
| Build 時間 | ~1s | ~1s | 持平 |
| Bundle 大小 | 404KB | 381KB | **-6%** |

### 提取的模組

```
src/
├── App.jsx              6,944 行 (主應用，保留 UI 渲染與狀態協調)
├── hooks/               1,840 行 (7 個 custom hooks)
│   ├── usePortfolioManagement.js  # 組合管理
│   ├── useCloudSync.js            # 雲端同步
│   ├── useMarketData.js           # 市場數據
│   ├── useStrategyBrain.js        # 策略大腦
│   ├── useEvents.js               # 事件追蹤
│   ├── useHoldings.js             # 持股管理
│   └── useReports.js              # 報告管理
├── components/          3,545 行 (12 個 UI 元件群組)
│   ├── common/          # 通用 UI 元件
│   ├── holdings/        # 持股相關
│   ├── watchlist/       # 觀察股
│   ├── events/          # 事件追蹤
│   ├── reports/         # 報告
│   ├── research/        # 研究
│   ├── trade/           # 交易上傳
│   ├── log/             # 交易日誌
│   ├── news/            # 新聞分析
│   └── overview/        # 總覽
├── lib/                 1,489 行 (5 個工具模組)
│   ├── holdings.js      # 持股計算
│   ├── brain.js         # 策略大腦邏輯
│   ├── datetime.js      # 日期時間
│   ├── market.js        # 市場數據
│   └── events.js        # 事件邏輯
└── utils.js             352 行 (向後相容層)
```

---

## 🏗️ 架構設計

### 分層架構

```
┌─────────────────────────────────────────────────────────┐
│                      App.jsx                            │
│  (6,944 行) UI 渲染 + 狀態協調 + 事件處理                │
├─────────────────────────────────────────────────────────┤
│                    Custom Hooks                         │
│  (1,840 行) 業務邏輯封装，每個 hook 管理一個功能域       │
├─────────────────────────────────────────────────────────┤
│              UI Components (Presentational)             │
│  (3,545 行) 純 UI 元件，接收 props 渲染，無狀態          │
├─────────────────────────────────────────────────────────┤
│                  Utility Libraries                      │
│  (1,489 行) 純函數，無副作用，可測試性最高               │
└─────────────────────────────────────────────────────────┘
```

### 數據流向

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  localStorage │ ──▶ │   Hooks      │ ──▶ │  Components  │
│   (狀態持久化) │     │ (業務邏輯)   │     │   (UI 渲染)   │
└──────────────┘     └──────────────┘     └──────────────┘
       ▲                    │                    │
       │                    ▼                    │
       │            ┌──────────────┐            │
       └────────────│  lib/ utils  │◀───────────┘
                    │  (純函數)     │
                    └──────────────┘
```

### 依賴關係

```
App.jsx
├── hooks/ (業務邏輯)
│   └── lib/ (工具函數)
├── components/ (UI 元件)
│   └── lib/ (工具函數)
└── utils.js (向後相容)
    └── lib/ (工具函數)
```

**關鍵原則：**
- ✅ lib/ 不依賴 App.jsx 或 hooks/
- ✅ components/ 只接收 props，不直接修改狀態
- ✅ hooks/ 封装所有狀態修改邏輯
- ✅ App.jsx 負責協調，不直接處理業務邏輯

---

## 📦 核心模組說明

### 1. hooks/ - 業務邏輯層

#### usePortfolioManagement
```javascript
// 管理投資組合 CRUD、切換、總覽模式
const {
  portfolios,           // 所有組合
  activePortfolioId,    // 目前組合 ID
  viewMode,             // 'portfolio' | 'overview'
  portfolioSummaries,   // 組合摘要（含指標）
  switchPortfolio,      // 切換組合
  createPortfolio,      // 新增組合
  renamePortfolio,      // 更名
  deletePortfolio,      // 刪除
  openOverview,         // 進入總覽
  exitOverview,         // 離開總覽
} = usePortfolioManagement({ ... });
```

#### useCloudSync
```javascript
// 管理雲端同步（owner-only）
const {
  cloudSync,            // 是否已同步
  canUseCloud,          // 是否可使用雲端
  scheduleCloudSave,    // 排程保存
  syncAnalysisFromCloud, // 同步分析
  syncResearchFromCloud, // 同步研究
} = useCloudSync({ activePortfolioId, viewMode });
```

#### useMarketData
```javascript
// 管理市場數據、收盤價同步
const {
  marketPriceCache,     // 價格快取
  marketPriceSync,      // 同步狀態
  refreshing,           // 是否刷新中
  refreshPrices,        // 手動刷新
  syncPostClosePrices,  // 收盤後同步
} = useMarketData({ ... });
```

#### useStrategyBrain
```javascript
// 管理策略大腦、規則、驗證
const {
  strategyBrain,        // 策略大腦狀態
  brainValidation,      // 驗證案例
  brainAudit,           // 審核桶
  updateStrategyBrain,  // 更新大腦
  addValidationCase,    // 新增案例
  mergeBrainAudit,      // 合併審核
} = useStrategyBrain({ ... });
```

#### useEvents
```javascript
// 管理事件追蹤（pending → tracking → closed）
const {
  newsEvents,           // 所有事件
  eventsByStatus,       // 按狀態分組
  urgentCount,          // 待處理數量
  addEvent,             // 新增事件
  transitionEvent,      // 狀態轉換
  startReview,          // 開始復盤
  submitReview,         // 提交復盤
} = useEvents({ ... });
```

#### useHoldings
```javascript
// 管理持股、計算、 watchlist
const {
  holdings,             // 持股列表
  holdingsSummary,      // 持股摘要
  topGainers,           // 前 5 漲幅
  topLosers,            // 前 5 跌幅
  upsertHolding,        // 新增/更新
  applyTrade,           // 應用交易
  updateTargetPrice,    // 更新目標價
} = useHoldings({ ... });
```

#### useReports
```javascript
// 管理日報、分析歷史
const {
  analysisHistory,      // 分析歷史
  dailyReport,          // 目前日報
  dailyExpanded,        // 是否展開
  addAnalysis,          // 新增分析
  deleteAnalysis,       // 刪除分析
} = useReports({ ... });
```

### 2. lib/ - 工具函數層

#### lib/holdings.js
```javascript
// 持股相關純函數
export function resolveHoldingPrice(item, overridePrice) { }
export function getHoldingMarketValue(item) { }
export function getHoldingUnrealizedPnl(item) { }
export function getHoldingReturnPct(item) { }
export function normalizeHoldings(rows, quotes, priceHints) { }
export function applyTradeEntryToHoldings(rows, trade) { }
// ... 共 20+ 函數
```

#### lib/brain.js
```javascript
// 策略大腦相關純函數
export function brainRuleText(rule) { }
export function normalizeBrainRule(rule) { }
export function deriveBrainRuleValidationScore(rule) { }
export function normalizeBrainAuditBuckets(value) { }
export function mergeBrainWithAuditLifecycle(next, current, audit) { }
// ... 共 27+ 函數
```

#### lib/events.js
```javascript
// 事件追蹤相關純函數
export function normalizeEventRecord(event) { }
export function transitionEventStatus(event, newStatus) { }
export function buildEventStockOutcomes(event) { }
export function inferEventActual(priceAtEvent, priceAtExit) { }
// ... 共 16+ 函數
```

#### lib/datetime.js
```javascript
// 日期時間相關純函數
export function getTaipeiClock(date) { }
export function parseFlexibleDate(value) { }
export function formatDateTW(date) { }
export function canRunPostClosePriceSync(date, syncMeta) { }
// ... 共 15+ 函數
```

#### lib/market.js
```javascript
// 市場數據相關純函數
export function normalizeMarketPriceCache(value) { }
export function getCachedQuotesForCodes(cache, codes) { }
export function fetchJsonWithTimeout(input, init, timeoutMs) { }
// ... 共 10+ 函數
```

### 3. components/ - UI 元件層

每個元件群組都遵循相同模式：
- 接收 props
- 純渲染，無狀態
- 回調函數由 parent 提供

```javascript
// 範例：HoldingsPanel
export function HoldingsPanel({
  holdings,
  totalVal,
  totalCost,
  winners,
  losers,
  top5,
  // ... callbacks
  onUpdateTarget,
  onUpdateAlert,
}) {
  return h("div", null,
    h(HoldingsSummary, { holdings, totalVal, totalCost }),
    h(PortfolioHealthCheck, { holdings }),
    h(Top5Holdings, { holdings, totalVal }),
    h(WinLossSummary, { winners, losers }),
    h(HoldingsTable, { holdings, onUpdateTarget, onUpdateAlert }),
  );
}
```

---

## 🔑 關鍵設計決策

### 1. 為什麼保留 6,944 行的 App.jsx？

**決策：** 不進一步提取 UI 渲染邏輯

**理由：**
- UI 渲染邏輯緊密耦合 React 生命週期
- 進一步提取會增加複雜度但收益低
- 目前的分層已足夠清晰
- 保持「足夠好」而非「完美」

**文檔：** `docs/refactoring/REFACTORING_DECISION_DOCUMENT.md`

### 2. 為什麼有 utils.js？

**目的：** 向後相容層

**說明：**
- 重構前所有代碼都在 App.jsx 和 utils.js
- 重構後 utils.js 改為 re-export from lib/
- 確保舊的 import 路徑仍然有效
- 未來可逐步移除

### 3. 為什麼 hooks 不直接 import lib/？

**實際上是這樣做的！**

```javascript
// hooks/useHoldings.js
import {
  normalizeHoldings,
  getHoldingMarketValue,
  // ...
} from "../lib/holdings.js";
```

所有 hooks 都從 lib/ import 純函數，確保：
- 業務邏輯可測試
- 無重複代碼
- 單一事實來源

### 4. 為什麼 components 不直接 import lib/？

**混合策略：**
- 簡單計算：直接在 component 中計算（減少 import）
- 複雜邏輯：從 lib/ import（保持可測試性）

**範例：**
```javascript
// 簡單計算 - 直接在 component 中
const pct = ((price - cost) / cost) * 100;

// 複雜邏輯 - 從 lib/ import
const normalized = normalizeEventRecord(event);
```

---

## 🧪 測試策略（待實現）

### 建議的測試結構

```
tests/
├── lib/
│   ├── holdings.test.js     # 持股計算測試
│   ├── brain.test.js        # 策略規則測試
│   ├── datetime.test.js     # 日期處理測試
│   └── events.test.js       # 事件邏輯測試
├── hooks/
│   ├── useHoldings.test.js  # Hook 狀態測試
│   ├── useEvents.test.js    # Hook 狀態測試
│   └── ...
└── components/
    ├── common/
    │   └── Base.test.js     # UI 元件測試
    └── ...
```

### 測試優先級

1. **P0 - lib/ 純函數**
   - 最容易測試
   - 無副作用
   - 高覆蓋率 (>90%)

2. **P1 - hooks/**
   - 狀態管理邏輯
   - 中覆蓋率 (>70%)

3. **P2 - components/**
   - UI 渲染測試
   - 關鍵路徑測試

---

## 🚀 開發指南

### 新增功能流程

1. **確定功能類型**
   - 純邏輯 → `lib/`
   - 狀態管理 → `hooks/`
   - UI 渲染 → `components/`

2. **實作順序**
   ```
   lib/ (純函數)
     ↓
   hooks/ (業務邏輯)
     ↓
   components/ (UI 元件)
     ↓
   App.jsx (整合)
   ```

3. **測試驗證**
   ```bash
   npm run build  # 必須通過
   ```

### 修改現有功能

1. **找到對應模組**
   - 持股計算 → `lib/holdings.js`
   - 事件邏輯 → `lib/events.js` + `hooks/useEvents.js`
   - UI 渲染 → `components/{feature}/`

2. **修改後驗證**
   ```bash
   npm run build
   # 手動測試相關功能
   ```

### 除錯技巧

1. **狀態問題** → 檢查對應的 hook
2. **計算錯誤** → 檢查 lib/ 純函數
3. **UI 問題** → 檢查 components/ props

---

## 📊 效能指標

### Build 指標

```
Build 時間：     ~1.0s
Bundle 大小：    380.90 KB (gzip: 125.54 KB)
模組數量：     65
```

### 執行時指標（待測量）

```
初次渲染：     TBD ms
互動延遲：     TBD ms
記憶體使用：   TBD MB
```

---

## 🔧 常見問題

### Q: 為什麼 App.jsx 還有 6,944 行？

**A:** 這是經過深思熟慮的決策。進一步提取會導致：
- ROI 遞減（投入 8 小時僅減少 21%）
- 循環依賴風險
- 測試覆蓋率不足

目前的結構已達到「足夠好」的狀態。

### Q: 如何找到某個功能的代碼？

**A:** 遵循以下規則：
- 計算邏輯 → `lib/{feature}.js`
- 狀態管理 → `hooks/use{Feature}.js`
- UI 渲染 → `components/{feature}/`

### Q: 如何添加新功能？

**A:** 
1. 先在 lib/ 添加純函數
2. 在 hooks/ 添加狀態管理
3. 在 components/ 添加 UI
4. 在 App.jsx 整合

### Q: utils.js 可以做什麼？

**A:** 僅用於向後相容。新代碼應直接從 lib/ import。

---

## 📚 相關文檔

| 文檔 | 用途 |
|------|------|
| `CLAUDE.md` | 專案概述、本地啟動 |
| `docs/refactoring/APP_REFACTORING_GUIDE.md` | 重構技術細節 |
| `docs/refactoring/PHASE_4_FINAL_COMPLETE.md` | Phase 4 完成報告 |
| `docs/refactoring/REFACTORING_DECISION_DOCUMENT.md` | 重構決策記錄 |
| `docs/refactoring/FINAL_OPTIMIZATION_REPORT.md` | 最終優化報告 |

---

## ✅ 檢查清單（接手時）

- [ ] 閱讀 `CLAUDE.md` 了解專案
- [ ] 運行 `npm run build` 驗證
- [ ] 閱讀本文檔了解架構
- [ ] 閱讀 `REFACTORING_DECISION_DOCUMENT.md` 了解決策
- [ ] 運行本地開發環境測試
- [ ] 確認所有功能正常

---

## 📞 聯絡與協作

如有疑問，請參考：
1. 本文檔
2. 相關文檔
3. 代碼註解

**重要原則：**
- 保持現有架構
- 新增代碼遵循相同模式
- 修改前確保測試覆蓋
- 保持向後相容

---

**文檔版本：** 1.0  
**最後更新：** 2026-03-27  
**維護者：** AI 協作團隊
