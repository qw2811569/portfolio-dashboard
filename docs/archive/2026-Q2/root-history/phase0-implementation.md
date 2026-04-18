# Phase 0 基礎建設實作指南

最後更新：2026-03-28
狀態：Phase 0 已完成 → Phase 0.5（外部資源整合）進行中
驗證：lint ✅ build ✅
作者：Qwen Code
升級補充：Claude Opus（2026-03-28，新增 Phase 0.5 整合項目）

---

## 執行摘要

本文件整合 Phase 0-4 基礎建設的策略規劃與實作總結。

**完成項目：**

- ✅ 資料收集工具函式庫
- ✅ TWSE 三大法人 API
- ✅ MOPS 月營收 API（含反爬蟲對策）
- ✅ Thesis 追蹤系統
- ✅ 風險管理框架
- ✅ 貢獻積分系統
- ✅ Phase 4 問題分析報告

---

## 第一部分：策略規劃

### 1. 核心原則

1. **合法優先**：只用官方 API、RSS、合法來源
2. **漸進累積**：從最少摩擦力開始，逐步自動化
3. **真值分離**：明確區分 Truth Layer 與 Analysis Layer
4. **反爬蟲規避**：用多個合法來源交叉驗證，不硬碰硬

### 2. 資料來源

| 資料類型     | 來源            | 更新頻率   | 反爬蟲風險 |
| ------------ | --------------- | ---------- | ---------- |
| 收盤價       | TWSE API        | 每日       | 低         |
| 法人買賣超   | TWSE            | 每日       | 低         |
| 月營收       | MOPS            | 每月 10 日 | 中         |
| 財報         | MOPS            | 每季       | 中         |
| 法說會日程   | TWSE 重大訊息   | 不定期     | 低         |
| 分析師目標價 | Google News RSS | 不定期     | 中         |

### 3. 資料分層架構

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 0: 真值層 (Truth Layer) - 使用者輸入 + 官方 API       │
│ - 持倉成本、股數 (使用者輸入/截圖解析)                      │
│ - 收盤價 (TWSE API)                                         │
│ - 使用者目標價 (使用者輸入)                                 │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: 市場資料層 (Market Data) - 官方 API + RSS          │
│ - 月營收 (MOPS + RSS 交叉驗證)                              │
│ - 財報數據 (MOPS)                                           │
│ - 除權息 (TWSE API)                                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: 分析資料層 (Analysis Data) - RSS + AI 萃取         │
│ - 分析師目標價 (Google News RSS + AI 萃取)                  │
│ - 法人買賣超 (TWSE API)                                     │
│ - 融資融券 (TWSE API)                                       │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: 事件層 (Event Data) - RSS + MOPS + 使用者          │
│ - 法說會日程 (MOPS + RSS)                                   │
│ - 財報發布日 (MOPS + RSS)                                   │
│ - 產業新聞 (RSS)                                            │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: 脈絡層 (Context) - 漸進累積                        │
│ - 個股股性 (使用者標註 + 系統學習)                          │
│ - 策略規則 (收盤分析累積)                                   │
│ - 歷史案例 (事件復盤累積)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 第二部分：實作總結

### 4. 已完成實作

#### 4.1 核心常數更新

**檔案：** `src/constants.js`

```javascript
// Thesis 追蹤
export const DEFAULT_THESIS = { ... };

// 風險管理
export const DEFAULT_RISK_SETTINGS = { ... };

// 數據新鮮度
export const DATA_FRESHNESS = { ... };

// 儲存鍵值
export const STORAGE_KEYS = { ... };
```

#### 4.2 資料工具函式庫

**檔案：** `src/lib/dataUtils.js`

| 函式                          | 用途                |
| ----------------------------- | ------------------- |
| `calculateFreshness()`        | 計算數據新鮮度      |
| `calculateDataCompleteness()` | 計算數據完整性      |
| `reconcileData()`             | 多來源數據調解      |
| `buildTemporalContext()`      | 建立時間脈絡 Prompt |
| `calculatePositionSize()`     | 部位規模計算        |
| `checkRiskLimits()`           | 風險限制檢查        |
| `buildTaiwanMarketContext()`  | 台股脈絡建立        |

#### 4.3 TWSE API

**檔案：** `api/twse-institutional.js`

```
GET /api/twse-institutional?date=20260327
```

回應：

```json
{
  "date": "20260327",
  "institutions": {
    "foreign": { "buy": 1000000, "sell": 800000, "net": 200000 },
    "investment": { "buy": 500000, "sell": 300000, "net": 200000 },
    "dealer": { "buy": 100000, "sell": 150000, "net": -50000 }
  }
}
```

#### 4.4 MOPS 月營收 API

**檔案：** `api/mops-revenue.js`

```
GET /api/mops-revenue?stockId=2330&year=2026&month=2
```

反爬蟲對策：

- 隨機延遲（1-3 秒）
- User-Agent 輪替
- 快取（30 天）

#### 4.5 快取系統

**檔案：** `api/_lib/cache.js`

- 記憶體快取（Map）
- 自動過期機制
- 定期清理（每 10 分鐘）

#### 4.6 Thesis 追蹤系統

**檔案：** `src/hooks/useThesisTracking.js`

```javascript
const {
  theses,
  activeTheses,
  addThesis,
  updateThesis,
  removeThesis,
  getThesisByStock,
  getThesesNeedingReview,
} = useThesisTracking()
```

Thesis 結構：

```javascript
{
  id: "thesis-1234567890",
  stockId: "2330",
  reason: "月營收連續成長，AI 伺服器需求強勁",
  expectation: "Q1 財報 EPS 成長 20%",
  invalidation: "月營收轉負，毛利率下滑超過 5%",
  targetPrice: 1100,
  stopLossPercent: 10,
  status: "active",
}
```

#### 4.7 風險管理框架

**檔案：** `src/hooks/useRiskManagement.js`

```javascript
const { settings, warnings, riskSummary, calcPositionSize, checkLimits, validateTrade } =
  useRiskManagement({ holdings })
```

風險設定：

```javascript
{
  totalCapital: 1000,     // 總資金（萬元）
  riskPerTrade: 2,        // 每筆風險 (%)
  maxPosition: 30,        // 單一標的最大持倉 (%)
  maxSector: 50,          // 單一產業最大持倉 (%)
  maxLoss: 10,            // 總虧損上限 (%)
}
```

#### 4.8 貢獻積分系統

**檔案：** `src/hooks/useContributionPoints.js`

```javascript
const { points, summary, addPoints, dailyCheckIn, redeemReward } = useContributionPoints()
```

積分規則：

```javascript
POINT_RULES = {
  addThesis: 10,
  uploadScreenshot: 20,
  dailyCheckIn: 1,
  completeResearch: 15,
}
```

---

## 第三部分：Phase 4 問題分析

### 5. 研究系統問題

#### 5.1 數據品質問題

| 問題         | 對策                        |
| ------------ | --------------------------- |
| 數據不完整   | 完整性標記 + AI Prompt 警告 |
| 數據時效性   | 新鮮度指標 + 時間脈絡       |
| 數據來源衝突 | 來源優先級 + 衝突警告       |

#### 5.2 AI 分析問題

| 問題     | 對策                       |
| -------- | -------------------------- |
| 脈絡不足 | 使用者脈絡 + 台股脈絡      |
| 建議模糊 | 強制具體數字 + 輸出驗證    |
| 成本過高 | 數據壓縮 + 分層分析 + 快取 |

#### 5.3 使用者體驗問題

| 問題         | 對策                  |
| ------------ | --------------------- |
| 資訊超載     | 分層顯示 + 可折疊內容 |
| 建議不可執行 | 表格化 + 具體價位     |

---

## 第四部分：使用指南

### 6. 快速開始

#### 6.1 資料工具函式

```javascript
import {
  calculateFreshness,
  calculatePositionSize,
  buildTaiwanMarketContext,
} from 'src/lib/dataUtils.js'

// 計算新鮮度
const freshness = calculateFreshness('2026-03-27')

// 計算部位
const position = calculatePositionSize({
  totalCapital: 1000000,
  riskPerTrade: 2,
  entryPrice: 950,
  stopLossPrice: 850,
})
```

#### 6.2 Thesis 追蹤

```javascript
import { useThesisTracking } from 'src/hooks/useThesisTracking.js'

const { addThesis, getThesisByStock } = useThesisTracking()

await addThesis({
  stockId: '2330',
  reason: '月營收連續成長',
  expectation: 'Q1 財報 EPS 成長 20%',
  invalidation: '月營收轉負',
  targetPrice: 1100,
  stopLossPercent: 10,
})
```

#### 6.3 風險管理

```javascript
import { useRiskManagement } from 'src/hooks/useRiskManagement.js'

const { calcPositionSize, validateTrade } = useRiskManagement({ holdings })

const position = calcPositionSize(950, 850)
const validation = validateTrade({ code: '2330', value: position.positionValue })
```

---

## 第五部分：API 端點總覽

### 7. API 端點

```
GET  /api/twse-institutional?date=YYYYMMDD
GET  /api/mops-revenue?stockId=XXX&year=YYYY&month=M
POST /api/thesis-check
```

### 8. Hooks

```javascript
useThesisTracking(portfolioId)
useRiskManagement({ portfolioId, holdings })
useContributionPoints(userId)
```

---

## 第六部分：下一步行動

### 9. 本週完成（原 Qwen 項目）

- [ ] 前端 UI 整合（數據完整性標記、新鮮度指標）
- [ ] Thesis 表單組件
- [ ] 風險設定面板
- [ ] 積分顯示組件

### 10. 下週完成（原 Qwen 項目）

- [ ] TWSE 融資融券 API
- [ ] RSS 事件萃取擴展
- [ ] 數據同步機制

---

## 第七部分：Phase 0.5 — 外部資源整合

> 完整設計規格見 `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md`

### 11. Phase A：資料基礎（1 週）

| 項目                     | 檔案                            | 來源           |
| ------------------------ | ------------------------------- | -------------- |
| [ ] 資料同步腳本         | `scripts/sync-coverage-data.py` | My-TW-Coverage |
| [ ] 供應鏈 JSON          | `src/data/supplyChain.json`     | My-TW-Coverage |
| [ ] 主題 JSON            | `src/data/themes.json`          | My-TW-Coverage |
| [ ] 公司摘要 JSON        | `src/data/companyProfiles.json` | My-TW-Coverage |
| [ ] 資料適配層           | `src/lib/dataAdapters/`         | 架構設計       |
| [ ] STOCK_META 加 themes | `src/seedData.js`               | My-TW-Coverage |

### 12. Phase B：工作流升級（1 週）

| 項目                      | 檔案                             | 來源                       |
| ------------------------- | -------------------------------- | -------------------------- |
| [ ] Thesis Scorecard 升級 | `src/hooks/useThesisTracking.js` | financial-services-plugins |
| [ ] Catalyst 分類擴充     | `src/lib/eventUtils.js`          | financial-services-plugins |
| [ ] Dossier 供應鏈整合    | `src/lib/dossierUtils.js`        | My-TW-Coverage             |

### 13. Phase C：Morning Note + 收尾（1 週）

| 項目                     | 檔案                                    | 來源                       |
| ------------------------ | --------------------------------------- | -------------------------- |
| [ ] 公開資訊觀測站 API   | `api/mops-announcements.js`             | 新資料來源                 |
| [ ] 每日交易備忘組裝器   | `src/lib/morningNoteBuilder.js`         | financial-services-plugins |
| [ ] EventsPanel 分類 tab | `src/components/events/EventsPanel.jsx` | UI                         |
| [ ] 策略文件更新         | `docs/stock-selection-strategy.md`      | 已完成                     |
| [ ] Phase 0 文件更新     | `docs/phase0-implementation.md`         | 已完成                     |

---

## 附錄：檔案清單

### 新增檔案

```
src/
├── constants.js (更新)
├── lib/
│   └── dataUtils.js (新增)
├── hooks/
│   ├── useThesisTracking.js (新增)
│   ├── useRiskManagement.js (新增)
│   └── useContributionPoints.js (新增)

api/
├── _lib/
│   └── cache.js (新增)
├── twse-institutional.js (新增)
└── mops-revenue.js (新增)
```

---

## 參考文件

- `docs/AI_COLLABORATION_GUIDE.md`
- `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`
- `docs/THREE_KEY_POINTS_DISCUSSION.md`
- `docs/MY_TW_COVERAGE_ANALYSIS.md`
