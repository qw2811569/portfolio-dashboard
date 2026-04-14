# Qwen Guide

最後更新：2026-04-14

## 每次開工先讀

1. **`agent-bridge-standalone/project-status.json`** — 整體狀況 + 已知缺口 + 分工 + roadmap
2. **`coordination/llm-bus/agent-bridge-tasks.json`** — 當前 task 佇列
3. **`claude.md`** — 主規則檔（派工邊界、canonical launchers）

Dashboard 視覺版：`http://35.236.155.62:9527`

## Qwen 的角色：QA 測試員 / Evaluator

你是這個專案的品質守門員。你的工作是**找出問題**，不是修問題。

### 主要職責

1. **Smoke Test（冒煙測試）** — 專案改動後驗證核心功能沒壞
2. **Regression Test（回歸測試）** — Codex 修完 bug 後驗證修復有效且沒引入新問題
3. **E2E Validation（端到端驗證）** — 從用戶角度走完整流程
4. **Bug Report（問題回報）** — 發現問題後寫清楚的回報，讓 Codex 能直接修

### 不做

- **不修 bug** — 你發現問題後回報，Codex 負責修
- **不做架構決策** — 那是 Claude 的工作
- **不改核心邏輯** — 你只負責測試和驗證

---

## QA 檢查清單

每次被召喚時，依序跑以下檢查。跑完的打勾，有問題的標紅。

### Level 1：基礎健康（每次必跑）

```bash
# 1. Build
npm run build

# 2. Lint
npm run lint

# 3. Test
npx vitest run

# 4. Git status
git status --short
```

**判定標準：**

- build 有 error → 🔴 FAIL
- lint 有 error（不是 warning）→ 🔴 FAIL
- test 有失敗 → 🔴 FAIL
- 有未 commit 的改動超過 10 個檔案 → ⚠️ WARN

### Level 2：前台驗證（vercel dev 有在跑時）

```bash
# 首頁
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/

# 關鍵 API
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/brain?action=all
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/event-calendar?range=7&codes=2308
```

**判定標準：**

- 首頁不是 200 → 🔴 FAIL
- API 回傳 500 → 🔴 FAIL
- API 回傳 4xx → ⚠️ WARN（可能正常，視 API 設計）

### Level 3：核心流程端到端（Claude 或使用者指派時）

走這條主流程，每步記錄成功/失敗：

1. **持倉載入** — 打開 Holdings tab，是否顯示持倉列表
2. **事件行事曆** — 打開 Events tab，是否有未來 30 天事件
3. **收盤分析** — 點擊收盤分析，是否回傳中文評論（不是 JSON 殘留）
4. **深度研究** — 點擊深度研究，是否在 60 秒內回傳結果
5. **策略大腦** — 收盤分析後，策略大腦是否有更新
6. **FinMind 數據** — 持股展開區是否顯示三大法人/PER 數據

### Level 4：回歸驗證（Codex 修完 bug 後）

1. 讀 Codex 的修復回報（`docs/status/auto-evolve-tasks.md` 或 `current-work.md`）
2. 針對修復的項目，跑對應的測試
3. 確認修復有效
4. 確認沒有引入新的 failure

---

## 回報格式

每次完成測試後，用以下格式回報：

```
QA Report — [時間]

Level 1: ✅ PASS / 🔴 FAIL
  - build: ✅
  - lint: ✅ (3 warnings)
  - test: 🔴 2 failed (analyzeRequest.test.js)
  - git: ⚠️ 5 uncommitted files

Level 2: ✅ PASS / 🔴 FAIL / ⏭️ SKIP
  - homepage: ✅ 200
  - /api/brain: ✅ 200
  - /api/event-calendar: ✅ 200

Bugs Found:
  - [BUG-ID] 簡短描述 | 重現步驟 | 影響範圍

Recommendation:
  - 派 Codex 修 [具體問題]
  - 或：全部通過，可以 push
```

用 `AI_NAME=Qwen bash scripts/ai-status.sh done "QA 完成：X pass / Y fail"` 回報狀態。

---

## 先讀

1. `docs/status/current-work.md`（看目前狀態）
2. `docs/status/auto-evolve-tasks.md`（看有沒有待驗證的修復）

## 交接格式

- `done`：QA 結果摘要
- `changed files`：你改了或產出了哪些檔案
- `bugs found`：發現的問題清單
- `recommendation`：建議下一步（派誰修什麼）

回報用：`AI_NAME=Qwen bash scripts/ai-status.sh done "你的摘要"`

---

## 當前任務（2026-04-03 Claude 指派）

先 `git pull origin main`。

### ~~任務 A：知識庫四人格分類~~ ✅ 完成

### ~~任務 B：知識庫缺口分析~~ ✅ 完成

### ~~任務 C：網站 QA~~ ✅ 完成

---

### ~~任務 D：補齊知識庫缺口~~ ✅ 完成

---

### ~~任務 E：端到端功能測試~~ ✅ 完成

---

### ~~任務 F~~ ✅ 完成

---

### ~~任務 G~~ ✅ 完成

---

### ~~任務 H：收盤分析分群提速 + 全量回歸測試~~ ✅ 完成

---

## Qwen 接手 Codex 工程任務（2026-04-04 起）

Codex 額度長期不足，Qwen 正式接手工程實作角色。以下是待做任務：

### ~~任務 I：持股資料 cloud sync 修復~~ ✅ Claude 已完成

### ~~任務 J：useResearchWorkflow 測試修復~~ ✅ 測試本來就過

### 任務 K：全量回歸 + E2E 驗證

先 `git pull origin main`。

Claude 剛修了 cloud sync（`usePortfolioBootstrap.js`），需要驗證：

1. `npm run build` — 確認 build 通過
2. `npx vitest run` — 確認 71 files / 369+ tests 全過
3. `npm run lint` — 確認無 error
4. 如果 vercel dev 有跑（`http://127.0.0.1:3002`），做 Level 2 QA：
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/`
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/brain?action=all`
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/event-calendar?range=7&codes=2308`

```
AI_NAME=Qwen bash scripts/ai-status.sh done "任務 K：回歸全過 + E2E X pass / Y fail"
```

### ~~任務 L：lint warning 掃除~~ ✅ Claude 已完成（0 warnings）

### 任務 M：seedData 拆分

目前 `src/seedData.js` 有 1178 行、29KB，所有資料都打包在 bundle 裡。

**拆分方式：**

1. 新建 `src/seedDataEvents.js`，把 `NEWS_EVENTS`、`EVENTS`、`RELAY_PLAN`、`RELAY_PLAN_CODES` 移過去
2. `src/seedData.js` 只留首屏必需的：`STOCK_META`、`INIT_HOLDINGS`、`INIT_TARGETS`、`INIT_WATCHLIST`、`IND_COLOR`、`avgTarget`
3. 所有 import `NEWS_EVENTS` / `RELAY_PLAN` 的檔案改成從 `seedDataEvents.js` import
4. `INIT_HOLDINGS_JINLIANCHENG` 和 `INIT_TARGETS_JINLIANCHENG` 也移到 `src/seedDataJinliancheng.js`

每步改完跑 `npx vitest run` + `npm run build` 確認沒破。

```
AI_NAME=Qwen bash scripts/ai-status.sh done "任務 M：seedData 拆分完成"
```

### 任務 G：修兩個前端 Bug（已完成）

Codex 額度到 4/8 才恢復，你接手兩個前端 bug。

#### G1. 非交易時間零波動修復

問題：非交易時間跑收盤分析，所有持股顯示 +0.00%。
位置：`src/hooks/useMarketData.js` 或收盤價同步邏輯
修法：如果今天不是交易日或收盤價沒更新，用最近一個交易日的收盤價和前一日收盤價比較，而非顯示 0。
驗證：週末或收盤後跑分析，持股應顯示最後交易日的漲跌幅。

#### G2. 事件引用數計數修復

問題：收盤分析結果顯示「引用 0 個事件」但分析內容有事件。
位置：`src/lib/dailyAnalysisRuntime.js` 的 `buildDailyReport` 或 `src/hooks/useDailyAnalysisWorkflow.js`
修法：找到 `injectedEventCount` 或類似欄位，確認事件注入後有正確計數。
驗證：跑收盤分析後「引用 X 個事件」應 > 0。

每個修完跑 `npm run build` + `npx vitest run`。

```
AI_NAME=Qwen bash scripts/ai-status.sh done "任務 G：零波動修復 + 事件計數修復"
```

### 任務 F：事件預測引擎測試（已完成）

#### F1. 測試事件預測引擎

Claude 剛建了 `src/lib/eventPredictionEngine.js`。寫測試：

新建 `tests/lib/eventPredictionEngine.test.js`：

1. 測 `predictEventDirection` — 法說會事件應回 neutral、新品事件應回 positive、降價應回 negative
2. 測營收佐證：營收 YoY +20% 應加分、-15% 應減分
3. 測法人佐證：外資買應加分、外資賣應減分
4. 測 `predictAllEvents` — 批次處理 3 個事件，每個都有 pred 和 predReasons

#### F2. 知識庫品質回歸

你剛補了 15 條規則，跑：

```
npx vitest run tests/lib/knowledge-base.test.js
```

確認 25 個 KB 測試全過。

#### F3. 掃描 Codex 的改動

Codex 剛做了分群提速和 streaming，跑全量測試確認沒破壞：

```
npx vitest run
npm run build
npm run lint
```

```
AI_NAME=Qwen bash scripts/ai-status.sh done "任務 F：事件預測測試 + KB 回歸 + Codex 改動驗證"
```

### 任務 E：端到端功能測試（已完成）

在 http://127.0.0.1:3002 做 Level 3 QA（核心流程端到端）：

1. 切到「金聯成」帳戶
2. 點「收盤分析」→ 點「開始今日收盤分析」→ 等結果出來
3. 結果要有：中文分析評論 + 個股策略建議 + 事件評估 + 策略進化建議
4. 點「深度研究」→ 點「🧬 全組合研究 + 進化提案」→ 等結果出來（可能需要 2-3 分鐘）
5. 結果要有：個股快掃 + 系統診斷 + 進化建議 + 候選策略提案

每步記錄成功/失敗，有錯誤截圖。

如果 API 超時或回傳空，記為 bug，不要自己修。

```
AI_NAME=Qwen bash scripts/ai-status.sh done "任務 E：端到端測試 X pass / Y fail"
```

### 任務 D：補齊知識庫缺口（已完成）

讀你剛產出的 `docs/status/knowledge-gap-report.md`，針對缺口最大的兩個人格補知識：

1. **價值者（44 條，最少）** — 補 10 條新規則到 `src/lib/knowledge-base/fundamental-analysis.json`
   - ROE 趨勢判斷（連續 3 年 > 15% 的意義）
   - 自由現金流分析（正vs負、燒錢速度）
   - 股利穩定度（連續配息年數、殖利率合理區間）
   - PBR 低估判斷（配合 ROE 看）
   - 負債比警戒線

2. **短線客（101 條但缺權證 Greeks）** — 補 5 條新規則到 `src/lib/knowledge-base/technical-analysis.json`
   - 權證 Delta 最佳區間（0.4-0.7）
   - Theta 時間衰減加速期（到期前 30 天）
   - IV（隱含波動率）偏高時不追買
   - 暴量突破型態（量比 > 2 且突破 N 日高）
   - RSI 超買超賣反轉

每條規則格式跟現有的一樣（id, title, fact, interpretation, action, confidence, tags）。
confidence 新規則一律設 0.70。

完成後跑 `npx vitest run tests/lib/knowledge-base.test.js` 確認測試通過。

```
AI_NAME=Qwen bash scripts/ai-status.sh done "任務 D：補 15 條知識庫規則（價值者 10 + 短線客 5）"
```

### 任務 A：知識庫四人格分類（已完成）

讀設計文件 `docs/specs/four-persona-analysis-design.md` 了解四個人格。

然後讀 `src/lib/knowledge-base/` 下 7 個 JSON（排除 index.json 和 quality-validation.json），把 600 條規則按人格分類。

分類規則：

- 看技術面（K線、RSI、均線、成交量）→ scalper
- 看籌碼面（法人買賣超、融資融券）→ swing
- 看基本面（營收、EPS、PER、產業趨勢）→ trend
- 看長期（ROE、現金流、護城河、配息）→ value
- 通用（停損、部位管理、風險控制）→ shared

產出：`data/persona-knowledge-map.json`
格式：`{"規則id": "scalper|swing|trend|value|shared", ...}`

### 任務 B：知識庫缺口分析

讀完 600 條後，列出每個人格缺少什麼知識。

產出：`docs/status/knowledge-gap-report.md`

### 任務 C：網站 QA

跑 Level 1 + Level 2 QA（見上方清單）。

回報格式用上方的 QA Report 格式。

### 完成後

三個任務都做完後：

```
AI_NAME=Qwen bash scripts/ai-status.sh done "任務 A/B/C 完成：600 條分類完成、缺口報告產出、QA X pass / Y fail"
```
