# Qwen Guide

最後更新：2026-04-01

這份是 Qwen 的短版角色卡，不是獨立 source of truth。**完整 AI 分工與任務路由規則看 `docs/AI_COLLABORATION_GUIDE.md`**。

## 先讀

1. `docs/AI_COLLABORATION_GUIDE.md`
2. `docs/PORTFOLIO_TO_RESEARCH_ARCHITECTURE_REPORT.md`
3. `docs/status/current-work.md`（只有在接手進行中的工作時）

## Qwen 最適合做什麼

- bounded implementation
- 機械式重構
- lint / test / 小型 UI cleanup
- 第一輪 code review
- 不碰 schema 的低風險 helper 補強
- 文件 / PDF / 報告整理與摘要
- **知識庫機械式維護**（見下方待辦清單）

## Qwen 不應主導什麼

- strategy brain 核心規則判定
- cloud sync / persistence 高風險修改
- 客戶版數字與結論的最終裁決
- 以「看起來合理」取代實際驗證
- knowledgeBase.js 的策略映射邏輯（Claude 負責）
- confidence auto-adjust 演算法（Codex 負責）

---

## 知識庫待辦清單（Claude 2026-04-01 交接）

知識庫已完成 600/600，品質測試 25/25 全過。以下是 Qwen 接手的**低風險機械式任務**：

### P0 — 立即可做

#### 1. 給 strategy-cases 補 confidence 欄位

120 個策略案例目前沒有 confidence，需要批量補上。

**規則：**

- 成功案例（`outcome: "success"`）：預設 `0.75`
- 失敗案例（`outcome: "failure"`）：預設 `0.70`
- 2024-2026 近期案例（id >= sc-061）：信心度 +0.05（資料更新）
- 經典教科書案例（sc-001~sc-010）：信心度 +0.05（經過驗證）

**檔案：** `src/lib/knowledge-base/strategy-cases.json`

**驗證：** 改完跑 `npx vitest run tests/lib/knowledge-base.test.js`，確認 25/25 全過

#### 2. 清理重複 entry

壓測發現：

- 重複 title：`董監持股質押比率`（在 fa 和 ca 各出現一次）→ 檢查內容是否不同，不同則改 title 區分，相同則刪一個
- 重複 action（3 個）→ 改寫使其各有特色

**驗證方式：**

```bash
node -e "
const fs=require('fs'),dir='src/lib/knowledge-base';
const titles=[],actions=[];
fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='index.json'&&f!=='quality-validation.json').forEach(f=>{
  const d=JSON.parse(fs.readFileSync(dir+'/'+f,'utf-8'));
  (d.items||[]).forEach(i=>{titles.push(i.title);actions.push(i.action)});
});
const dt=titles.filter((t,i)=>titles.indexOf(t)!==i);
const da=actions.filter((a,i)=>actions.indexOf(a)!==i);
console.log('重複title:',dt.length,'重複action:',da.length);
if(dt.length)console.log(dt);if(da.length)console.log(da.slice(0,5));
"
```

#### 3. Usage tracking 實作

在 `src/lib/knowledgeBase.js` 的 `buildKnowledgeContext()` 加入 usage 記錄。

**規格：**（來自 `docs/superpowers/specs/2026-03-31-kb-evolution-design.md`）

```javascript
// 在 buildKnowledgeContext 的 return 前加：
function trackUsage(items) {
  try {
    const log = JSON.parse(localStorage.getItem('kb-usage-log') || '[]')
    log.push({
      timestamp: Date.now(),
      itemIds: items.map((i) => i.id),
    })
    if (log.length > 500) log.splice(0, log.length - 500)
    localStorage.setItem('kb-usage-log', JSON.stringify(log))
  } catch {
    /* silent */
  }
}
```

**注意：** 這是 side-effect，不應影響主流程。加 try-catch 保護。

### P1 — 本週做

#### 4. Feedback 按鈕 UI

在 daily analysis 結果區加 👍/👎 按鈕。

**位置：** 找到 `src/components/` 中顯示分析結果的面板（可能在 holdings 或 overview 元件裡）
**儲存：** `localStorage['kb-feedback-log']`，格式見 design doc
**不需要做：** confidence 自動調整邏輯（那是 Codex 的事）

#### 5. 提升 news-correlation 高品質條目的 confidence

壓測發現事件驅動策略注入的知識偏向 fundamental-analysis 而非 news-correlation，因為 nc 的 confidence 普遍只有 0.65-0.75。

**做法：** 檢視 nc 所有條目，把真正高品質的（有具體數字門檻、台股特有事件）提升到 0.80-0.85
**數量：** 約 10-15 條需要提升
**驗證：** 改完跑測試，然後用以下指令確認事件驅動策略能取到 nc 條目：

```bash
node -e "
// ... (same inline test from stress test)
// 確認事件驅動策略的 top 5 至少有 1 條 nc-*
"
```

---

### P2 — 自動事件行事曆接入（Claude 2026-04-01 交接）

Claude 已建好 API 和 hook，Qwen 需要接入前端：

#### 6. 在 `useAppRuntime.js` boot 流程呼叫 `fetchAutoEvents`

**已建好的檔案：**

- `api/event-calendar.js` — 自動事件行事曆 API（月營收/FOMC/央行/財報季/除權息/MOPS法說會）
- `src/hooks/useAutoEventCalendar.js` — 前端 hook（呼叫 API + 合併到 newsEvents）

**Qwen 要做的：**

1. 在 `useAppRuntimeWorkflows.js` 或 `useAppRuntimeCoreLifecycle.js` 中 import `useAutoEventCalendar`
2. 在 boot 完成後呼叫 `fetchAutoEvents(holdingCodes)`（持股代碼陣列）
3. 確保只在首次 boot 呼叫一次（用 ref 防重複）

**範例接線：**

```javascript
import { useAutoEventCalendar } from './useAutoEventCalendar.js'

// 在 workflow hook 內
const { fetchAutoEvents } = useAutoEventCalendar({ setNewsEvents })

// boot 完成後呼叫一次
useEffect(() => {
  if (bootComplete && holdings.length > 0) {
    const codes = holdings.map((h) => h.code)
    fetchAutoEvents(codes)
  }
}, [bootComplete]) // 只在 boot 完成時執行一次
```

**驗證：** 啟動後，行事曆 tab 應自動出現月營收公布日、FOMC 等事件

#### 7. 行事曆 UI 區分自動事件和手動事件

自動產生的事件 `source: 'auto-calendar'` 或 `source: 'mops'`，UI 上可以用不同顏色或標記區分。

**不需要做的：**

- 不需要改 `api/event-calendar.js`（Claude 已完成）
- 不需要改 `useAutoEventCalendar.js`（Claude 已完成）
- 不需要改 `normalizeEventRecord`（已相容）

### P3 — Gemini 輸出消費（定期）

#### 8. 讀取 Gemini 蒐集的結構化資料

Gemini 會把蒐集結果寫到 `docs/gemini-research/` 目錄。Qwen 負責讀取並匯入應用：

- `event-calendar-*.json` → 匯入事件系統（`setNewsEvents`）
- `target-price-*.json` → 更新 `src/seedData.js` 的 `INIT_TARGETS`（需人工確認）
- `news-*.json` → 可作為 daily analysis 的補充 context

**做法：** 寫一個 `scripts/import-gemini-research.js` 腳本，讀取目錄中最新的 JSON，匯入對應的系統。

### P4 — 測試覆蓋擴充

目前 65 個 hooks 中只有 ~15 個有測試。以下是 Qwen 可以補的低風險測試：

#### 9. 補 `useEvents` 測試

**檔案：** `src/hooks/useEvents.js`
**測試：** CRUD 操作（addEvent, updateEvent, deleteEvent, transitionEvent）、review 流程
**難度：** 低（純狀態 hook，不需 mock API）

#### 10. 補 `useHoldings` 測試

**檔案：** `src/hooks/useHoldings.js`
**測試：** 持股增刪改、排序、市值計算
**難度：** 低

#### 11. 補 `useWatchlistActions` 測試

**檔案：** `src/hooks/useWatchlistActions.js`
**測試：** watchlist upsert/delete
**難度：** 低

#### 12. 補 `dossierUtils` 測試

**檔案：** `src/lib/dossierUtils.js`
**測試：** `buildDailyHoldingDossierContext`（確認 stockMeta 有被正確傳入和使用）、`buildHoldingDossiers`
**難度：** 中（需要構造 dossier mock data）

### P5 — 還原 quality-validation.json

你上次把品質框架定義覆蓋成了評分報告。

**做法：**

1. 把現在的 `quality-validation.json` 內容移到 `quality-report-2026-04-01.json`（保留評分結果）
2. 從 git history 還原原本的品質框架定義：`git show 1eab1ed:src/lib/knowledge-base/quality-validation.json > src/lib/knowledge-base/quality-validation.json`
3. 確認還原後包含 `qualityCriteria`、`scoringSystem`、`validationProcess`、`redFlags`、`greenFlags` 等區塊

### P6 — RSS 來源擴充

在 `api/analyst-reports.js` 中加入更多台灣財經 RSS 來源。

**新增來源：**

- 鉅亨網：`https://news.cnyes.com/rss/cat/tw_stock`
- 經濟日報：`https://money.udn.com/rssfeed/news/1001/5710`

**做法：** 在 `handler` 函數中，除了現有的 Google News RSS，額外抓這 2 個 RSS，合併 items 後去重再 extractInsights。

---

## 修正待辦（先做再繼續新任務）

1. **還原 `quality-validation.json`**（P5）
2. **清理重複 title**（P0 任務 2，上次沒做）：`董監持股質押比率` 在 fa 和 ca 各出現一次

---

## 交接格式

- `done`
- `changed files`
- `risks`
- `next best step`

若只做到一半，請留下下一個最小 edit target。

## 參考文件

- 知識庫演化方案：`docs/superpowers/specs/2026-03-31-kb-evolution-design.md`
- 實驗帳本：`docs/superpowers/kb-experiment-results.tsv`
- AI 協作指南 §7：`docs/AI_COLLABORATION_GUIDE.md`
- 知識庫測試：`tests/lib/knowledge-base.test.js`
- 自動事件 API：`api/event-calendar.js`
- 自動事件 hook：`src/hooks/useAutoEventCalendar.js`
