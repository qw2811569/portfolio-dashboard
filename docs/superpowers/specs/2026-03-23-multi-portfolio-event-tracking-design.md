# 多組合管理 + 事件追蹤強化 設計文件

> 日期：2026-03-23
> 狀態：設計完成，待實作

## 背景與目標

使用者（積極型台股交易者）需要在同一個 App 中管理多人持倉（幫朋友/家人代操或給建議），同時改善事件分析系統的驗證機制與策略大腦整合。

### 三大改進方向

1. **多組合管理**：支援多人獨立持倉，各自享有完整功能
2. **事件生命週期強化**：從二段式（待驗證→已驗證）改為三段式（待發生→追蹤中→已結案），加入自動股價追蹤
3. **策略大腦雙寫**：每人各有完整策略大腦，復盤教訓同步回饋到操盤者的主腦

## 設計決策紀錄

| 決策 | 選擇 | 理由 |
|------|------|------|
| 資料共用策略 | 全部獨立 | 最簡單、最不容易有 bug，交叉比對用唯讀視角處理 |
| 策略大腦 | 每人完整一顆 + 教訓雙寫到主腦 | 各人累積自己的規則，操盤者也能從所有人的經驗學習 |
| 事件驗證 | 自動抓股價 + 追蹤期 + 出場結案 | 不急著當天驗證，追蹤到出場再做最終判定 |
| 組合切換 | 頂部 dropdown | 包含「全部總覽」彙總視角 |
| 儲存方案 | 組合包模式（localStorage） | 改動最小、5人規模 localStorage 撐得住（~500KB） |
| 雲端同步 | 暫不實作 | 先在本地測試通過後再接 Vercel Blob |
| 人數上限 | 不鎖死 | 架構用 portfolioId 索引，可無限擴展 |

---

## 一、資料結構

### 1.1 Portfolio 管理

```js
// 全域：組合清單
// localStorage: "pf-portfolios-v1"
portfolios = [
  { id: "me", name: "我", isOwner: true, createdAt: "2026-03-23" },
  { id: "wang", name: "老王", isOwner: false, createdAt: "2026-03-23" },
  { id: "mei", name: "小美", isOwner: false, createdAt: "2026-03-24" },
]

// 全域：當前選中
// localStorage: "pf-active-portfolio-v1"
activePortfolioId = "me"
```

### 1.2 Portfolio-Aware 存取（核心改動）

現有的 `save(key, data)` / `load(key, fallback)` 必須改為 portfolio-aware：

```js
// 新增：根據當前組合產生 localStorage key
function pfKey(suffix) {
  return `pf-${activePortfolioId}-${suffix}`;
}

// 所有現有的 save/load 呼叫都要改：
// 舊: save("pf-holdings-v2", holdings)
// 新: save(pfKey("holdings-v2"), holdings)

// 所有 useEffect auto-save 也要跟著改：
// 舊: useEffect(() => { save("pf-holdings-v2", holdings); }, [holdings])
// 新: useEffect(() => { save(pfKey("holdings-v2"), holdings); }, [holdings, activePortfolioId])
```

**要改的 save/load 呼叫清單**：

| 現有 key | 新 key | 備註 |
|----------|--------|------|
| `pf-holdings-v2` | `pf-{pid}-holdings-v2` | holdings |
| `pf-news-events-v1` | `pf-{pid}-news-events-v1` | events |
| `pf-targets-v1` | `pf-{pid}-targets-v1` | 目標價 |
| `pf-log-v2` | `pf-{pid}-log-v2` | 交易日誌 |
| `pf-brain-v1` | `pf-{pid}-brain-v1` | 策略大腦 |
| `pf-analysis-history-v1` | `pf-{pid}-analysis-history-v1` | 分析歷史 |
| `pf-daily-report-v1` | `pf-{pid}-daily-report-v1` | 當日報告 |
| `pf-reversal-v1` | `pf-{pid}-reversal-v1` | 反轉條件 |
| `pf-research-history-v1` | `pf-{pid}-research-history-v1` | 研究歷史 |

**不隨組合切換的全域 key**：

| key | 用途 |
|-----|------|
| `pf-portfolios-v1` | 組合清單 |
| `pf-active-portfolio-v1` | 當前選中 |
| `pf-cloud-sync-at` | 全域雲端同步時間戳 |

**非 owner 組合的 load fallback**：
```js
// owner（"me"）用現有的 INIT 常數作 fallback
// 其他人用空值 fallback
function loadForPortfolio(pid, suffix, ownerFallback) {
  const fallback = pid === "me" ? ownerFallback : getEmptyFallback(suffix);
  return load(`pf-${pid}-${suffix}`, fallback);
}

// 空值 fallback 對照表
function getEmptyFallback(suffix) {
  if (suffix.includes("holdings")) return [];
  if (suffix.includes("events"))   return [];
  if (suffix.includes("targets"))  return {};
  if (suffix.includes("log"))      return [];
  if (suffix.includes("brain"))    return null;
  if (suffix.includes("history"))  return [];
  if (suffix.includes("report"))   return null;
  if (suffix.includes("reversal")) return {};
  return null;
}
```

### 1.3 每人獨立資料（localStorage key 架構）

```
"pf-{pid}-holdings-v2"          → holdings 陣列
"pf-{pid}-news-events-v1"       → events 陣列
"pf-{pid}-targets-v1"           → 目標價
"pf-{pid}-log-v2"               → 交易日誌
"pf-{pid}-brain-v1"             → 該人的策略大腦
"pf-{pid}-notes-v1"             → 個人備註（新功能，見 1.4）
"pf-{pid}-analysis-history-v1"  → 收盤分析歷史
"pf-{pid}-daily-report-v1"      → 當日報告
"pf-{pid}-reversal-v1"          → 反轉條件
"pf-{pid}-research-history-v1"  → 研究歷史
```

每人約 80-120KB，5 人 ≈ 500KB，遠低於 localStorage 5MB 上限。

### 1.4 個人備註結構（新功能）

```js
// localStorage: "pf-{pid}-notes-v1"
// 新功能：記錄每個人的投資偏好、風險屬性
portfolioNotes = {
  riskProfile: "保守型，不碰權證",   // 風險屬性
  preferences: "偏好高殖利率",       // 偏好
  customNotes: "每月可投入 5 萬"     // 自由備註
}
```

**UI 位置**：在「管理組合」頁面，每個組合的編輯表單中顯示。三個文字輸入欄位，簡潔不複雜。復盤時 AI prompt 會帶入該人的 notes，讓策略建議更個人化。

### 1.5 策略大腦結構

```js
// 每人各一顆完整大腦
// localStorage: "pf-{pid}-brain-v1"
{
  rules: ["規則1", "規則2", ...],
  lessons: [
    { date: "2026/04/05", text: "教訓內容" }
  ],
  commonMistakes: ["常犯錯誤1", ...],
  stats: { hitRate: "5/8", totalAnalyses: 8 },
  lastUpdate: "2026/04/05"
}

// 操盤者（me）的大腦額外收所有人的教訓
// lessons 項目多一個 source 欄位
{
  ...同上,
  lessons: [
    { date: "2026/04/05", text: "教訓內容", source: "老王-台燿法說復盤" },
    { date: "2026/04/03", text: "教訓內容" },  // 自己的，無 source
  ]
}
```

### 1.6 事件生命週期（三段式）

```js
event = {
  // 沿用欄位
  id, date, title, detail, stocks, pred, predReason,

  // 狀態改為三段
  status: "pending" | "tracking" | "closed",

  // 新增：追蹤相關
  eventDate: "2026/04/01",       // 事件實際發生日
  trackingStart: null,           // 開始追蹤日（事件後約 2 天）
  exitDate: null,                // 出場日
  priceAtEvent: null,            // 事件日股價（自動抓）
  priceAtExit: null,             // 出場日股價（自動抓）
  // ↑ 多股票時為 object: { "3006": 194.5, "3017": 1905 }
  priceHistory: [],              // 追蹤期間股價紀錄
  // [{ date: "2026/04/03", prices: { "3006": 510, "3017": 1920 } }, ...]

  // 沿用：復盤欄位
  actual: null,                  // "up" | "down" | "neutral"
  actualNote: "",
  correct: null,
  lessons: "",
  reviewDate: null
}
```

**stocks 欄位格式解析**：現有 stocks 格式為 `["晶豪科 3006", "奇鋐 3017"]`，需解析出代碼。複用現有邏輯 `s.match(/\d{4,6}/)?.[0]` 取得股票代碼後查價。

**多股票事件的漲跌判定**：取所有相關股票的平均漲跌幅做為判定依據。

**狀態轉換**：
- `pending` → `tracking`：事件日到了，自動抓 `priceAtEvent`，開始記錄 `priceHistory`
  - 若事件日為非交易日（週末/假日），延後至下一個交易日自動抓取
  - 若股價 API 暫時無法取得，保持 `pending`，下次開 App 再嘗試
- `tracking` → `closed`：使用者點「結案復盤」，填入 `exitDate` + `priceAtExit`，自動預填 `actual`（比對漲跌方向），進入復盤流程
- 自動驗證邏輯：`priceAtExit > priceAtEvent` → 預填 actual="up"，反之 "down"，±1% 內 "neutral"
- **追蹤超時**：追蹤超過 90 天自動在「待處理事項」中顯示警告，提醒使用者結案

**correct 判定規則**：
- `pred === actual` → `correct = true`
- `pred !== actual` → `correct = false`
- 包含 neutral：如果預測 "up" 但實際 "neutral"，算 `false`（沒漲到預期）

**向後相容**：遷移時將現有 `status: "past"` 映射為 `"closed"`（見第四章遷移邏輯）。

---

## 二、UI 互動設計

### 2.1 頂部組合切換器

位置：App 最頂端，標題列區域。

```
┌─────────────────────────────────┐
│  ▼ 我的組合                      │  ← dropdown trigger
├─────────────────────────────────┤
│  ● 我          17檔  +5.2%      │  ← 選中態
│    老王         8檔  -1.3%      │
│    小美        12檔  +3.8%      │
│  ──────────────────────────────  │
│    📊 全部總覽                   │
│  ──────────────────────────────  │
│    ＋ 新增組合                   │
│    ⚙ 管理組合                   │
└─────────────────────────────────┘
```

- 每個選項直接顯示持股檔數 + 總報酬率
- 選了之後所有 Tab 資料全切到該人
- 切換為同步操作（localStorage < 5ms）

### 2.2 「全部總覽」視角

選「全部總覽」時取代正常 Tab 內容，進入唯讀彙總頁面。只讀取各組合的 holdings + events（不載入 history 類大型資料，確保效能）：

```
┌─────────────────────────────────┐
│  全部總覽 · 3 個組合             │
├─────────────────────────────────┤
│  總市值  186,420   總損益 +8,230 │
│                                  │
│  ── 各組合摘要 ──                │
│  我     82,400  +5.2%  17檔     │  ← 點擊可切換到該人
│  老王   55,020  -1.3%   8檔     │
│  小美   49,000  +3.8%  12檔     │
│                                  │
│  ── 重複持股 ──                  │
│  晶豪科 3006  → 我、老王         │
│  台燿 6274    → 我、小美         │
│  奇鋐 3017    → 我、老王、小美   │
│                                  │
│  ── 待處理事項 ──                │
│  老王：2 件事件待驗證             │
│  小美：1 件追蹤中即將到期         │
│  我：3 件追蹤中                   │
└─────────────────────────────────┘
```

- 純唯讀，不可編輯
- 重複持股交叉比對：掃描所有 portfolio 的 holdings，比對 code 欄位
- 待處理事項：彙總所有 portfolio 的 pending + tracking 事件

### 2.3 新增/管理組合

- **新增**：表單只填名字，自動產生 id（時間戳或隨機），初始資料為空陣列
- **管理**：可改名、刪除（二次確認「確定刪除老王的所有資料？」）、匯出單人備份 JSON、編輯個人備註（riskProfile / preferences / customNotes）
- STOCK_META 為全域共用（產業/策略分類跟人無關），不需每人複製
- EVENTS 常數（硬編碼行事曆，如法說會日期）維持全域共用不分人，因為行事曆是公開資訊

### 2.4 事件追蹤中 UI

`tracking` 狀態的事件卡片多顯示股價走勢：

```
┌─────────────────────────────────┐
│  ↑ 台燿 Q1 法說會               │
│  2026/04/01 · 台燿 6274   追蹤中 │
├─────────────────────────────────┤
│  事件日股價：505                  │
│  目前股價：  528  (+4.5%)        │
│  追蹤天數：  5 天                 │
│                                  │
│  505 ──┬──╱──╲──╱── 528        │  ← 簡易折線圖
│        事件日        今天        │
│                                  │
│  [ 繼續追蹤 ]    [ 結案復盤 ]    │
└─────────────────────────────────┘
```

- 股價資料來自現有的 price refresh 機制
- 點「結案復盤」→ 自動帶入 priceAtExit、預填 actual → 進入現有復盤表單
- 追蹤超過 90 天的事件卡片顯示橙色警告標記

---

## 三、核心流程

### 3.1 組合切換流程

```
用戶選擇「老王」
  1. saveCurrentPortfolio()     // 把當前所有 state 寫入 "pf-{currentId}-*"
  2. resetTransientState()      // 重置 UI 暫態（見下方清單）
  3. setActivePortfolioId("wang")
  4. loadPortfolio("wang")      // 從 "pf-wang-*" 讀取，更新所有 state
  5. UI 自動 re-render          // 同步完成，無需 loading
```

**切換時必須重置的 transient UI state**：
- `reviewingEvent` → null（正在復盤的事件）
- `reviewForm` → 初始值（復盤表單內容）
- `parsed` → null（交易解析中的資料）
- `memoStep` / `memoIn` / `memoAns` → 初始值（備忘錄問答）
- `showAddEvent` → false（新增事件表單）
- `newEvent` → 初始值（新增事件表單內容）
- `expandedNews` → new Set()（展開的事件卡片）
- `expandedStock` → null（展開的持股卡片）
- `scanQuery` → ""（搜尋框）

### 3.2 復盤雙寫流程

```
submitReview(eventId)  // 假設當前 portfolio = "wang"
  1. 更新 wang 的 events（status → "closed"）
  2. AI 分析 → 回傳更新後的 brain
  3. 儲存到 "pf-wang-brain-v1"（老王的大腦）→ via state + auto-save
  4. 直接從 localStorage 讀取 "pf-me-brain-v1"（主腦）
     ↑ 不依賴 React state，避免 race condition
  5. 把這筆 lesson 加入主腦，帶 source: "老王-{事件標題}"
  6. 直接寫回 localStorage "pf-me-brain-v1"
  7. 若當前就是 "me"，步驟 3 的 state 更新已包含教訓，跳過 4-6
```

**關鍵**：步驟 4-6 直接操作 localStorage 而非 React state，因為當 `activePortfolioId !== "me"` 時，記憶體中的 `strategyBrain` state 存的是當前組合（老王）的大腦，不是主腦。如果透過 auto-save effect 寫入，會把老王的大腦覆蓋到主腦 key。

### 3.3 事件狀態轉換流程

```
pending → tracking:
  1. 到了 eventDate（或使用者手動觸發）
  2. 解析 stocks 欄位取得代碼（s.match(/\d{4,6}/)?.[0]）
  3. 抓取相關股票的當日股價 → 填入 priceAtEvent
     - 多股票: priceAtEvent = { "3006": 194.5, "3017": 1905 }
     - 非交易日: 延後至下一個有報價的日期
     - API 失敗: 保持 pending，下次重試
  4. 設定 trackingStart = 今天
  5. status 改為 "tracking"
  6. 開始記錄 priceHistory（每次 App 開啟時更新）

tracking → closed:
  1. 使用者點「結案復盤」
  2. 抓取當日股價 → 填入 priceAtExit、exitDate
  3. 自動計算漲跌：平均(priceAtExit) vs 平均(priceAtEvent)
     - 漲幅 > 1% → 預填 actual = "up"
     - 跌幅 > 1% → 預填 actual = "down"
     - ±1% 以內 → 預填 actual = "neutral"
  4. 使用者可修正預填值
  5. 進入復盤表單 → submitReview → 雙寫大腦
```

### 3.4 priceHistory 更新策略

- 每次 App 開啟、或切換到事件分析 Tab 時
- 掃描所有 status="tracking" 的事件
- 對每個事件的 stocks 解析代碼後抓當日股價（複用現有 price refresh）
- 若今天的日期尚未記錄，append 到 priceHistory
- 每筆格式：`{ date: "2026/04/03", prices: { "3006": 510, "3017": 1920 } }`
- 不做定時輪詢，避免 API 負擔
- **超時保護**：追蹤超過 90 天仍未結案，在 UI 顯示提醒但不自動關閉

### 3.5 雲端同步（暫停）

多組合模式下，雲端同步暫時關閉（`cloudSyncStateRef.current.enabled` 維持現狀但不擴展到新組合）。現有的 `pf-cloud-sync-at`、`pf-analysis-cloud-sync-at`、`pf-research-cloud-sync-at` 三個全域同步時間戳維持不動，只對 "me" 組合的資料生效。等本地測試通過後再擴展。

---

## 四、舊資料遷移

### 一次性自動遷移

App 啟動時偵測：若 `pf-portfolios-v1` 不存在但 `pf-holdings-v2` 存在 → 執行遷移。

```js
function migrateToPortfolios() {
  // 1. 建立組合清單
  save("pf-portfolios-v1", [{ id: "me", name: "我", isOwner: true, createdAt: today() }]);
  save("pf-active-portfolio-v1", "me");

  // 2. 搬移現有 key（先寫新 → 再刪舊）
  const MIGRATE_KEYS = [
    "holdings-v2", "news-events-v1", "targets-v1", "log-v2",
    "brain-v1", "analysis-history-v1", "daily-report-v1",
    "reversal-v1", "research-history-v1"
  ];
  for (const k of MIGRATE_KEYS) {
    const data = load(`pf-${k}`);
    if (data !== null) {
      save(`pf-me-${k}`, data);
      localStorage.removeItem(`pf-${k}`);
    }
  }

  // 3. 遷移事件 status: "past" → "closed"
  const events = load("pf-me-news-events-v1");
  if (events) {
    const migrated = events.map(e => ({
      ...e,
      status: e.status === "past" ? "closed" : e.status,
      // 為已結案事件補上新欄位的預設值
      ...(e.status === "past" ? {
        eventDate: e.date,
        trackingStart: e.reviewDate || e.date,
        exitDate: e.reviewDate || null,
        priceAtEvent: null,   // 歷史資料無法回填
        priceAtExit: null,
        priceHistory: [],
      } : {})
    }));
    save("pf-me-news-events-v1", migrated);
  }
}
```

**安全措施**：
- 先寫新 key，確認成功後才刪舊 key
- 如果中途失敗（例如 quota），下次啟動時重跑（偵測條件仍然成立）
- 遷移過程靜默，使用者無感
- 事件 status 映射：`"past"` → `"closed"`、`"pending"` 維持不變

---

## 五、範圍限制

### 本次不做

- Vercel Blob 雲端同步（測試通過後再接）
- 多人同時登入/權限控制
- 組合之間的資料匯入匯出（未來可加）
- 事件的跨組合共用（各自獨立，最簡單）
- 觀察清單（INIT_WATCHLIST）的多組合化（維持全域共用）
- EVENTS 常數（行事曆）的多組合化（維持全域共用，公開資訊）

### 未來擴展路徑

- localStorage → Vercel Blob：加一層 lazy load，架構從方案 A 遷移到方案 C
- 組合數 > 10 人：考慮只快取活躍 portfolio，其餘存 Blob
- 共用事件庫：如果需求出現，可加一個「公共事件模板」讓各 portfolio 引用
- 觀察清單每人獨立：需新增 `pf-{pid}-watchlist-v1` key
