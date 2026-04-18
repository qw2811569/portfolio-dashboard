#!/bin/bash
# Sync Claude's TodoWrite state to Agent Bridge dashboard
# Usage: bash scripts/sync-todos-to-bridge.sh "message string"
# Or with file: bash scripts/sync-todos-to-bridge.sh --file docs/status/todo-live.md
#
# Requires: .tmp/vercel-secrets/BRIDGE_INTERNAL_TOKEN.txt (provisioned by VM smoke test)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="${VM_STATUS_URL:-https://35.236.155.62.sslip.io/agent-bridge/api/local-status}"
TOKEN_FILE="${ROOT_DIR}/.tmp/vercel-secrets/BRIDGE_INTERNAL_TOKEN.txt"
TOKEN="${VM_STATUS_TOKEN:-$(cat "$TOKEN_FILE" 2>/dev/null | tr -d '\n')}"
AGENT="${AGENT:-Claude-Todos}"
STATUS="${STATUS:-progress}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: No token. Set VM_STATUS_TOKEN env or provision $TOKEN_FILE" >&2
  exit 1
fi

# Read message from file or argument
MESSAGE=""
if [[ "${1:-}" == "--file" && -n "${2:-}" ]]; then
  MESSAGE="$(cat "$2")"
elif [[ -n "${1:-}" ]]; then
  MESSAGE="$*"
else
  echo "Usage: $0 <message> OR $0 --file <path>" >&2
  exit 1
fi

# Truncate to 4KB (Bridge likely has body size limit)
MESSAGE_TRUNC="$(printf '%s' "$MESSAGE" | head -c 4000)"

# JSON escape via python
MESSAGE_JSON="$(printf '%s' "$MESSAGE_TRUNC" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')"

PAYLOAD=$(cat <<EOF
{"agent":"$AGENT","status":"$STATUS","message":$MESSAGE_JSON,"timestamp":$(date +%s000),"host":"$(hostname -s 2>/dev/null || echo mac)"}
EOF
)

HTTP=$(curl -sk -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$PAYLOAD" \
  --connect-timeout 5 --max-time 10 \
  -w '%{http_code}' \
  -o /tmp/bridge-sync-response.json 2>/dev/null || echo "000")

if [[ "$HTTP" == "200" ]]; then
  echo "✓ Synced to $URL ($HTTP)"
else
  echo "✗ Sync failed: HTTP $HTTP" >&2
  cat /tmp/bridge-sync-response.json 2>/dev/null >&2 || true
  echo "" >&2
  exit 1
fi
