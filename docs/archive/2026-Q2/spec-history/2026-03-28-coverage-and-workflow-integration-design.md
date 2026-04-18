# 外部資源整合設計規格書：My-TW-Coverage + Financial Services Plugins

最後更新：2026-03-28
狀態：設計規格（待實作）
作者：Claude Opus
審閱：使用者確認方向

---

## 1. 背景與動機

我們的台股投資決策工作台目前有完整的持倉管理、事件追蹤、策略大腦、thesis 追蹤等核心功能，但在兩個面向仍有明顯缺口：

1. **資料深度不足** — 持倉 dossier 缺少供應鏈、客戶/供應商、主題分類等結構化 context
2. **分析工作流不夠結構化** — thesis 追蹤是扁平列表，事件缺少分類和影響度評估

兩個外部 GitHub repo 能補上這些缺口：

| Repo                                                                                              | 定位                     | 我們取什麼                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| [Timeverse/My-TW-Coverage](https://github.com/Timeverse/My-TW-Coverage)                           | 1,735 家台股結構化資料庫 | 供應鏈、主題篩選、公司摘要                             |
| [anthropics/financial-services-plugins](https://github.com/anthropics/financial-services-plugins) | 機構級金融分析工作流     | thesis scorecard、catalyst calendar、morning note 結構 |

---

## 2. 整體架構

```
┌──────────────────────────────────────────────────────────────────┐
│                     我們的台股投資決策工作台                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │ 資料適配層   │  │ 靜態參考資料  │  │ 結構化工作流           │   │
│  │ (Adapters)  │  │ (Coverage)   │  │ (Workflow Skills)     │   │
│  │             │  │              │  │                       │   │
│  │ TWSE公開API │  │ 供應鏈 JSON  │  │ Thesis Scorecard      │   │
│  │ MOPS API    │  │ 主題 JSON    │  │ Catalyst Calendar     │   │
│  │ Coverage靜態│  │ 公司摘要JSON │  │ Morning Note          │   │
│  │ ──未來──    │  │              │  │                       │   │
│  │ FactSet MCP │  │              │  │                       │   │
│  │ Morningstar │  │              │  │                       │   │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬───────────┘   │
│         │                │                      │               │
│         ▼                ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              統一內部格式 (CompanyData / Event / Thesis) │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │ dossierUtils│  │ brainRuntime │  │ AI Prompt Builder│       │
│  │ holdings    │  │ eventUtils   │  │ 收盤分析/研究     │       │
│  │ reportUtils │  │ thesisTrack  │  │ morning note     │       │
│  └─────────────┘  └──────────────┘  └──────────────────┘       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Track A：資料層（from My-TW-Coverage）

### 3.1 靜態參考資料

新增 `src/data/` 目錄，放三個 JSON 檔案：

#### supplyChain.json

```json
{
  "2330": {
    "name": "台積電",
    "sector": "Technology",
    "industry": "Semiconductors",
    "upstream": [
      { "name": "ASML", "code": null, "product": "EUV機台", "dependency": "high" },
      { "name": "環球晶", "code": "6488", "product": "矽晶圓", "dependency": "medium" }
    ],
    "downstream": [
      { "name": "Apple", "code": null, "product": "A/M系列晶片", "revenueShare": ">20%" },
      { "name": "NVIDIA", "code": null, "product": "AI GPU", "revenueShare": "~12%" }
    ],
    "customers": ["Apple", "NVIDIA", "AMD", "Qualcomm", "聯發科", "Broadcom"],
    "suppliers": ["ASML", "Applied Materials", "Tokyo Electron", "Shin-Etsu"]
  }
}
```

**範圍：** 先做持倉 + 觀察股涵蓋的公司（約 30-50 家），不是全部 1,735 家。隨需擴充。

#### themes.json

```json
{
  "AI伺服器": {
    "description": "AI 訓練與推論伺服器完整供應鏈",
    "count": 148,
    "relatedThemes": ["CoWoS", "HBM", "NVIDIA", "CPO", "資料中心"],
    "stocks": {
      "upstream": ["2382", "2324", "3231"],
      "midstream": ["2308", "2317", "3044"],
      "downstream": ["3017", "3037", "2327"]
    }
  },
  "CoWoS": { ... },
  "NVIDIA": { ... }
}
```

**範圍：** 21 個主題全部收錄（資料量小，直接全收）。

#### companyProfiles.json

```json
{
  "2330": {
    "name": "台積電",
    "sector": "Technology",
    "industry": "Semiconductors",
    "description": "全球最大專用積體電路製造服務公司，市佔率超過 60%...",
    "wikilinks": ["AI", "CoWoS", "EUV", "HBM", "半導體"]
  }
}
```

**範圍：** 同 supplyChain.json，先做持倉 + 觀察股。

### 3.2 資料產出腳本

新增 `scripts/sync-coverage-data.py`：

- 從 My-TW-Coverage repo 的 `Pilot_Reports/` 解析 markdown
- 產出上述三個 JSON 檔案
- 從 `themes/` 目錄解析主題篩選
- 不即時拉 yfinance，只取結構化的描述/供應鏈/主題

使用方式：

```bash
# 首次同步（clone My-TW-Coverage 到 .tmp/ 後解析）
python scripts/sync-coverage-data.py --source .tmp/My-TW-Coverage

# 指定只同步特定股票（持倉 + 觀察股）
python scripts/sync-coverage-data.py --tickers 2330,2317,3017,3037
```

更新頻率：每月手動跑一次，或有新持倉時補跑。

### 3.3 STOCK_META 擴充

在 `src/seedData.js` 的 STOCK_META 加上 themes 欄位：

```javascript
"2330": {
  industry: "半導體",
  strategy: "成長股",
  period: "中長",
  position: "核心",
  leader: "龍頭",
  // 新增
  themes: ["AI伺服器", "CoWoS", "HBM", "NVIDIA"],
},
"3017": {
  industry: "AI/伺服器",
  strategy: "成長股",
  period: "中長",
  position: "核心",
  leader: "龍頭",
  // 新增
  themes: ["AI伺服器", "資料中心"],
},
```

### 3.4 Dossier 整合

`dossierUtils.js` 的 `buildHoldingDossier()` 擴充：

```javascript
import supplyChainData from '../data/supplyChain.json'
import themesData from '../data/themes.json'
import companyProfiles from '../data/companyProfiles.json'

// 在 dossier 組裝時自動帶入
function buildSupplyChainContext(code) {
  const chain = supplyChainData[code]
  if (!chain) return null
  return {
    upstream: chain.upstream,
    downstream: chain.downstream,
    customers: chain.customers,
    suppliers: chain.suppliers,
  }
}

function buildThemeContext(code, stockMeta) {
  const themes = stockMeta?.themes || []
  return themes
    .map((t) => ({
      name: t,
      ...themesData[t],
    }))
    .filter(Boolean)
}
```

AI prompt 會自動帶入：

```
供應鏈：上游 ASML(EUV機台,高度依賴), 環球晶(矽晶圓)
        下游 Apple(>20%營收), NVIDIA(~12%營收)
主題：  AI伺服器(148家), CoWoS(39家)
相關股：同主題持倉有 3017奇鋐, 3443創意
```

---

## 4. Track B：工作流層（from financial-services-plugins）

### 4.1 Thesis Scorecard 升級

**現有結構（Qwen Phase 0）：**

```javascript
{
  ;(id, stockId, reason, expectation, invalidation, targetPrice, stopLossPercent, status)
}
```

**升級後結構：**

```javascript
{
  // 保留現有欄位（向後相容）
  id: "thesis-2330-001",
  stockId: "2330",
  status: "active",           // active / invalidated / closed
  createdAt: "2026/02/01",
  updatedAt: "2026/03/28",

  // 升級：核心 thesis
  direction: "long",          // long / short（新增，預設 long）
  statement: "AI伺服器需求帶動CoWoS產能滿載，2026營收成長30%+",
  // reason → 改名為 statement（向後相容：讀取時 fallback 到 reason）

  // 升級：支撐論點 scorecard
  pillars: [
    {
      id: "p1",
      text: "月營收連續成長 >20%",
      status: "on_track",     // on_track / watch / behind / broken
      trend: "stable",        // up / stable / down
      lastChecked: "2026/03/28",
    },
    {
      id: "p2",
      text: "CoWoS產能持續擴張",
      status: "on_track",
      trend: "up",
      lastChecked: "2026/03/20",
    },
    {
      id: "p3",
      text: "AI晶片客戶訂單能見度",
      status: "watch",
      trend: "stable",
      lastChecked: "2026/03/15",
    },
  ],

  // 升級：失效條件（明確列出，取代舊的 invalidation 字串）
  risks: [
    { id: "r1", text: "NVIDIA轉單三星", triggered: false },
    { id: "r2", text: "月營收連續2月衰退", triggered: false },
  ],

  // 升級：conviction + 價格目標
  conviction: "high",         // high / medium / low
  targetPrice: 2200,
  stopLoss: 1650,             // 改為絕對價格（比 % 更直覺）
  stopLossPercent: 10,        // 保留向後相容

  // 升級：更新日誌（新增）
  updateLog: [
    {
      date: "2026/03/28",
      event: "Q4法說會展望正面",
      impact: "strengthen",   // strengthen / weaken / neutral
      pillarId: "p3",         // 影響哪個 pillar
      action: "hold",         // hold / add / trim / exit
      note: "N5/N3 產能利用率維持高檔",
    },
  ],
}
```

**向後相容策略：**

- `useThesisTracking` 的 `readThesisFromStorage` 加 normalize 函數
- 舊格式的 `reason` 映射到 `statement`
- 舊格式的 `invalidation` 字串轉成單一 `risks` 項目
- 缺失的 `pillars`、`conviction`、`updateLog` 給預設空值
- 不需要 migration，讀取時即時 normalize

### 4.2 Catalyst Calendar 結構化

**事件分類擴充（加在 `eventUtils.js` 的 `normalizeEventRecord`）：**

```javascript
// 新增欄位（向後相容，舊事件預設 null）
{
  ...existingEvent,

  catalystType: "earnings",
  // earnings   — 月營收公布、季報、法說會
  // corporate  — 人事異動、併購、增資、庫藏股、除權息
  // industry   — 產業數據、技術突破、供應鏈變化
  // macro      — 總經數據、央行決策、政策變動、匯率
  // technical  — 量價異常、籌碼變化、外資動向

  impact: "high",             // high / medium / low

  // 與 thesis 的關聯
  relatedThesisIds: [],       // 關聯到哪些 thesis
  pillarImpact: null,         // 影響哪個 pillar id

  // 預期 vs 實際（復盤用）
  expectedOutcome: null,
  actualOutcome: null,
}
```

**自動分類規則（在 normalize 時嘗試推斷）：**

```javascript
function inferCatalystType(event) {
  const text = (event.title || '').toLowerCase()
  if (/營收|財報|eps|法說|季報|年報/.test(text)) return 'earnings'
  if (/併購|增資|庫藏|董事|除權|除息/.test(text)) return 'corporate'
  if (/產能|訂單|供應鏈|技術|製程/.test(text)) return 'industry'
  if (/fed|利率|gdp|cpi|央行|匯率|關稅/.test(text)) return 'macro'
  if (/外資|融資|融券|成交量|突破|跌破/.test(text)) return 'technical'
  return null // 無法推斷，使用者手動選
}
```

**EventsPanel UI 擴充：**

- 加入分類 tab 篩選（全部 / 財報 / 公司 / 產業 / 總經 / 技術）
- 影響度標記（高用紅色、中用黃色、低用灰色）
- 點擊事件可關聯到 thesis pillar

### 4.3 每日交易備忘（Morning Note 輕量版）

**不是自動生成頁面，而是「備忘組裝器」** — 把散落在各處的資訊自動彙整成一份摘要。

**資料來源（全部免費/現有）：**

| 來源           | 取什麼                                     | 已有/需建                          |
| -------------- | ------------------------------------------ | ---------------------------------- |
| 持倉 + thesis  | 今日需關注的 pillar 驗證點                 | 已有                               |
| 催化事件       | 今天/本週的 upcoming events                | 已有                               |
| 法人買賣超     | 昨日三大法人買賣超                         | 已有 (`api/twse-institutional.js`) |
| 供應鏈 context | 相關股票的動態                             | Track A 新增                       |
| 公開資訊觀測站 | 重大訊息（法說會、董事會決議、月營收公告） | 需建：RSS 抓取                     |

**輸出格式：**

```
每日交易備忘 — 2026/03/28（五）

── 今日事件 ──
[HIGH] 台積電 3月營收公布（thesis p1 驗證點）
[MED]  奇鋐 法說會 14:00

── 持倉狀態 ──
台積電  conviction:HIGH  昨收 1845  距停損 +11.8%  pillar 3/3 on_track
奇鋐    conviction:MED   昨收 498   距停損 +7.2%   pillar 2/3 on_track, 1 watch

── 法人動態 ──
外資 昨日買超 125 億，連3日買超
AI伺服器族群：外資買超 15 億（台積電 +8億, 廣達 +3億, 奇鋐 +2億）

── 觀察股提示 ──
欣興(3037) 接近你設定的進場價 285（目前 290）

── 重大訊息 ──（from 公開資訊觀測站）
2308 台達電：董事會通過配息 12 元
3443 創意：3月合併營收 XX 億，YoY +XX%
```

**實作方式：**

新增 `src/lib/morningNoteBuilder.js`：

```javascript
export function buildMorningNote({
  holdings, // 持倉
  theses, // thesis 列表
  events, // 催化事件
  watchlist, // 觀察股
  institutional, // 法人買賣超（from API）
  announcements, // 重大訊息（from RSS，可選）
  supplyChainData, // 供應鏈資料
}) {
  return {
    date: todayFormatted(),
    sections: {
      todayEvents: buildTodayEvents(events, theses),
      holdingStatus: buildHoldingStatus(holdings, theses),
      institutional: buildInstitutionalSummary(institutional, holdings),
      watchlistAlerts: buildWatchlistAlerts(watchlist, holdings),
      announcements: announcements || [],
    },
    // 純文字版本（供 AI prompt 或匯出用）
    plainText: renderPlainText(sections),
  }
}
```

**觸發方式：**

- App 開啟時自動組裝（如果是交易日 8:00-9:00 之間）
- 也可手動觸發（「產生今日備忘」按鈕）
- 不需要額外 API call，全部用已有資料組裝

### 4.4 公開資訊觀測站 RSS 抓取

新增 `api/mops-announcements.js`：

```javascript
// GET /api/mops-announcements?date=20260328
//
// 來源：公開資訊觀測站 重大訊息
// 快取：30 分鐘
//
// 回應：
// {
//   date: "20260328",
//   announcements: [
//     { code: "2308", name: "台達電", type: "dividend", title: "董事會通過配息12元", time: "18:30" },
//     { code: "3443", name: "創意", type: "revenue", title: "3月合併營收...", time: "16:00" },
//   ]
// }
```

---

## 5. Track C：資料適配層（為付費資料源鋪路）

### 5.1 為什麼現在就要做

未來商業化時會接付費資料源（FactSet、Morningstar 等）。如果現在業務邏輯直接綁死免費資料源的格式，轉換時會到處是 bug。加一層薄的 adapter 成本極低（每個 ~50-100 行），保護力極大。

### 5.2 統一內部格式

新增 `src/lib/dataAdapters/types.js`：

```javascript
/**
 * 統一的公司資料格式 — 所有 adapter 都輸出這個格式
 * 業務邏輯只認這個格式，永遠不直接碰外部 API 的原始欄位
 */
export const CompanyDataShape = {
  code: '', // 股票代碼
  name: '', // 公司名稱
  sector: '', // 板塊
  industry: '', // 產業

  // 估值指標
  pe: null, // P/E (TTM)
  forwardPe: null, // Forward P/E
  pb: null, // P/B
  ps: null, // P/S
  evEbitda: null, // EV/EBITDA

  // 成長指標
  revenueYoy: null, // 營收年增率 (%)
  epsGrowth: null, // EPS 成長率 (%)
  grossMargin: null, // 毛利率 (%)
  operatingMargin: null, // 營業利益率 (%)

  // 元資料
  source: '', // 資料來源識別（"twse-public" / "coverage-static" / "factset"）
  freshness: '', // fresh / aging / stale
  fetchedAt: null, // 資料取得時間
}
```

### 5.3 Adapter 結構

```
src/lib/dataAdapters/
├── types.js                  # 統一格式定義
├── coverageAdapter.js        # 從 My-TW-Coverage 靜態 JSON 取得
├── twsePublicAdapter.js      # 從 TWSE 公開 API 取得
├── index.js                  # 匯出 activeAdapter（config 切換）
└── (未來)
    ├── factsetAdapter.js     # FactSet MCP
    └── morningstarAdapter.js # Morningstar MCP
```

每個 adapter 實作同一個介面：

```javascript
// coverageAdapter.js
import supplyChainData from "../../data/supplyChain.json";
import companyProfiles from "../../data/companyProfiles.json";

export function getCompanyData(code) {
  const profile = companyProfiles[code];
  const chain = supplyChainData[code];
  if (!profile) return null;

  return {
    code,
    name: profile.name,
    sector: profile.sector,
    industry: profile.industry,
    pe: null,            // 靜態資料沒有即時估值
    forwardPe: null,
    // ...其他欄位
    source: "coverage-static",
    freshness: "aging",  // 靜態資料固定 aging
    fetchedAt: null,
  };
}

export function getSupplyChain(code) { ... }
export function getThemes(code) { ... }
```

```javascript
// index.js — 組合多個 adapter，按優先級 fallback
import * as twse from './twsePublicAdapter.js'
import * as coverage from './coverageAdapter.js'

export function getCompanyData(code) {
  // 優先用即時資料，不足的用靜態資料補
  const live = twse.getCompanyData(code)
  const static_ = coverage.getCompanyData(code)

  return mergeCompanyData(live, static_) // 非 null 欄位以 live 為主
}
```

### 5.4 切換付費資料源時的操作

```javascript
// 未來加 FactSet 時，只需要：
// 1. 新增 factsetAdapter.js（實作同一個介面）
// 2. 在 index.js 加一行
import * as factset from './factsetAdapter.js'

export function getCompanyData(code) {
  const premium = factset.getCompanyData(code) // 新增
  const live = twse.getCompanyData(code)
  const static_ = coverage.getCompanyData(code)

  return mergeCompanyData(premium, live, static_) // premium 優先
}
// 3. 完成。業務邏輯、UI、prompt 全部不用動。
```

---

## 6. 策略架構升級（整合 Qwen 現有文件）

### 6.1 選股策略引擎升級

Qwen 的三層篩選模型（`docs/stock-selection-strategy.md`）整合新資料源後的變化：

**Layer 1 量化篩選 — 新增供應鏈維度：**

```javascript
quantitativeScore =
  revenueYoY * 0.2 +
  epsGrowth * 0.2 +
  grossMargin * 0.15 +
  targetUpside * 0.15 +
  technicalMomentum * 0.1 +
  // 新增
  supplyChainHealth * 0.1 + // 供應鏈健康度（客戶集中度、供應商依賴度）
  themeHeat * 0.1 // 主題熱度（同主題股票整體動能）
```

新增指標定義：

```javascript
// 供應鏈健康度
function calcSupplyChainHealth(code) {
  const chain = getSupplyChain(code)
  if (!chain) return 50 // 無資料，中性

  const customerDiversification = chain.customers.length >= 5 ? 80 : 50
  const supplierRisk = chain.upstream.some((s) => s.dependency === 'high') ? 30 : 70

  return (customerDiversification + supplierRisk) / 2
}

// 主題熱度（簡易版：同主題股票近 5 日平均漲幅）
function calcThemeHeat(code, stockMeta, marketData) {
  const themes = stockMeta[code]?.themes || []
  if (themes.length === 0) return 50

  const themeStocks = getStocksInThemes(themes)
  const avgChange = average(themeStocks.map((s) => marketData[s]?.change5d || 0))

  return normalize(avgChange, -10, 10, 0, 100)
}
```

**Layer 2 事件驅動 — 整合 catalyst 分類：**

```javascript
eventScore =
  upcomingCatalystScore + // 依 catalystType 加權
  institutionalFlowScore + // 法人動向（已有）
  thesisValidationScore // 新增：近期事件對 thesis pillar 的影響

// 不同 catalystType 的權重
const CATALYST_WEIGHTS = {
  earnings: 1.0, // 財報類最重要
  corporate: 0.8,
  industry: 0.7,
  macro: 0.5,
  technical: 0.4,
}
```

**Layer 3 大腦驗證 — 整合 thesis scorecard：**

```javascript
brainValidationScore =
  ruleMatchScore * 0.3 +
  analogSupport * 0.2 +
  freshnessBonus * 0.1 +
  // 新增
  thesisIntegrity * 0.4 // thesis scorecard 完整性：pillars on_track 比例 + conviction level

function calcThesisIntegrity(thesis) {
  if (!thesis) return 0

  const pillarScore =
    thesis.pillars.filter((p) => p.status === 'on_track').length / thesis.pillars.length
  const convictionMultiplier = { high: 1.0, medium: 0.7, low: 0.4 }[thesis.conviction] || 0.5
  const riskPenalty = thesis.risks.some((r) => r.triggered) ? 0.3 : 1.0

  return pillarScore * convictionMultiplier * riskPenalty * 100
}
```

### 6.2 Phase 0 升級項目

在 Qwen 的 `docs/phase0-implementation.md` 基礎上新增：

| 項目                   | 來源                       | 狀態                        |
| ---------------------- | -------------------------- | --------------------------- |
| ~~Thesis 追蹤系統~~    | Qwen Phase 0               | 已完成 → 待升級為 scorecard |
| ~~風險管理框架~~       | Qwen Phase 0               | 已完成                      |
| ~~TWSE 法人 API~~      | Qwen Phase 0               | 已完成                      |
| ~~MOPS 月營收 API~~    | Qwen Phase 0               | 已完成                      |
| 供應鏈靜態資料         | My-TW-Coverage             | **新增**                    |
| 主題標籤系統           | My-TW-Coverage             | **新增**                    |
| Thesis Scorecard 升級  | financial-services-plugins | **新增**                    |
| Catalyst Calendar 分類 | financial-services-plugins | **新增**                    |
| 資料適配層             | 架構設計                   | **新增**                    |
| 每日交易備忘           | financial-services-plugins | **新增**                    |
| 公開資訊觀測站 RSS     | 資料來源                   | **新增**                    |

---

## 7. 實作順序

### Phase A（1 週）：資料基礎

1. `scripts/sync-coverage-data.py` — 從 My-TW-Coverage 解析資料
2. `src/data/supplyChain.json` + `themes.json` + `companyProfiles.json`
3. `src/lib/dataAdapters/` — types.js + coverageAdapter.js + twsePublicAdapter.js + index.js
4. STOCK_META 加 `themes` 欄位

### Phase B（1 週）：工作流升級

5. `useThesisTracking` 升級 — scorecard + pillars + risks + updateLog + conviction
6. `eventUtils.js` 擴充 — catalystType + impact + relatedThesisIds + inferCatalystType
7. `dossierUtils.js` 整合 — buildSupplyChainContext + buildThemeContext

### Phase C（1 週）：Morning Note + 收尾

8. `api/mops-announcements.js` — 公開資訊觀測站 RSS
9. `src/lib/morningNoteBuilder.js` — 備忘組裝器
10. UI 調整 — EventsPanel 分類 tab、thesis 詳情頁 scorecard 顯示
11. 更新 `docs/stock-selection-strategy.md` — 新增供應鏈/主題/thesis 維度
12. 更新 `docs/phase0-implementation.md` — 新增項目狀態

---

## 8. 不做的事

| 排除項目                                   | 原因                                 |
| ------------------------------------------ | ------------------------------------ |
| D3.js 力導向圖                             | 維護成本高，用靜態列表 + AI 分析替代 |
| Import 全部 1,735 家財報                   | 太肥，只做持倉+觀察股的              |
| 獨立知識圖譜系統                           | JSON lookup + wikilink tag 就夠用    |
| comps-analysis Excel 輸出                  | 我們是 web app，用 UI 表格           |
| idea-generation 量化篩選                   | 缺少大規模 screening 資料源          |
| 付費 MCP 整合（FactSet 等）                | 架構已準備好，但目前用免費資料源訓練 |
| investment-banking / private-equity skills | 機構用途，不適合個人積極交易者       |

---

## 9. 未來擴充路徑（商業化後）

當產品開始收費、需要更高精度時：

1. **付費資料源接入** — 在 `dataAdapters/` 加新 adapter，config 切換，業務邏輯不動
2. **自製台股 MCP Server** — 把我們的 TWSE/MOPS API 封裝成 MCP 協定，讓其他 AI 工具也能用
3. **Morning Note 升級** — 接付費新聞 API 後，從「備忘彙整」升級為「AI 晨報生成」
4. **主題熱度即時追蹤** — 接付費資料後可做即時的主題輪動監控
5. **comps-analysis UI** — 有完整估值資料後可做同業比較表

---

## 參考來源

- [Timeverse/My-TW-Coverage](https://github.com/Timeverse/My-TW-Coverage) — 1,735 家台股結構化資料庫
- [anthropics/financial-services-plugins](https://github.com/anthropics/financial-services-plugins) — Anthropic 金融分析工作流
- `docs/stock-selection-strategy.md` — Qwen 選股策略規格書
- `docs/phase0-implementation.md` — Qwen Phase 0 實作指南
- `docs/MY_TW_COVERAGE_ANALYSIS.md` — Qwen My-TW-Coverage 分析報告
- `docs/AI_COLLABORATION_GUIDE.md` — AI 協作指南
- `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md` — 架構共識報告
