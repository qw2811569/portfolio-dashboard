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

report_ai_start() {
  local message="$1"
  AI_NAME=Qwen bash "$ROOT_DIR/scripts/ai-status.sh" start "$message" >/dev/null 2>&1 || true
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

ensure_ollama_ready() {
  if ! command -v ollama >/dev/null 2>&1; then
    cat >&2 <<'EOF'
launch-qwen: ollama not found in PATH.
Install it manually first:
  brew install ollama
EOF
    return 1
  fi

  export OLLAMA_DUMMY_KEY="${OLLAMA_DUMMY_KEY:-ollama}"

  if curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
    return 0
  fi

  ollama serve >/tmp/ollama-serve.log 2>&1 &
  local ollama_pid=$!

  for _ in {1..20}; do
    if curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
      disown "${ollama_pid}" 2>/dev/null || true
      return 0
    fi
    sleep 1
  done

  cat >&2 <<'EOF'
launch-qwen: ollama serve did not become ready on localhost:11434.
Check /tmp/ollama-serve.log for details.
EOF
  return 1
}

if [[ "${1:-}" != "--help" && "${1:-}" != "-h" && "${1:-}" != "--version" && "${1:-}" != "-v" ]]; then
  if [[ "$USE_REMOTE" == "1" ]]; then
    report_ai_start "Qwen VM dispatch：$*"
    exec bash "$ROOT_DIR/scripts/bridge-remote-dispatch.sh" --agent qwen "$@"
  fi

  ensure_ollama_ready

  if [[ "$#" -eq 1 && -f "$1" && -r "$1" ]]; then
    report_ai_start "Qwen CLI 啟動：brief 檔 $1"
    exec qwen -y -p "$(cat "$1")"
  fi

  if [[ "$#" -gt 0 ]]; then
    report_ai_start "Qwen CLI 啟動：$*"
  else
    report_ai_start "Qwen CLI 啟動，等待任務輸入"
  fi
fi

exec qwen -y "$@"
