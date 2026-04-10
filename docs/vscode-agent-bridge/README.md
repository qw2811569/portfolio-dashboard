# Agent Bridge — 手機遙控 VS Code AI Agents

從手機監控和操控 VS Code 裡的所有 AI coding agents。

現在已升級成「terminal bus + task board」的最小 dispatcher：

- session 層：看得到每個 agent terminal 的即時輸出
- task 層：讀 workspace 內的 machine-readable 任務檔，顯示目前該做什麼
- dispatch 層：可以把 task 一鍵派給對應 agent，而不是只手動輸入訊息
- verify 層：task 可以附上 completion evidence，避免一派工就被當成已完成

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

# 派工給對應 agent
curl -X POST http://localhost:9527/api/tasks/wave-4-startup-trace/dispatch \
  -H 'Content-Type: application/json' \
  -d '{}'
```

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
- `completedAt`
- `consensusState`

v1 原則：

- 不把 terminal buffer 混進 task state
- 不假裝 `sendText()` 等於任務完成
- 不把 route shell / live runtime 的判斷藏在 prompt 裡，要寫回 task source file
- `/complete` 走 soft verify gate：需要 evidence，但一般 `PATCH` 仍保留 draft / override 彈性

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
