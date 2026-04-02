#!/usr/bin/env bash
# 推送 LLM 交接報告到 Telegram
# 用法：bash scripts/notify-handoff.sh "Codex 完成修復"
# 需要環境變數：TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:$PATH"

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-692135484}"

if [[ -z "$BOT_TOKEN" ]]; then
  echo "[notify] ⚠️ 缺少 TELEGRAM_BOT_TOKEN 環境變數，跳過通知"
  exit 0
fi

if [[ "${1:-}" != "" ]]; then
  MESSAGE="$*"
else
  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  LATEST=$(grep -m1 "^- " "$ROOT_DIR/docs/status/current-work.md" | sed 's/^- //' | head -c 500)
  MESSAGE="最新交接：${LATEST:-無最新 checkpoint}"
fi

curl -s "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "text=${MESSAGE}" > /dev/null 2>&1 && echo "[notify] ✅ 已推送到 Telegram" || echo "[notify] ⚠️ 推送失敗"
