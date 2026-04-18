#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_DEFAULT="${AGENT_BRIDGE_REMOTE_DEFAULT:-0}"
USE_REMOTE=0

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/launch-preflight.sh"

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

report_ai_start() {
  local message="$1"
  AI_NAME=Codex bash "$ROOT_DIR/scripts/ai-status.sh" start "$message" >/dev/null 2>&1 || true
}

NVM_DIR="${HOME}/.nvm"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${NVM_DIR}/nvm.sh"
  if node_bin="$(nvm which current 2>/dev/null)" && [[ -n "${node_bin}" && -x "${node_bin}" ]]; then
    PATH="$(dirname "${node_bin}"):${PATH}"
    export PATH
  fi
fi

if [[ "${1:-}" != "--help" && "${1:-}" != "-h" && "${1:-}" != "--version" && "${1:-}" != "-v" ]]; then
  if [[ "$USE_REMOTE" == "1" ]]; then
    launch_preflight_require_command curl
    launch_preflight_require_command node
    launch_preflight_require_env AGENT_BRIDGE_REMOTE_URL "Set the VM bridge base URL before using --remote-vm."
    launch_preflight_require_env AGENT_BRIDGE_REMOTE_TOKEN "Set the VM bridge bearer token before using --remote-vm."
    report_ai_start "Codex VM dispatch：$*"
    exec bash "$ROOT_DIR/scripts/bridge-remote-dispatch.sh" --agent codex "$@"
  fi

  launch_preflight_require_command codex

  if [[ "$#" -eq 1 && -f "$1" && -r "$1" ]]; then
    report_ai_start "Codex CLI 啟動：brief 檔 $1"
    exec codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check - < "$1"
  fi

  if [[ "$#" -gt 0 ]]; then
    report_ai_start "Codex CLI 啟動：$*"
  else
    report_ai_start "Codex CLI 啟動，等待任務輸入"
  fi
fi

launch_preflight_require_command codex
exec codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check "$@"
