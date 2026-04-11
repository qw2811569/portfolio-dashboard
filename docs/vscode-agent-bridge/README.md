# Agent Bridge — 手機遙控 VS Code AI Agents

從手機監控和操控 VS Code 裡的所有 AI coding agents。

現在已升級成「terminal bus + task board」的最小 dispatcher：

- session 層：看得到每個 agent terminal 的即時輸出
- task 層：讀 workspace 內的 machine-readable 任務檔，顯示目前該做什麼
- dispatch 層：可以把 task 一鍵派給對應 agent，而不是只手動輸入訊息
- verify 層：task 可以附上 completion evidence，避免一派工就被當成已完成
- consensus 層：major task 可要求顯式多 agent review，未過共識的依賴任務不能往下 dispatch

## 支援 Agents

| Agent             | 偵測方式                   | 快捷鍵                   |
| ----------------- | -------------------------- | ------------------------ |
| 🟠 Claude Code    | terminal name 含 `claude`  | /status, /compact, /cost |
| 🟢 Codex CLI      | terminal name 含 `codex`   | /status, yes/no          |
| 🔵 Qwen           | terminal name 含 `qwen`    | /help, clear             |
| 🔴 Gemini         | terminal name 含 `gemini`  | /help, /stats            |
| ⚪ GitHub Copilot | terminal name 含 `copilot` | —                        |

## 安裝

```bash
# 1. Clone & 安裝依賴
cd vscode-agent-bridge
npm install

# 2. 編譯 TypeScript
npm run compile

# 3. 打包成 .vsix
npm run package

# 4. 安裝到 VS Code
code --install-extension agent-bridge-0.1.0.vsix
```

## 使用

1. VS Code 啟動後自動開 server（預設 port 9527）
2. 手機瀏覽器打開 `http://<your-ip>:9527`
3. 如果用 Tailscale，就是 `http://<tailscale-ip>:9527`

### 設定

在 VS Code Settings 裡搜尋 `Agent Bridge`：

- `agentBridge.port` — 伺服器 port（預設 9527）
- `agentBridge.autoStart` — 是否自動啟動（預設 true）

### 指令

- `Agent Bridge: Start Server` — 啟動伺服器
- `Agent Bridge: Stop Server` — 停止伺服器
- `Agent Bridge: Show Connection QR Code` — 顯示連線資訊

## 架構

```
手機瀏覽器 ←── WebSocket ──→ VS Code Extension
                                  │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              Task Store     Session Router   Terminal Bus
                    │              │              │
                    └──────────────┼──────────────┘
                                   ▼
                             Claude / Codex / Qwen / Gemini
```

- Extension 監聽所有 VS Code terminal 的 output
- 根據 terminal name 自動辨識 agent 類型
- WebSocket 即時串流 terminal 輸出到手機
- 手機可以對任何 terminal 發送訊息
- Extension 也會讀 workspace 內的 `coordination/llm-bus/agent-bridge-tasks.json`
- 任務可以指定 owner / write scope / depends_on / dispatch prompt

## 任務來源

如果 workspace 有這個檔案：

`coordination/llm-bus/agent-bridge-tasks.json`

Agent Bridge 會在啟動時自動讀入，並把任務顯示到手機 dashboard 的 task board。

建議做法：

- `runtime-execution-plan.md` 保留人讀的高階計劃
- `agent-bridge-tasks.json` 保留機器讀的當前任務批次
- 大決定先寫進 `runtime-stabilization-brief.md`
- worker 類任務再透過 Agent Bridge 派給對應 session

## API

Dashboard 內建，也可以自己用 API：

```bash
# 取得所有 agent sessions
curl http://localhost:9527/api/sessions

# 發送訊息給 agent
curl -X POST http://localhost:9527/api/send \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"term_claude_123","text":"/status"}'

# 建立新 terminal
curl -X POST http://localhost:9527/api/terminal/create \
  -H 'Content-Type: application/json' \
  -d '{"name":"claude","command":"claude"}'

# 列出目前任務
curl http://localhost:9527/api/tasks

# 從 workspace task file 重新同步
curl -X POST http://localhost:9527/api/tasks/sync

# 建立或覆蓋一個任務
curl -X POST http://localhost:9527/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "id":"wave-4-startup-trace",
    "title":"Trace canonical startup loading path",
    "owner":"codex",
    "status":"pending",
    "summary":"Measure the long loading phase on the live AppShell runtime."
  }'

# 更新任務
curl -X PATCH http://localhost:9527/api/tasks/wave-4-startup-trace \
  -H 'Content-Type: application/json' \
  -d '{"status":"in_progress"}'

# 以 verify gate 完成任務
curl -X POST http://localhost:9527/api/tasks/wave-4-startup-trace/complete \
  -H 'Content-Type: application/json' \
  -d '{
    "evidence": {
      "changedFiles": ["src/hooks/usePortfolioBootstrap.js"],
      "verificationRuns": ["bun run lint", "bun scripts/ui-smoke.cjs"],
      "risksNoted": ["route shell parity still not complete"],
      "nextStep": "finish Wave 3 route-gap audit"
    }
  }'

# 寫入 major task 的 consensus review
curl -X POST http://localhost:9527/api/tasks/wave-5-consensus-gate/consensus \
  -H 'Content-Type: application/json' \
  -d '{
    "agentId":"claude",
    "decision":"approved",
    "summary":"Minimal gate shape is sound; generic PATCH should not bypass consensus."
  }'

# 派工給對應 agent
curl -X POST http://localhost:9527/api/tasks/wave-4-startup-trace/dispatch \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## Hard Gates（選用強制門檻）

預設行為是 **soft gate**：`verificationState` 只是 UI 指示，`PATCH /api/tasks/:id` 跟 `POST /api/tasks/:id/complete` 都可以把 task 直接標為 `completed`，dashboard 只用 `draft / 待共識 / 已驗證` 的 chip 提示，沒有硬阻擋。

設定環境變數 `AGENT_BRIDGE_HARD_GATES=1`（預設 `0`）後，兩條 gate 會變成**真正阻擋**完成轉換，完成路徑只剩下「evidence 齊全」且（如果 `requiresConsensus:true`）「consensus 已 approved」才會放行。

| Gate          | 何時擋                                                                                                     | HTTP  | 回應 shape                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------- |
| **Verify**    | `status="completed"` 轉換時 `evidence.{changedFiles, verificationRuns, risksNoted, nextStep}` 有任一個為空 | `400` | `{ok:false, error:"hard-gate: missing completion evidence", missing:[...]}`     |
| **Consensus** | `requiresConsensus:true` 但 `consensusState !== 'approved'`                                                | `409` | `{ok:false, error:"hard-gate: consensus not approved", reason:<current state>}` |

兩條 gate **共用同一個** env flag — opt-in 打開就兩條一起打開。PATCH 跟 `/complete` 兩條完成路徑都會跑同一個 validator，PATCH 不能繞過 `/complete`。

啟用後 `GET /api/status` 會回報：

```json
{
  "hardGates": { "enabled": true, "envVar": "AGENT_BRIDGE_HARD_GATES" }
}
```

### 緊急脫困

如果 hard gate 誤擋住 session 的正常流程，**關掉 env 變數後重啟 VS Code extension 即可**回到 soft gate 模式。沒有 per-request bypass 是**刻意**的設計：所有 override 都在 env 層級，操作有痕跡、不會偷偷解禁。

### Smoke check

```bash
node docs/vscode-agent-bridge/scripts/hard-gate-smoke.cjs
```

驗證 validator 的 pass/fail 判斷：空 evidence 該擋、完整 evidence 該過、consensus 未 approved 該擋、approved 該過。

## 任務資料模型（v1）

- `id`
- `title`
- `lane`
- `owner`
- `status`
- `priority`
- `dependsOn`
- `writeScope`
- `sourcePlanRef`
- `summary`
- `dispatchPrompt`
- `assignedSessionId`
- `lastDispatchedAt`
- `dispatchCount`
- `evidence.changedFiles`
- `evidence.verificationRuns`
- `evidence.risksNoted`
- `evidence.nextStep`
- `requiresConsensus`
- `consensusReviews[].agentId`
- `consensusReviews[].decision`
- `consensusReviews[].summary`
- `consensusReviews[].updatedAt`
- `completedAt`
- `consensusState`

v1 原則：

- 不把 terminal buffer 混進 task state
- 不假裝 `sendText()` 等於任務完成
- 不把 route shell / live runtime 的判斷藏在 prompt 裡，要寫回 task source file
- `/complete` 走 soft verify gate：需要 evidence，但一般 `PATCH` 仍保留 draft / override 彈性
- `AGENT_BRIDGE_HARD_GATES=1` 可把 verify gate + consensus gate 一起升級成 hard block（見上方「Hard Gates」章節）
- generic `PATCH` / `task:update` 不可直接改 `consensusState` 或 `consensusReviews`
- major task 用 `/consensus` 收 review，再由 dashboard 顯示 `待共識 / 共識退回 / 已驗證`
- 如果 dependency 任務仍在 `待共識`，下游 task 不可 dispatch

## 結合 Telegram（進階）

如果要接進你的 OpenClaw / Telegram bot：

```python
import requests

BRIDGE_URL = "http://<tailscale-ip>:9527"

# 列出 agents
sessions = requests.get(f"{BRIDGE_URL}/api/sessions").json()

# 發送指令
requests.post(f"{BRIDGE_URL}/api/send", json={
    "sessionId": sessions[0]["id"],
    "text": "/status"
})
```

## License

MIT
