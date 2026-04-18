# 四人格時間軸分析系統設計

## 核心概念

一檔股票不該用同一套邏輯分析。根據持有週期，AI 切換成不同人格，用完全不同的資料來源、打分邏輯、知識庫權重。

---

## 四個人格

### 1. 短線客（Scalper）— 極短 1-2 週

**看什麼：** 日 K 線型態、成交量暴量比、權證 Delta/Theta/IV、盤中動量、當沖比
**不看：** 月營收（太慢）、PER（無意義）、產業趨勢（太遠）
**知識庫：** technical-analysis 60% + risk-management 30% + news-correlation 10%
**打分邏輯：**

- 近3日量比 > 2.0 且股價突破5日高 → +2
- 權證 Delta > 0.5 且 Theta < -0.05 → +1（時間價值還夠）
- 權證 Delta < 0.3 → -2（太價外，時間衰減致命）
- 近5日外資連續買超 → +1
- RSI > 80 → -1（超買）
- RSI < 20 → +1（超賣反彈）
  **判定門檻：** score >= 3 做多，<= -3 做空，其他不碰
  **適用持股：** 權證（053848, 054657, 702157, 705200, 084891）、00637L

### 2. 波段手（Swing Trader）— 短期 1-2 月

**看什麼：** 法人連續買賣超天數、月營收月增率、事件催化窗口、融資券變化
**不看：** 年度財報（太遠）、長期 ROE 趨勢
**知識庫：** chip-analysis 35% + news-correlation 30% + technical-analysis 25% + risk-management 10%
**打分邏輯：**

- 外資+投信同買超 > 3天 → +2
- 月營收連續2月月增 → +1
- 近7天有法說/財報事件 → +1（事件前布局）
- 融資增+股價跌 → -2（散戶接刀）
- 跌破月線 → -1
  **判定門檻：** score >= 3 做多，<= -3 做空
  **適用持股：** 事件驅動股（4583）、短中期持有的景氣循環股

### 3. 趨勢家（Trend Follower）— 中期 3-6 月

**看什麼：** 營收 YoY、三大法人累計、產業景氣循環位階、估值區間（PER/PBR band）
**知識庫：** fundamental-analysis 35% + industry-trends 30% + chip-analysis 20% + strategy-cases 15%
**打分邏輯：**

- 營收 YoY > 20% 連續2季 → +2
- MA20 > MA60 且股價在 MA20 上方 → +2（多頭趨勢確認）
- PER < 歷史 25 percentile → +1（估值便宜）
- PER > 歷史 75 percentile → -1（估值偏高）
- 外資持股比率上升 → +1
- 景氣對策信號由藍轉綠 → +2
- 季節性修正（12月、3月）→ -1
  **判定門檻：** score >= 4 做多，<= -4 做空
  **適用持股：** 成長股（2308, 3017, 3443, 3231, 3491, 6862, 8227）、景氣循環股（1503, 1717, 2313, 2543, 3006, 6274, 6770）

### 4. 價值者（Value Investor）— 長期 1-5 年

**看什麼：** ROE 趨勢、自由現金流、護城河、產業龍頭地位、股利政策、資本配置
**知識庫：** fundamental-analysis 40% + strategy-cases 30% + industry-trends 25% + risk-management 5%
**打分邏輯：**

- ROE > 15% 連續3年 → +2
- 自由現金流連續正數 → +1
- 產業龍頭（leader=龍頭）→ +1
- PBR < 1.5 且 ROE > 10% → +2（價值低估）
- 負債比 > 60% → -2
- 股利連續5年不中斷 → +1
  **判定門檻：** score >= 4 買進長抱，<= -3 考慮出場
  **適用持股：** ETF（0050, 00918）、核心持股

---

## 知識庫管理

每個人格負責審查自己用到的知識庫分類：

### 淘汰標準

- 回測命中率 < 30% 的規則 → confidence 降到 0.5 以下
- 6 個月沒被引用的規則 → 標記 stale
- 與新資料矛盾的規則 → 更新或刪除

### 補充標準

- 回測發現的新規律（如「季末法人調節效應」）→ 新增規則
- 個股特有的行為模式 → 新增到 strategy-cases
- 台股特殊結構（漲跌停、融資維持率）→ 強化 risk-management

---

## 實作位置

### 新增

- `src/lib/personaEngine.js` — 四人格引擎（選人格、組知識、打分）
- `tests/lib/personaEngine.test.js` — 測試

### 修改

- `src/lib/analysisFramework.js` — 接入 persona 系統
- `src/lib/knowledgeBase.js` — getRelevantKnowledge 支援 persona 權重
- `src/hooks/useDailyAnalysisWorkflow.js` — 根據持股自動選人格
- `src/lib/backtestRuntime.js` — 回測用 persona 打分

---

## Qwen 任務（Claude 指派）

### 任務 A：知識庫審查

讀 600 條知識庫規則，按四人格分類標記：

1. 哪些規則屬於「短線客」— 標記 persona: scalper
2. 哪些屬於「波段手」— 標記 persona: swing
3. 哪些屬於「趨勢家」— 標記 persona: trend
4. 哪些屬於「價值者」— 標記 persona: value
5. 哪些跨多個人格 — 標記 persona: shared

產出一個 JSON 對照表：`data/persona-knowledge-map.json`

### 任務 B：知識庫缺口分析

讀完 600 條後，列出每個人格缺少的知識：

- 短線客缺什麼？（可能缺權證 Greeks 相關規則）
- 波段手缺什麼？（可能缺事件催化效應規則）
- 趨勢家缺什麼？（可能缺產業循環位階判斷）
- 價值者缺什麼？（可能缺 ROE/現金流分析規則）

產出缺口報告：`docs/status/knowledge-gap-report.md`

### 任務 C：網站 QA

在 http://127.0.0.1:3002 做完整 QA：

1. 每個 tab 截圖
2. console errors 列表
3. 功能測試（收盤分析、深度研究按鈕是否能點）
