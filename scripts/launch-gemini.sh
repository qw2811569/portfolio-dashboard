#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/ai-git-identity.sh"

source "$(dirname "$0")/gemini-common.sh"
gemini_init_env

DEFAULT_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"

report_ai_start() {
  local message="$1"
  AI_NAME=Gemini bash "$ROOT_DIR/scripts/ai-status.sh" start "$message" >/dev/null 2>&1 || true
}

if [[ "${1:-}" != "--help" && "${1:-}" != "-h" && "${1:-}" != "--version" && "${1:-}" != "-v" ]]; then
  gemini_log_launch "interactive" "${DEFAULT_MODEL}" "general" "${PWD}"
  if [[ "$#" -gt 0 ]]; then
    report_ai_start "Gemini CLI 啟動：$*"
  else
    report_ai_start "Gemini CLI 啟動，等待任務輸入"
  fi
fi

if gemini_has_model_flag "$@"; then
  exec gemini "$@" </dev/null
fi

exec gemini -m "${DEFAULT_MODEL}" "$@" </dev/null
