# infra-03 — VM 端 LLM orchestrator（真正的自動化，省 Claude token）

**派給**：Codex
**日期**：2026-04-16
**用戶目標**：

> 「活用 vm 看能不能讓你們正在派工與完成的進度都使用 vm 讓你們省去 token 成本，使其自動化」

**關鍵**：從「Mac 端 spawn + 回傳 log 到 Claude」→ 改「VM 端 spawn + WebSocket 只推最終結果」

## 現況 vs 目標

### 現況（Mac-centric，token 貴）

```
Claude(Mac) 寫 brief → Mac bash launch-codex.sh → log 回 Mac →
  Claude 讀完整 log（大量 token）→ Claude 決策 → 再派
```

每個 dispatch 回合 Claude 吃 log 吃到飽，上下文爆炸、token 成本高。

### 目標（VM-centric，token 省）

```
Claude(Mac) 寫 brief file 或 summary →
  POST VM /api/workers/dispatch {agent, briefPath, callback} →
  VM spawn Codex/Qwen/Gemini CLI（VM 端有 OAuth/API key）→
  VM 收 log、寫 Blob、push WebSocket →
  Agent Bridge live 顯示進度 →
  只有「task done + 重點結論」回 Claude（小 payload）
```

Claude 只需看 3 個欄位：`done / verdict / next_step`，不讀整份 log。

## Architecture

### VM 端新增

`agent-bridge-standalone/workers/llm-dispatcher.mjs`：

- HTTPS endpoint `POST /api/workers/dispatch`
  - Body: `{agent: 'codex'|'qwen'|'gemini', brief: string, taskId: string, callback?: string}`
  - Auth: BRIDGE_AUTH_TOKEN
  - spawn VM 上的 CLI (`codex exec`, `qwen -y -p`, `gemini -p`)
  - Stream log → WebSocket broadcast → Agent Bridge 顯示
  - 收尾寫 Blob `llm-dispatches/<taskId>.json`
  - 發 callback POST `{taskId, done, summary}` 回 Mac（精簡）

### VM 端裝 CLI（infra-03 原定）

- `codex-cli` 0.118.0（已在 Mac，要在 VM 重裝）
- `qwen-code` + OAuth（VM 上 `qwen auth`）
- `gemini-cli` + GEMINI_API_KEY（VM env）

Secrets 存 VM `/etc/agent-bridge/secrets.env`（root-only），pm2 load 時帶環境。

### Mac 端瘦身

修改 `scripts/launch-codex.sh` 等：

- 新增 mode：`--remote-vm`（或預設）
- 走 HTTPS POST 到 VM，不 spawn 本機 process
- 等 callback 或 WebSocket event

保留 local fallback：`--local` flag 才跑本機（除錯 / VM down 時 degrade）

### Claude 端的壓縮 summary

VM 完成後打 callback：

```json
{
  "taskId": "...",
  "agent": "codex",
  "done": true,
  "verdict": "shipped|blocked|failed",
  "summary_250words": "...",
  "changed_files": ["..."],
  "commit_hash": "...",
  "blob_key": "llm-dispatches/xxx.json", // 完整 log 在這
  "duration_sec": 120
}
```

Claude 只要讀 250 字 summary + 5 個欄位，節省 ~95% token（相比現在讀 3000 行 log）。

## 實作範圍

### Phase A (本 round，1-1.5 天)

1. `agent-bridge-standalone/workers/llm-dispatcher.mjs` — HTTPS endpoint + spawn + stream
2. `scripts/launch-codex.sh`（等）加 `--remote-vm` mode
3. `agent-bridge-standalone/server.mjs` 加 `/api/workers/dispatch` route
4. Agent Bridge dashboard UI 顯示 VM spawn log（WebSocket live）
5. VM 安裝 CLI（**需用戶 OAuth 登入**，Codex 做不了 OAuth，需要用戶）
6. 寫到 Vercel Blob `llm-dispatches/<taskId>.json`
7. 加 fallback：`--local` mode 沿用現有 Mac spawn

### Phase B（後續）

- Callback webhook 到 Claude（Claude 需要 inbox endpoint）
- Claude agent 每輪問 Agent Bridge API 拿 summary
- 自動 retry / rate-limit handling

## 前提（務必讀）

1. **此任務排隊在 `br7x7bmhp` Agent Bridge 優化之後**（避免 server.mjs race）
2. **VM 安裝 Codex CLI 需用戶 OAuth 登入** — Codex 做完 infra 側，會 flag 「等用戶 ssh VM 跑 `codex login`」
3. Qwen CLI OAuth 同上
4. Gemini 已有 API key（之前加到 Vercel env 了，VM 也放一份）
5. 這**會改 launch-\*.sh**（Mac dispatch 層），小心不要 revert 之前的 `-y` flag fix (commit 9f6fccf)

## 回報

```
done:
changed files:
vm deploy: commit + pm2 restart + CLI install status
手動 OAuth steps remaining:（如有，列給用戶）
token cost 估算: Mac-spawn $/round vs VM-spawn $/round
我反駁 Claude 的地方:
```

## 不做

- ❌ 不在本 round 寫完 Claude inbox / auto-callback loop（Phase B）
- ❌ 不 revert launch-\*.sh 已有 fix
- ❌ 不 `--no-verify`
- ❌ 本 round 不跑完 5 個 agent 的 E2E 測試（只跑 codex 一個證明架構 work）

## 反駁 Claude

- 如果「Mac launch-\*.sh 改走 HTTPS」你覺得太痛（要變太多環境變數），建議另做 `launch-remote.sh` 獨立腳本
- 如果 VM 上 CLI OAuth token 存法有安全疑慮，建議替代
- 如果 WebSocket push log 會讓 Agent Bridge 頁面卡（大量 stdout），建議 batch / throttle
