# VM 付費資源利用分析 — 目前用到 20%，可榨出 80%

**作者**：Claude（架構人格）
**日期**：2026-04-16
**狀態**：草稿，等用戶定優先級

---

## 1. VM 現況

### 規格

- GCP e2-standard-4（4 vCPU / 16GB RAM / 100GB disk）
- 地點：`asia-east1-b`（彰濱，Taiwan nearby latency 5-10ms）
- IP：`35.236.155.62`
- Domain：`35.236.155.62.sslip.io`（HTTPS + Let's Encrypt）
- pm2 process manager + nginx reverse proxy

### 目前實際用到

- **Agent Bridge standalone server**（port 9527 → 443）
  - Task queue UI dashboard（LLM 協作面板）
  - WebSocket live feed
  - Consensus round 管理
  - 佔用：~200MB RAM、< 5% CPU

**利用率：~20%**。剩下 80% 閒置資源沒用。

---

## 2. VM vs Vercel — VM 擅長、Vercel 擋不住的事

| 能力                           | Vercel              | VM                                        |
| ------------------------------ | ------------------- | ----------------------------------------- |
| **單 function 時長**           | 300s max（Pro）     | 無限                                      |
| **重度 AI task（全組合研究）** | ❌ timeout          | ✅ 隨便跑                                 |
| **WebSocket / SSE**            | ⚠️ edge 弱          | ✅ 原生強                                 |
| **Cron 排程**                  | UTC 固定 / 冷啟動   | ✅ cron + systemd 隨意                    |
| **固定 IP**                    | 動態 serverless IP  | ✅ 固定 IP（scraping 友善、被 allowlist） |
| **本地 DB / vector DB**        | 外掛服務 ($$)       | ✅ SQLite / pg-vector / Qdrant 任何       |
| **LLM CLI runtime**            | ❌ 無法跑           | ✅ Codex / Qwen / Gemini CLI 可常駐       |
| **長期記憶 / stateful**        | cold start 每次清空 | ✅ in-memory 永久                         |
| **disk cache 大量檔案**        | Blob 有費           | ✅ 100GB 本地 disk                        |
| **即時 scraping job**          | 10s 上限            | ✅ 數分鐘 level job                       |

---

## 3. VM 對我們專案的 6 個「本來就該用 VM」的場景

### 🔥 #1 長時間 AI task（解鎖我們一直卡的事）

**痛點**：

- 全組合深度研究（11 檔 × Claude API）在 Vercel 會 timeout
- Gemini grounding 每檔要多次 web search，容易碰 Vercel maxDuration
- Phase 2 target price AI extract 跑 11 檔 + fallback chain 卡 timeout

**VM 解法**：cron 在 VM 上跑 node script，隨便跑 10 分鐘，寫完結果 PUT 回 Vercel Blob。Vercel 只負責 read。

### 🔥 #2 本地 SQLite / FinMind 快取

**痛點**：FinMind 1600 req/hr 付費額度，每次 dev / debug 都重打 = 浪費 quota

**VM 解法**：VM 跑 FinMind 每日全量同步到本地 SQLite（100GB disk 放得下幾十萬筆）。前端改讀 VM cache API，**FinMind quota 100% 省下來給新功能用**。

### 🔥 #3 LLM CLI on VM（infra-03 原計畫）

**痛點**：我們現在的 Codex / Qwen / Gemini dispatch 都在你 Mac 跑，Mac 關機就停。dispatch log 散落本機。

**VM 解法**：`infra-03` 原計畫就是這個 — VM 裝 CLI + OAuth token + agent-bridge 直接呼叫。24/7 可用，不依賴 Mac。

- VM 背景跑定時 AI 研究（每晚跑全組合 review）
- 你睡覺時 AI 幫你做功課，早上起來看結果

### 🔥 #4 CMoney / 新聞 / 爬蟲 job runner

**痛點**：

- CMoney feed parse 需要頻繁 fetch（Vercel cron 會 timeout + IP rotate 被 block）
- 大量 HTML parse CPU 重

**VM 解法**：

- VM 固定 IP（CMoney 認得、不會當 DDoS 擋）
- 跑 `scrapy` / `playwright` 重量級爬蟲工具
- 結果寫 Blob 供前端讀

### 🔥 #5 Vector DB 做語意搜尋

**痛點**：持股新聞、研究報告堆了上百篇，要找「3491 類似案例」只能 keyword grep

**VM 解法**：裝 pg-vector（或 Qdrant），把歷史 research artifacts 算 embedding，做：

- 找相似持股歷史（「以前 AI 伺服器股在類似情境漲幅如何」）
- 找相關新聞聚類
- RAG 加強 daily analysis 品質

### 🔥 #6 Always-on WebSocket / SSE

**痛點**：Vercel edge function 跑 WebSocket 不穩，disconnect 頻繁

**VM 解法**：Agent Bridge 已經在跑，**持倉看板也可以接 VM WebSocket** 做：

- 盤中股價 push（TWSE 每 5 秒更新 → VM → 前端）
- 重大事件 push（不用輪詢）
- Multi-LLM consensus round 即時狀態

---

## 4. 相對應的「VM 不擅長」也要說

| 事項                     | 為什麼還是該 Vercel                           |
| ------------------------ | --------------------------------------------- |
| 前端 static asset        | Vercel CDN 快過 VM nginx                      |
| 用戶認證                 | Vercel middleware 成熟                        |
| 公開 API（低流量短任務） | Vercel cold start 夠快、免維運                |
| 零運維期待的服務         | VM 要 patch / monitor，Vercel serverless 不用 |

所以**不是全搬 VM**，是**把 Vercel 擋不住的搬 VM**。

---

## 5. 優先級建議（依用戶當前痛點）

### P0（直接解當前問題）

1. **VM 跑 Phase 2/3 target-price pipeline** — cron 在 VM，Vercel 只讀
   - 解決 Vercel cron 60s 限制
   - 解決 Gemini grounding quota 超載（VM 可分批跑）
   - 估時：4-6 hours
2. **VM 裝 Codex/Qwen/Gemini CLI** — infra-03 任務，20% 利用率直接翻倍
   - 估時：1 day（帳號授權 + systemd service）

### P1（幾天內高 ROI）

3. **FinMind 本地 SQLite cache** — 省 quota、dev 秒級快、打開新功能空間
   - 估時：1 day（cron sync + VM API 包裝）
4. **深度研究 job 搬 VM** — 解開 timeout 枷鎖
   - 估時：半天（既有 code 搬 pm2 process）

### P2（1-2 週）

5. **Vector DB + RAG** — 研究品質提升
   - 裝 pg-vector 或 Qdrant
   - Embedding script（OpenAI ada / local bge）
   - 估時：2-3 days
6. **盤中即時推送（WebSocket）** — 看盤體驗提升
   - TWSE quote → VM → 前端 SSE
   - 估時：1-2 days

### P3（有空再做）

7. 自動每晚 AI 研究 cron
8. 自動 CMoney / 新聞每 15 分鐘抓

---

## 6. 跟 infra-01 的關係（重新定位）

之前討論的 infra-01「知識庫搬哪？」— 共識是 Vercel Blob（不是 VM）。**這還是對的**：

- 知識庫是「小 JSON 檔 + CDN read-heavy」→ Blob 最優
- **VM 是「長時間 compute + stateful service」** → 不同用途

**兩者不衝突**：infra-01 的 Blob + VM 的 long-running job + Vercel 的 static/API 層 = 三層架構。

---

## 7. 用戶你拍板

1. **P0 做哪個先？**（我推 target-price pipeline 搬 VM — 直接解目前痛）
2. **infra-03 CLI on VM 你授權哪幾家？**（Codex OAuth 要你帳號、Gemini 已有 key）
3. **FinMind 本地 cache 想做嗎？**（省 quota 直接、但多一層 sync 風險）
4. **Vector DB 想做嗎？**（研究品質加分但工時長）

同時：CMoney feasibility Codex 剛回來（`bcq2dzjn5`），下個回合整合這份 VM 建議 + CMoney 結果，可能直接派 VM target-price 實作。
