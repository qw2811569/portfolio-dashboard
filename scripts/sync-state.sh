#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-}"

echo "🔄 同步 docs-site 狀態..."
echo "   真相來源：docs/status/current-work.md"

# Refresh cross-agent activity from local traces first, so docs-site can show
# non-manual AI progress even when peers didn't call ai-status directly.
python3 "$ROOT_DIR/scripts/refresh-ai-presence.py" --quiet --window-minutes "${AI_PRESENCE_WINDOW_MINUTES:-90}" || true

if [[ "$MODE" == "--full" ]]; then
  echo "   模式：full（重新檢查 build / lint / tests）"
  node "$ROOT_DIR/scripts/build-docs-state.mjs" --full
else
  echo "   模式：quick（只重建展示狀態，不重跑驗證）"
  node "$ROOT_DIR/scripts/build-docs-state.mjs"
fi

echo ""
echo "✅ 已更新 docs-site/state.json"
echo "🌐 docs site 重新整理後會自動讀取新狀態"
