#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

# 強制使用 Node 24，避免背景啟動時落到舊版 node / npx
NODE24_BIN="$HOME/.nvm/versions/node/v24.13.1/bin"
if [[ -d "$NODE24_BIN" ]]; then
  export PATH="$NODE24_BIN:$PATH"
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 24 > /dev/null 2>&1 || true

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

echo "Starting Vite frontend in background on ${PORT}..."
nohup bash -lc "export PATH='${NODE24_BIN}:$PATH'; cd '${REPO_ROOT}' && '${NODE24_BIN}/npx' vite --host ${LISTEN_HOST} --port ${PORT} --strictPort" \
  > .tmp/vercel-dev.log 2>&1 &
VDEV_PID=$!
echo "frontend pid: ${VDEV_PID}"

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
