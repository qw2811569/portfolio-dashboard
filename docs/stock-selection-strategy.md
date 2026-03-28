# 選股策略完整規格書

最後更新：2026-03-28
狀態：策略規格與問題分析（已整合外部資源升級方向）
作者：Qwen Code
升級補充：Claude Opus（2026-03-28，整合 My-TW-Coverage + financial-services-plugins）

---

## 執行摘要

本文件整合選股引擎的設計規格與深度反思，包含：

- 三層篩選邏輯與評分系統
- 根本問題分析與解決對策
- 實作順序建議

**核心結論：選股引擎不是「功能」問題，是「數據」問題。需先建立基礎建設，累積數據後才能實作有意義的選股。**

**2026-03-28 升級：** 整合兩個外部資源後，數據問題有了具體解法：

- **My-TW-Coverage** 提供 1,735 家台股的供應鏈、主題分類、公司摘要 → 補上 Layer 1 量化篩選的結構化 context
- **financial-services-plugins** 的 thesis-tracker / catalyst-calendar 工作流 → 強化 Layer 2 事件驅動和 Layer 3 大腦驗證的結構化程度
- **資料適配層** 確保未來接付費資料源時零 bug 過渡
- 完整設計見 `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md`

---

## 第一部分：設計規格

### 1. 核心架構

#### 1.1 三層篩選模型

```
┌─────────────────────────────────────────────────────────────┐
│                    選股策略引擎                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 量化篩選 (Quantitative Screen) - 40% 權重         │
│  Layer 2: 事件驅動 (Event Catalyst) - 30% 權重              │
│  Layer 3: 大腦驗證 (Brain Validation) - 30% 權重            │
└─────────────────────────────────────────────────────────────┘
```

#### 1.2 評分公式

```javascript
totalScore = quantitativeScore * 0.4 + eventScore * 0.3 + brainValidationScore * 0.3 - riskDeduction

// 各分項計算
// 升級前（原始版本）
// quantitativeScore = (
//   revenueYoY * 0.25 +
//   epsGrowth * 0.25 +
//   grossMargin * 0.2 +
//   targetUpside * 0.2 +
//   technicalMomentum * 0.1
// )

// 升級後（整合供應鏈 + 主題維度）
quantitativeScore =
  revenueYoY * 0.2 +
  epsGrowth * 0.2 +
  grossMargin * 0.15 +
  targetUpside * 0.15 +
  technicalMomentum * 0.1 +
  supplyChainHealth * 0.1 + // 新增：供應鏈健康度（客戶集中度、供應商依賴度）
  themeHeat * 0.1 // 新增：主題熱度（同主題股票整體動能）

eventScore = upcomingRevenueScore + conferenceCallScore + analystUpgradeScore + sectorRotationScore

// 升級前（原始版本）
// brainValidationScore = (
//   ruleMatchScore * 0.5 +
//   analogSupport * 0.3 +
//   freshnessBonus * 0.2
// )

// 升級後（整合 thesis scorecard）
brainValidationScore =
  ruleMatchScore * 0.3 + analogSupport * 0.2 + freshnessBonus * 0.1 + thesisIntegrity * 0.4 // 新增：thesis scorecard 完整性
  // thesisIntegrity = pillars on_track 比例 × conviction 乘數 × risk 懲罰
```

### 2. 資料結構

#### 2.1 選股評分物件

```typescript
interface StockSelection {
  code: string
  name: string
  industry: string

  score: {
    total: number // 0-100
    quantitative: number // 0-100
    event: number // 0-100
    brainValidation: number // 0-100
    riskDeduction: number // 負分扣減
  }

  signals: {
    buy: string[] // 買進訊號
    watch: string[] // 觀察訊號
    avoid: string[] // 避免訊號
  }

  freshness: {
    fundamentals: 'fresh' | 'aging' | 'stale' | 'missing'
    targets: 'fresh' | 'aging' | 'stale' | 'missing'
    analyst: 'fresh' | 'aging' | 'stale' | 'missing'
    research: 'fresh' | 'aging' | 'stale' | 'missing'
  }

  analogs: Array<{
    code: string
    name: string
    period: string
    verdict: 'supported' | 'mixed' | 'contradicted'
    similarity: number // 0-1
  }>

  matchedRules: Array<{
    ruleId: string
    ruleText: string
    status: 'validated' | 'stale' | 'invalidated'
    validationScore: number
  }>
}
```

### 3. 台股特有規則

#### 3.1 硬閘門 (Hard Gates)

| 條件   | 規則                        | 扣分 |
| ------ | --------------------------- | ---- |
| 月營收 | 每月 10 日前未公布 → stale  | -20  |
| 月營收 | YoY < 0                     | -20  |
| 法說會 | 前 3 天內                   | +15  |
| 財報   | 公告後 7 天內未更新 → stale | -15  |
| 目標價 | 90 天內無報告 → 0 分        | -20  |
| 族群   | 近 5 日落後大盤 > 10%       | -15  |

#### 3.2 驗證門檻

```javascript
const VALIDATION_THRESHOLDS = {
  revenue: { required: true, maxAge: 45, minGrowth: 0 },
  conference: { required: true, maxAge: 90 },
  target: { required: true, minSources: 2, maxAge: 90 },
  sector: { required: false, momentumLookback: 5 },
}
```

### 4. 風險管理

#### 4.1 風險扣減因子

```javascript
const RISK_DEDUCTIONS = {
  negativeRevenueYoY: -10,
  consecutiveDecliningMargin: -15,
  highValuation: -10,
  overbought: -10,
  breakdownSupport: -15,
  upcomingUncertainEvent: -20,
  staleBrainRules: -15,
  contradictedByAnalogs: -20,
}
```

#### 4.2 熔斷機制

以下情況暫停選股推薦：

1. 大盤單日下跌 > 5%
2. 持倉總虧損 > 20%
3. 策略規則連續失敗 3 次
4. 系統資料新鮮度 < 50%

---

## 第二部分：問題分析與對策

### 5. 根本問題總結

經過深度分析，發現以下**五大根本問題**：

#### 問題 1：資料收集不可持續

| 項目 | 現況                 | 影響           |
| ---- | -------------------- | -------------- |
| 來源 | 依賴手動輸入/AI 解析 | 無法大規模收集 |
| 品質 | 不穩定               | 分析結果不可靠 |
| 時效 | 延遲                 | 錯過投資時機   |

**對策：**

- 建立自動化資料收集管道（TWSE API、RSS）
- 使用者輸入模板化、簡化
- 漸進累積數據

#### 問題 2：沒有歷史數據

| 項目     | 需求       | 現況     |
| -------- | ---------- | -------- |
| 股性判斷 | 1-2 年數據 | 零累積   |
| 策略驗證 | 多次回測   | 無法執行 |
| 案例庫   | 數十案例   | 空白     |

**對策：**

- 時間累積（1-3 個月）
- 引入外部數據源
- 建立歷史案例庫

#### 問題 3：缺少 thesis 追蹤

| 缺失            | 影響                 |
| --------------- | -------------------- |
| 無進場理由記錄  | 無法判斷 thesis 破壞 |
| 無停損/停利條件 | 建議變成技術指標     |
| 無事件結果追蹤  | 無法累積經驗         |

**對策：**

- 強制記錄 thesis（模板引導）
- 設定「thesis 破壞條件」
- 定期提醒檢視

#### 問題 4：沒有風險管理

| 不知道     | 無法            |
| ---------- | --------------- |
| 總資金     | 計算合理部位    |
| 風險承受度 | 提供個人化建議  |
| 目標報酬   | 判斷風險/報酬比 |

**對策：**

- 使用者設定或從持倉反推
- 建立風險管理框架
- 提供風險指標監控

#### 問題 5：使用者摩擦力大

| 問題         | 影響       |
| ------------ | ---------- |
| 手動輸入繁瑣 | 使用者流失 |
| 數據不足     | 系統價值低 |
| 惡性循環     | 無法累積   |

**對策：**

- 模板化（減少輸入）
- 自動化（自動同步）
- 遊戲化（積分、回饋）

---

### 6. 資料來源分析

| 資料類型     | 最佳來源      | 更新頻率   | 反爬蟲風險 |
| ------------ | ------------- | ---------- | ---------- |
| 收盤價       | TWSE API      | 每日       | 低         |
| 月營收       | MOPS          | 每月 10 日 | 中         |
| 財報         | MOPS          | 每季       | 中         |
| 法人買賣超   | TWSE          | 每日       | 低         |
| 分析師目標價 | 新聞報導      | 不定期     | 中         |
| 法說會日程   | TWSE 重大訊息 | 不定期     | 低         |

---

## 第三部分：實作順序

### 7. 正確順序

```
1. 建立基礎建設（資料收集、thesis 追蹤、風險管理）
   ↓
2. 累積數據（持倉表現、事件反應、預測準確度）
   ↓
3. 分析數據（股性分類、策略驗證、案例庫）
   ↓
4. 實作選股引擎（數據驅動、可驗證、可優化）
```

### 8. Phase 0: 基礎建設 (1-2 週)

#### 8.1 TWSE API 整合

- [ ] 法說會日程自動同步
- [ ] 財報發布日自動同步
- [ ] 除權息公告自動同步
- [ ] 法人買賣超自動同步

#### 8.2 thesis 追蹤系統

- [ ] 進場時強制記錄 thesis（模板引導）
- [ ] 設定「thesis 破壞條件」
- [ ] 定期提醒檢視
- [ ] 記錄檢視結果

#### 8.3 風險管理框架

- [ ] 使用者設定總資金與風險承受度
- [ ] 部位規模計算
- [ ] 風險指標監控
- [ ] 警告系統

#### 8.4 資料收集自動化

- [ ] 強化 Google News RSS 萃取
- [ ] 月營收自動同步（MOPS）
- [ ] 法人買賣超自動同步（TWSE）

### 9. Phase 1: 數據累積 (1-3 個月)

- [ ] 累積持倉表現數據
- [ ] 累積事件與股價反應
- [ ] 累積使用者預測準確度
- [ ] 建立歷史案例庫

### 10. Phase 2: 選股引擎 (3 個月後)

**有足夠數據後才能實作有意義的選股：**

- [ ] 基於歷史數據訓練股性分類
- [ ] 基於實際表現調整評分權重
- [ ] 基於累積案例建立驗證機制
- [ ] 基於使用者行為優化建議

---

## 附錄：評分計算範例

### 台積電 (2330) 範例

```javascript
{
  code: "2330",
  name: "台積電",

  // Layer 1: 量化評分
  quantitative: {
    revenueYoY: 85,      // YoY +25%
    epsGrowth: 90,       // EPS +30%
    grossMargin: 80,     // 毛利率 52%
    targetUpside: 75,    // 目標價空間 15%
    technicalMomentum: 70,
    // 加權平均：82
  },

  // Layer 2: 事件評分
  event: {
    upcomingRevenue: 90,   // 3 天後公布
    conferenceCall: 100,   // 本週法說
    analystUpgrade: 80,    // 近期上修
    sectorRotation: 85,    // AI 題材熱
    // 總和：90
  },

  // Layer 3: 大腦驗證
  brainValidation: {
    ruleMatchScore: 95,    // 5 條 validated 規則支持
    analogSupport: 85,     // 3 個相似案例支持
    freshnessBonus: 15,    // 資料新鮮
    marketRegimeFit: 90,   // AI 伺服器題材匹配
    // 加權平均：89
  },

  // 風險扣減
  riskDeduction: -5,       // 輕微超買

  // 最終評分
  total: 87,               // 強力買進候選
}
```

---

---

## 升級附錄：新增指標定義

### 供應鏈健康度 (supplyChainHealth)

```javascript
// 資料來源：My-TW-Coverage 供應鏈 JSON (src/data/supplyChain.json)
function calcSupplyChainHealth(code) {
  const chain = getSupplyChain(code)
  if (!chain) return 50 // 無資料，中性分

  // 客戶分散度：客戶越多越健康
  const customerDiversification = chain.customers.length >= 5 ? 80 : 50

  // 供應商風險：有 high dependency 供應商扣分
  const supplierRisk = chain.upstream.some((s) => s.dependency === 'high') ? 30 : 70

  return (customerDiversification + supplierRisk) / 2
}
```

### 主題熱度 (themeHeat)

```javascript
// 資料來源：STOCK_META.themes + themes.json + 市場報價
function calcThemeHeat(code, stockMeta, marketData) {
  const themes = stockMeta[code]?.themes || []
  if (themes.length === 0) return 50

  // 找出同主題所有股票的近 5 日平均漲幅
  const themeStocks = getStocksInThemes(themes)
  const avgChange = average(themeStocks.map((s) => marketData[s]?.change5d || 0))

  return normalize(avgChange, -10, 10, 0, 100)
}
```

### Thesis 完整性 (thesisIntegrity)

```javascript
// 資料來源：useThesisTracking (升級後的 scorecard 格式)
function calcThesisIntegrity(thesis) {
  if (!thesis) return 0

  // pillar on_track 比例
  const pillarScore =
    thesis.pillars.filter((p) => p.status === 'on_track').length / thesis.pillars.length

  // conviction 乘數
  const convictionMultiplier = { high: 1.0, medium: 0.7, low: 0.4 }[thesis.conviction] || 0.5

  // 任何 risk 被觸發就大幅懲罰
  const riskPenalty = thesis.risks.some((r) => r.triggered) ? 0.3 : 1.0

  return pillarScore * convictionMultiplier * riskPenalty * 100
}
```

---

## 參考文件

- `docs/AI_COLLABORATION_GUIDE.md`
- `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`
- `src/lib/brainRuntime.js`
- `docs/THREE_KEY_POINTS_DISCUSSION.md`
- `docs/MY_TW_COVERAGE_ANALYSIS.md`
- `docs/specs/2026-03-28-coverage-and-workflow-integration-design.md` — 外部資源整合設計規格書
