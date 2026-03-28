# My-TW-Coverage 專案分析與我們的系統優化建議

最後更新：2026-03-27
狀態：策略分析報告
作者：Qwen Code

---

## 一、My-TW-Coverage 專案概述

### 1.1 這是什麼？

**My-TW-Coverage** 是一個結構化的台股研究資料庫，涵蓋：

- **1,735 家** 台股上市公司（TWSE + OTC）
- **99 個** 產業類別
- **4,900+** 知識圖譜連結（wikilinks）
- **20 個** 主題投資篩選（如：AI 伺服器、CoWoS）

### 1.2 核心價值

```
把分散的公開資訊，整合成一致、可搜尋的結構化格式
```

**特色功能：**

- ✅ 標準化報告模板
- ✅ 供應鏈地圖（上中下游）
- ✅ 客戶/供應商關係
- ✅ 知識圖譜（wikilink 交叉引用）
- ✅ 主題式篩選（如：NVIDIA 供應鏈）

---

## 二、對我們系統的價值分析

### 2.1 可直接採用的部分

#### ✅ 1. 標準化報告模板

**My-TW-Coverage 模板：**

```markdown
# 2330 - [[台積電]]

## 業務簡介

**板塊:** Technology
**產業:** Semiconductors
**市值:** 47,326,857 百萬台幣
**企業價值:** 44,978,990 百萬台幣

[業務描述，包含 [[wikilinks]]...]

## 供應鏈位置

**上游:** [[ASML]], [[Applied Materials]], [[SUMCO]]...
**中游:** **台積電** (晶圓代工)
**下游:** [[Apple]], [[NVIDIA]], [[AMD]]...

## 主要客戶及供應商

### 主要客戶

- [[Apple]], [[NVIDIA]], [[AMD]], [[Qualcomm]]...

### 主要供應商

- [[ASML]], [[Tokyo Electron]], [[Shin-Etsu]]...

## 財務概況

### 估值指標

| P/E (TTM) | Forward P/E | P/S (TTM) | P/B | EV/EBITDA |
| --------- | ----------- | --------- | --- | --------- |
| 25.3      | 22.1        | 12.5      | 5.2 | 18.9      |

### 年度/季度財務數據

[3 年年報 + 4 季季報]
```

**我們可採用：**

1. **標準化 holding dossier 格式**
2. **供應鏈位置標記**（上中下游）
3. **客戶/供應商關係清單**
4. **估值指標表格**

**實作建議：**

```javascript
// 擴充 holding dossier 結構
const holdingDossier = {
  code: '2330',
  name: '台積電',

  // 新增：業務簡介
  businessOverview: {
    sector: 'Technology',
    industry: 'Semiconductors',
    marketCap: 47326857, // 百萬台幣
    enterpriseValue: 44978990,
    description: '...',
  },

  // 新增：供應鏈位置
  supplyChain: {
    upstream: ['ASML', 'Applied Materials', 'SUMCO'],
    midstream: ['台積電 (晶圓代工)'],
    downstream: ['Apple', 'NVIDIA', 'AMD'],
  },

  // 新增：客戶/供應商
  relationships: {
    customers: ['Apple', 'NVIDIA', 'AMD'],
    suppliers: ['ASML', 'Tokyo Electron', 'Shin-Etsu'],
  },

  // 新增：估值指標
  valuation: {
    pe: 25.3,
    forwardPe: 22.1,
    ps: 12.5,
    pb: 5.2,
    evEbitda: 18.9,
  },

  // 現有：基本面、事件、研究等...
}
```

---

#### ✅ 2. 知識圖譜（Wikilink）概念

**My-TW-Coverage 的 wikilink 格式：**

```
[[台積電]] → [[ASML]]（供應商）
[[台積電]] → [[Apple]]（客戶）
[[台積電]] → [[CoWoS]]（技術）
[[台積電]] → [[AI 伺服器]]（應用）
```

**我們可採用：**

1. **個股之間的關係標記**
2. **個股與技術/主題的關聯**
3. **交叉引用系統**

**實作建議：**

```javascript
// 知識圖譜數據結構
const knowledgeGraph = {
  nodes: [
    { id: '2330', name: '台積電', type: 'stock' },
    { id: 'AAPL', name: 'Apple', type: 'customer' },
    { id: 'ASML', name: 'ASML', type: 'supplier' },
    { id: 'cowos', name: 'CoWoS', type: 'technology' },
    { id: 'ai_server', name: 'AI 伺服器', type: 'theme' },
  ],

  edges: [
    { source: '2330', target: 'AAPL', type: 'supplies_to', weight: 0.3 },
    { source: '2330', target: 'ASML', type: 'buys_from', weight: 0.2 },
    { source: '2330', target: 'cowos', type: 'uses_technology', weight: 1.0 },
    { source: '2330', target: 'ai_server', type: 'serves_market', weight: 0.8 },
  ],
}

// 查詢「跟 Apple 有關的股票」
function findStocksRelatedTo(graph, targetName) {
  const targetNode = graph.nodes.find((n) => n.name === targetName)
  const relatedEdges = graph.edges.filter((e) => e.target === targetNode.id)
  return relatedEdges.map((e) => graph.nodes.find((n) => n.id === e.source))
}

// 結果：[台積電，鴻海，和碩，...]
```

**應用場景：**

```
使用者操作：「幫我找跟 NVIDIA 有關的股票」

系統回應：
┌─────────────────────────────────────────────────────────────┐
│ 與 NVIDIA 有關的股票（共 15 檔）                              │
├─────────────────────────────────────────────────────────────┤
│ 直接供應商（5 檔）：                                         │
│ - 台積電 (2330)：CoWoS 封裝，佔營收 15%                     │
│ - 鴻海 (2317)：伺服器組裝，佔營收 8%                        │
│ - 廣達 (2382)：伺服器代工，佔營收 12%                       │
│ ...                                                         │
├─────────────────────────────────────────────────────────────┤
│ 間接供應商（10 檔）：                                        │
│ - 欣興 (3037)：IC 載板                                       │
│ - 南電 (8046)：ABF 載板                                      │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

#### ✅ 3. 主題式篩選（Thematic Screens）

**My-TW-Coverage 主題：**

- CoWoS 供應鏈
- AI 伺服器
- NVIDIA 供應鏈
- Apple 供應鏈
- 電動車
- ...（共 20 個主題）

**我們可採用：**

1. **主題標籤系統**
2. **主題篩選功能**
3. **主題追蹤清單**

**實作建議：**

```javascript
// 主題標籤系統
const themes = {
  'AI 伺服器': {
    stocks: ['2330', '2317', '2382', '3037', '8046'],
    description: 'AI 伺服器供應鏈',
    keywords: ['AI', '伺服器', 'GPU', 'CoWoS'],
    marketSize: '2025 年全球 AI 伺服器市場 1500 億美元',
    growthRate: '+40% YoY',
  },

  CoWoS: {
    stocks: ['2330', '2344', '3037', '5522'],
    description: 'CoWoS 先進封裝供應鏈',
    keywords: ['CoWoS', '先進封裝', '2.5D/3D'],
    marketSize: '2025 年 CoWoS 產能 50 萬片/月',
    growthRate: '+60% YoY',
  },

  'NVIDIA 供應鏈': {
    stocks: ['2330', '2317', '2382', '6531'],
    description: 'NVIDIA AI 晶片供應鏈',
    keywords: ['NVIDIA', 'AI 晶片', 'H100', 'H200'],
    marketSize: 'NVIDIA 資料中心營收 1000 億美元',
    growthRate: '+200% YoY',
  },
}

// 主題篩選功能
function screenByTheme(themeName) {
  const theme = themes[themeName]
  return {
    themeName,
    stocks: theme.stocks.map((code) => getStockData(code)),
    averageMetrics: calculateAverageMetrics(theme.stocks),
    topPick: rankByMetrics(theme.stocks)[0],
  }
}
```

**UI 設計：**

```
┌─────────────────────────────────────────────────────────────┐
│ 主題篩選                                                     │
├─────────────────────────────────────────────────────────────┤
│ 🔥 熱門主題：                                                │
│ [AI 伺服器] [CoWoS] [NVIDIA 供應鏈] [Apple 供應鏈] [電動車]   │
│                                                              │
│ 所選主題：AI 伺服器                                          │
│ 涵蓋股票：15 檔                                              │
├─────────────────────────────────────────────────────────────┤
│ 成分股列表：                                                 │
│ ┌──────┬────────┬──────┬────────┬────────┬────────┐        │
│ │ 代碼 │ 名稱   │ 權重 │ 漲跌幅 │ 本益比 │ 評等   │        │
│ ├──────┼────────┼──────┼────────┼────────┼────────┤        │
│ │ 2330 │ 台積電 │ 35%  │ +2.1%  │ 25.3   │ ⭐⭐⭐⭐⭐ │        │
│ │ 2317 │ 鴻海   │ 20%  │ +1.5%  │ 12.5   │ ⭐⭐⭐⭐  │        │
│ │ 2382 │ 廣達   │ 15%  │ +3.2%  │ 18.7   │ ⭐⭐⭐⭐  │        │
│ └──────┴────────┴──────┴────────┴────────┴────────┘        │
│                                                              │
│ [加入觀察股] [開始分析] [查看主題報告]                       │
└─────────────────────────────────────────────────────────────┘
```

---

#### ✅ 4. 供應鏈地圖視覺化

**My-TW-Coverage 做法：**

- D3.js 力導向圖
- 節點：公司、技術、材料
- 連線：供應關係、技術使用

**我們可採用：**

1. **供應鏈視覺化**
2. **關係強度標記**
3. **互動式探索**

**實作建議：**

```javascript
// 供應鏈圖譜數據
const supplyChainGraph = {
  stock: '2330',
  layers: {
    upstream: [
      { name: 'ASML', product: '微影設備', dependency: 'high' },
      { name: 'Applied Materials', product: '製程設備', dependency: 'high' },
      { name: 'SUMCO', product: '矽晶圓', dependency: 'medium' },
    ],
    midstream: [{ name: '台積電', role: '晶圓代工', marketShare: '60%' }],
    downstream: [
      { name: 'Apple', product: 'iPhone/Mac', revenue: '15%' },
      { name: 'NVIDIA', product: 'GPU', revenue: '12%' },
      { name: 'AMD', product: 'CPU/GPU', revenue: '8%' },
    ],
  },
}

// 視覺化組件
function SupplyChainVisualization({ stock }) {
  return (
    <div className="supply-chain-viz">
      <h3>{stock.name} 供應鏈地圖</h3>

      <div className="layer upstream">
        <h4>上游</h4>
        {stock.supplyChain.upstream.map((s) => (
          <Node key={s.name} data={s} type="supplier" />
        ))}
      </div>

      <div className="layer midstream">
        <h4>中游</h4>
        <Node data={stock} type="self" highlight />
      </div>

      <div className="layer downstream">
        <h4>下游</h4>
        {stock.supplyChain.downstream.map((s) => (
          <Node key={s.name} data={s} type="customer" />
        ))}
      </div>
    </div>
  )
}
```

---

### 2.2 可激發靈感的部分

#### 💡 1. 產業輪動追蹤

**My-TW-Coverage 靈感：**

- 20 個主題投資篩選
- 每個主題有供應鏈地圖
- 可追蹤主題熱度變化

**我們的優化方向：**

**A. 主題熱度指標**

```javascript
// 主題熱度計算
function calculateThemeHeat(theme) {
  const stocks = theme.stocks

  // 1. 股價動能（30 日漲幅）
  const momentum = average(stocks.map((s) => s.priceChange30d))

  // 2. 成交量變化（5 日平均 vs 20 日平均）
  const volumeTrend = average(stocks.map((s) => s.volume5d / s.volume20d))

  // 3. 法人買超（5 日累計）
  const institutionalBuy = sum(stocks.map((s) => s.institutionalNet5d))

  // 4. 新聞聲量（Google News 數量）
  const newsVolume = sum(stocks.map((s) => s.newsCount7d))

  // 綜合熱度（0-100）
  const heat = normalize(
    momentum * 0.3 + volumeTrend * 0.2 + institutionalBuy * 0.3 + newsVolume * 0.2
  )

  return {
    heat,
    momentum,
    volumeTrend,
    institutionalBuy,
    newsVolume,
    trend: heat > 70 ? 'hot' : heat > 40 ? 'neutral' : 'cold',
  }
}
```

**B. 主題輪動提醒**

```
主題輪動提醒：

🔥 AI 伺服器 熱度上升（50 → 75）
   - 台積電 +5%
   - 廣達 +8%
   - 外資連續 3 日買超

❄️ 電動車 熱度下降（65 → 40）
   - 和碩 -3%
   - 鴻海 -2%
   - 融資連續 5 日減少

[查看完整主題報告] [設定提醒]
```

**C. 主題切換建議**

```
主題輪動建議：

目前持有：AI 伺服器（熱度 75，高檔）
建議：部分獲利了結，切換至...

候選主題：
1. 散熱（熱度 45，上升中）
   - 雙鴻、奇鋐
   - 液冷趨勢剛啟動

2. 銅合金（熱度 40，低檔）
   - 新日興、兆豐
   - AI 伺服器帶動需求

[查看建議] [執行切換]
```

---

#### 💡 2. 客戶/供應商集中度分析

**My-TW-Coverage 靈感：**

- 明確列出主要客戶/供應商
- 可計算集中度風險

**我們的優化方向：**

**A. 集中度風險指標**

```javascript
// 客戶集中度分析
function analyzeCustomerConcentration(stock) {
  const customers = stock.relationships.customers
  const revenueFromTop3 = customers.slice(0, 3).reduce((sum, c) => sum + c.revenuePercent, 0)

  let riskLevel
  if (revenueFromTop3 > 70) riskLevel = 'high'
  else if (revenueFromTop3 > 50) riskLevel = 'medium'
  else riskLevel = 'low'

  return {
    riskLevel,
    top3Percent: revenueFromTop3,
    topCustomer: customers[0],
    diversificationScore: 100 - revenueFromTop3,
  }
}

// 使用範例
const concentration = analyzeCustomerConcentration(tsmc)
// {
//   riskLevel: "medium",
//   top3Percent: 55,
//   topCustomer: { name: "Apple", percent: 25 },
//   diversificationScore: 45
// }
```

**B. 客戶風險警示**

```
⚠️ 客戶集中度警示

和碩 (4938) 客戶集中度：高
- 前 3 大客戶佔營收 85%
- 最大客戶 Apple 佔 60%

風險情境：
- 若 Apple 砍單 20%，營收減少 12%
- 若 Apple 轉單，短期難覓替代客戶

建議：
- 持續追蹤 Apple 訂單動向
- 觀察新客戶開發進度
- 設定 Apple 營收佔比警戒線

[加入追蹤] [設定警示]
```

**C. 供應鏈連鎖反應分析**

```
供應鏈連鎖反應：

情境：Apple iPhone 銷量下滑 20%

直接影響：
- 和碩 (4938)：營收 -12%（Apple 佔 60%）
- 鴻海 (2317)：營收 -5%（Apple 佔 25%）

間接影響：
- 台積電 (2330)：營收 -2%（間接供應）
- 欣興 (3037)：營收 -3%（載板供應）

[查看完整影響分析]
```

---

#### 💡 3. 估值比較系統

**My-TW-Coverage 靈感：**

- 標準化估值指標（P/E、P/B、EV/EBITDA）
- 可跨公司比較

**我們的優化方向：**

**A. 估值比較表格**

```
┌─────────────────────────────────────────────────────────────┐
│ 估值比較：AI 伺服器主題                                      │
├────────┬──────┬───────┬─────────┬───────┬─────────┬────────┤
│ 公司   │ 股價 │ P/E   │ P/B     │ PS    │ EV/EBITDA│ 評等   │
├────────┼──────┼───────┼─────────┼───────┼─────────┼────────┤
│ 台積電 │ 950  │ 25.3  │ 5.2     │ 12.5  │ 18.9    │ ⭐⭐⭐⭐⭐│
│ 鴻海   │ 180  │ 12.5  │ 1.8     │ 0.6   │ 8.5     │ ⭐⭐⭐⭐ │
│ 廣達   │ 250  │ 18.7  │ 3.5     │ 1.2   │ 12.3    │ ⭐⭐⭐⭐ │
│ 緯創   │ 120  │ 15.2  │ 2.1     │ 0.8   │ 9.8     │ ⭐⭐⭐  │
├────────┴──────┴───────┴─────────┴───────┴─────────┴────────┤
│ 產業平均 │      │ 17.9  │ 3.2     │ 3.8   │ 12.4    │        │
└─────────────────────────────────────────────────────────────┘

解讀：
- 台積電估值溢價合理（技術領先）
- 鴻海估值偏低（毛利率改善中）
- 廣達估值合理（AI 伺服器帶動）
```

**B. 估值區間追蹤**

```javascript
// 估值歷史區間
function calculateValuationRange(stock, years = 5) {
  const history = getValuationHistory(stock, years)

  return {
    current: {
      pe: stock.pe,
      pb: stock.pb,
      ps: stock.ps,
    },
    range: {
      pe: { min: min(history.pe), max: max(history.pe), avg: avg(history.pe) },
      pb: { min: min(history.pb), max: max(history.pb), avg: avg(history.pb) },
      ps: { min: min(history.ps), max: max(history.ps), avg: avg(history.ps) },
    },
    percentile: {
      pe: percentile(stock.pe, history.pe),
      pb: percentile(stock.pb, history.pb),
      ps: percentile(stock.ps, history.ps),
    },
    interpretation: interpretPercentile(percentile(stock.pe, history.pe)),
  }
}

function interpretPercentile(p) {
  if (p < 20) return '低估區間'
  if (p < 40) return '合理偏低'
  if (p < 60) return '合理區間'
  if (p < 80) return '合理偏高'
  return '高估區間'
}
```

**C. 估值異常警示**

```
⚠️ 估值異常警示

台積電 (2330) 本益比 25.3x
- 歷史平均：20.5x
- 歷史最高：35.2x
- 歷史最低：12.3x
- 目前百分位：68%（合理偏高）

解讀：
- 估值溢價反映 AI 題材
- 若 EPS 成長 30%，本益比將降至 19.5x
- 建議：觀察 Q3 財報確認成長動能

[查看詳細估值報告] [設定警示]
```

---

#### 💡 4. 知識累積系統

**My-TW-Coverage 靈感：**

- 4,900+ wikilink 交叉引用
- 持續累積的知識庫

**我們的優化方向：**

**A. 策略大腦 + 知識圖譜整合**

```javascript
// 策略規則與知識圖譜連結
const brainRule = {
  id: 'rule_001',
  text: 'AI 伺服器供應鏈，月營收連續 3 個月成長 > 20%，可積極操作',

  // 連結到知識圖譜
  relatedEntities: [
    { type: 'theme', id: 'ai_server', name: 'AI 伺服器' },
    { type: 'stocks', ids: ['2330', '2317', '2382'] },
    { type: 'technology', id: 'cowos', name: 'CoWoS' },
  ],

  // 驗證歷史
  validationHistory: [
    { date: '2026-02', result: 'success', stocks: ['2330', '2382'] },
    { date: '2026-01', result: 'mixed', stocks: ['2317'] },
  ],
}
```

**B. 知識卡片**

```
┌─────────────────────────────────────────────────────────────┐
│ 知識卡片：CoWoS                                              │
├─────────────────────────────────────────────────────────────┤
│ 什麼是 CoWoS？                                              │
│ Chip-on-Wafer-on-Substrate，台積電先進封裝技術              │
├─────────────────────────────────────────────────────────────┤
│ 相關股票：                                                  │
│ - 台積電 (2330)：主要供應商                                 │
│ - 欣興 (3037)：IC 載板                                       │
│ - 南電 (8046)：ABF 載板                                     │
├─────────────────────────────────────────────────────────────┤
│ 市場規模：                                                  │
│ - 2024：30 萬片/月                                          │
│ - 2025：50 萬片/月（預估）                                  │
│ - 2026：80 萬片/月（預估）                                  │
├─────────────────────────────────────────────────────────────┤
│ 相關策略規則：                                              │
│ - 規則 #001：CoWoS 產能擴張週期                             │
│ - 規則 #015：先進封裝題材輪動                               │
├─────────────────────────────────────────────────────────────┤
│ 最近新聞：                                                  │
│ - 台積電 CoWoS 產能滿載，2026 年擴產 50%                    │
│ - NVIDIA H200 需求強勁，CoWoS 供不應求                      │
└─────────────────────────────────────────────────────────────┘
```

**C. 知識貢獻激勵**

```javascript
// 使用者貢獻知識點，獲得積分
const contributionRewards = {
  addSupplyChainLink: 10, // 新增供應鏈連結
  addCustomerSupplier: 5, // 新增客戶/供應商
  addThemeTag: 5, // 新增主題標籤
  updateValuation: 3, // 更新估值數據
  verifyRelationship: 2, // 驗證關係正確性
}

// 貢獻排行榜
const leaderboard = [
  { user: '用戶 A', points: 1250, rank: 1 },
  { user: '用戶 B', points: 980, rank: 2 },
  { user: '用戶 C', points: 750, rank: 3 },
]
```

---

## 三、實作優先級建議

### 3.1 短期（1-2 週）

| 功能                        | 優先級 | 工時 | 依賴            |
| --------------------------- | ------ | ---- | --------------- |
| 標準化 holding dossier 格式 | P0     | 4h   | 無              |
| 主題標籤系統                | P0     | 6h   | 無              |
| 客戶/供應商清單             | P1     | 4h   | holding dossier |
| 估值指標計算                | P1     | 4h   | TWSE API        |

### 3.2 中期（1 個月）

| 功能             | 優先級 | 工時 | 依賴     |
| ---------------- | ------ | ---- | -------- |
| 知識圖譜基礎架構 | P0     | 12h  | 主題標籤 |
| 主題篩選功能     | P0     | 8h   | 主題標籤 |
| 供應鏈視覺化     | P1     | 16h  | 知識圖譜 |
| 估值比較表格     | P1     | 8h   | 估值指標 |

### 3.3 長期（3 個月）

| 功能           | 優先級 | 工時 | 依賴        |
| -------------- | ------ | ---- | ----------- |
| 主題熱度指標   | P1     | 12h  | 主題篩選    |
| 客戶集中度分析 | P2     | 8h   | 客戶/供應商 |
| 估值區間追蹤   | P2     | 12h  | 估值比較    |
| 知識貢獻系統   | P2     | 16h  | 知識圖譜    |

---

## 四、與現有系統整合

### 4.1 與 Thesis 追蹤整合

```javascript
// Thesis 中引用知識圖譜
const thesis = {
  stockId: '2330',
  reason: 'AI 伺服器需求強勁，CoWoS 產能滿載',

  // 連結到知識圖譜
  relatedThemes: ['AI 伺服器', 'CoWoS'],
  relatedStocks: ['2317', '2382'], // 同樣受惠的股票

  // 自動帶入供應鏈數據
  supplyChainContext: {
    downstream: ['Apple', 'NVIDIA'], // 這些客戶的需求強勁
    upstream: ['ASML'], // 設備供應穩定
  },
}
```

### 4.2 與風險管理整合

```javascript
// 風險評估加入供應鏈因素
function assessRisk(holding, knowledgeGraph) {
  const baseRisk = calculateBaseRisk(holding)

  // 客戶集中度風險
  const customerConcentration = analyzeCustomerConcentration(holding)
  if (customerConcentration.riskLevel === 'high') {
    baseRisk.score += 20
  }

  // 供應鏈依賴風險
  const supplierDependency = analyzeSupplierDependency(holding, knowledgeGraph)
  if (supplierDependency.singleSource) {
    baseRisk.score += 15
  }

  // 主題熱度風險
  const themeHeat = calculateThemeHeatForStock(holding)
  if (themeHeat > 80) {
    baseRisk.score += 10 // 過熱警示
  }

  return baseRisk
}
```

### 4.3 與停損/加倉整合

```javascript
// 停損建議加入供應鏈因素
function suggestStopLoss(stock, knowledgeGraph) {
  const baseStopLoss = calculateBaseStopLoss(stock)

  // 若客戶集中度高，建議較緊的停損
  const concentration = analyzeCustomerConcentration(stock)
  if (concentration.riskLevel === 'high') {
    return baseStopLoss * 0.8 // 收紧 20%
  }

  // 若供應鏈穩定，可放寬停損
  const supplyChainStability = assessSupplyChainStability(stock, knowledgeGraph)
  if (supplyChainStability > 0.8) {
    return baseStopLoss * 1.2 // 放寬 20%
  }

  return baseStopLoss
}
```

---

## 五、結論與建議

### 5.1 My-TW-Coverage 的核心價值

1. **結構化**：把分散資訊整合成一致格式
2. **關聯性**：wikilink 建立知識網絡
3. **主題式**：按投資主題組織股票
4. **可累積**：持續擴充的知識庫

### 5.2 我們該學什麼

| 學習項目       | 採用程度    | 理由                     |
| -------------- | ----------- | ------------------------ |
| 標準化報告模板 | ✅ 完全採用 | 提升數據品質             |
| 知識圖譜概念   | ✅ 部分採用 | 增強關聯分析             |
| 主題式篩選     | ✅ 完全採用 | 符合投資邏輯             |
| 供應鏈視覺化   | ⚠️ 簡化採用 | 技術複雜，先做基礎版     |
| D3.js 網絡圖   | ❌ 暫不採用 | 維護成本高，用靜態圖替代 |

### 5.3 我們的差異化優勢

相比 My-TW-Coverage，我們的優勢：

1. **個人化**：追蹤使用者的持倉和 thesis
2. **互動性**：使用者可貢獻和驗證數據
3. **實戰導向**：直接連結到交易決策（停損/加倉）
4. **AI 增強**：自動分析和建议，不只是資料展示

### 5.4 下一步行動

**本週：**

- [ ] 擴充 holding dossier 格式
- [ ] 建立主題標籤系統
- [ ] 新增客戶/供應商欄位

**下週：**

- [ ] 實作主題篩選功能
- [ ] 建立知識圖譜基礎架構
- [ ] 整合估值指標計算

**下個月：**

- [ ] 供應鏈視覺化（簡化版）
- [ ] 主題熱度指標
- [ ] 知識貢獻系統

---

**最後更新：2026-03-28**

**狀態：分析完成 → 已整合進外部資源設計規格書**

> **2026-03-28 Claude 補充：** 本文件的分析已整合到 `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md`，
> 並與 Anthropic 的 financial-services-plugins 做交叉評估，形成完整的整合設計。
> 本文件保留為原始分析紀錄。
