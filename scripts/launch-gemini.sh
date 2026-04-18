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
SECRETS_DIR="${ROOT_DIR}/.tmp/secrets"
GEMINI_KEY_FILE="${SECRETS_DIR}/GEMINI_API_KEY.txt"

report_ai_start() {
  local message="$1"
  AI_NAME=Gemini bash "$ROOT_DIR/scripts/ai-status.sh" start "$message" >/dev/null 2>&1 || true
}

load_gemini_api_key() {
  if [[ ! -f "${GEMINI_KEY_FILE}" ]]; then
    cat >&2 <<EOF
launch-gemini: missing API key file:
  ${GEMINI_KEY_FILE}
EOF
    return 1
  fi

  GEMINI_API_KEY="$(tr -d '\r\n' < "${GEMINI_KEY_FILE}")"
  if [[ -z "${GEMINI_API_KEY}" ]]; then
    echo "launch-gemini: API key file is empty: ${GEMINI_KEY_FILE}" >&2
    return 1
  fi

  export GEMINI_API_KEY
}

gemini_supports_auth_type() {
  gemini --help 2>/dev/null | rg -q -- '--auth-type'
}

build_gemini_args() {
  local args=("$@")

  if ! gemini_has_model_flag "${args[@]}"; then
    args=(-m "${DEFAULT_MODEL}" "${args[@]}")
  fi

  if gemini_supports_auth_type; then
    args=(--auth-type gemini "${args[@]}")
  fi

  printf '%s\n' "${args[@]}"
}

collect_gemini_args() {
  GEMINI_ARGS=()
  while IFS= read -r line; do
    GEMINI_ARGS+=("${line}")
  done < <(build_gemini_args "$@")
}

if [[ "${1:-}" != "--help" && "${1:-}" != "-h" && "${1:-}" != "--version" && "${1:-}" != "-v" ]]; then
  if [[ "$USE_REMOTE" == "1" ]]; then
    report_ai_start "Gemini VM dispatch：$*"
    exec bash "$ROOT_DIR/scripts/bridge-remote-dispatch.sh" --agent gemini "$@"
  fi

  load_gemini_api_key
  gemini_log_launch "interactive" "${DEFAULT_MODEL}" "general" "${PWD}"
  if [[ "$#" -gt 0 ]]; then
    report_ai_start "Gemini CLI 啟動：$*"
  else
    report_ai_start "Gemini CLI 啟動，等待任務輸入"
  fi
fi

if [[ "$#" -eq 1 && -f "$1" && -r "$1" ]]; then
  collect_gemini_args -p "$(cat "$1")"
else
  collect_gemini_args "$@"
fi

exec gemini --approval-mode yolo "${GEMINI_ARGS[@]}" </dev/null
