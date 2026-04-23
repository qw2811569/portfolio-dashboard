#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_KEY="${GCE_SSH_KEY:-$HOME/.ssh/google_compute_engine}"
VM_HOST="${VM_HOST:-chenkuichen@35.236.155.62}"
CLAUDE_VM_AUTH_MODE="${CLAUDE_VM_AUTH_MODE:-auto}"
CLAUDE_VM_PERMISSION_MODE="${CLAUDE_VM_PERMISSION_MODE:-bypassPermissions}"

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/launch-preflight.sh"

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/ai-git-identity.sh"

show_help() {
  cat <<'EOF'
Usage:
  bash scripts/launch-claude-vm.sh "brief text"
  bash scripts/launch-claude-vm.sh path/to/brief.md
  cat path/to/brief.md | bash scripts/launch-claude-vm.sh

Environment:
  GCE_SSH_KEY           SSH private key path
  VM_HOST               SSH target, default chenkuichen@35.236.155.62
  CLAUDE_VM_AUTH_MODE   auto | claude-auth | api-key (default: auto)
  CLAUDE_VM_PERMISSION_MODE  Claude permission mode (default: bypassPermissions)
EOF
}

report_ai_start() {
  local message="$1"
  AI_NAME=Claude bash "$ROOT_DIR/scripts/ai-status.sh" start "$message" >/dev/null 2>&1 || true
}

read_brief() {
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    show_help
    exit 0
  fi

  if [[ "$#" -gt 0 ]]; then
    if [[ "$#" -eq 1 && -f "$1" && -r "$1" ]]; then
      cat "$1"
      return 0
    fi
    printf '%s' "$*"
    return 0
  fi

  if [[ ! -t 0 ]]; then
    cat
    return 0
  fi

  show_help >&2
  exit 1
}

launch_preflight_require_command ssh
launch_preflight_require_file "$SSH_KEY" "Set GCE_SSH_KEY to the VM SSH private key path."

BRIEF_TEXT="$(read_brief "$@")"
if [[ -z "${BRIEF_TEXT//[$'\t\r\n ']}" ]]; then
  echo "launch-claude-vm: brief is empty" >&2
  exit 1
fi
BRIEF_B64="$(printf '%s' "$BRIEF_TEXT" | base64 | tr -d '\n')"

report_ai_start "Claude VM dispatch：${BRIEF_TEXT:0:80}"

ssh \
  -i "$SSH_KEY" \
  "$VM_HOST" \
  bash -s -- "$CLAUDE_VM_AUTH_MODE" "$CLAUDE_VM_PERMISSION_MODE" "$BRIEF_B64" <<'EOF'
set -euo pipefail

auth_mode="${1:-auto}"
permission_mode="${2:-bypassPermissions}"
brief_b64="${3:-}"

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

has_claude_auth() {
  env -u ANTHROPIC_API_KEY claude auth status 2>/dev/null | grep -q '"loggedIn":[[:space:]]*true'
}

run_claude() {
  local auth_kind="$1"
  if [[ "$auth_kind" == "claude-auth" ]]; then
    printf '%s' "$brief_b64" | base64 -d | env -u ANTHROPIC_API_KEY claude --print --permission-mode "$permission_mode"
    return
  fi
  printf '%s' "$brief_b64" | base64 -d | claude --print --permission-mode "$permission_mode"
}

case "$auth_mode" in
  claude-auth)
    run_claude claude-auth
    ;;
  api-key)
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
      load_env_file "$HOME/.env"
    fi
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
      load_env_file "$HOME/.agent-bridge-runtime.env"
    fi
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
      echo "launch-claude-vm: ANTHROPIC_API_KEY missing on VM" >&2
      exit 1
    fi
    run_claude api-key
    ;;
  auto)
    if has_claude_auth; then
      run_claude claude-auth
      exit 0
    fi
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
      load_env_file "$HOME/.env"
    fi
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
      load_env_file "$HOME/.agent-bridge-runtime.env"
    fi
    if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
      run_claude api-key
      exit 0
    fi
    echo "launch-claude-vm: no usable Claude auth on VM" >&2
    exit 1
    ;;
  *)
    echo "launch-claude-vm: unsupported CLAUDE_VM_AUTH_MODE=$auth_mode" >&2
    exit 1
    ;;
esac
EOF
