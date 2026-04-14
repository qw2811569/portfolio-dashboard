#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

exec codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check "$@"
