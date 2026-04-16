#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_DEFAULT="${AGENT_BRIDGE_REMOTE_DEFAULT:-0}"
USE_REMOTE=0

if [[ "$REMOTE_DEFAULT" == "1" ]]; then
  USE_REMOTE=1
fi

FORWARDED_ARGS=()
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --remote-vm)
      USE_REMOTE=1
      shift
      ;;
    --local)
      USE_REMOTE=0
      shift
      ;;
    *)
      FORWARDED_ARGS+=("$1")
      shift
      ;;
  esac
done
set -- "${FORWARDED_ARGS[@]}"

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
  if [[ "$USE_REMOTE" == "1" ]]; then
    report_ai_start "Gemini VM dispatch：$*"
    exec bash "$ROOT_DIR/scripts/bridge-remote-dispatch.sh" --agent gemini "$@"
  fi

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
