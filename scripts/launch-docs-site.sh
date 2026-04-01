#!/bin/bash

# 文檔網站啟動腳本
# 使用 Python 內建伺服器啟動本地文檔網站

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_SITE_DIR="$ROOT_DIR/docs-site"

presence_loop() {
  local window_minutes="${AI_PRESENCE_WINDOW_MINUTES:-90}"
  while true; do
    python3 "$ROOT_DIR/scripts/refresh-ai-presence.py" --quiet --window-minutes "$window_minutes" >/dev/null 2>&1 || true
    sleep 10
  done
}

echo "🚀 啟動文檔網站..."
echo ""
echo "📂 目錄：$DOCS_SITE_DIR"
echo "🌐 網址：http://localhost:8080"
echo ""
echo "按 Ctrl+C 停止伺服器"
echo ""

presence_loop &
PRESENCE_PID=$!

cleanup() {
  if [[ -n "${PRESENCE_PID:-}" ]]; then
    kill "$PRESENCE_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

cd "$DOCS_SITE_DIR" && python3 -m http.server 8080
