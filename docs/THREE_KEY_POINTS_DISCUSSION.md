> ⚠️ **SUPERSEDED · 2026-04-18** · 此檔為早期產品/付費 brainstorm 草案。最新產品方向請見 `docs/decisions/2026-04-16-product-stage-stability-first.md` 與 `docs/product/portfolio-dashboard-spec.md`。
>
> 保留理由：保留早期討論脈絡；其中付費/社交貨幣/商業化建議已被「先穩定再談錢」正式決議延後。

# 三大關鍵點深度討論報告

最後更新：2026-03-27
狀態：策略討論草案
作者：Qwen Code

---

## 討論點 1：付費機制與社交貨幣設計

### 1.1 核心問題

**如何讓付費使用者有「輕度學習成本」但獲得「極大成就感」，並願意主動分享？**

### 1.2 設計原則

```
┌─────────────────────────────────────────────────────────────┐
│ 付費設計三原則                                              │
├─────────────────────────────────────────────────────────────┤
│ 1. 輕度學習：不需要花很多時間研究，直覺就會用               │
│ 2. 極大成就感：用沒多久就感覺到「這個工具幫到我」           │
│ 3. 社交貨幣：有東西可以跟朋友炫耀、分享                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 付費方案設計

#### 方案 A：成就系統（推薦）

**核心概念：** 把投資過程遊戲化，讓使用者「打怪升級」

| 等級 | 名稱       | 解鎖條件              | 解鎖功能     | 社交貨幣            |
| ---- | ---------- | --------------------- | ------------ | ------------------- |
| LV1  | 投資新手   | 註冊即得              | 基本持倉管理 | -                   |
| LV2  | 認真投資人 | 連續簽到 7 天         | 風險警告     | 簽到徽章            |
| LV3  | 策略玩家   | 完成 5 筆 thesis 記錄 | 策略大腦     | 策略卡片可分享      |
| LV4  | 獲利高手   | 單月獲利>10%          | 進階分析     | 獲利報告可分享      |
| LV5  | 投資達人   | 連續 3 月獲利         | 完整功能     | 達人頭銜 + 專屬徽章 |

**成就感來源：**

- 每次升級都有動畫慶祝
- 解鎖新功能時有「恭喜解鎖」提示
- 可以看到自己的進步軌跡（等級、勝率、獲利曲線）

**社交貨幣設計：**

```
可分享的內容：
├─ 投資等級徽章（圖片）
├─ 本月獲利報告（可隱藏金額）
├─ 勝率統計（例如：最近 10 筆交易 7 筆獲利）
├─ 策略卡片（我的投資策略是什麼）
└─ 學習成就（例如：已連續檢視 30 天）
```

**分享機制：**

```
一鍵分享到：
├─ LINE（生成精美圖片）
├─ Facebook/Instagram
├─ PTT（生成文字版報告）
└─ 邀請連結（朋友註冊雙方都得積分）
```

**範例分享文案：**

```
🎉 我在使用「台股投資決策工作台」
本月勝率 70%！連續獲利 3 個月！
用這個工具幫我追蹤月營收、分析風險
推薦給你！[邀請連結]
```

#### 方案 B：解鎖制（備案）

**核心概念：** 付費解鎖特定功能，而不是訂閱制

| 功能包     | 價格      | 內容                | 適合對象 |
| ---------- | --------- | ------------------- | -------- |
| 風險管理包 | NT$299/月 | 部位計算、風險警告  | 新手     |
| 分析大師包 | NT$499/月 | 深度研究、自動分析  | 中階     |
| 完整功能包 | NT$699/月 | 全部功能 + 優先支持 | 專業     |

**優點：** 彈性高，使用者只買需要的
**缺點：** 可能阻礙使用者嘗試進階功能

#### 方案 C：訂閱制（標準）

**核心概念：** 月費/年費制，類似 Netflix

| 方案   | 價格                 | 內容                |
| ------ | -------------------- | ------------------- |
| 月訂閱 | NT$599/月            | 全部功能            |
| 年訂閱 | NT$4990/年（省 30%） | 全部功能 + 優先支持 |

**優點：** 收入穩定
**缺點：** 使用者可能覺得「不用也要付錢」

### 1.4 推薦方案：混合制

```
免費版：
- 基本持倉管理
- 每日簽到賺積分
- 基礎風險警告

付費版（NT$399/月）：
- 完整分析功能
- 策略大腦
- 深度研究
- 可分享報告（含浮水印）
- 專屬徽章

邀請獎勵：
- 每邀請 1 人註冊：得 7 天免費使用
- 每邀請 1 人付費：得 1 個月免費使用 + NT$100 積分
```

### 1.5 成就感設計細節

#### 1.5.1 即時回饋

```
使用者完成某個動作後，立即給予回饋：

✅ 記錄 thesis 後：
   「恭喜！你已完成第 1 筆投資記錄，獲得 10 點積分！」
   進度條：■□□□□ 1/5 解鎖下一等級

✅ 連續簽到 7 天：
   「太強了！連續簽到 7 天，解鎖『認真投資人』徽章！」
   [徽章圖片] + 分享按鈕

✅ 第一筆獲利交易：
   「恭喜！你的第一筆獲利交易！
    台積電 (2330) +15% 獲利
    已自動記錄到獲利曲線」
```

#### 1.5.2 進步軌跡可視化

```
個人化數據報告（每月生成）：

┌─────────────────────────────────────────┐
│ 你的 3 月投資報告                        │
├─────────────────────────────────────────┤
│ 📈 本月獲利：+12.5%                     │
│ 🎯 勝率：7/10 (70%)                     │
│ ⭐ 最佳交易：台積電 +25%                │
│ 📚 學習成就：連續檢視 21 天              │
│ 🏆 等級提升：LV3 → LV4                  │
├─────────────────────────────────────────┤
│ [分享報告] [下載 PDF]                   │
└─────────────────────────────────────────┘
```

#### 1.5.3 社交比較（良性）

```
排行榜（可選加入）：
- 本月勝率排行榜（前 10 名）
- 連續簽到排行榜
- 最活躍用戶排行榜

注意：不顯示金額，只顯示百分比和次數
避免使用者因為金額比較而焦慮
```

### 1.6 病毒式傳播設計

#### 1.6.1 邀請機制

```
邀請流程：
1. 使用者點擊「邀請朋友」
2. 生成個人化邀請連結 + 專屬優惠碼
3. 朋友註冊並輸入優惠碼
4. 雙方獲得獎勵

獎勵設計：
- 朋友：首月 5 折
- 邀請者：獲得 1 個月免費 + 100 積分
```

#### 1.6.2 分享模板

```
系統自動生成分享內容：

模板 1（獲利報告）：
「本月勝率 75%！用這個工具幫我追蹤持股風險
推薦給你！[連結]」

模板 2（等級成就）：
「我解鎖了『投資達人』徽章！
連續 3 個月獲利，這個工具真的有用 [連結]」

模板 3（學習成就）：
「已連續檢視持倉 30 天！
養成投資好習慣，從這個工具開始 [連結]」
```

#### 1.6.3 社群挑戰

```
每月舉辦社群挑戰：

挑戰 1：連續簽到 30 天
獎勵：專屬徽章 + 抽獎機會

挑戰 2：記錄 10 筆 thesis
獎勵：解鎖「策略玩家」稱號

挑戰 3：邀請 3 位朋友
獎勵：免費使用 1 個月

挑戰 4：分享獲利報告
獎勵：積分加倍
```

---

## 討論點 2：停損與加倉機制設計

### 2.1 核心問題

**系統如何學習並建立停損與加倉的判斷機制？**

### 2.2 現況分析

**目前缺失：**

- ❌ 沒有強制記錄停損點
- ❌ 沒有加倉邏輯
- ❌ 沒有從歷史交易學習停損/加倉效果

### 2.3 停損機制設計

#### 2.3.1 停損類型

```
┌─────────────────────────────────────────────────────────────┐
│ 停損類型                                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. 固定比例停損                                             │
│    - 設定：跌 8% 停損                                        │
│    - 優點：簡單明確                                         │
│    - 缺點：可能被洗出去                                     │
├─────────────────────────────────────────────────────────────┤
│ 2. 技術面停損                                               │
│    - 設定：跌破季線停損                                     │
│    - 優點：符合技術分析                                     │
│    - 缺點：需要定義什麼是「跌破」                           │
├─────────────────────────────────────────────────────────────┤
│ 3. Thesis 破壞停損                                          │
│    - 設定：月營收轉負就停損                                 │
│    - 優點：符合投資邏輯                                     │
│    - 缺點：需要記錄 thesis                                  │
├─────────────────────────────────────────────────────────────┤
│ 4. 時間停損                                                 │
│    - 設定：30 天內沒漲就停損                                 │
│    - 優點：避免資金效率低落                                 │
│    - 缺點：可能錯過後續漲幅                                 │
└─────────────────────────────────────────────────────────────┘
```

#### 2.3.2 停損建議學習流程

```
階段 1：收集數據（1-3 個月）
├─ 記錄每筆交易的停損設定
├─ 記錄實際停損執行與否
├─ 記錄停損後的股價走勢

階段 2：分析模式（3-6 個月）
├─ 分析哪些停損設定最終獲利
├─ 分析哪些停損設定被洗出去後又漲
├─ 找出最適合使用者的停損參數

階段 3：個人化建議（6 個月後）
├─ 「根據你的歷史交易，建議停損設 8-10%」
├─ 「你過去 5 次設 5% 停損，4 次被洗出去」
├─ 「科技股建議設 8%，傳產股建議設 10%」
```

#### 2.3.3 停損建議演算法

```javascript
// 停損建議邏輯
function suggestStopLoss(stock, userHistory) {
  // 1. 基礎停損（根據波動率）
  const volatility = calculateVolatility(stock)
  const baseStopLoss = volatility * 2 // 2 倍波動率

  // 2. 技術面停損（根據支撐位）
  const supportLevel = findSupportLevel(stock)
  const technicalStopLoss = (stock.price - supportLevel) / stock.price

  // 3. 使用者歷史偏好
  const userPreference = getUserStopLossPreference(userHistory)

  // 4. 綜合建議
  const suggestedStopLoss = weightedAverage([
    { value: baseStopLoss, weight: 0.4 },
    { value: technicalStopLoss, weight: 0.4 },
    { value: userPreference, weight: 0.2 },
  ])

  return {
    suggested: suggestedStopLoss,
    range: {
      min: suggestedStopLoss * 0.8,
      max: suggestedStopLoss * 1.2,
    },
    reasoning: buildReasoning(stock, userHistory),
  }
}
```

#### 2.3.4 停損執行提醒

```
提醒時機：
├─ 股價接近停損點（距離 5% 以內）
│  「台積電股價 870，接近你的停損點 850（-2.3%）」
│  [調整停損] [維持不變] [暫時忽略]
│
├─ 股價觸及停損點
│  「台積電股價已觸及你的停損點 850」
│  「建議行動：執行停損」
│  [執行停損] [延後檢視] [調整停損]
│
└─ 停損後股價反彈（事後檢討）
   「你於 3/20 在 850 停損台積電，目前股價 900（+5.9%）」
   「復盤建議：檢視停損條件是否過緊」
   [開始復盤] [忽略]
```

### 2.4 加倉機制設計

#### 2.4.1 加倉類型

```
┌─────────────────────────────────────────────────────────────┐
│ 加倉類型                                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. 金字塔加倉（推薦）                                       │
│    - 股價上漲才加倉                                         │
│    - 每次加倉金額遞減                                       │
│    - 例：100 萬 → 50 萬 → 25 萬                              │
├─────────────────────────────────────────────────────────────┤
│ 2. 等額加倉                                                 │
│    - 固定金額加倉                                           │
│    - 例：每跌 10% 加倉 50 萬                                 │
├─────────────────────────────────────────────────────────────┤
│ 3. 事件驅動加倉                                             │
│    - 月營收超預期才加倉                                     │
│    - 法說會釋出利多才加倉                                   │
├─────────────────────────────────────────────────────────────┤
│ 4. Thesis 確認加倉                                          │
│    - 預期事件發生後加倉                                     │
│    - 例：預期 EPS 成長 20%，實際公布 25% → 加倉              │
└─────────────────────────────────────────────────────────────┘
```

#### 2.4.2 加倉建議學習流程

```
階段 1：收集數據
├─ 記錄每次加倉的價格、金額、理由
├─ 記錄加倉後的股價走勢
├─ 記錄加倉對整體損益的影響

階段 2：分析效果
├─ 哪些加倉時機最終獲利？
├─ 哪些加倉時機被套牢？
├─ 加倉後平均持倉成本變化？

階段 3：個人化建議
├─ 「你過去 5 次在股價下跌時加倉，3 次被套牢」
├─ 「建議：只在股價上漲時加倉（金字塔式）」
├─ 「你的加倉金額過大，建議降低单次加倉比例」
```

#### 2.4.3 加倉建議演算法

```javascript
// 加倉建議邏輯
function suggestAddPosition(stock, userHistory, currentHolding) {
  // 1. 檢查是否符合加倉條件
  const conditions = checkAddConditions(stock, currentHolding)

  if (!conditions.met) {
    return {
      suggest: false,
      reason: conditions.reason,
    }
  }

  // 2. 計算建議加倉金額
  const suggestedAmount = calculateAddAmount(stock, userHistory, currentHolding)

  // 3. 計算加倉後持倉成本
  const newAvgCost = calculateNewAvgCost(currentHolding, stock.price, suggestedAmount)

  // 4. 風險評估
  const riskAssessment = assessAddRisk(stock, currentHolding, suggestedAmount)

  return {
    suggest: true,
    amount: suggestedAmount,
    newAvgCost,
    reasoning: buildAddReasoning(stock, conditions),
    riskWarning: riskAssessment.warnings,
  }
}

// 金字塔加倉金額計算
function calculateAddAmount(stock, history, holding) {
  const totalCapital = history.totalCapital
  const currentPercent = (holding.value / totalCapital) * 100

  // 金字塔加倉：每次加倉金額遞減
  const addPercent = Math.max(
    2, // 最少加 2%
    Math.min(10, currentPercent * 0.5) // 最多加 10% 或當前持倉的 50%
  )

  return totalCapital * (addPercent / 100)
}
```

#### 2.4.4 加倉提醒

```
加倉訊號：
├─ 股價突破關鍵價位
│  「台積電股價突破 950，創新高」
│  「符合金字塔加倉條件」
│  [查看建議] [忽略]
│
├─ 月營收超預期
│  「台積電 3 月營收 2000 億，YoY +30%（預期 +20%）」
│  「符合事件驅動加倉條件」
│  [查看建議] [忽略]
│
└─ Thesis 確認
   「你預期的 Q1 EPS 成長 20% 已實現（實際 25%）」
   「符合 Thesis 確認加倉條件」
   [查看建議] [忽略]
```

### 2.5 系統學習機制

#### 2.5.1 數據收集

```javascript
// 每次交易後記錄
const tradeRecord = {
  stockId: '2330',
  action: 'buy' | 'sell' | 'add' | 'cut',
  price: 950,
  qty: 1000,
  reason: '月營收成長',
  thesis: 'AI 伺服器需求強勁',
  stopLoss: 850,
  target: 1100,

  // 事後記錄
  outcome: 'profit' | 'loss',
  pnlPercent: 15.8,
  holdingPeriod: 30, // days

  // 停損/加倉相關
  isStopLossExecuted: false,
  isAddPosition: true,
  addPrice: 920,
  addQty: 500,

  // 學習標籤
  tags: ['earnings_beat', 'breakout', 'institutional_buy'],
}
```

#### 2.5.2 模式分析

```javascript
// 定期分析使用者交易模式
function analyzeUserPatterns(tradeHistory) {
  const patterns = {
    stopLossEffectiveness: analyzeStopLoss(tradeHistory),
    addPositionEffectiveness: analyzeAddPosition(tradeHistory),
    optimalHoldPeriod: analyzeHoldPeriod(tradeHistory),
    sectorPreference: analyzeSectorPreference(tradeHistory),
  }

  return {
    patterns,
    suggestions: generateSuggestions(patterns),
  }
}

// 分析停損效果
function analyzeStopLoss(history) {
  const stopLossTrades = history.filter((t) => t.action === 'sell' && t.isStopLossExecuted)

  const stoppedOutThenRallied = stopLossTrades.filter((t) => {
    const priceAfterStop = getPriceAfterDays(t.stockId, t.date, 30)
    return priceAfterStop < t.price // 停損後股價下跌 = 正確
  }).length

  const washedOut = stopLossTrades.filter((t) => {
    const priceAfterStop = getPriceAfterDays(t.stockId, t.date, 30)
    return priceAfterStop > t.price * 1.05 // 停損後股價上漲 5% = 被洗
  }).length

  return {
    total: stopLossTrades.length,
    correct: stoppedOutThenRallied,
    washedOut,
    accuracy: stoppedOutThenRallied / stopLossTrades.length,
  }
}
```

#### 2.5.3 個人化建議生成

```
根據分析結果，生成個人化建議：

「根據你過去 20 筆交易記錄：

✅ 做得好的：
- 你的停損準確率 75%，高於平均 60%
- 你在月營收公布前加倉，勝率 80%

⚠️ 可改進的：
- 你過去 5 次設 5% 停損，4 次被洗出去後股價又漲
- 建議：將停損從 5% 調整到 8-10%

📊 數據支持：
- 設 8-10% 停損的交易，最終獲利比例 70%
- 設 5% 停損的交易，最終獲利比例 40%

[查看詳細報告] [調整預設停損]」
```

---

## 討論點 3：籌碼面分析補充

### 3.1 核心問題

**目前分析缺少籌碼面，需要補充哪些籌碼數據？**

### 3.2 籌碼面數據清單

```
┌─────────────────────────────────────────────────────────────┐
│ 籌碼面數據                                                   │
├─────────────────────────────────────────────────────────────┤
│ 1. 三大法人買賣超（已有）                                   │
│    - 外資買賣超                                             │
│    - 投信買賣超                                             │
│    - 自營商買賣超                                           │
├─────────────────────────────────────────────────────────────┤
│ 2. 融資融券（需補充）                                       │
│    - 融資餘額                                               │
│    - 融券餘額                                               │
│    - 融資增減                                               │
│    - 融券增減                                               │
│    - 當沖比率                                               │
├─────────────────────────────────────────────────────────────┤
│ 3. 大戶持股（需補充）                                       │
│    - 大戶持股張數                                           │
│    - 大戶持股變化                                           │
│    - 大戶集中度                                             │
├─────────────────────────────────────────────────────────────┤
│ 4. 股權分散（需補充）                                       │
│    - 股東人數                                               │
│    - 股東人數變化                                           │
│    - 戶數增減                                               │
├─────────────────────────────────────────────────────────────┤
│ 5. 借券賣出（需補充）                                       │
│    - 借券賣出量                                             │
│    - 借券賣出餘額                                           │
│    - 借券賣出成交率                                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 籌碼面數據來源

| 數據類型       | 來源 | API 端點                                | 更新頻率 |
| -------------- | ---- | --------------------------------------- | -------- |
| 三大法人買賣超 | TWSE | `/api/twse-institutional`               | 每日     |
| 融資融券       | TWSE | `/api/twse-margin` (待實作)             | 每日     |
| 大戶持股       | TWSE | `/api/twse-major` (待實作)              | 每日     |
| 股權分散       | TWSE | `/api/twse-shareholder` (待實作)        | 每週     |
| 借券賣出       | TWSE | `/api/twse-securities-lending` (待實作) | 每日     |

### 3.4 籌碼面分析指標

#### 3.4.1 法人集中度

```javascript
// 法人連續買超天數
function calculateInstitutionalConsecutive(data) {
  let consecutive = 0
  for (let i = 0; i < data.length; i++) {
    if (data[i].net > 0) {
      consecutive++
    } else {
      break
    }
  }
  return consecutive
}

// 法人買賣超趨勢
function calculateInstitutionalTrend(data, days = 5) {
  const recent = data.slice(0, days)
  const totalNet = recent.reduce((sum, d) => sum + d.net, 0)
  const avgNet = totalNet / days

  return {
    totalNet,
    avgNet,
    trend: avgNet > 0 ? 'buying' : 'selling',
    strength: Math.abs(avgNet),
  }
}
```

#### 3.4.2 融資融券分析

```javascript
// 融資增減趨勢
function calculateMarginTrend(data, days = 5) {
  const recent = data.slice(0, days)
  const marginChange = recent.reduce((sum, d) => sum + d.marginChange, 0)
  const warrantChange = recent.reduce((sum, d) => sum + d.warrantChange, 0)

  return {
    marginChange,
    warrantChange,
    netChange: marginChange - warrantChange,
    signal: marginChange > 0 ? 'bullish' : 'bearish',
  }
}

// 當沖比率
function calculateDayTradingRatio(data) {
  const totalVolume = data.reduce((sum, d) => sum + d.volume, 0)
  const dayTradingVolume = data.reduce((sum, d) => sum + d.dayTradingVolume, 0)

  return (dayTradingVolume / totalVolume) * 100
}
```

#### 3.4.3 大戶持股分析

```javascript
// 大戶持股集中度
function calculateMajorHolderConcentration(data) {
  const top10Shares = data.top10.reduce((sum, h) => sum + h.shares, 0)
  const totalShares = data.totalShares

  return (top10Shares / totalShares) * 100
}

// 大戶持股變化
function calculateMajorHolderChange(current, previous) {
  const change = current - previous
  const changePercent = (change / previous) * 100

  return {
    change,
    changePercent,
    signal: change > 0 ? 'accumulating' : 'distributing',
  }
}
```

### 3.5 籌碼面綜合評分

```
┌─────────────────────────────────────────────────────────────┐
│ 籌碼面評分卡（範例）                                        │
├─────────────────────────────────────────────────────────────┤
│ 台積電 (2330) 籌碼面評分：85 分                              │
├─────────────────────────────────────────────────────────────┤
│ ✅ 外資連續 5 日買超（+20 分）                               │
│ ✅ 投信連續 3 日買超（+15 分）                               │
│ ⚠️ 融資增加 1000 張（-5 分）                                │
│ ✅ 大戶持股增加 2%（+15 分）                                 │
│ ✅ 股東人數減少 3%（+10 分）                                 │
│ ⚠️ 借券賣出增加（-5 分）                                    │
│ ✅ 當沖比率下降至 15%（+10 分）                             │
│ ✅ 自營商買超（+10 分）                                     │
│ ⚠️ 融券增加 500 張（-5 分）                                 │
│ ✅ 融資使用率下降（+10 分）                                 │
├─────────────────────────────────────────────────────────────┤
│ 綜合判斷：籌碼面偏多                                        │
│ 建議：可積極操作                                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 籌碼面警示訊號

```
⚠️ 籌碼面警示（出現時主動提醒）：

1. 外資連續 3 日賣超 > 1000 張
   「外資連續 3 日賣超台積電，累計 5000 張」

2. 融資暴增 > 20%
   「台積電融資餘額單日增加 25%，注意散戶追高」

3. 大戶持股銳減 > 5%
   「台積電大戶持股單週減少 5%，注意主力出貨」

4. 借券賣出激增 > 50%
   「台積電借券賣出單日增加 50%，注意空方力道」

5. 當沖比率飆升 > 30%
   「台積電當沖比率升至 35%，注意短線波動加大」

6. 股東人數暴增 > 10%
   「台積電股東人數單季增加 15%，注意籌碼分散」
```

### 3.7 籌碼面與技術面結合

```
籌碼面 + 技術面綜合判斷：

情境 1：籌碼好 + 技術好
- 外資買超 + 股價突破
- 判斷：強烈買進

情境 2：籌碼好 + 技術差
- 外資買超 + 股價下跌
- 判斷：可能為主力佈局，可分批進場

情境 3：籌碼差 + 技術好
- 外資賣超 + 股價上漲
- 判斷：可能為散戶行情，謹慎追高

情境 4：籌碼差 + 技術差
- 外資賣超 + 股價下跌
- 判斷：強烈賣出
```

---

## 總結與建議

### 討論點 1：付費機制與社交貨幣

**建議方案：**

1. 採用混合制（免費 + 付費解鎖）
2. 設計成就系統（等級、徽章、排行榜）
3. 提供可分享的報告模板（獲利報告、等級成就）
4. 設計邀請獎勵機制（雙方得利）

**下一步：**

- [ ] 設計成就系統 UI
- [ ] 建立分享報告模板
- [ ] 實作邀請機制

### 討論點 2：停損與加倉機制

**建議方案：**

1. 強制記錄停損點（進場時必填）
2. 提供多種停損類型選擇
3. 從歷史交易學習個人化停損建議
4. 設計金字塔加倉機制
5. 定期生成停損/加倉效果報告

**下一步：**

- [ ] 擴充 thesis 表單（增加停損類型）
- [ ] 實作停損建議演算法
- [ ] 實作加倉建議演算法
- [ ] 建立歷史交易分析系統

### 討論點 3：籌碼面分析

**建議方案：**

1. 實作 TWSE 融資融券 API
2. 實作大戶持股 API
3. 實作股權分散 API
4. 建立籌碼面評分系統
5. 設計籌碼面警示訊號

**下一步：**

- [ ] 實作 `api/twse-margin.js`
- [ ] 實作 `api/twse-major.js`
- [ ] 實作 `api/twse-shareholder.js`
- [ ] 建立籌碼面評分演算法
- [ ] 設計籌碼面警示系統

---

**最後更新：2026-03-27**

**狀態：討論草案，待決策**
