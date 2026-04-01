# 收盤分析 Streaming 設計草案

最後更新：2026-04-02
狀態：設計規格（待實作）
作者：Codex

---

## 1. 背景

production `/api/analyze` 曾以真實 20 檔持股 payload 測到 `60.21s`，已貼近目前 [`vercel.json`](/Users/chenkuichen/app/test/vercel.json) 對 `api/analyze.js` 設定的 `maxDuration: 60`。P0 已先靠 prompt 瘦身把風險壓低，但持股數、事件密度、策略大腦上下文一旦再長，latency 仍可能回到邊界。

這份文件的目的不是立刻改寫，而是定義一條可漸進上線的 streaming 路線，讓：

- 使用者先看到增量輸出，而不是整包等完
- 分析流程拆成「先有文字、後有結構化附錄」
- 即使總生成時間仍長，perceived latency 也能明顯下降

---

## 2. 目標與非目標

### 目標

1. `/api/analyze` 改成支援增量輸出
2. 前端 `useDailyAnalysisWorkflow.js` 可邊收邊渲染分析正文
3. `EVENT_ASSESSMENTS` / `BRAIN_UPDATE` 仍保留結構化可解析結果
4. 與現有 `dailyReport` / `analysisHistory` / `strategyBrain` 相容

### 非目標

1. 這一輪不改 `/api/research`
2. 這一輪不重寫整個 AI provider 抽象
3. 這一輪不追求 token 級 ultra-fine streaming UI，只要 paragraph / text chunk 級即可

---

## 3. 現況瓶頸

### 3.1 後端

- [`api/analyze.js`](/Users/chenkuichen/app/test/api/analyze.js) 目前是一次呼叫 `callAiRaw()`，等模型完整回覆後才 `res.status(200).json(data)`
- [`api/_lib/ai-provider.js`](/Users/chenkuichen/app/test/api/_lib/ai-provider.js) 目前只包 non-streaming `Messages API`
- 這代表 server 端第一個 byte 要等整段內容完成才送出

### 3.2 前端

- [`useDailyAnalysisWorkflow.js`](/Users/chenkuichen/app/test/src/hooks/useDailyAnalysisWorkflow.js) 目前假設 `/api/analyze` 一次回傳完整 JSON
- `aiInsight`、`eventAssessments`、`brainAudit` 都在 response 完整後才落地

### 3.3 使用者體感

- 即使最終不 timeout，使用者仍會卡在 loading 近 1 分鐘
- 這種等待方式無法區分「模型還活著」和「請求快失敗」

---

## 4. Runtime 選項比較

## 4.1 繼續用 Node.js Serverless + streaming

優點：

- 與目前 `api/*.js` 架構最相容
- 可直接延用現有 `api/_lib/ai-provider.js`
- Vercel 官方目前也明確建議 Edge 使用情境優先評估遷回 Node.js，以獲得較佳效能與穩定性

缺點：

- 仍受 function duration 限制；streaming 改善的是體感，不是無限延長 runtime
- 如果模型很晚才吐第一段 token，first byte 仍可能偏慢

## 4.2 Edge Runtime + ReadableStream

優點：

- Web Stream API 原生一致，實作 SSE/streaming response 很順
- 對全球分佈使用者 first-byte latency 可能更好

缺點：

- 目前 Vercel 官方文件已註明較推薦 Node.js runtime
- Edge 只能用 Web APIs；若之後 AI provider / helper 帶入 Node-only 套件，遷移成本會變高
- 我們現有 bare `api/*.js` handler 需要改成 Edge 可接受的 request/response 風格

## 4.3 建議

**首選：Node.js streaming-first。**

雖然最初任務假設是「ReadableStream + Edge Function」，但以目前 repo 架構與 Vercel 最新建議來看，較穩的方案是：

1. 先在 Node runtime 做 streaming `/api/analyze`
2. 若之後發現首 byte latency 仍過高，再開第二階段評估 Edge 版本

這樣能先解決 80% 的使用者體感問題，同時保留最小改動面。

---

## 5. API 契約提案

新增 `/api/analyze?stream=1`，保留舊的 non-streaming JSON 路徑，讓前端可漸進切換。

### 5.1 Response 格式

使用 `text/event-stream`，事件類型如下：

1. `meta`
   - 模型、日期、requestId、模式（daily_close / blind_prediction）
2. `delta`
   - 增量文字內容
3. `section`
   - 解析到特定段落時發送，例如 `summary`、`stocks`、`risks`
4. `json_block`
   - 當串流中偵測到 `EVENT_ASSESSMENTS` 或 `BRAIN_UPDATE` 的 fenced JSON 區塊時送出
5. `done`
   - 完整結束，附總 token / elapsedMs
6. `error`
   - 中途失敗

### 5.2 相容策略

- `stream !== 1` 時維持現況：回完整 JSON
- `stream === 1` 時回 SSE
- 前端先做 capability detect；若失敗自動 fallback 到舊模式

---

## 6. 後端設計

### 6.1 AI provider 層

在 [`api/_lib/ai-provider.js`](/Users/chenkuichen/app/test/api/_lib/ai-provider.js) 新增：

- `callAiRawStream({ system, messages, maxTokens, allowThinking })`

Anthropic Messages API 已支援 `stream: true`，可用 SSE 逐步接收事件。provider 層只需要做兩件事：

1. 轉發上游 SSE
2. 把 `content_block_delta` 累積成 text chunk，供 `/api/analyze` 對外輸出

### 6.2 `/api/analyze` handler

新增 streaming 分支：

1. 驗證 request body
2. `Content-Type: text/event-stream`
3. 先發 `meta`
4. 呼叫 `callAiRawStream()`
5. 每收到文字 delta 就轉成 SSE `delta`
6. 本地累積完整文字，結尾再做：
   - `extractAiText`
   - `extractEventAssessments`
   - `extractBrainUpdate`
7. 發送 `json_block` 與 `done`

### 6.3 結構化 JSON 保留方式

不要要求模型先輸正文、再另開第二請求補 JSON。這會增加成本與不一致風險。

建議保留目前 prompt 契約，但在 server 端做「雙軌累積」：

- UI 先顯示 streaming 正文
- 後端同時累積全文
- 全文完成後再從完整字串解析 `EVENT_ASSESSMENTS` / `BRAIN_UPDATE`

這樣可同時兼顧體感與既有資料結構。

---

## 7. 前端設計

### 7.1 `useDailyAnalysisWorkflow.js`

新增一條 streaming 路徑：

1. 組 prompt 的邏輯維持不變
2. 發送 `fetch('/api/analyze?stream=1', { method: 'POST', body })`
3. 透過 `response.body.getReader()` + `TextDecoder` 讀取 SSE chunk
4. 維護三段狀態：
   - `streamingText`
   - `streamingMeta`
   - `streamingJsonBlocks`
5. loading UI 改成：
   - `準備 prompt`
   - `模型開始輸出`
   - `整理事件 / 大腦附錄`

### 7.2 狀態落地

- `aiInsight`：在 `done` 前可先顯示 `streamingText`
- `eventAssessments` / `brainAudit`：收到 `json_block` 或 `done` 後才正式寫入
- 若 stream 中斷：
  - 保留已收到的 partial text
  - 標記 `aiError = 'stream_interrupted'`
  - 不更新 `brainAudit`

### 7.3 UI 呈現

Daily panel 增加三個細節：

1. 文字游標／「模型輸出中」狀態
2. 若 `EVENT_ASSESSMENTS` 尚未完成，顯示「事件附錄整理中」
3. 若 stream 中斷，提供「從目前輸出儲存為草稿」或「重跑」

---

## 8. 預估效益

### 8.1 Perceived latency

以目前 `60.21s` case 估算：

- 現況：使用者約在 `55-60s` 才看到第一個字
- streaming 後：
  - 理想情況：`3-8s` 內看到第一段正文
  - 保守情況：`8-15s` 內看到第一段正文

即使總完成時間仍在 `35-55s`，體感會從「整段卡死」改成「已開始分析，正在補完整內容」。

### 8.2 Timeout 風險

- streaming **不會**自動消除 runtime 上限
- 若單次生成仍常逼近 duration，仍要持續做 prompt budget
- 若未來持股數增加到 30+ 檔，仍建議把 `/api/analyze` 分成：
  - 主正文請求
  - 結構化 appendix 請求

---

## 9. 分階段落地計畫

### Phase 1：最低風險版

- 保留 Node.js runtime
- `api/_lib/ai-provider.js` 新增 streaming wrapper
- `/api/analyze?stream=1` 支援 SSE
- 前端 daily workflow 可讀 SSE

### Phase 2：穩定性補強

- 加入 abort / retry / partial draft 儲存
- 對 `EVENT_ASSESSMENTS` / `BRAIN_UPDATE` 加 parse telemetry
- 量測 first chunk latency / total latency / parse failure rate

### Phase 3：是否需要 Edge 的決策點

只有在以下條件成立時才值得評估 Edge：

1. Node streaming 已上線，但 first chunk latency 仍 > 15s
2. 問題確認是 runtime 啟動或區域 RTT，而不是模型本身慢
3. provider 層仍能只靠 Web APIs 實作，沒有 Node 相依

---

## 10. 風險

1. 串流中若模型輸出 markdown fenced JSON 半途被截斷，parse 會失敗
2. 前端若只拿到 partial text，可能讓使用者誤以為整份報告已完成
3. streaming 會讓 observability 複雜化，需要額外記錄 firstChunkAt / doneAt / abortReason
4. 若後續仍把 prompt 疊太大，streaming 只會掩蓋體感，不會真正解決成本與 duration

---

## 11. 建議結論

1. **短期**：繼續做 prompt budget，避免 total latency 再回到 60s 紅線
2. **中期**：以 Node.js runtime 先實作 `/api/analyze?stream=1`
3. **長期**：若 Node streaming 已證明不足，再評估 Edge 版本

換句話說，streaming 應該被視為「使用者體感加速器」，不是取代 prompt 瘦身的萬靈丹。

---

## 12. 參考資料

- Vercel: Configuring Maximum Duration for Vercel Functions
  - https://vercel.com/docs/functions/configuring-functions/duration
- Vercel: Edge Runtime
  - https://vercel.com/docs/functions/runtimes/edge
- Vercel: What is streaming?
  - https://vercel.com/kb/guide/what-is-streaming
- Anthropic: Messages API / streaming
  - https://docs.anthropic.com/en/api/messages
  - https://docs.anthropic.com/en/api/streaming
