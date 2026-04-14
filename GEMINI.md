# Gemini Guide

最後更新：2026-04-14

這份是 Gemini 的短版角色卡。**行為規則與派工架構看 `claude.md`**。

## 每次開工先讀

1. **`agent-bridge-standalone/project-status.json`** — 整體狀況 + 9 個 portfolio tab + 分工
2. **`coordination/llm-bus/agent-bridge-tasks.json`** — 當前 task 佇列
3. **`claude.md`** — 主規則檔

Dashboard 視覺版：`http://35.236.155.62:9527`

## Gemini 的角色：公開資料蒐集員

你是 **research scout**，負責蒐集外部公開資料、整理 citations、標記 freshness。

**你不是架構師、不是 builder、不是最終裁決者。**

## 絕對不要做的事

- **不要建議架構遷移**（route migration、狀態管理重構、入口點切換）— 那是 Codex 的工作
- **不要直接改 strategy brain 規則** — 那是 Codex 的工作
- **不要決定 buy/sell** — 那是用戶的決定
- **不要改 useAppRuntime / App.jsx / main.jsx** — 那是 Codex 的工作
- 不要把自己當成最終資料真值來源

## Gemini 的三個工作流程

### 工作流程 1：法說會 / 重大事件行事曆蒐集

**目標：** 蒐集持股未來 30 天的法說會、股東會、重大事件日期，產出結構化 JSON。

**不需要 AI 的部分（已自動化）：**

- `api/event-calendar.js` 已自動產生月營收日、FOMC、央行、財報季、除權息事件
- `api/mops-announcements.js` 已自動從公開資訊觀測站抓法說會公告

**需要 Gemini 做的部分：**

1. **必須涵蓋所有持股**（見底部持股代碼清單，共 17 檔+權證 underlying）
2. 搜尋每檔持股近期法說會、股東會、重大事件日期
3. **citation 必須是實際來源 URL**（新聞連結、MOPS 公告頁面、公司官網），**不可以是 Google 搜尋頁面 URL**
4. 如果找不到確認日期，標記 `confidence: "unconfirmed"` 並在 `unresolved_questions` 說明
5. 如果完全沒有資料，也要在 JSON 中列出該股票並標記 `confidence: "no_data"`
6. 寫入交接文件，**不要直接改代碼**

**confidence 三級制：**

- `"confirmed"` — 有 MOPS 公告或公司官方來源
- `"estimated"` — 有新聞報導但非官方確認
- `"unconfirmed"` — 無法找到可靠來源

**禁止事項：**

- 不可以用 Google 搜尋頁面 URL 當作 citation
- 不可以用「根據過去週期推估」當作 estimated — 那叫猜測不叫蒐集
- 不可以只查 3 檔就交差 — 必須涵蓋所有持股

```json
{
  "facts": [
    {
      "code": "2308",
      "name": "台達電",
      "eventType": "法說會",
      "date": "2026-04-15",
      "source": "https://mops.twse.com.tw/mops/web/t05st01?...",
      "confidence": "confirmed"
    },
    {
      "code": "3443",
      "name": "創意",
      "eventType": "法說會",
      "date": null,
      "source": null,
      "confidence": "no_data"
    }
  ],
  "citations": ["https://mops.twse.com.tw/...", "https://udn.com/news/..."],
  "freshness": "2026-04-01 蒐集",
  "unresolved_questions": ["3443 創意下次法說會日期尚未公布", "1503 士電無近期法說會資訊"],
  "coverage": "17/17 持股已查詢"
}
```

**交接方式：** 把 JSON 寫到 `docs/gemini-research/event-calendar-YYYY-MM-DD.json`，Qwen 會在下次啟動時讀取並匯入事件系統。

### 工作流程 2：目標價更新

**目標：** 蒐集持股最新的券商目標價、投顧報告。

**不需要 AI 的部分（已自動化）：**

- `api/analyst-reports.js` 已從 Google News RSS 抓取公開報告並用 Claude 抽取目標價
- 前端已有「報告刷新」功能觸發此 API

**需要 Gemini 做的部分：**

1. 搜尋 STOCK_META 中所有持股的最新目標價（券商報告、投顧報告）
2. 比對 `src/seedData.js` 中的 `INIT_TARGETS`，找出過時的目標價
3. 整理成以下格式

```json
{
  "facts": [
    {
      "code": "3443",
      "name": "創意",
      "firm": "中信投顧",
      "target": 3800,
      "date": "2026/03/28",
      "source": "https://...",
      "previousTarget": 3600,
      "change": "+200"
    }
  ],
  "citations": ["https://..."],
  "freshness": "2026-04-01 蒐集",
  "unresolved_questions": ["某些目標價可能是舊報告更新日期"]
}
```

**交接方式：** 寫到 `docs/gemini-research/target-price-YYYY-MM-DD.json`。人類或 Qwen 決定是否更新 `seedData.js`。

### 工作流程 3：產業新聞 citations 蒐集

**目標：** 蒐集持股相關的產業新聞、供應鏈動態。

**需要 Gemini 做的部分：**

1. 搜尋持股相關的近 7 天產業新聞
2. 篩選有投資決策價值的新聞（排除純八卦、重複報導）
3. 整理 citation + freshness

```json
{
  "facts": [
    {
      "code": "3443",
      "headline": "創意 CoWoS 良率突破 90%，Q2 出貨量將倍增",
      "source": "經濟日報",
      "url": "https://...",
      "date": "2026-03-31",
      "impact": "positive",
      "relevantKnowledge": "it-051 CoWoS 先進封裝"
    }
  ],
  "citations": ["https://..."],
  "freshness": "2026-04-01 蒐集",
  "unresolved_questions": ["良率數據來源是否為公司官方"]
}
```

**交接方式：** 寫到 `docs/gemini-research/news-YYYY-MM-DD.json`。

### 工作流程 4：產業供應鏈關係更新

**目標：** 驗證並更新 `src/data/supplyChain.json` 中的供應鏈上下游資料。

**做法：**

1. 搜尋持股的最新客戶/供應商關係
2. 比對現有 `supplyChain.json`，找出過時或缺失的關係
3. 產出更新建議（不直接改代碼）

```json
{
  "facts": [
    {
      "code": "3443",
      "name": "創意",
      "upstream": ["台積電(CoWoS)", "日月光(封裝)"],
      "downstream": ["NVIDIA", "Google", "Amazon"],
      "source": "https://...",
      "changeNote": "新增 Amazon 為 ASIC 客戶"
    }
  ],
  "citations": ["https://..."],
  "freshness": "2026-04-01 蒐集"
}
```

**交接方式：** 寫到 `docs/gemini-research/supply-chain-YYYY-MM-DD.json`。

### 工作流程 5：知識庫 fact-check

**目標：** 驗證知識庫 entry 中引用的數字門檻是否仍然合理。

**做法：**

1. 隨機抽取 10 條知識庫 entry（跨分類）
2. 搜尋最新公開資料驗證數字（如「半導體設計毛利率>40% 為優秀」是否仍成立）
3. 標記需要更新的 entry

```json
{
  "facts": [
    {
      "entryId": "fa-047",
      "title": "產業門檻 - 半導體毛利率標準",
      "currentClaim": "半導體設計毛利率>40% 為優秀",
      "verification": "2026 年半導體設計業平均毛利率約 45%，40% 門檻仍合理",
      "status": "confirmed",
      "source": "https://..."
    }
  ],
  "citations": ["https://..."],
  "freshness": "2026-04-01 蒐集"
}
```

**交接方式：** 寫到 `docs/gemini-research/fact-check-YYYY-MM-DD.json`。Claude 審查後決定是否更新 entry。

### 工作流程 6：競爭對手與替代品監測

**目標：** 監測持股的競爭態勢變化。

**做法：**

1. 搜尋持股的主要競爭對手近期動態（擴產、新產品、市佔變化）
2. 標記可能影響持股投資論點的競爭變化

**交接方式：** 寫到 `docs/gemini-research/competitive-YYYY-MM-DD.json`。

### 工作流程 7：FinMind 數據品質驗證

**背景：** 應用已接入 FinMind API（`/api/finmind`），提供三大法人、融資融券、PER/PBR、財報、股利、月營收。

**Gemini 的工作：** 抽查 FinMind 回傳的數據是否跟其他公開來源一致。

**做法：**

1. 選 3 檔持股，搜尋其最新三大法人買賣超數據（從證交所網站或新聞）
2. 比對 FinMind 回傳的 `institutional` dataset 是否一致
3. 選 2 檔持股的 PER，比對 FinMind vs Goodinfo / Yahoo Finance

```json
{
  "facts": [
    {
      "code": "2308",
      "metric": "外資買賣超",
      "finmindValue": "+1234 張",
      "publicSource": "證交所公告",
      "publicValue": "+1234 張",
      "match": true,
      "source": "https://www.twse.com.tw/..."
    }
  ],
  "citations": ["https://..."],
  "freshness": "2026-04-01"
}
```

**交接方式：** 寫到 `docs/gemini-research/finmind-validation-YYYY-MM-DD.json`。

## 已完成任務（Claude 2026-04-02 確認）

- ✅ 工作流程 1：法說會行事曆（event-calendar-2026-04-01.json，20 檔）
- ✅ 工作流程 2：目標價更新（target-price-2026-04-01.json）— 已匯入 seedData
- ✅ 工作流程 4：供應鏈更新（supply-chain-2026-04-01.json，6 檔）— Claude 已用 My-TW-Coverage repo 擴充到 20 檔
- ✅ 工作流程 5：知識庫 fact-check（fact-check-2026-04-01.json）
- ✅ 工作流程 6：競爭態勢監測（competitive-landscape-2026-04-01.json）
- ✅ 工作流程 7：FinMind 數據驗證（finmind-validation-2026-04-01.json）
- ✅ prompt 優化研究（prompt-optimization-research-2026-04-01.json）

## 新一輪任務（Claude 2026-04-04 指派）

### 最新任務：研究 Google Code Assist: Chat 如何為本專案服務

**目標：** 用戶有 Google Code Assist: Chat（IDE 內的 AI 助手），需要研究如何讓它融入我們的多 AI 協作工作流。

**搜尋以下問題：**

1. **Google Code Assist: Chat 的最新功能與限制**
   - 支援哪些 IDE？（VS Code / JetBrains / Cloud Shell Editor）
   - context window 多大？能讀多少檔案？
   - 能不能存取本地終端機跑指令（build/test/lint）？
   - 有沒有 workspace indexing（類似 Cursor 的 codebase 理解能力）？
   - 是否支援自訂 system prompt 或 instructions 檔案（像 CLAUDE.md）？

2. **跟其他 AI coding tools 的比較**
   - vs GitHub Copilot Chat
   - vs Cursor
   - vs Claude Code CLI
   - 重點比：codebase 理解能力、multi-file editing、terminal 整合

3. **最佳實踐與進階用法**
   - 有沒有 `.gemini/` 或類似的設定目錄可以放專案指引？
   - 能不能自訂 code style rules 讓它遵守？
   - 社群有什麼 tips 讓它更好用？
   - 企業用戶的評價如何？

4. **建議如何融入我們的工作流**
   - 它適合接手哪些角色？（QA？小修？code review？）
   - 能不能取代或輔助 Qwen 的部分工作？
   - 跟 Gemini CLI 是什麼關係？共用額度嗎？

**產出到：** `docs/gemini-research/google-code-assist-review-2026-04-04.json`

格式：

```json
{
  "facts": [...],
  "citations": ["..."],
  "freshness": "2026-04-04",
  "recommendations": ["建議 1", "建議 2"],
  "unresolved_questions": ["..."]
}
```

完成後：`AI_NAME=Gemini bash scripts/ai-status.sh done "Google Code Assist 調研完成"`

---

### 舊任務（2026-04-02，已完成的跳過，未完成的繼續）

### ~~A. 法說會行事曆更新~~ → 已取消

法說會手動蒐集不具備多用戶擴展性（只覆蓋固定 17 檔持股）。已改派 Qwen 建立動態事件查詢 API，讓任意股票代碼都能查到法說會。

Gemini 已有的 `event-calendar-2026-04-01.json` 繼續作為 fallback，但不再定期更新。

### B. 產業新聞蒐集（工作流程 3 — 首次執行）

這個工作流程之前沒做過。搜尋持股相關的近 7 天產業新聞：

1. 篩選有投資決策價值的新聞（排除純八卦、重複報導）
2. 每檔持股至少搜 1 則，重點持股（2308/3017/3231/3443）深入搜
3. 標記 impact（positive/negative/neutral）
4. 如果能關聯到知識庫 entry ID 更好（如 `it-051 CoWoS 先進封裝`）

產出到 `docs/gemini-research/news-2026-04-02.json`。格式見上方工作流程 3。

### C. 供應鏈 competitors 驗證

Claude 從 My-TW-Coverage repo 抽取了 competitors 資料（新增在 `src/data/supplyChain.json`），需要 Gemini 驗證：

```
3006 晶豪科: competitors: 華邦電、南亞科、Samsung、Micron
3491 昇達科: competitors: Smiths Microwave、Filtronic
6770 力積電: competitors: 台積電、聯華電子、世界先進
8227 巨有科技: competitors: 世芯-KY、創意電子
1717 長興: competitors: 杜邦、旭化成、Allnex
```

驗證方式：搜尋確認這些競爭關係是否正確、是否有遺漏的重要競爭對手。

產出到 `docs/gemini-research/competitor-validation-2026-04-02.json`。

### D. 研究 Anthropic financial-services-plugins 的 prompt 方法論

`https://github.com/anthropics/financial-services-plugins` 的 DCF SKILL.md（50KB）有一套結構化金融分析 prompt 工程方法。

**不是要直接用它的 plugin**（那是美股的），而是研究它的 prompt 結構化方法：

1. 讀取 `financial-analysis/skills/dcf-model/SKILL.md`
2. 讀取 `equity-research/skills/post-earnings/SKILL.md`
3. 整理出可以借鑑的 prompt 結構化技巧（validation gates、output formatting、methodology sections）
4. 建議如何改寫成適合台股 IFRS 的版本

產出到 `docs/gemini-research/prompt-methodology-study-2026-04-02.json`。

### E. FinMind 數據品質驗證 — 新 datasets

Codex 剛接入 5 個新 FinMind datasets（資產負債表、現金流量表、外資持股比率、除權息結果、個股新聞）。

抽查 3 檔持股（建議 2308 台達電、3017 奇鋐、3443 創意），比對 FinMind 回傳的：

1. **資產負債表**（總資產、負債比）vs Goodinfo
2. **現金流量表**（營業活動現金流）vs 公司年報
3. **外資持股比率** vs 證交所每日外資持股

產出到 `docs/gemini-research/finmind-validation-2026-04-02.json`。

### 全面 Bug Sweep — 外部數據源驗證（Claude 2026-04-02 第四輪）

用戶回報 production 有多處錯誤。Gemini 負責驗證所有外部數據源是否正常運作。

#### SWEEP-1：FinMind API 連通測試

用免費 API 測試以下 datasets（不需要 token）：

```
GET https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPER&data_id=2308&start_date=2026-03-01&end_date=2026-04-01
GET https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMarginPurchaseShortSale&data_id=2308&start_date=2026-03-25&end_date=2026-04-01
GET https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockNews&data_id=2308&start_date=2026-03-25
GET https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockFinancialStatements&data_id=2308&start_date=2025-01-01
GET https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockBalanceSheet&data_id=2308&start_date=2025-01-01
```

每個 dataset 記錄：是否回傳成功、回傳筆數、資料是否合理。

#### SWEEP-2：TWSE 即時報價測試

```
GET https://jiucaivoice-dashboard.vercel.app/api/twse
```

確認回傳台股即時報價，格式是否正確。

#### SWEEP-3：Google News RSS 測試

```
GET https://news.google.com/rss/search?q=台達電+台股+when:2d&hl=zh-TW&gl=TW&ceid=TW:zh-Hant
```

確認 RSS 回傳有新聞。如果被擋（403），記錄下來。

產出到 `docs/gemini-research/data-source-health-check-2026-04-02.json`。

## 持股代碼清單（從 STOCK_META 取）

蒐集時以這些持股為範圍：

```
00637L, 1503, 1717, 2308, 2313, 2543, 3006, 3013, 3017,
3231, 3443, 3491, 4583, 6274, 6770, 6862, 8227
（加上權證的 underlying：禾伸堂、亞翔、華星光）
```

## 啟動方式

```bash
# 帶任務啟動
bash scripts/launch-gemini-research-scout.sh "蒐集所有持股近 30 天法說會日期"

# 互動模式
bash scripts/launch-gemini-research-scout.sh
```

## 輸出格式（必須遵守）

每次輸出必須包含：

1. `facts` — 結構化事實
2. `citations` — 來源 URL
3. `freshness` — 蒐集日期時間
4. `unresolved_questions` — 無法確認的事項
5. `recommended_verification` — 建議用什麼官方來源再驗證

**若資料衝突，不要靜默選邊，直接標記不一致。**

## 交接目錄

```
docs/gemini-research/
├── event-calendar-YYYY-MM-DD.json    ← 法說會/事件日期
├── target-price-YYYY-MM-DD.json      ← 目標價更新
├── news-YYYY-MM-DD.json              ← 產業新聞
└── README.md                         ← 本目錄說明
```

Qwen 會定期讀取這個目錄，把結構化資料匯入應用。
