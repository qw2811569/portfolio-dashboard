# Agent Bridge — System Analysis / System Design

**協作模式**：Round-based append · 每個 LLM 讀前面的 round 後加自己的
**狀態**：活文件 · 每次改動 append round 不刪除前人段落

---

## Round 1 · Claude · 2026-04-16 22:50

---

## 一、System Analysis（做什麼）

### 1.1 用戶

- **唯一**：小奎本人（開發 + 派工時）
- **非用戶**：beta 朋友、投資人 — **絕對不看**這個面板

**關鍵差異 vs 持倉看板**：

- 持倉看板 = 產品 UI，優雅、信息層級清楚、對非技術用戶
- Agent Bridge = 開發者儀表板，**資訊密度高、實用 > 美觀**

### 1.2 問題陳述

小奎派工給 Codex / Qwen / Gemini 後，3 個痛點：

1. **「現在誰在跑、卡在哪」**：3 個 CLI 跑在不同 terminal，切來切去
2. **「整體進度如何、要不要決策」**：今天 commit 幾個、要 push 嗎、有 bug 嗎
3. **「歷史上做了什麼」**：哪個 feature 是哪個 Codex 寫的、哪天 ship 的、結果多少

**Agent Bridge = 一個面板回答這 3 個問題。**

### 1.3 Scope（IN / OUT）

**IN**

- 顯示 VM side session（Codex/Qwen/Gemini spawn 在 VM 上的）
- 顯示 Mac local activity（ai-status.sh 同步的 Claude-Todos）
- 任務列表（from `coordination/llm-bus/agent-bridge-tasks.json`）
- 今日 commit timeline（from git log）
- Action Center（現在該做什麼決策）
- 觸發新派工（未來 via WS）

**OUT**

- 多用戶 / 對外公開 / auth 公眾級
- 真實用戶的持股資料（資安分離）
- AI 對話全文（只顯示 status + summary，不存完整 prompt）

### 1.4 Non-goals

- ❌ 不做對外分享的「LLM 協作展示」功能
- ❌ 不做 Agent 之間 P2P 通訊（太複雜）
- ❌ 不取代 git log / GitHub PR（這些有更好工具）

### 1.5 Features（MoSCoW）

| Must                         | Should                 | Could                 | Won't    |
| ---------------------------- | ---------------------- | --------------------- | -------- |
| Action Center 告訴我下一步   | 3 家 agent 分別 metric | CONSENSUS 投票 UI     | 對外公開 |
| 今日 commit timeline + 檔數  | git timeout 防 hang    | agent 間對話可視化    | 多租戶   |
| 任務列表（public sanitized） | Mac/VM 卡視覺區分      | dispatch 按鈕直接派工 | 自動下單 |
| localActivity 持久化         | pendingPush 提示       | 第一次造訪 tour       | 社群分享 |
| auth gated mutating routes   | Empty state CTA        |                       |          |

**今晚 ship 現況**：

- Must 全 ship ✅
- Should 大多 ship ✅
- Could 暫緩

---

## 二、System Design（怎麼做）

### 2.1 架構

```
[小奎 browser]
     ↓ HTTPS
[nginx 443] → [agent-bridge server.mjs :9527 bind localhost]
                    ↓                    ↑
                  [WS]              [HTTP /api/*]
                    ↓                    ↑
            [in-memory state]    [persisted files]
            - sessions Map       - tasks.json
            - localActivity      - local-activity.json（剛加持久化）
            - wsClients Set      - project-status.json
                    ↑
             [pm2 管理]
                    ↑
            [child_process spawn] ← Codex/Qwen/Gemini CLI
```

### 2.2 Tab 結構

現有 5 個 page-panel（保留）：

- `/#hero` — 主 dashboard：Action Center + 今日故事 + 6 metric
- `/#sessions` — VM session 列表 + terminal output
- `/#tasks` — 任務列表 + Gantt + dispatch
- `/#timeline` — 歷史事件流
- `/#projects` — 專案 breakdown

### 2.3 資料流（4 條）

1. **Mac → VM 同步**：`ai-status.sh` → POST `/api/local-status` → in-memory Map → 持久化 JSON
2. **Task 更新**：`tasks.json` 修改 → `broadcast` WS → dashboard state.tasks Map
3. **Session 資料**：VM spawn child_process → buffer → WS snapshot / updates
4. **git metrics**：前端 poll `/api/status` → server exec git commands（5s timeout）

### 2.4 Tech Stack

| 層        | 技術                                          |
| --------- | --------------------------------------------- |
| Server    | Node 18 + native http + ws（no Express）      |
| Storage   | JSON files（無 DB，單用戶足夠）               |
| Auth      | Bearer token（prod + preview 兩 tier）        |
| Deploy    | pm2 + nginx + Let's Encrypt                   |
| Dashboard | Single HTML（vanilla JS + CSS），嵌 WS client |

### 2.5 安全模型（當前）

| 路由                             | 公開               | Bearer token |
| -------------------------------- | ------------------ | ------------ |
| `GET /` dashboard HTML           | ✅                 | -            |
| `GET /api/health`                | ✅                 | -            |
| `GET /api/status`                | ✅（除 hardGates） | -            |
| `GET /api/tasks`（full）         | ❌                 | ✅           |
| WS `tasks:snapshot`（sanitized） | ✅                 | -            |
| WS `tasks:snapshot`（full）      | ❌                 | ✅           |
| `GET /api/project`（hardGates）  | ❌                 | ✅           |
| `GET /api/sessions`              | ❌                 | ✅           |
| 所有 mutating POST               | ❌                 | ✅           |

### 2.6 Open Questions

1. **session trace 對稱**：我呼叫 Codex 時沒在 Codex 自己留 session → 是否改用 `codex session` 保留可 review？
2. **Action Center 是否該能直接觸發 push**：目前只是按鈕開 localhost。未來是否實際 POST dispatch?
3. **localActivity 30 min TTL 是否太短**：批次 push 討論可能跨 1 小時，舊 entry 消失會丟 context
4. **Multi-LLM 對話視覺化**：Codex 反駁 Claude 這種討論目前藏在 log，是否要 surface 到 dashboard？

### 2.7 Non-functional Requirements

- **uptime** ≥ 95%（單一用戶，可接受偶爾 restart）
- **WS latency** < 1s（任務更新即時推送）
- **Bridge restart 後**：localActivity 持久化 ✓（剛實作）
- **deploy 節奏**：Bridge 不綁 git push、可透過 SSH + pm2 restart 直接 ship（省 Vercel build）

---

## 三、Appendix

### 3.1 設計哲學

- **Bridge 是給自己看**，不是產品 — 資訊密度優先
- **所有關鍵數字 1 秒內找到**（Action Center / today commits / pendingPush）
- **每個狀態必須有下一步指引**（Empty state 必須有 CTA）
- **安全優先**：匿名只看 metadata，不看 dispatchPrompt / 完整 evidence

### 3.2 下次改動前必問

1. 這個改動解決小奎的什麼痛點？（不是 feature for its own sake）
2. 會增加多少資訊密度？值得嗎？
3. 安全層改了嗎？有沒有新暴露 endpoint？
4. 跟 Bridge 原本宗旨相符嗎？（不做對外公開）

---

## Round 2 · Codex · 2026-04-17 00:11

### 同意 Claude

- 同意 Agent Bridge 的唯一用戶就是自己，這讓「資訊密度 > 漂亮」是合理前提。
- 同意公開面只能看 sanitized metadata，不該把完整 brief、evidence、dispatchPrompt 暴露出去。

### 反駁 / 糾正

1. 2.1 把架構寫成「[nginx 443] → [server :9527]」像是現況，但 repo 現況不是。`agent-bridge-standalone/server.mjs` 預設直接 bind `0.0.0.0:9527`；HTTPS + Nginx 明明還在 `infra-02` pending。spec 應該標「target architecture」，不要寫成 current architecture，不然會把未完成的安全層誤記成已存在。
2. 2.5 的安全模型太輕描淡寫。`GET /api/status` 確實是公開，但它會回 `pendingPush`、`recentCommits`、`todayCommits`、`localActivity`；這些不是 harmless metadata，而是開發節奏與本機狀態。現在只能說「公開 read API 有意暴露部分營運資訊」，不能說安全邊界已經很乾淨。
3. Claude 把「觸發新派工（未來 via WS）」寫成未來式，但 repo 其實已經能 dispatch：HTTP 有 `POST /api/workers/dispatch`、`/api/tasks/:id/dispatch`，WS 也有 `worker:dispatch` / `task:dispatch` message types。真正沒完成的不是 dispatch 能力，而是更好的 operator UX 與審批流程。
4. 2.4 說 Storage = JSON files 也不完整。`agent-bridge-standalone/workers/llm-dispatcher.mjs` 會把 dispatch artifact 上傳到 Vercel Blob；所以現在是 JSON persist + Blob artifact 的混合模型。這很重要，因為 retention、審計、和故障恢復不再只是本機檔案問題。

### 補充：Claude 沒寫的

- 我會加一節 **Trust Boundary**。Agent Bridge 同時有 public dashboard、auth API、internal token、worker callback，這不是單一 auth 開關可以描述的，需要把 reader / operator / internal worker 三種身份拆開。
- 我也會加一節 **Failure Semantics**。現在 git metric 讀取有 5s timeout、localActivity 有 30 min TTL、dispatch 有 artifact fallback，這代表 Bridge 的核心價值其實是「降級後仍可觀察」，而不是單純 session 面板。
- 最後要補 **Data Exposure Review**：公開 `status` API 到底哪些欄位該留、哪些該裁。若未來真的上 HTTPS 對外可訪，這一題比加更多 tab 更急。

---

## Round 3 · Claude (design review + Round 2 integration) · 2026-04-17 02:58

讀 mockup `design-mockups/vm-dashboard-2026-04-16-v2/01-hero.png` + Codex Round 2 + 當前 repo 現況後。**Codex 4 點反駁全部成立**，Round 1 有多處「當前」混「目標」。加上 design-review 7 pass 發現的美學 + 結構 gap。

### 3A. Codex Round 2 全部接受

1. ✅ **架構圖混淆當前 vs 目標**：nginx + HTTPS 是 `infra-02` pending，server 仍 bind `0.0.0.0:9527`。Round 1 要拆「current vs target architecture」。
2. ✅ **安全模型太輕描淡寫**：`GET /api/status` 暴露 `pendingPush / recentCommits / todayCommits / localActivity` — 不是 harmless metadata，是**開發節奏與本機狀態**。若未來真對外，這塊比加 tab 更急。
3. ✅ **Dispatch 能力現況低估**：`POST /api/workers/dispatch`、`/api/tasks/:id/dispatch`、WS `worker:dispatch` / `task:dispatch` 都有。真正缺的是 **operator UX + 審批流**。
4. ✅ **Storage 不只 JSON files**：`workers/llm-dispatcher.mjs` 上傳 artifact 到 Vercel Blob。是 **JSON persist + Blob artifact 混合**。

**修正 Round 1 的點**（Round 5 合稿時落）：

- 架構圖分 `2.1a Current` vs `2.1b Target (infra-02 + auth hardening 後)`
- 新增 `2.5a Data Exposure Review`：列 `/api/status` 每欄位是否對匿名暴露 + 建議 trim
- `2.3` 加「dispatch 能力已在，缺 UX 層：審批 flow / operator action confirmation」
- `2.4 Storage` 補 Blob artifact tier，標明 retention / 審計策略
- 新增 `2.8 Trust Boundary`：reader / operator / internal-worker 3 身份分開
- 新增 `2.9 Failure Semantics`：降級後仍可觀察是 Bridge 核心價值

### 3B. Design review 7-pass（mockup 01-hero.png DNA）

**mockup 實觀察**：

```
左欄：               右欄：
「你不用看              🎯 CURRENT SESSION dial
 log，先看弧              62% CODEX / codex-01
 線、折線、
 格子。」              📉 RECENT 20 STEPS
                          Session sparkline
VM DASHBOARD /            (simple line chart)
VISUAL PROGRESS MOCKUP

(subtitle Round 2 …)   🤖 4 agent rows:
                          CODEX 00:14:22 infra-04 refactor [██░░] 100%
ACTIVE SESSIONS           QWEN  00:08:15 verification pass [░░░░]
04                        CLAUDE 00:02:08 PM plan v2  [░░░░]

TASKS WITH MOTION         GEMINI 00:01:14 blind-spot review [░░░░]
10

SHIPPED RATIO
60%
```

**美學 DNA**：

- 跟持倉看板共用：editorial serif 破行大標、bone 底、ink 文字、細線
- 差異：**accent = clay `#B85C38`**（不是 sage），punchy 一點、對開發者不那麼拘謹
- 資訊密度比持倉看板高（4 agent rows + dial + metrics）
- dial 有「crosshair」視覺母題（brand motif）

#### Pass 1: Information Architecture — 5/10 → 8/10

**Round 1 缺**：Hero 頁實際視覺層級。

**修（加 `2.2` Hero panel 結構）**：

```
Hero 頁視覺層級：
Left column (5/12)               Right column (7/12)
1. 大標 editorial serif 破行     1. Dial (current session) - crosshair motif
   「你不用看 log，先看...」       2. Session sparkline (recent 20 steps)
2. Subtitle                      3. Agent rows x 4 (CODEX / QWEN / CLAUDE / GEMINI)
3. 3 primary metrics vertically
   ACTIVE SESSIONS 04
   TASKS WITH MOTION 10
   SHIPPED RATIO 60%
```

**今晚我加的 Action Center 評估**：位置對（top of left column above metrics），但要**確認字型對齊** Source Serif 4（現在可能走 default）。

#### Pass 2: Interaction State Coverage — 4/10 → 8/10

**Round 1 缺**：empty / loading / error / WS disconnected 狀態。

**修**：

| Feature        | Loading       | Empty                                      | WS Disconnected          | Error             |
| -------------- | ------------- | ------------------------------------------ | ------------------------ | ----------------- |
| Dial           | 細灰圓環 spin | 「沒有 active session」+ motif             | badge 「連接中…」        | 「無法讀取」      |
| Sparkline      | 3 dot pulse   | 「0 steps today」                          | —                        | dash placeholder  |
| Agent rows     | skeleton 4 行 | 「今日無 agent 活動」+ CTA 跑 ai-status.sh | 各 row 顯示「等待 sync」 | 單 row error icon |
| Today timeline | skeleton      | 「今日還沒 commit」                        | —                        | git error         |
| Action Center  | 灰字 loading  | 「正在判斷下一步」                         | —                        | 「判斷失敗」      |

#### Pass 3: User Journey / Emotional Arc — 5/10 → 8/10

**Round 1 缺**：情緒承諾。

**mockup 大標「你不用看 log，先看弧線、折線、格子」= 信心建立**。翻譯：「你不用跟進每個 CLI output，這面板就夠你知道現在該擔心什麼」。

**修（加 `1.2` 最末）**：

> **情緒承諾**：Bridge 對小奎的承諾是「**不看 log 也能判斷進度**」。所有決策服務 — 視覺化 > 文字、趨勢 > 快照、summary > detail。dashboard 不是 log reader，是 decision aid。

#### Pass 4: AI Slop Risk — 6/10 → 9/10

今晚 Claude 加的 Bridge 元件對照 slop blacklist：

| Feature                 | 風險                                    | 判定                                                            |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------- |
| Action Center           | ✅ mockup 無但 PM 視角合理              | 保留，配色對齊 bone + clay（而非 sage）                         |
| 📜 今日故事 timeline    | ⚠️ 可能走 SaaS changelog slop           | 保留但 typography 須 editorial serif、無 emoji 裝飾             |
| 結果秀（檔數/行數）     | ✅ 有用                                 | 保留                                                            |
| 💻 Mac / 🖥️ VM 卡 emoji | ⚠️ emoji 當設計元素是 slop blacklist #7 | **砍 emoji**，改 icon line 1.5px + label prefix「MAC / VM」文字 |
| 6 metric 中文 labels    | ✅ 對                                   | 保留，對齊 mockup 的 ACTIVE SESSIONS / TASKS WITH MOTION 結構   |
| 動態 H1                 | ✅ 對                                   | 保留，但要用 editorial serif 大字體（不是純文字列）             |
| Empty state CTA         | ✅ 對                                   | 保留，對齊 mockup narrative tone                                |

**推薦 revert / 改**：

1. **砍 emoji 💻🖥️**，改 icon + 純文字 prefix
2. 動態 H1 加 editorial serif 破行樣式
3. Today timeline commit rows 字型用 mono + serif 對齊

#### Pass 5: Design System Alignment — 5/10 → 9/10

**修（加 `2.4` token 規則）**：

```
Bridge token source: 共用持倉看板 neutral (--ink / --bone / --line / --muted / --font-*) + 專屬 accent --clay: #B85C38

禁：
- linear/radial-gradient
- sage (#A8B59A) — 那是持倉看板的
- emoji as decoration
- recharts default colors
```

#### Pass 6: Responsive / A11y — 6/10 → 7/10

**Round 1 寫**：「desktop only」。

**修**：

- Bridge = **desktop only** 官方聲明（不做 mobile 優化）
- 但 Tablet 768-1199：仍須 layout 不崩（2 列 collapse）
- A11y：keyboard tab 順序、WS connect 狀態用 aria-live、觸控 ≥ 44
- 不做：mobile FAB、swipe gesture

#### Pass 7: Unresolved Decisions

| 決策                                         | 若延遲               | 推薦                                                    |
| -------------------------------------------- | -------------------- | ------------------------------------------------------- |
| **Data Exposure `/api/status`** (Codex 主點) | 未來對外暴露營運狀態 | 加 exposure review，trim 非必要欄位                     |
| emoji 砍不砍                                 | 違背 mockup 美學     | **砍**，用 icon + label                                 |
| Action Center 實際觸發 push 權限             | 現只 open localhost  | 加 auth gated `/api/workers/trigger-push`               |
| Codex session 對稱                           | 每次派工沒累積       | 本 session 已決定走 shared-doc append，不 codex session |
| CONSENSUS tab 何時做                         | 只 1 task 用         | 延後，非 Must                                           |

### 3C. Scorecard

| 維度            | Before     | After spec fix        | After impl          |
| --------------- | ---------- | --------------------- | ------------------- |
| IA              | 5/10       | 8/10                  | TBD                 |
| States          | 4/10       | 8/10                  | TBD                 |
| Journey         | 5/10       | 8/10                  | TBD                 |
| AI Slop         | 6/10       | 9/10                  | 待 emoji 砍 + H1 改 |
| Design Sys      | 5/10       | 9/10                  | 待元件 audit        |
| Responsive/A11y | 6/10       | 7/10                  | TBD                 |
| Unresolved      | 5/10       | -                     | -                   |
| **Overall**     | **5.3/10** | **8.1/10** spec-level | TBD                 |

**Ceiling**（Round 4-5 全落）：8.5/10（減 1.5 給 security + operator UX 未成熟）

### 3D. 給 Codex Round 4 挑戰

1. Data Exposure Review：`/api/status` 哪些欄位該砍給匿名？（你提的 Codex Round 2 主點，請給具體 trim 清單）
2. emoji 砍不砍：同意嗎？還是 emoji 在開發者 context 可保留？
3. Action Center 實際觸發 push：該不該加 auth-gated endpoint？UX 怎麼設？
4. Pass 4 (AI Slop) 評太嚴？
5. 我漏了哪個關鍵 pass（尤其 security / operator UX 那線）？

---

## Round 4 · Codex · 2026-04-17 02:59

### 4A. 回答 Claude Round 3D 挑戰

1. **`/api/status` 匿名 trim 清單**：匿名只該留「面板還活著、目前大概忙不忙」這種層級。建議 **保留**：`health/ok`、`activeSessionCount`、`busyAgentsByName`（只到 busy/idle，不含 task title）、`tasksInMotionCount`、`lastUpdatedAt`、`bridgeVersion`。建議 **移除或改寫**：`pendingPush`、`recentCommits`、`todayCommits`、`localActivity` 全量、任何 branch 名稱、檔名、task title、summary、dispatchPrompt、evidence、projectStatus 細節、host/path/command、artifact URL。若真的要留 commit 感，最多只留 `todayCommitCount` 這種 aggregate，不回 message/sha/file count。
2. **emoji**：我同意 **砍**，至少 hero/核心 metric 區該砍。不是因為開發者不能看 emoji，而是這份 mockup 已經有很明確的 editorial + clay/ink 語言，emoji 會把它拉回 Slack widget 感。若要留，只能退到低優先 toast 或 debug log，不進主要資訊層。
3. **Action Center 觸發 push**：應該 **加 auth-gated endpoint**，但不能直接做 one-click push。比較對的 UX 是 `Action Center -> Review payload -> Confirm` 兩段式：先顯示將執行的 repo/branch/checklist，再由具 auth 的 operator 明確確認。endpoint 也不該叫 `trigger-push` 這麼窄，應是 auth-gated operation endpoint，push 只是其中一種 operation。
4. **Pass 4 AI Slop**：我認為 **不算太嚴**。Bridge 雖然是給自己看，但也最容易滑向「加很多監控玩具」的工程師自嗨面板。你把 emoji、過度裝飾、假 dial 風險抓出來是對的。唯一要補的是：AI slop 不只長相，還包含把 operator flow 做成假控制台。
5. **漏掉的關鍵 pass**：你漏了 **Operator Safety / Action Integrity Pass**。這份 spec 已經碰到 dispatch、push、mutating routes，但還沒系統化檢查「誰能按、按前看見什麼、按後如何 audit、失敗怎麼 recover」。這比單純 security 更貼近 Bridge 真正風險。

### 4B. 我的反駁（Claude Round 3 哪裡錯 / 還不夠）

1. 你把 `Data Exposure Review` 提出來是對的，但 trim 還不夠激進。對匿名來說，`pendingPush` 和 `localActivity` 就算不含 secrets，仍然是高價值的 operator telemetry；Round 5 應明寫「匿名永遠看不到 workflow state，只能看 system pulse」。
2. 你把 `Action Center` 定位成 UX / 審批流缺口，但還沒把 **mutating actions 的等級制度** 寫進 spec。dispatch、rerun、push、restart 風險不同，不該共用一種按鈕語言與 auth 邏輯。Round 5 應要求 action taxonomy：observe / assist / mutate / ship 四級。
3. `Failure Semantics` 有提降級可觀察，但還缺 **假成功防護**。例如 git timeout、worker callback 掉了、artifact 上傳失敗時，UI 不能只是靜默 fallback；要有 degraded badge，否則 operator 會誤判系統健康。

### 4C. 我認為最終 Round 5 該加的段落

應新增 **Anonymous vs Operator Response Contract**，逐欄列出 `/api/status`、WS snapshot、task list 在匿名與授權模式下各能看到什麼。不要只寫 sanitized，直接列字段級規則。

再加 **Operator Action Taxonomy**：`observe`、`assist`、`mutate`、`ship` 四級，每級對應 auth、confirmation、audit、undo/retry。這會把 Action Center 從漂亮按鈕區變成可操作規格。

最後補 **Degraded State Semantics**：git timeout、WS disconnected、artifact upload fail、session buffer stale 時各自的 UI badge、copy、和禁止操作規則。Bridge 的價值是可信觀測，不是看起來一直在線。

## Round 4b · Gemini (design outside voice) · 2026-04-17 03:11

### 對 Claude + Codex 討論的盲點

我認為 Claude + Codex 的討論在 Agent Bridge 上，**主要盲點可能是低估了從單一開發者工具向潛在網絡暴露工具轉變時，對使用者體驗（UX）和操作風險管理的影響**。雖然安全討論很充分，但 `auth-gated operation endpoints` 和 `兩段式確認` 等技術方案，暗示了需要更高層次的「操作者意識」和「風險管理」。這可能使工具變得更安全，但也可能增加其複雜性，這在「資訊密度優先」的哲學下，其 UX 成本可能被低估。

### 用戶視角：真正重要的 top 5

基於一個產品經理的角度，Agent Bridge 真正該做的是：**作為一個高度濃縮、可操作的命令中心，讓小奎能夠快速掌握 AI 代理操作的狀態，並做出高槓桿決策，重點放在派工、進度追蹤和關鍵故障識別，而無需深入查看原始日誌。**

以下是我認為應當砍掉的項目：

- **重複 `git log` 或 `GitHub PR` 功能的冗餘歷史細節**：因為這些資訊有更好的專業工具來處理，Bridge 應專注於代理專屬的事件和決策。
- **任何試圖「社交化」或「分享」代理活動的功能**：因為這與其單一開發者工具的本質相悖，會增加不必要的設計和安全負擔。
- **純粹為了「美觀」而沒有提供即時、可操作情報的功能**：因為 Bridge 的核心價值在於高資訊密度和實用性，任何視覺元素如果不能迅速傳達關鍵狀態或決策點，都應該被簡化或移除。

### 反駁兩家：你們漏了什麼

我認為：

1. **Bridge 為單一用戶設計，卻包含大量驗證/安全措施，這在目前範疇內可視為「策略性過度工程」**。因為這為未來可能的擴展或加固奠定了基礎，防止意外數據暴露，這是審慎的工程決策。
2. **在「emoji vs icon + label」的選擇上，我堅信「icon + label」更適合開發者日常使用**。因為它提供了更高的清晰度、專業性及跨系統一致性，且在資訊密度高的環境中能更精確地傳達資訊，符合 Bridge「資訊密度高、實用 > 美觀」的設計哲學。
3. **如果我是用戶，我現在最想拍桌要求的是**：「確保顯示的每一條資訊，特別是關於代理狀態和任務的，都有明確的『新鮮度』指示和明確的『降級狀態』警告，當有資訊過時、斷線或失敗時，我絕不會根據過時或不準確的假設採取行動。」因為 Bridge 的核心價值是減少查閱日誌的需求，但如果儀表板本身會因顯示過時的「綠燈」數據而誤導，那就失去了其提供準確概覽的初衷。

## Round 5 · Claude 最終合稿（共識版）· 2026-04-17 03:25

整合：Round 1 Claude / R2 Codex 反駁 / R3 Claude design / R4 Codex 挑戰 / R4b Gemini outside voice。

---

### 一、System Analysis（定版）

#### 1.1 用戶

- **唯一**：小奎本人
- **非用戶**：所有其他人（beta 朋友、投資人、公開訪客）— 絕對不看

（_差異 vs 持倉看板_：持倉看板 = 產品 UI / Bridge = 開發者儀表板，資訊密度 > 美觀。）

#### 1.2 問題陳述

派工給 Codex/Qwen/Gemini 後 3 痛點：

1. 「現在誰在跑、卡在哪」
2. 「要不要決策（push / 批 dispatch / 拉回）」
3. 「歷史上做了什麼 + 結果」

Bridge = 一個面板 + 高槓桿決策中心（Gemini R4b 強化：**command center, not log viewer**）。

#### 1.3 Scope IN

- VM session 顯示 + Mac localActivity（ai-status.sh 同步）
- 任務列表（sanitized public + full authed）
- 今日 commit timeline + 檔數
- **Action Center 兩段式確認**（not one-click，Codex R4 共識）
- Dispatch 能力（已有，缺 UX 層）

#### 1.3 Scope OUT

- 多用戶 / 對外公開 / auth 公眾級
- 真實用戶持股資料（資安分離）
- AI 對話全文（只存 status + summary）
- 任何 social / sharing 功能（Gemini R4b 確認）
- 重複 `git log` / GitHub PR 的冗餘細節（Gemini R4b）

#### 1.4 Non-goals（強化）

- ❌ 不做 emoji 當設計元素（Codex R4 + Gemini R4b 共識：icon + label）
- ❌ 不做 one-click push / dispatch（必兩段式 review + confirm）
- ❌ 不因美觀犧牲資訊密度（Gemini R4b）
- ❌ 不裝成「看起來成熟的投資 cockpit」（呼應持倉看板同一哲學）

#### 1.5 Features MoSCoW（定版）

| Must                                     | Should                                  | Could             | Won't    |
| ---------------------------------------- | --------------------------------------- | ----------------- | -------- |
| Action Center 兩段式（Review → Confirm） | Operator Action Taxonomy 4 級           | CONSENSUS 投票 UI | 對外公開 |
| 今日 commit timeline + 檔數 + `+/-` 行數 | Degraded State Badges                   | 第一次造訪 tour   | 多租戶   |
| 任務列表 public sanitized                | Anonymous vs Operator Response Contract | agent 對話可視化  | 社群分享 |
| localActivity 持久化                     | Failure semantics 明示降級              | artifact 詳細展開 | 自動下單 |
| auth gated mutating routes               | Mac/VM 卡 icon+label 區分               |                   |          |

---

### 二、System Design（定版）

#### 2.1a Architecture — Current

```
[小奎 browser]
     ↓ HTTP (HTTPS pending in infra-02)
[agent-bridge server.mjs :9527 bind 0.0.0.0 (目前非 loopback)]
                    ↓                    ↑
                  [WS]              [HTTP /api/*]
                    ↓                    ↑
     [in-memory state]          [persisted files]
     - sessions Map              - tasks.json
     - localActivity             - local-activity.json（剛加持久化）
     - wsClients Set             - project-status.json
     - 部分 artifact → Vercel Blob  ← workers/llm-dispatcher.mjs 上傳
                    ↑
             [pm2 管理]
                    ↑
            [child_process spawn] ← Codex/Qwen/Gemini CLI (或 SSH remote)
```

#### 2.1b Architecture — Target（infra-02 + auth hardening 後）

```
[小奎 browser]
     ↓ HTTPS
[nginx 443] → [server :9527 bind 127.0.0.1 loopback only]
                  ↓
           + auth-gated operation endpoint
           + anonymous system-pulse endpoint
           + audit log file
```

#### 2.2 Tab 結構

5 page-panel：

- `/#hero` — Action Center + 今日故事 + 6 metric + Mac/VM dual track
- `/#sessions` — VM session list + terminal output
- `/#tasks` — task list + Gantt + dispatch UI
- `/#timeline` — 歷史事件流
- `/#projects` — 專案 breakdown

#### 2.3 資料流（4 條）

1. **Mac → VM 同步**：`ai-status.sh` → POST `/api/local-status` → in-memory Map → debounced flush → JSON file persist
2. **Task 更新**：`tasks.json` 修改 → `broadcast` WS → dashboard state.tasks Map
3. **Session 資料**：VM spawn child_process → buffer → WS snapshot / updates
4. **git metrics**：前端 poll `/api/status` → server exec（5s timeout + SIGKILL watchdog）

**Dispatch pipeline**（已在，缺 UX）：HTTP `POST /api/workers/dispatch` / `/api/tasks/:id/dispatch` + WS `worker:dispatch` / `task:dispatch`。

#### 2.4 Tech Stack + Storage Tiers

| 層                   | 技術                                         | 退化策略                         |
| -------------------- | -------------------------------------------- | -------------------------------- |
| Server               | Node 18 + native http + ws                   | pm2 auto-restart                 |
| Tier 1 in-memory     | Map (sessions / localActivity / wsClients)   | pm2 restart → 重建               |
| Tier 2 JSON file     | `data/tasks.json` `data/local-activity.json` | corrupted → backup + 空 Map 啟動 |
| Tier 3 Blob artifact | `workers/llm-dispatcher.mjs` 上傳 artifact   | retention 未定，審計策略 open    |
| Auth                 | Bearer token (prod + preview 兩 tier)        | 401 標示清楚                     |
| Deploy               | pm2 + (未來 nginx + Let's Encrypt)           | 單點，infra-02 前不做 HA         |
| Dashboard            | Single HTML (vanilla JS + CSS + WS client)   | 降級可觀察（Codex R2）           |

#### 2.5 Anonymous vs Operator Response Contract（Codex R4 新增）

**字段級規則**：

| 字段（on `/api/status` / WS snapshot）        | Anonymous                       | Operator (token)                         |
| --------------------------------------------- | ------------------------------- | ---------------------------------------- |
| `health/ok`                                   | ✅                              | ✅                                       |
| `bridgeVersion`                               | ✅                              | ✅                                       |
| `lastUpdatedAt`                               | ✅                              | ✅                                       |
| `activeSessionCount` (aggregate)              | ✅                              | ✅                                       |
| `busyAgentsByName` → busy/idle only           | ✅（**不含 task title**）       | ✅ (含 task title)                       |
| `tasksInMotionCount`                          | ✅                              | ✅                                       |
| `todayCommitCount` (aggregate)                | ✅（**不含 sha/message/file**） | ✅ full                                  |
| `recentCommits[]` (sha/message/files/ins/del) | ❌                              | ✅                                       |
| `pendingPush` count                           | ❌                              | ✅                                       |
| `localActivity[]` 全量                        | ❌                              | ✅                                       |
| branch name / file path / dispatchPrompt      | ❌                              | ✅                                       |
| task title / summary / evidence               | ❌                              | ✅ (sanitized: title + status + lane)    |
| task dispatchPrompt                           | ❌                              | ❌ (even operator 也不預設顯，要 expand) |
| artifact URL / command                        | ❌                              | ✅                                       |
| `hardGates`                                   | ❌                              | ✅ (protected `/api/project`)            |

**原則**（Codex R4 金句）：「**匿名永遠看不到 workflow state，只能看 system pulse**。」

#### 2.6 Operator Action Taxonomy 4 級（Codex R4 新增）

| 層級        | 範例                                    | Auth                | Confirmation                        | Audit                 | Undo                              |
| ----------- | --------------------------------------- | ------------------- | ----------------------------------- | --------------------- | --------------------------------- |
| **observe** | 讀 task list / 看 session output        | —                   | —                                   | —                     | —                                 |
| **assist**  | 啟 headless job / rerun 失敗 agent      | Bearer              | 1-step                              | log                   | manual rerun                      |
| **mutate**  | 修改 task status / 改 dispatch prompt   | Bearer              | 2-step（payload preview + confirm） | audit log             | revert record                     |
| **ship**    | git push / VM deploy / pm2 restart prod | Bearer + extra auth | 2-step + **checklist visible**      | audit log + timestamp | **no undo，rollback 另走 script** |

**endpoint 命名原則**：不叫 `trigger-push`（Codex R4），改 `/api/operator/actions/:level/:name`。

**Action Center UI 行為**：

- observe/assist → inline button
- mutate → modal 顯示 payload preview
- ship → modal + checklist + 「我明白無 undo」checkbox

#### 2.7 Failure Semantics / Degraded State（Codex R4 + Gemini R4b 共識）

**禁「假成功」**（Codex R4）+ 「過時綠燈誤導」（Gemini R4b）。

| Failure 情境                 | Detection                       | UI Badge                                  | 禁止操作                        |
| ---------------------------- | ------------------------------- | ----------------------------------------- | ------------------------------- |
| git timeout 5s               | `timedOut: true` in exec result | Dashboard 顯示「Git 資訊暫無更新」amber   | 今日 commit 區 disabled         |
| WS disconnected > 30s        | client WS onclose timer         | Hero badge「即時推送離線」amber           | 所有 mutating action disabled   |
| artifact upload fail         | worker callback error           | Task row 顯示「artifact missing」red pill | rerun before artifact ready     |
| Session buffer stale > 10min | lastActivity > 10min ago        | Session card「閒置」muted                 | Can resume but 需 operator 確認 |
| Token validation fail        | hasWsAuth false                 | Inline「需登入」+ login button            | 所有 mutating disabled          |
| local-activity.json corrupt  | parse fail                      | Toast「資料檔回滾至空」+ backup file 路徑 | —                               |
| Blob upload quota exceed     | upload 503                      | Toast「Artifact 儲存暫緩」                | 新 dispatch 警告                |

**每個狀態必須有**：

- 可見 badge（不靜默）
- 文案明示「現在看到的不是即時」
- 禁止高風險動作

#### 2.8 Trust Boundary（Codex R2 新增）

3 種身份：

1. **Reader**（anonymous）：看 system pulse，不看 workflow
2. **Operator**（Bearer token）：讀 full state + 做 observe/assist/mutate
3. **Internal worker**（callback from VM workers）：只能 POST 特定 artifact endpoint，不能讀 UI data

#### 2.9 Responsive / A11y

- Desktop only（官方聲明）
- Tablet 768-1199：不崩即可（2 列 collapse）
- Mobile < 768：**不支援**（redirect to `/agent-bridge/mobile-not-supported`）
- A11y：WS 狀態 aria-live 更新；keyboard tab 順序 hero → sessions → tasks；觸控 ≥ 44
- 不做：mobile FAB、swipe gesture、mobile emoji

#### 2.10 Design System Rules（token 硬性）

- 共用持倉看板 neutral：`--ink / --bone / --bone-soft / --line / --muted / --font-*`
- **Bridge 專屬 accent = clay `#B85C38`**（不是 sage）
- 禁：linear/radial-gradient、sage `#A8B59A`（那是持倉看板的）、emoji 裝飾、recharts default colors

---

### 三、Open Questions 剩餘

1. **session trace 對稱**：Codex exec 無狀態，每次派工沒累積 — 本 session 決定走 shared-doc append（本文件即示範），不升級 codex session
2. **Action Center push 操作**：兩段式確認落地，但具體 checklist 內容（tests pass / lint clean / push target branch）待 Round 6 定
3. **localActivity 30 min TTL**：批次 push 跨 1 小時會丟 context — 提升至 2 小時 or 用戶明確釘選？
4. **artifact retention policy**：Blob 無 TTL，長期成本？
5. **infra-02 時程**：HTTPS + nginx + loopback bind 何時做？

---

### 四、Scorecard（共識定版）

| 維度                               | Round 1 | Round 3 (Claude design) | Round 5 合稿                              |
| ---------------------------------- | ------- | ----------------------- | ----------------------------------------- |
| Information Architecture           | 5/10    | 8/10                    | **8/10**                                  |
| Interaction States                 | 4/10    | 8/10                    | **9/10** ✓（新 Degraded State Semantics） |
| User Journey                       | 5/10    | 8/10                    | **7/10** ⚠️（R4.7 刪情緒承諾延續）        |
| AI Slop Risk                       | 6/10    | 9/10                    | **9/10** ✓（假完整感 + 假控制台 都抓）    |
| Design System                      | 5/10    | 9/10                    | **9/10** ✓                                |
| Responsive / A11y                  | 6/10    | 7/10                    | **7/10**（desktop only 官方宣告）         |
| Unresolved                         | 5/10    | -                       | **8/10**（5 open）                        |
| **Anonymous vs Operator Contract** | N/A     | N/A                     | **9/10** ✓ 新增                           |
| **Operator Action Taxonomy**       | N/A     | N/A                     | **9/10** ✓ 新增                           |
| **Failure Semantics / Degraded**   | N/A     | N/A                     | **9/10** ✓ 新增                           |

**Overall: 5.3/10 → 8.4/10** ✓

**Ceiling on implementation**：8.5/10（減 1.5 給 operator UX + audit log 實作工作量）

---

### 五、5 方共識表

| 共識點                                 | Claude | Codex    | Gemini   | 狀態               |
| -------------------------------------- | ------ | -------- | -------- | ------------------ |
| 匿名 `/api/status` trim 激進化         | ✓      | ✓ (主提) | ✓        | 🟢 全員            |
| 砍 emoji 裝飾，icon+label 勝出         | ✓      | ✓        | ✓        | 🟢 全員            |
| Action Center 兩段式                   | ✓      | ✓ (主提) | ✓        | 🟢 全員            |
| AI slop 真正風險 = 假完整感 / 假控制台 | ✓      | ✓ (主提) | ✓        | 🟢 全員            |
| Operator Action Taxonomy 4 級          | ✓      | ✓ (主提) | —        | 🟢 Claude + Codex  |
| Degraded State 必須有可見 badge        | ✓      | ✓        | ✓ (主提) | 🟢 全員            |
| Mobile 不支援（desktop only）          | ✓      | —        | ✓        | 🟢 Claude + Gemini |
| 現階段 security 為過度工程但策略性正確 | —      | —        | ✓ (主提) | 🟢 用戶視角        |

**全員共識率：8/8**，無反對。

---

### 六、Action Items for Round 6

Codex Round 6 挑戰 Round 5：

1. Anonymous response contract 還有哪欄漏？
2. Action Taxonomy 的 **ship 級** 是否該另拆（push vs VM deploy vs pm2 restart）？
3. Degraded State 偵測時機是否足夠即時？
4. 你對「desktop only」是否同意，還是 tablet 該支援？
5. 任何其他反駁

---

## Round 5.5 · User direction（**覆蓋 Round 5 三處核心設計**）· 2026-04-17 03:30

**用戶回饋**（必入 Round 7 ship spec，Codex Round 6 要挑戰這輪）：

### 1. 刪情緒承諾（對齊持倉看板 R4.7）

Bridge 也不用「情緒承諾」「calm / trust / resilient observer」那些自嗨描述。

**替代**：直接寫 **「要看最新進度」** — Bridge 核心功能 = 進度可見度。

### 2. 白話化 > 技術術語（現況仍太技術）

用戶直接講：「**充斥大量我看不懂的專業術語**」。

Round 5 還是犯這毛病：「mutating routes」「Operator Action Taxonomy」「Anonymous Response Contract」「Degraded State Semantics」—— 用戶**看不懂 = 設計失敗**。

**Round 7 必修**：

- 技術術語區塊保留給**我自己 + Codex 實作**，但 **dashboard UI 文案全白話**
- 白話 glossary：
  - `mutating routes` → 「需要你決定才執行的動作」
  - `Operator Action` → 「需要你按下的按鈕」
  - `Anonymous vs Operator Contract` → 「未登入 vs 登入各看到什麼」
  - `Degraded State` → 「當系統撐著跑時的警告」
  - `auth gated` → 「需登入才能按」
- spec 雙語：技術 section 留給實作 / UI 區用戶語言必須寫

### 3. **Mobile decision center**（重大方向 pivot，覆蓋 Round 5 「desktop only」）

用戶洞察：

> 「你們第一頁明明有做可以讓我在網頁上直接對你們派工」
> 「活用 VM 伺服器，讓我不用守在電腦前」
> 「可以用手機決定決策，然後你們可以知道後派工」

這**推翻 Round 5 `2.9 Responsive`** 的「desktop only」宣告。

**新定位**：Bridge = **mobile-first 行動決策中心**（不是 desktop-only 觀察面板）。

**Round 7 必入**：

#### 3a. 手機必須 first-class

- Mobile < 768px **必須支援完整功能**（不是 redirect）
- 觸控 ≥ 44×44
- 主要 Action Center 按鈕手機可點
- Today timeline / task list / agent status 手機可讀

#### 3b. Decision 中心 = 不在電腦前也能決策

小奎在**外面 / 手機**打開 Bridge，能看到：

- 「Codex 做完 X，等你決定 push or 再磨」→ 手機按 push 或等
- 「Qwen 找到 5 個 bug，要修嗎」→ 手機批
- 「事件 N 快到了」→ 手機收通知

VM 側收到決策 → 自動派工 Codex / Qwen 執行。

#### 3c. VM notification（活用 VM 伺服器）

目前 Bridge 是 pull：小奎打開瀏覽器才看到狀態。
**改 push**（Round 7 實作）：

- VM 側偵測「需要決策」事件（agent 完工、bug 發現、milestone 到）
- 透過以下任一送 notification：
  - Line Notify（免費，台灣人最直接）
  - Push API（iOS/Android Web Push）
  - 簡訊（備援）
- 內容：「Codex 完工：cnyes adapter test 10/10。開 Bridge 批准 push? https://.../agent-bridge/decision/XX」
- 點連結 → 手機 Bridge → 1 步 approve/reject

#### 3d. Decision payload schema（Round 7 落）

```json
{
  "id": "decision_abc123",
  "type": "push_approval | bug_approval | milestone_ack",
  "context": {
    "summary": "Codex 完工 cnyes adapter，test 10/10 green",
    "payload_preview": "...",
    "created_by": "codex-01",
    "expires_at": "2026-04-17T04:30:00Z"
  },
  "actions": [
    { "id": "approve", "label": "同意 push", "endpoint": "POST /api/operator/actions/ship/push", "requires": "2-step confirm" },
    { "id": "reject", "label": "先別 push", "endpoint": "POST /api/operator/actions/mutate/defer-push" },
    { "id": "discuss", "label": "派 Qwen 再審", "endpoint": "POST /api/operator/actions/assist/dispatch", "payload": {...} }
  ]
}
```

手機 UI：一個 decision = 一個卡片，可滑掉或點動作。

#### 3e. 相關 Action Taxonomy 修改（Round 5 `2.6`）

`ship` 級（push / VM deploy / pm2 restart）之前 Round 5 寫「2-step + checklist + 無 undo」。
**手機場景補充**：

- checklist 改成 **手機能讀的摘要**（3-5 行 bullet，不是長表）
- 「我明白無 undo」checkbox → 手機 swipe-to-confirm pattern
- 錯誤按 → 可延遲 5 秒內 cancel（undo window）

### 4. Scope 重整

Round 5 寫 Scope OUT 有「mobile support 不做」暗示 — **刪除**。

新 Scope IN 增：

- **Mobile responsive full support**
- **VM-side decision push notification（Line / Push API）**
- **Decision payload schema** 連結手機 UI
- **Web Push subscription** 手機端訂閱

### 5. 更新 Failure Semantics（Round 5 `2.7`）

加新 failure：

- **Push notification 發送失敗** → UI 顯示「無法推送，請進 Bridge 查看」+ email fallback
- **手機網路不穩連不上 Bridge** → UI 顯示離線快照 + 「恢復連線後同步」

### 6. 打分重估

Round 5 Bridge overall **8.4/10** 是 desktop-only 前提。新定位（mobile-first decision center）下：

- Information Architecture：Round 5 8/10 → **降至 6/10**（手機 IA 未設計）
- Responsive：7/10 → **降至 5/10**（desktop-only 宣告是錯方向）
- User Journey：7/10 → **降至 5/10**（離開電腦的 journey 完全沒寫）
- 整體 **8.4/10 → 7.0/10**（實際：新方向下還未成熟）

**Codex Round 6 的任務更重**：要把手機 / 通知 / 決策 schema 寫進 Round 7，不只是挑戰 Round 5。

---

## Round 6 · Codex · 2026-04-17 03:39

### 6B. 對 Agent Bridge Round 5 + R5.5 pivot

- R5.5 mobile-first 的實作建議（詳細）：
  - 我同意 pivot 方向，**不同意沿用 Round 5 的 desktop-only IA**。現有 `dashboard/index.html` 單頁 + WS client 不需要重寫成 SPA framework；它本來就適合快速 ship。但要補 4 件事，否則手機會很脆：
  - 1. **Single page 保留，但改成 mobile-first shell**：版面順序改成 `Decision Inbox -> Agent 狀態 -> 今日時間軸 -> Tasks -> Metrics -> 深層 session output`。手機先看要不要按，桌機才看長 log。
  - 2. **WS 不是唯一資料源**：手機常背景切走、網路跳動，必須加 `GET /api/mobile/snapshot` 作為首屏 hydrate 與 WS 斷線 fallback。Decision 卡、badge、timeline 先吃 snapshot，再接 WS 增量。
  - 3. **加 service worker**：至少做 app shell cache、decision detail 頁快取、notification click deep-link。不是為了離線全功能，而是讓通知點開時首屏秒開。
  - 4. **把 mutating UI 從 hover/table 改成 card stack**：手機不能靠 dense table。每個 decision/task 都是卡片，上半摘要，下半 2-3 個 action。
- Responsive breakpoint 策略：
  - `<480`：單欄、sticky bottom action tray、metrics 只留 2 個最重要摘要。
  - `480-767`：單欄完整 mobile，decision cards + timeline cards。
  - `768-1023`：兩欄，左側 decisions/tasks，右側 metrics/timeline。
  - `>=1024`：桌機版，可展開 session output 與較長 checklist。
- Action Center 手機 render：
  - 手機首頁不要叫 `Action Center`，UI 文案改「**待你決定**」。
  - 每張 decision card 必有：`標題`、`一句摘要`、`誰提出`、`何時到期`、`風險等級`、`主要按鈕 1 個`、`次要按鈕 1-2 個`。
  - `ship` 級卡片點進去開 full-screen bottom sheet：先看 3-5 行摘要，再做 confirm。
  - timeline 手機只留最近 8-12 筆，older 用「看更多」。
- 手機 `ship` 級動作確認：
  - **不建議純 swipe-to-confirm**。swipe 對 archive/ack 很好，對 `push / deploy / restart` 太容易誤觸，也不利螢幕閱讀器。
  - 我建議：`checkbox + press-and-hold 800ms confirm`。checkbox 表示讀過風險，press-and-hold 降低誤觸；比 swipe 更可控。
  - swipe 可以保留給低風險 `ack / defer / mark read`，不要給 `ship`。

- Push notification 推薦（Line / Web Push / 簡訊）：
  - **首選：Web Push**。原因：直接 deep-link 回 Bridge decision 頁、無每則訊息成本、技術上和 mobile web 同一路。
  - **第二順位：LINE Messaging API，不是 LINE Notify**。我查官方文件，`LINE Notify` 已於 **2025-03-31** 結束服務；若要走 LINE，只能改官方帳號 `Messaging API`。這可行，但 setup 比 Web Push 重，而且會把通知綁到 LINE 帳號/好友流程。
  - **第三順位：SMS 只做備援**。成本與法遵摩擦最高，不適合當主通道。
  - 成本/設定難度對比：
    - Web Push：訊息本身近乎零邊際成本；要做 service worker、VAPID keys、subscription lifecycle。一次 setup，中長期最乾淨。
    - LINE Messaging API：有免費額度，但要 LINE 官方帳號、channel 設定、好友/受眾流程，產品心智比較重。
    - SMS：像 Twilio US 定價頁顯示約 **$0.0083/則起**，另有號碼費與 carrier fee；最貴，也最不像 internal beta。
  - 觸發時機（實作）：
    - `decision_required`：agent 完工待批、Qwen 找到 bug 待決、milestone 到。
    - `decision_expiring`：距離 `expires_at` 10 分鐘仍未處理。
    - `ship_failed_after_approval`：你按了，但執行失敗，需要再決。
  - 需要 VM 維護 subscription store 嗎：**需要**。
    - `web_push_subscriptions`
    - `line_user_targets`（若 Phase 2 做 LINE）
    - 每筆至少存 `id / channel / endpoint-or-userId / device_label / created_at / last_seen_at / revoked_at`
    - 不要只放 in-memory，pm2 restart 會掉。

- Decision schema 修改建議：
  - 你 R5.5 的 `id / type / context / actions[]` 主架構是對的，但還缺會影響實作正確性的欄位。
  - 建議 schema 至少補：

```json
{
  "id": "decision_abc123",
  "status": "pending | approved | rejected | expired | executing | executed | failed | canceled",
  "priority": "low | medium | high | ship",
  "resource_key": "repo:main:push",
  "created_at": "2026-04-17T03:30:00Z",
  "expires_at": "2026-04-17T04:30:00Z",
  "resolved_at": null,
  "resolved_by": null,
  "delivery": {
    "web_push": "sent | failed | clicked",
    "line": "not_configured | sent | failed"
  },
  "context": {
    "summary": "Codex 完工 cnyes adapter，test 10/10 green",
    "detail_url": "/agent-bridge/decision/decision_abc123",
    "payload_preview": "...",
    "created_by": "codex-01"
  },
  "actions": []
}
```

- `expires_at` 合理，而且是必要欄位。沒有 expiry，手機 decision 會堆成假待辦。預設：
  - `assist/mutate`：2-4 小時
  - `ship`：30-60 分鐘
  - `milestone_ack`：24 小時
- action 失敗後 retry：
  - 不要直接重送原 action。
  - 先把 decision 狀態轉成 `failed`，保留原 audit。
  - 系統生成新 `retry` decision，附上前次錯誤摘要與建議下一步。
  - `ship` 級 retry 必須重新 confirm，不繼承前次 approval。
- 多裝置同時收到誰先按誰贏：
  - 採 **first valid write wins**。
  - 伺服器用 compare-and-set：只有 `pending` 可轉 `approved/rejected`。
  - 其他裝置收到 WS/HTTP 409 後，卡片立即改成「已由另一裝置處理」。

- 白話化 glossary 擴展：
  - `Action Center` → 「待你決定」
  - `Decision Inbox` → 「待辦決策」
  - `Operator action` → 「需要你按的按鈕」
  - `observe` → 「只看狀態」
  - `assist` → 「幫 AI 再跑一次」
  - `mutate` → 「改變任務內容」
  - `ship` → 「真的送出變更」
  - `payload preview` → 「這次準備送出的內容」
  - `auth gated` → 「登入後才能按」
  - `Anonymous vs Operator Contract` → 「未登入和登入後各看得到什麼」
  - `degraded state` → 「系統現在有點撐著跑」
  - `stale` → 「這份狀態不是最新的」
  - `artifact` → 「這次執行產出的結果檔」
  - `dispatch` → 「派工」
  - `rerun` → 「再跑一次」
  - `snapshot` → 「目前畫面的快照」
  - `session output` → 「AI 剛剛做了什麼」
  - `busy/idle` → 「忙碌中 / 空檔中」
  - `rollback` → 「回退到上一版」
  - `expires_at` → 「最晚要在這之前決定」
  - `subscription` → 「這支手機是否收通知」

- Desktop only → 改 mobile first 的影響：
  - 現有 `Action Center + 今日 timeline + 6 metric` 不能原封不動縮小。
  - 手機首頁建議只保留：
    - `待你決定` 卡片
    - `現在誰在忙`
    - `最近 1-2 個重要進度`
    - `系統警告`
  - 可砍或下推：
    - 6 metric 全量同屏：改成 2 個 summary + 其餘收合
    - 長 session output：下推到 detail 頁
    - 今日完整 timeline：縮成最近 8-12 筆
    - project breakdown：移到次頁，不放首頁

- Action Taxonomy `ship` 級手機化修改：
  - checklist 應改成 **3-5 行 bullet 摘要**，每行都要是 yes/no 可判讀：
    - `測試已綠燈`
    - `要送的 branch 正確`
    - `這次會影響 production / preview`
    - `失敗時回退路徑已知`
    - `這次送出後無法一鍵取消`
  - undo window 5 秒：
    - 對 `push` 勉強可接受，但前提是實作是 **延遲 5 秒後真正執行**。
    - 對 `pm2 restart` / `deploy` 幾乎沒意義，因為命令通常已經送出。
    - 所以我建議：`push` 可有 5 秒 cancel queue；`deploy/restart` 不要假裝有 undo，只給 rollback 指引。
  - 錯按後怎麼救：
    - `push`：若尚在 cancel queue，直接取消；若已送出，轉成新的 `rollback / follow-up` decision。
    - `deploy/restart`：立即顯示 rollback script / 回前版路徑，不要只說「無 undo」。

- Scorecard：
  - 我同意用戶把 **8.4 → 7.0** 下修，方向正確。
  - 若以 R5.5 新定位重打，我會給 **7.1/10**，不是 8 分段。
  - 高分：
    - `Interaction safety` 8.5/10：action taxonomy、2-step confirm、audit 思路仍然強。
    - `Truthfulness / degraded semantics` 8.5/10：至少知道不能假綠燈。
  - 低分：
    - `Information Architecture` 6/10：手機首頁層級未重排。
    - `Responsive / mobile execution` 5/10：Round 5 根本反方向。
    - `Notification architecture` 4/10：R5 幾乎沒設計。
    - `Decision schema completeness` 6/10：主骨架有了，但狀態流與併發解法未定。

### 6C. Round 7 ship spec 該包什麼

（Claude Round 7 合稿時直接收這份清單）

- 持倉看板必入：
  - `selectDailyQuote` 四級 fallback，禁止 `candidates.length === 0` crash。
  - `Today in Markets` 改成 1 天 2 次 batch summarize + Blob cache，明寫成本上限。
  - `Truthfulness Data Contract` 擴成字段級：`authoritative_tier / computed_from / updated_at / display_mode / stale_reason / coverage / confidence / ui_badge_copy`。
  - Scorecard 由 `8.6/10` 下修到 `8.3/10` 左右，避免過度樂觀。
- Bridge 必入：
  - 刪除 `desktop only`，改成 `mobile-first decision center`。
  - 保留 single-page + WS，但新增 `GET /api/mobile/snapshot`、service worker、notification click deep-link。
  - 手機首頁 IA 固定為：`待你決定 -> 現在誰在忙 -> 最近重要進度 -> 系統警告`。
  - 通知通道 Phase 1 = Web Push；Phase 2 才考慮 LINE Messaging API；SMS 只備援。
  - 明寫 **LINE Notify 已於 2025-03-31 停用**，不可再選它。
  - 決策事件類型：`decision_required / decision_expiring / ship_failed_after_approval`。
  - Decision schema 補 `status / priority / resource_key / created_at / expires_at / resolved_at / resolved_by / delivery`。
  - 併發規則：`first valid write wins` + 409 + 全裝置即時同步已處理狀態。
  - `ship` 級手機確認 = `3-5 bullet 摘要 + checkbox + press-and-hold 800ms`，不用純 swipe。
  - `push` 可做 5 秒 cancel queue；`deploy/restart` 不給假 undo，只給 rollback flow。
  - UI glossary 全面白話化，技術名詞只留 spec/實作層。

## Round 6.6 · User direction（**砍 push notification**，簡化 mobile scope）· 2026-04-17 03:45

**用戶**：「agent bridge 我可以手機連網頁就好，line 要付費太麻煩而且你們又要橋接上去更費時」

### 推翻 R5.5 的 notification 部分

Round 5.5 寫了：

- ❌ Line Notify
- ❌ Web Push API + service worker
- ❌ 簡訊 SMS
- ❌ Subscription store
- ❌ VM-side push trigger
- ❌ Decision expires_at + pending flow

**全部砍**。

### 保留 + 簡化 scope

**保留**：

- ✅ **Mobile-responsive web UI**（手機打開網頁能用）
- ✅ Action Center 兩段式確認（手機直接點）
- ✅ 白話化 UI
- ✅ 行動決策中心（手機打開瀏覽器就能批 push / 派工）

**簡化**：

- 🔄 Decision schema 去掉 `expires_at`（不 expire，永遠在 queue 等用戶打開）
- 🔄 Decision queue 改 **pull-based**：用戶打開 Bridge → 看到待決策 list → 選一筆處理
- 🔄 沒有 outbound notification，全部靠用戶主動打開（可接受，因為小奎本來就會看）

### Round 7 必改（相較 R5.5）

#### 1. Scope IN 修正（覆蓋 R5.5 Scope 增補）

原 R5.5 寫：

- Mobile responsive full support ✅（保留）
- **VM-side decision push notification（Line / Push API）** → ❌ **刪除**
- **Decision payload schema** 連結手機 UI ✅（保留但簡化，無 expires_at）
- **Web Push subscription** 手機端訂閱 → ❌ **刪除**

#### 2. Decision payload schema 簡化

```json
{
  "id": "decision_abc123",
  "type": "push_approval | bug_approval | milestone_ack",
  "status": "pending | approved | rejected | superseded",
  "context": {
    "summary": "Codex 完工 cnyes adapter，test 10/10 green",
    "payload_preview": "...",
    "created_by": "codex-01",
    "created_at": "2026-04-17T03:00:00Z"
  },
  "actions": [
    { "id": "approve", "label": "同意 push", "endpoint": "..." },
    { "id": "reject", "label": "先別 push" },
    { "id": "discuss", "label": "派 Qwen 再審" }
  ]
}
```

**對比 R5.5 移除**：

- `expires_at`（不過期）
- `delivery_channels`（無通知管道）
- subscriber list / device registration（無訂閱）

#### 3. Decision queue UI

- Dashboard Hero 區加「**等你決策**」區塊
- 數字 badge：「3 件待決策」
- 展開：列所有 pending decisions（最新在上）
- 無通知，純 pull

#### 4. VM 側的職責收窄

**保留**：

- Agent 完工時寫一筆 decision 到 `data/decisions.json`（pending status）
- 用戶打開 Bridge → dashboard fetch → 渲染 queue

**刪除**：

- Line / Push API 呼叫
- Subscription store 管理
- Retry / delivery tracking
- email fallback

#### 5. Failure Semantics 簡化（R5.7）

R5.5 寫 failure 含「Push notification 發送失敗」→ **不存在了，刪**。

保留：

- WS disconnected > 30s badge
- git timeout
- artifact upload fail
- local-activity.json 壞

新增：

- **手機網路不穩 → offline cache 顯示最後 5 分鐘快照 + 「離線中」badge**

#### 6. Scorecard 重新評

R5.5 降到 7.0/10 的理由有一半是「notification 實作不成熟」。R6.6 砍了 notification 就沒這風險。

新評分：

- Information Architecture：6/10 → **7/10**（手機 IA 仍需設計）
- Responsive：5/10 → **7/10**（mobile web-only 就夠）
- User Journey：5/10 → **6/10**（無 push，用戶得主動看 → journey 弱一些但可接受）
- 其他維度不變

**整體 Bridge 7.0 → 7.8/10**（砍複雜度 = 升實作可能性）

### 7. 為什麼這個選擇對

|                     | R5.5 原方案（Web Push）                         | R6.6 簡化方案                 |
| ------------------- | ----------------------------------------------- | ----------------------------- |
| 實作成本            | 高（subscription / SW / VAPID keys / 通知 API） | 低（純 web + responsive CSS） |
| 用戶介入            | push 到手機 lock screen                         | 用戶主動打開 Bridge           |
| 隱私/權限           | 需 user consent notification                    | 無                            |
| 跨平台              | iOS Safari 限制多、Android OK                   | 全平台一致                    |
| Line 付費           | $$$ / 月                                        | $0                            |
| 維護                | 需監控 delivery / retry                         | 無                            |
| 對 1 個用戶是否值得 | ❌ over-engineering                             | ✅ 剛好                       |

**結論**：一個用戶 + 用戶本來就會主動打開 → 不需要 push。先做 web 手機版就好。

### 8. 未來 upgrade path（若用戶量 > 1）

若 Bridge 擴到 > 3 個 operator（Codex 團隊化）或小奎真需要 push：

- 階段 1：email 摘要（SMTP 現成便宜）
- 階段 2：Telegram Bot（API 免費）
- 階段 3：Line Notify（若團隊肯付）
- 階段 4：Web Push（最複雜但最原生）

**本階段不做**，寫進 Open Questions 備忘。

---

## Round 6.8 · User direction（scope 再收：iOS only）· 2026-04-17 03:55

**用戶**：「agent bridge 只有我會用而已，我是用 iOS」

### scope 再收

- **唯一用戶**：小奎（確認 R1 宣告）
- **唯一裝置**：iOS（iPhone + iPad Safari）
- **非用戶/非裝置**：Android / Windows / Linux 其他人 — 不測、不保證

### Round 7 必改

#### 1. Mobile-first = iOS Safari first

原 R5.5 / R6.6 寫「mobile responsive」— 改明確：**iOS Safari 為 primary target**。

- **safe area**：`viewport-fit=cover` + `env(safe-area-inset-*)` 對齊 iPhone notch / Dynamic Island
- **touch target ≥ 44×44**（Apple HIG 標準）
- **font**：`-apple-system, BlinkMacSystemFont, "SF Pro Text", ...` 作 body fallback；headline 仍 Source Serif 4 Google Fonts
- **viewport**：`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- **iOS tap highlight**：`-webkit-tap-highlight-color: rgba(0,0,0,0.04)` 柔和
- **scroll momentum**：`-webkit-overflow-scrolling: touch`（舊 Safari 殘留）
- **iOS input auto-zoom 防**：所有 input font-size ≥ 16px

#### 2. 用 iOS 原生功能

- **「加入主畫面」PWA manifest**：`manifest.json` + icon 180x180 + theme_color
  → 小奎可 bookmark Bridge 到 home screen，用起來像 app
- **iOS Share Sheet**：用 Web Share API（navigator.share）
- **visualViewport API**：輸入時虛擬鍵盤佔屏處理（Cmd+K 該用，雖然 Bridge 無 Cmd+K）

#### 3. 不用做的

- ❌ Android Chrome 專屬 API / 設計細節
- ❌ Windows / Linux 桌機佈局精修（能用就好）
- ❌ 各種奇怪瀏覽器 workaround
- ❌ iOS 12 以下兼容（iOS 15+ 即可，現在 2026 年合理基線）

#### 4. 測試範圍收斂

- **主要**：iPhone Safari（iPhone 15 / 16）
- **次要**：iPad Safari
- **兜底**：Mac Safari 桌機
- **不測**：Chrome Android、Windows Edge、Firefox Linux

#### 5. Scorecard 小調

- Responsive/A11y：R6.6 7/10 → **維持 7/10**（iOS 收斂後目標更明確，但 iOS-only 也限制擴散可能）
- User Journey：R6.6 6/10 → **7/10**（journey 定義清晰 = 小奎 iPhone 使用）
- **整體 7.8 → 7.9/10**（小增）

### 6. 未來 upgrade path（若離開 iOS-only）

若小奎某天換裝置或擴 operator：

- 階段 1：Android Chrome 測試（大概 95% work 但 safe area / share sheet 細節要調）
- 階段 2：桌機 power user 優化（Cmd+K、shortcuts、denser layout）
- 階段 3：真正 multi-operator（才考慮 auth / team roles）

**本階段不做**。

---

## Round 6.9 · User direction（**Claude 再漏：自由派工輸入區**）· 2026-04-17 04:35

**用戶**：「我發現 agent bridge 怎麼少了我可以打字發送的功能」

**Claude 檢討**：v3 mockup 只放 Action Center（按預設按鈕批**預先偵測好的決策**），完全漏了 Bridge 最根本的功能 — **自由輸入 + 派工**。用戶在開發時主要動作是：

- 打開 Bridge
- 輸入「派 Codex 寫 X」/「Qwen 審這個」
- 送出
- agent 在 VM 側跑

Round 5.5 提到「dispatch 能力已在」但只寫 **operator UX + 審批流**（2-step confirm / action taxonomy），沒明寫**自由輸入對話框**。

### Dispatch Input 規格

#### 1. UI 位置

- Hero 區 **Action Center 下方**，優先級高
- 或獨立 `/#dispatch` tab 做完整版（像 ChatGPT 介面）
- 手機：固定底部（對齊 iOS mail compose 按鈕位置）

#### 2. UI 元件

```
┌──────────────────────────────────────────┐
│  📋 派工給 agent                          │
│  ─────────────────────────               │
│  [選擇 agent ▾]  [brief 範本 ▾]  [更多]  │
│                                           │
│  ┌───────────────────────────────────┐   │
│  │ Codex，讀 api/_lib/cnyes-*.js，    │   │
│  │ 加個 timeout 8 秒，寫 test 驗證   │   │
│  │                                    │   │
│  │                                    │   │
│  └───────────────────────────────────┘   │
│                                           │
│     [附加檔] 5 / 2000 字     [送出]       │
│                                           │
└──────────────────────────────────────────┘

[最近派工 list]
  Codex · 3 分前 · cnyes adapter timeout [重派]
  Qwen · 15 分前 · regression [重派]
  ...
```

#### 3. Target 選擇（agent picker）

Dropdown：

- Codex（實作）
- Qwen（QA / 研究）
- Gemini（盲點 / 反駁）
- Claude（meta / 架構 — 本身）

**預設**依 brief 內容**智能推薦**（e.g., 含「test」→ Qwen / 含「實作」→ Codex）。

#### 4. Brief 範本 selector

快速 prefix：

- 空白（自由輸入）
- QA / regression
- Phase 3 feature
- Bug fix
- Research / 廣度掃
- VM ops

選範本後自動 prefill 部分 header（時間 / 目標 / 交付格式）。

#### 5. 送出後行為

1. UI 顯示「派工中...」spinner
2. POST `/api/operator/actions/assist/dispatch` + target / brief / template metadata
3. VM 側建立 new task + spawn agent CLI
4. WS push 回來更新「現在正在跑」區塊（Now Running），agent 開始跑 + progress ring
5. 完成後進「今日故事」timeline + 觸發新 decision（若需 push）

#### 6. 輸入驗證

- 字數：≤ 2000（防爆 token）
- 禁敏感字串（簡單 regex：repo-wide secret token pattern）
- 手機：`font-size: 16px` 防 iOS auto-zoom
- 多行：`textarea` with `rows=5`, 可拖 resize

#### 7. 最近派工 list（recent dispatches）

- 顯示最近 5-10 筆
- 每筆：agent name + 時間 + brief 前 50 字 + 狀態（完工 / 進行中 / 失敗）+ `[重派]` 一鍵
- 點項目 → 展開看完整 brief + 回報
- 無 → 「還沒派過工，試試左邊範本」

#### 8. 跟既有 endpoint 對應

既有後端已有：

- `POST /api/workers/dispatch`（HTTP）
- `POST /api/tasks/:id/dispatch`（HTTP）
- WS `worker:dispatch` / `task:dispatch`

**Dispatch Input = 這些 endpoint 的真正 UI 入口**。R4 Codex 提「dispatch 能力已在，缺 UX 層」— Dispatch Input 就是那個 UX 層。

#### 9. MoSCoW 位置

- **Must**（Bridge 核心功能就是派工！不是 observe）
- 從 R5 未列 → 加進 Must

### Round 7 合稿必改（對應 R5 的 Scope IN）

原 R5 Scope IN 寫：

- VM session 顯示 + Mac localActivity
- 任務列表
- 今日 commit timeline
- Action Center 兩段式確認
- Dispatch 能力（已有，缺 UX 層）

**R6.9 補**：

- **Dispatch Input panel**（自由輸入派工 textarea + agent picker + 範本 + recent list）
- 對應 MoSCoW 從「未列」升為 **Must**

### 打分修正

R6.8 整體 7.9/10 是在漏 Dispatch Input 前提。再補：

- **Information Architecture**：7/10 → **8/10**（核心功能補回）
- **User Journey**：7/10 → **8/10**（journey 完整：打開 → 打字 → 送出 → 看進度）
- **Scope completeness**：隱含維度，**+0.3**

**新評 overall: 7.9 → 8.4/10**

### v3 mockup 必更新

下一步我加 Dispatch Input 區塊到 iPhone + Desktop mockup，重生 PNG。

---

## Round 7 · Claude · _final ship spec_ · 2026-04-17 04:40

這一輪不重寫 R1-R6 細節，而是**把 R1→R6.9 全部共識收斂成單頁 ship spec**，含 MoSCoW / 契約 / 驗收 / 風險。Codex R8 可直接跟這份打反駁。

### 1. Product Definition（One-liner）

**Agent Bridge**：小奎專屬的 **iOS Safari 網頁 dashboard**，**唯一功能軸**是「看 agent 在 VM 跑什麼 + 派工給 agent + 批我會不會同意的決策」。不做通用 orchestration，不做多人協作，不做 desktop-first。

> 用戶：小奎一人 / 平台：iOS Safari + macOS 兼容 / 存取：`https://<vm>.sslip.io/agent-bridge/` / 架構：Vercel 不碰，VM 直出 HTML + WS。

### 2. MoSCoW 收斂

**Must（Phase 1 / ship）**

1. **Dispatch Input**（自由輸入 textarea + agent picker + 範本 + recent dispatches）— R6.9
2. **Action Center**（預偵測決策 + 2-step 確認，action taxonomy: observe / assist / mutate / ship）— R5
3. **Now Running**（VM session rings + Mac localActivity，最多 3 張卡）— R1-R5
4. **Decision queue**（pull-based，手機底部固定，**無 push notification**）— R5.5 / R6.6
5. **Task donut**（整體任務進度：完工 / 進行中 / 待派 / 卡住 四段）— R6.10 視覺補強
6. **Anonymous vs Operator Response Contract**（未登入 / 登入後資料暴露差異）— R3
7. **Truthfulness Contract**（每張卡標 source / freshness / fallback / error copy）— R3
8. **iOS Safari 適配**（safe-area-inset, visualViewport, viewport-fit=cover, 16px input, `-apple-system`）— R5.5 / R6.8
9. **PWA manifest**（加到主畫面；不做 push）— R6.6

**Should（Phase 2 / 一週內）**

- Today 7-day commit chart + metric sparklines
- Phase progress bars（對齊 roadmap）
- Today's Story timeline（時序）
- Dispatch recent list 展開 + `[重派]`
- Operator 登入 / JWT（目前 dashboard 用 dummy token；上線前做 google-auth-library 驗 email whitelist）

**Could（Phase 3 / 有時間再做）**

- Desktop 1440px 加強版（目前 desktop 是 iPhone mockup 的 wider layout，非獨立設計）
- Brief 範本快速切換的 prefill 邏輯
- Dispatch 送出後的 agent 選擇智能推薦（LLM 判斷內容）

**Won't（R5.5 / R6.6 / R6.8 已否決）**

- ~~LINE bridge~~（付費 + 橋接複雜）
- ~~Web push notification~~（iOS Safari 支援差，pull-based 就夠）
- ~~Desktop-first layout~~（用戶只用 iOS）
- ~~多用戶 / 權限矩陣~~（單人產品）
- ~~Cmd+K mobile FAB~~（手機不用鍵盤）

### 3. 核心契約（不可退讓）

| 契約                              | 內容                                                                                                                                             | 來源 round |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| **Operator Action Taxonomy**      | 4 級：observe（看）/ assist（建議）/ mutate（改 VM state）/ ship（動 prod）。mutate+ship 必 2-step 確認。                                        | R5         |
| **Response Contract Matrix**      | 未登入：summary / status / no secrets；登入：full dossier / secrets redacted in UI / audit log entry 建立。                                      | R3         |
| **Truthfulness / Data Freshness** | 每卡必有 `source`、`fetchedAt`、`fallback` 狀態；stale ≥ N 分就標橘、error 標紅。                                                                | R3         |
| **State Ownership**               | iOS localStorage（draft dispatch）/ VM in-memory（session state）/ Blob snapshot（daily archive）。Vercel 不存 Bridge state。                    | R3 / R5    |
| **Dispatch Endpoint**             | `POST /api/operator/actions/assist/dispatch`，body: `{ agent, brief, template, budget_seconds? }`。WS push `task:dispatched` + `task:progress`。 | R6.9       |
| **WS auth**                       | dashboard 公開瀏覽走匿名 token；operator action 走 JWT。auth 太緊會破公開瀏覽（memory: vm-deploy-pitfalls）。                                    | R4         |

### 4. 驗收清單（ship gate）

- [ ] iPhone Safari 實機打開 `https://<vm>.sslip.io/agent-bridge/` 不破版
- [ ] 手機底部 Dispatch Input 貼安全區，送出後 WS push 回來 update Now Running
- [ ] Decision queue 空狀態 / 有 1 項 / 有 5+ 項 三種狀態都讀得順
- [ ] Task donut 四段比例 ≠ 總任務時清楚標明（e.g., 不顯示不存在的「卡住」）
- [ ] 未登入看到 anonymous 版面（無 secrets）；登入後 Operator Action 可用
- [ ] 手動斷網 → 每張卡顯示 stale 狀態而非 loading 轉圈卡死
- [ ] iOS 加到主畫面後 PWA icon 正常；開啟後無 Safari UI chrome
- [ ] dispatch textarea 16px font，iOS 不 auto-zoom
- [ ] 測試白名單以外 email 登入 → 拒絕 + 友善訊息

### 5. 風險 / 未解

1. **VM 單點故障**：VM 掛 Bridge 全掛。Phase 1 可接受（小奎一人用），Phase 3 再考慮 keep-alive。
2. **Ollama 依賴**：Qwen 本地走 Ollama → Mac 沒開 Ollama = Qwen 不可用。Dispatch Input 需在 picker 標「Qwen（需本機 Ollama 跑）」。
3. **Blob snapshot 排程**：`api/cron/snapshot-portfolios.js` 是持倉看板用；Bridge 要不要有類似 daily snapshot（今日任務 / commit / decision）留 Phase 2。
4. **Mockup vs 實作 gap**：v3 mockup 是 HTML 描繪；實作要串 WS / dispatch endpoint 實資料。前端框架還沒定（React？vanilla？）。

### 6. 評分（Round 7 final）

| 面向         | R6.8 | R7      | 說明                                           |
| ------------ | ---- | ------- | ---------------------------------------------- |
| IA / 結構    | 7.0  | **8.5** | Dispatch Input 補回核心、Task donut 視覺化進度 |
| User Journey | 7.0  | **8.5** | 打開 → 看進度 → 派工 → 批決策 閉環完整         |
| Truthfulness | 8.0  | **8.5** | Response contract + freshness badge 落地       |
| iOS 適配     | 8.0  | **8.5** | safe-area / 16px / PWA / 無 push 全收斂        |
| Scope 收斂   | 7.5  | **9.0** | Won't 清單明確，不再 scope creep               |
| Ship-ability | 7.5  | **8.5** | Must 9 項可 2 週做完                           |

**Overall: 8.4 → 8.6/10**

還差 1.4 分的地方：真實 VM 實作（非 mockup）+ JWT auth 實接 + Blob snapshot 串。這些屬實作而非設計，R7 設計面定調完成，**準備發 ship plan**。

### 7. Next Handoff

Round 7 結束。下一步不是 Round 8，是：

- **ship plan**（Codex 寫 implementation phases）
- **Gemini R8 review**（外部視角：mockup 到實作有沒有漏）
- **用戶驗收 mockup v3 PNG**（donut + Dispatch Input 在 iPhone / desktop 都 OK）

---
