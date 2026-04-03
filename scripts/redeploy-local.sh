#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

PORT="3002"
LISTEN_HOST="0.0.0.0"
LOCAL_URL="http://127.0.0.1:${PORT}"
TAILSCALE_IP="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
TAILSCALE_DNS="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys; data=json.load(sys.stdin); print((data.get("Self",{}).get("DNSName","") or "").rstrip("."))' 2>/dev/null || true)"

npm run build

PIDS="$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${PIDS}" ]]; then
  echo "Stopping existing port ${PORT} listener(s):"
  printf '%s\n' "${PIDS}"
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] || continue
    kill "${pid}" || true
  done <<< "${PIDS}"
  sleep 2
fi

mkdir -p .tmp

COMMAND="cd ${REPO_ROOT} && npx vercel dev --listen ${LISTEN_HOST}:${PORT} | tee .tmp/vercel-dev.log"
echo "Starting vercel dev in a new Terminal window..."
osascript <<OSA
tell application "Terminal"
  activate
  do script "${COMMAND}"
end tell
OSA

echo "Waiting for server to be ready..."
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "%{http_code}" "${LOCAL_URL}" | grep -q "200"; then
    echo "Server is ready."
    echo "Local URL : ${LOCAL_URL}"
    if [[ -n "${TAILSCALE_DNS}" ]]; then
      echo "Remote URL: http://${TAILSCALE_DNS}:${PORT}"
    fi
    if [[ -n "${TAILSCALE_IP}" ]]; then
      echo "Remote IP : http://${TAILSCALE_IP}:${PORT}"
    fi
    exit 0
  fi
  sleep 1
done

echo "Failed to start server within 15 seconds"
echo "Check .tmp/vercel-dev.log for details."
exit 1
