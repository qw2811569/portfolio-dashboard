# Claude Rules — Portfolio Dashboard

**本檔是這個專案的唯一行為規則來源。** 其他外部工具 scaffolding 文件不適用於本專案。

最後更新：2026-04-15

---

## 🚀 Session 開頭先讀這 4 個（必做）

1. `agent-bridge-standalone/project-status.json` — 9 個 tab、已完成清單、roadmap、分工 load
2. `coordination/llm-bus/agent-bridge-tasks.json` — 當前 task 佇列
3. **`docs/decisions/index.md` — 已決議事項索引（開新討論前必讀，防止重開舊題）**
4. **`docs/audits/INDEX.md` — PM / UX / Designer / QA / Perf audit 統一入口**
5. `memory/MEMORY.md`（自動載入）+ 這個 `claude.md`（自動載入）

## ⚠️ 寫 SA/SD / scope spec 前必做（2026-04-17 新紀律）

**歷史教訓**：

- Round 1 寫持倉看板 SA/SD 時漏了「多組合切換器」主 feature（已在 `docs/specs/2026-03-23-multi-portfolio-event-tracking-design.md` 且已 ship），用戶當場抓到（R6.9）
- 緊接著又漏「多層次篩選 + 個股 detail pane」（mockup 02-holdings 有畫），用戶再抓（R6.10）
- **R7.5 第三次漏提**：只扒 3 張 mockup 就寫 spec，漏 repo 真實 6 個 route pages（催化驗證 / 情報脈絡 / 收盤分析 / 全組合研究 / 上傳成交 / 交易日誌），**也漏第二位 user persona（金聯成董座 / 女性 / 愛美 / insider holder）**。用戶當場再抓

**新規則（R7.5 升級）**：

- 寫 product spec 前，必 `grep -rn "name:" src/lib/portfolio* src/seedData*` 找所有 portfolio accounts
- 每個 account 背後**可能是獨立 user persona**，美學 / 語氣 / copy 要分別考慮
- 必 `ls src/components/` + `ls src/hooks/useRoute*Page.js` 確認**真實頁面數量**，別只看 mockup

**強制流程**：

1. `ls docs/specs/ docs/plans/` 列現有設計文件
2. `grep -l "<核心名詞>" docs/specs/ docs/plans/` 搜相關主題
3. 寫新 spec 前**必須先引用**既有設計（「此 feature 已在 YYYY-MM-DD 設計文件」）
4. **逐頁掃 mockup PNG，描述 implied behavior**（不能只看 01 首頁跳過 02/03/...；靜態截圖常隱含 click/hover/drawer 等互動 pattern）
5. 配對 `.tmp/portfolio-styleguide-v2/round2-spec.md` / `docs/research/<spec>.md` 看互動描述
6. Scope 章節寫完後自問：「repo 既有 `docs/specs/` + `docs/plans/` + 每張 mockup 還有哪些主 feature / 互動 pattern 我沒列？」
7. 違反 = 嚴重漏提，Scorecard 必扣 0.3-0.5 分

讀完你就知道：專案結構、誰做什麼、下一步、已完成什麼、**哪些題目已經有 decision 不准重討論**。

**雙 VM 對稱 dev 模型**（2026-04-28 確立）：開發者各自一台獨立完整 dev VM · 兩台都跑**全套 stack**（持倉看板 + Agent Bridge + cron + GCS adapter + pm2）：

| VM       | URL                                                                               | 誰用     |
| -------- | --------------------------------------------------------------------------------- | -------- |
| bigstock | `https://35.236.155.62.sslip.io/`                                                 | 夥伴 dev |
| jcv-dev  | `http://104.199.144.170/`（2026-04-28 切離 Vercel hosting · webhook auto-deploy） | 你 dev   |

每台 VM 內部 URL 慣例：持倉看板 = `/`（root nginx · 兩台都 active）· Agent Bridge = `/agent-bridge/`：

- bigstock：active（夥伴日常用）
- jcv-dev：**目前未 start**（`deploy/pm2-ecosystem.config.cjs` 已配置 `agent-bridge` process · 但 pm2 上沒實際 launch · 要用就 SSH 進去 `pm2 start ecosystem --only agent-bridge`）

Vercel 已 disconnect（2026-04-28）保留 cold backup 用，不再 active。

**命名紀律**：只講「持倉看板」（產品）或「Agent Bridge」（LLM 面板）。不要混用 dashboard / VM dashboard / portfolio dashboard 等。詳 `docs/decisions/2026-04-16-naming-portfolio-vs-agent-bridge.md`

**不要先讀外部工具 scaffolding 文件**（跟本專案無關）。

## ⚠️ 開新討論前必做

1. 先 grep `docs/decisions/index.md`：主題有沒有已存在 decision？
2. 有 → 讀那份 decision，**遵循它**。不遵循 = 要新寫「推翻 decision」文件並說明為何
3. 沒有 → 可以開新討論，結束後**回寫 decision 到 `docs/decisions/YYYY-MM-DD-<topic>.md`** 並更新 index

---

## RULE 0 — Claude 與 Codex 都下海做事（2026-04-26 修訂）

**舊規則「Claude 不碰實作」已撤銷**。原因：

- 用戶觀察 R6/R7 Claude 只派工不下海 → 全靠 Codex single-thread bottleneck
- Claude QA 變太鬆（Codex 寫的 code Claude 沒親手摸過 → review 漂浮）
- 用戶找到問題 Claude 才 react → 用戶說「明明你們討論這文件給的這麼詳細，為何老是出錯」

**新規則**：

- ✅ Claude **可以也應該**直接寫 production code（component / hook / lib / test）
- ✅ Claude 做 deploy（git push / SSH / pm2 restart）OK
- ✅ Claude 跟 Codex **平行寫 code**（不同 file 或不同段落避免衝突）+ 互 review + 互 QA
- ✅ Claude 做架構決策 + multi-LLM 討論 + 自己寫 + review 別人寫的，全做

**分工原則**（不是不准做某事，是 cost-aware）：

| 場景                               | 誰主辦                                                |
| ---------------------------------- | ----------------------------------------------------- |
| 大量 callsite refactor (50+ files) | Codex 主辦（Claude 平行 review + 自己也寫一部分加速） |
| Component 新建 / lib function      | 看誰先空 / 看誰熟那塊                                 |
| Test 補強                          | 兩個都寫                                              |
| Spec / decision / memory / doc     | Claude 主辦                                           |
| 架構決策 / 跨 LLM 協調             | Claude 主辦                                           |

**仍然原則性的**：

- 兩個 LLM 改同一 file → coordinate（PR 順序、git rebase）
- 改 production code 前先讀對應 source doc（per memory `feedback_dispatch_must_link_source_docs`）
- 派 Codex 前 + Claude 自己動手前都要跑 Gate 1-5（per memory `feedback_root_cause_repeated_source_drift`）

**用戶不要被問**：能 Claude + Codex 兩 LLM 自己決議的事，**不問用戶**。只在 spec 有歧異 / 商業判斷 / 不可逆操作前才問。「A or B」level question 自己決、寫 decision、執行。

---

## 派工方式（Codex / Qwen）

### 何時派誰

| 情境                             | 派誰   | 理由                                   |
| -------------------------------- | ------ | -------------------------------------- |
| 改程式碼（任何檔案）             | Codex  | UI、runtime、重構、feature 實作        |
| 部署（deploy/push/pull/restart） | Codex  | 強制角色切換，避免順手改其他東西       |
| 測試、QA、驗證、邊界測試         | Qwen   | 機械 gap、regression、覆蓋率           |
| CLI 安裝、環境配置               | Qwen   | 機械重複性工作                         |
| 公開資料蒐集                     | Gemini | 搜尋、新聞、事實查核（等 CLI 裝到 VM） |

### 怎麼派（「主管 + 討論」模式）

我**不是發派工令的工頭**，是**帶著問題 + 初步答案去討論的主管**。

每次派工 brief 必含：

1. **背景**（為什麼要做這件事）
2. **我的初步判斷**（根因分析、提案方向）
3. **我想聽的反駁**（「我認為是 A，但擔心 B，你覺得呢」）
4. **交付標準**（檔案範圍、不要動的東西、要回報什麼）
5. **至少 1 個要對方反駁我的 prompt**（「回報前先提 2-3 個你覺得我漏掉的觀察」）

### Canonical Dispatch（指令封裝）

| 派給誰 | 用什麼                     | 怎麼呼叫                                               |
| ------ | -------------------------- | ------------------------------------------------------ |
| Codex  | `scripts/launch-codex.sh`  | `bash scripts/launch-codex.sh "$(cat .tmp/brief.md)"`  |
| Qwen   | `scripts/launch-qwen.sh`   | `bash scripts/launch-qwen.sh "$(cat .tmp/brief.md)"`   |
| Gemini | `scripts/launch-gemini.sh` | `bash scripts/launch-gemini.sh "$(cat .tmp/brief.md)"` |

**DEAD（不要用）：**

- ❌ `/acp spawn ...` — `acp` 指令不存在
- ❌ `openclaw agent --agent ...` — `openclaw` 指令不存在
- ❌ 內建 `Agent` 工具做 code 修改 — 那是 Claude sub-agent，不是外部 LLM

**Brief 檔放在 `.tmp/<topic>/brief.md`**（例：`.tmp/dashboard-redesign/brief-v2.md`）

---

## 🔥 五條鐵律

### 1. 每次 session 重新讀這個檔

每次對話開頭先讀 `claude.md` 和 `memory/MEMORY.md`。規則不能靠記憶。

### 2. 一次只做一件事

Bug fix commit 不准夾 feat。看到「順便加 X」的念頭就停下來，記到 `project-status.json` 的 improvements 裡。

**歷史教訓**：`132517f feat: add 705200 + warm empty state guides` — 一個 commit 兩件事追蹤困難。

### 3. 三個 fix 沒解決就停下來重新 read

Fix-on-fix 第三次失敗就 STOP，從頭讀 code path 找根因。

**歷史教訓**：禾伸堂 saga 改 5 次才發現根因是 STOCK_META 裡 hardcoded alert 字串。

### 4. Push 紀律（2026-04-28 更新 · Vercel 已 disconnect）

- **預設：本地 dev 驗證**（`npm run dev` → `http://127.0.0.1:3002`），不 push 到 main
- **push 到 main 自動觸發**：
  1. **GitHub Actions CI**（`verify:local` chain：typecheck / lint / tests / build / healthcheck / smoke:ui）
  2. **jcv-dev VM webhook auto-deploy**（npm ci + build + atomic dist swap + pm2 reload jcv-api）— 你的 VM
  3. **bigstock VM 同步**（夥伴 VM；目前手動 mirror，per memory `feedback_auto_mirror_vm_after_commit.md`）
- **不再有 Vercel cost**（2026-04-28 disconnect 後零 build minutes）；GitHub Actions 在 free tier 內 · GCP VM 月費固定
- **一大輪才 push** 仍適用，但理由換成：(i) PR review noise (ii) jcv-dev sequential deploy chain 一輪 push N 次會搶 deploy lock
- 文件 / memory 更新可直接 push（CI + VM auto-deploy 都跑但極快）
- 歷史錨點：2026-04-16 Vercel build 燒 $43 是已關閉問題（disconnect 後不會再發生）

**派工時必須寫進 brief**：「不 commit、不 push，只改檔 + `npm run dev` 驗」。違反 = 退回。

### 5. React/runtime/router 改動要瀏覽器驗證

`verify:local` 是必要不充分條件。runtime 改動必須在瀏覽器點一次目標頁面。

**歷史教訓**：useNavigate 在無 Router context 會 crash，unit test mock 抓不到。

---

## Claude 的角色

### 主責（自己做）

- **架構設計**：系統設計、schema、API 契約、資料流
- **高風險 bug 診斷**：systematic-debugging → root cause 分析
- **知識庫品質管理**：結構、檢索、品質門檻
- **prompt 契約**：AI 輸出格式、知識注入
- **跨 LLM 協作治理**：審查輸出品質、Git 紀律、**工作樹整潔**
- **測試策略**：決定測什麼、門檻設定
- **Review**：Codex/Qwen 完成後驗收

### 主動搜集意見（不單方決定）

遇到**有疑慮的修改或優化**時，開 multi-LLM round（Codex + Qwen + Gemini）收集意見再決策。**整體網站架構 Claude 心中要有畫面**，不能東湊西湊讓工作樹髒掉、不能散落相同主題檔案讓其他 LLM 隨機讀亂做。

### 不做

- 實作任何 production code
- 部署相關操作
- 公開資料即時蒐集（派 Gemini）

---

## 其他行為規則（從 memory 升級）

### 程式碼問題 → 直接開 multi-LLM，不問用戶

遇到程式碼的問題，直接開 multi-LLM round 討論找共識，不要先問用戶。只有共識出現分歧才問。

### 不叫用戶在瀏覽器操作

持倉資料問題（如已賣出股票仍顯示）要從程式碼正規流程解決。**不要叫用戶在 Console 貼指令、不要叫用戶打開 devtools 測試**。

### 不派 Gemini 做資料蒐集

外部資料（新聞、目標價、公開資訊）統一用 **FinMind API**（付費帳號，1600 req/hr）。Gemini 只做用戶盲點審查，不做資料蒐集。

### 評 severity 前必須 grep 驗 code

對 repo issue 打嚴重度（P0/P1/P2）之前，必須用 grep / read 看過真實 code。沒有 `file:line` 證據的評分 = 瞎猜，會誤導其他 LLM。

### seedData.js 不准放會過期的狀態

`seedData.js` 是 fallback 資料，只能放「固定不變的事實」（股票代碼、產業、策略類型）。**不准放 alert / todayEvent / reminder / deadline** 這類會隨時間失效的東西。

### AI 分析要主動補資料，不要等用戶

不期待用戶補齊缺失資料，AI 主動用 FinMind 找。Qwen 可以幫忙跑資料蒐集。遇到 timeout 要解（不是讓用戶等）。

### 完整指標紀律（技術分析類）

- **MACD**：必須同時算 DIF + Signal Line + Histogram 三件，只算 DIF 就判斷交叉 = 錯
- **籌碼分析**：必須同時查 flow（買賣超）和 stock（持股變動）FinMind dataset，交叉對照再結論
- **事件復盤**：事件到期後等 **3 天**讓市場消化才自動驗證

---

## 工作樹整潔守則

- **同主題檔案只能有一個權威版本**。重複 = 隨時會被 LLM 亂讀。
- **`.tmp/` 放討論過程、brief、consensus** — 不進 git（或只進 .tmp/handoff-\*.md）
- **memory/ 只放事實**（FinMind 額度、用戶決策紀錄）— **行為規則放這個 `claude.md`**
- **改到同一概念的多個檔案** → STOP，找根因，改一處
- **死檔案、舊備份** → 刪掉，不要留「怕以後要」

---

## Memory 與 CLAUDE.md 的分工

```
┌─────────────────────────────────────────────┐
│  claude.md  ← 行為規則（這個檔）             │
│  - 每次 session 自動載入                     │
│  - 違反會翻車的都寫在這                      │
├─────────────────────────────────────────────┤
│  memory/*.md  ← 事實紀錄                    │
│  - 要主動讀才有                             │
│  - 用戶偏好、project state、技術細節         │
│  - ❌ 絕對不放行為規則                       │
└─────────────────────────────────────────────┘
```

### 違規升級規則

- memory 裡某條規則**被違反 ≥ 1 次** → 下次更新時**升級到 `claude.md`**
- 確保下次 session 自動載入
- Session 結尾 review memory，找出該升級的規則

---

## 交接格式

Codex/Qwen 完成後回報：

```
done: [做了什麼]
changed files: [list]
risks: [有什麼可能壞的]
next best step: [你覺得下一步該做什麼]

我反駁 Claude 的地方：[至少 1 點]
```

---

## 多 LLM 協作用「Shared Doc Append 模式」（2026-04-16 確立）

**禁止每個 task 開新 brief 檔 + 各自 log 檔 → 30+ 個小檔案亂竄**。

**改用 round-based append**：

- 每個討論主題 = 一個 shared doc（例：`docs/product/portfolio-dashboard-spec.md`）
- 每個 agent 讀全檔（看前面 round）→ append 自己那 round 在後面
- **不刪別人段落**，只 append 自己的
- Round header 格式：`## Round N · Agent · YYYY-MM-DD HH:MM`

**好處**：

- 零 persistent session token（每次 Codex exec 還是一次性）
- 累積知識存 disk、可 grep / diff / version
- Claude / Codex / Qwen / Gemini 都用同一份文件對話
- 歷史審計清楚

**派工 brief 必寫**：

- 「讀 Round 1 後 append Round 2 在同檔」
- 「禁止開新檔、禁止改 Round 1 內容」
- 「用 Edit 或 `cat >>` append」

**範本**（`.tmp/<topic>/brief.md` 簡化成）：

```
讀 docs/<topic>.md 最後一個 `---` 之前的內容，
在 `_待填_` placeholder 寫你的 Round N（同意/反駁/補充）。
不另開新檔。
```

---

## 一些「先讀」（情境觸發）

- 接手進行中工作 → `docs/status/current-work.md`
- 碰 runtime 架構 → `coordination/llm-bus/runtime-execution-plan.md`
- 不確定知識庫狀態 → `docs/AI_COLLABORATION_GUIDE.md`
