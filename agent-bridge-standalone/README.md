# Agent Bridge Standalone

## HTTPS + Auth

Production should run behind Nginx with TLS termination and keep the Node server bound to loopback only.

### Runtime env

- `BRIDGE_HOST=127.0.0.1` — keeps the standalone server off the public interface
- `BRIDGE_PORT=9527`
- `WORKSPACE_ROOT=/home/chenkuichen/app`
- `BRIDGE_AUTH_TOKEN=<strong random token>` — prod write token, do not commit; inject via PM2 env only
- `BRIDGE_AUTH_TOKEN_PREVIEW=<strong random token>` — preview write token, distinct from prod

### Auth model

- Public read routes: `GET /`, `GET /api/health`, `GET /api/status`, `GET /api/project`
- Protected HTTP routes: all mutating routes including `POST /api/tasks`, `POST /api/tasks/sync`, `POST /api/local-status`, terminal send/create, and task action routes
- Protected WebSocket actions: connect is allowed for read-only live feed, but mutating WS messages require a valid prod or preview token

### Token tiers

- VM accepts both `BRIDGE_AUTH_TOKEN` and `BRIDGE_AUTH_TOKEN_PREVIEW`
- Vercel keeps using the same env name, `BRIDGE_AUTH_TOKEN`, but binds different values per target
- `production` should keep the prod token
- `preview` should use the preview token
- Current behavior is intentionally same-scope: both tokens can hit the same mutating routes until preview resources are isolated later
- Auth logs only record token class (`prod` or `preview`), never the secret value

HTTP callers should send:

```bash
Authorization: Bearer $BRIDGE_AUTH_TOKEN
```

`scripts/ai-status.sh` already supports this via `VM_STATUS_TOKEN`.

### Nginx shape

- `listen 80` → redirect to HTTPS
- `listen 443 ssl http2`
- `proxy_pass http://127.0.0.1:9527`
- pass `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`
- enable WebSocket upgrade for `/ws`

Because application auth now lives in `server.mjs`, Nginx only needs to handle TLS and proxying. This avoids duplicating bearer-token logic in two places.

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
   VM_STATUS_URL=https://<your-domain>/api/local-status
   VM_STATUS_TOKEN=<same BRIDGE_AUTH_TOKEN on the VM>
   ```
3. The `ai-status.sh` script will automatically push status updates. If the VM is unreachable, it silently fails — local status writing is unaffected.

### Setup (VM)

Restart the server with the runtime env loaded in PM2, for example:

```bash
BRIDGE_HOST=127.0.0.1 \
BRIDGE_PORT=9527 \
WORKSPACE_ROOT=/home/chenkuichen/app \
BRIDGE_AUTH_TOKEN=... \
BRIDGE_AUTH_TOKEN_PREVIEW=... \
pm2 restart agent-bridge --update-env
```

### API Reference

| Method | Path                | Description                                                                  |
| ------ | ------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/health`       | Lightweight health check for HTTPS / reverse-proxy verification              |
| POST   | `/api/local-status` | Receive Mac status update. Body: `{agent, status, message, timestamp, host}` |
| GET    | `/api/status`       | Returns server status + `localActivity` array (entries within 30 min)        |

### Notes

- **In-memory only**: Status is lost on VM restart. This is intentional — old status is stale anyway.
- **30-minute TTL**: Entries older than 30 min are filtered out of `/api/status`.
- **Silent fail**: If `VM_STATUS_URL` is not set or the VM is down, `ai-status.sh` continues normally.
