# Agent Bridge Standalone

## Mac ↔ VM Status Sync

The Dashboard now shows both **VM sessions** (child processes spawned on the VM) and **Mac local activity** (what LLMs are doing on your Mac via `ai-status.sh`).

### How it works

1. **Mac** — Every time `scripts/ai-status.sh` is called (start/progress/done), it POSTs to the VM's `/api/local-status` endpoint.
2. **VM** — Stores the latest status per agent in an in-memory Map. The `/api/status` GET endpoint merges VM sessions + Mac activity.
3. **Dashboard** — Fetches `/api/status` every 60s and renders a "💻 Mac 本地活動" section if there's recent activity (within 30 min).

### Setup (Mac)

1. Copy `.env.local.example` to `.env.local` in the project root:
   ```bash
   cp .env.local.example .env.local
   ```
2. Uncomment and set `VM_STATUS_URL` to your VM's address:
   ```
   VM_STATUS_URL=http://35.236.155.62:9527/api/local-status
   ```
3. The `ai-status.sh` script will automatically push status updates. If the VM is unreachable, it silently fails — local status writing is unaffected.

### Setup (VM)

No extra setup needed. The server already has the `/api/local-status` POST and updated `/api/status` GET endpoints. Just restart the server (`pm2 restart agent-bridge` or `node server.mjs`).

### API Reference

| Method | Path                | Description                                                                  |
| ------ | ------------------- | ---------------------------------------------------------------------------- |
| POST   | `/api/local-status` | Receive Mac status update. Body: `{agent, status, message, timestamp, host}` |
| GET    | `/api/status`       | Returns server status + `localActivity` array (entries within 30 min)        |

### Notes

- **In-memory only**: Status is lost on VM restart. This is intentional — old status is stale anyway.
- **30-minute TTL**: Entries older than 30 min are filtered out of `/api/status`.
- **Silent fail**: If `VM_STATUS_URL` is not set or the VM is down, `ai-status.sh` continues normally.
