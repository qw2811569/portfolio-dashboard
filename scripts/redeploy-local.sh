#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

npm run build

PIDS="$(pgrep -f "vercel dev --listen 127.0.0.1:3002" || true)"
if [[ -n "${PIDS}" ]]; then
  echo "Stopping existing vercel dev process(es):"
  printf '%s\n' "${PIDS}"
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] || continue
    kill "${pid}" || true
  done <<< "${PIDS}"
  sleep 2
fi

mkdir -p .tmp

COMMAND="cd ${REPO_ROOT} && vercel dev --listen 127.0.0.1:3002 | tee .tmp/vercel-dev.log"
echo "Starting vercel dev in a new Terminal window..."
osascript <<OSA
tell application "Terminal"
  activate
  do script "${COMMAND}"
end tell
OSA

echo "Waiting for server to be ready..."
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002 | grep -q "200"; then
    echo "Server is ready at http://127.0.0.1:3002"
    exit 0
  fi
  sleep 1
done

echo "Failed to start server within 15 seconds"
echo "Check .tmp/vercel-dev.log for details."
exit 1
