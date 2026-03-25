#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/gemini-common.sh"
gemini_init_env

DEFAULT_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"

if [[ "${1:-}" != "--help" && "${1:-}" != "-h" && "${1:-}" != "--version" && "${1:-}" != "-v" ]]; then
  gemini_log_launch "interactive" "${DEFAULT_MODEL}" "general" "${PWD}"
fi

if gemini_has_model_flag "$@"; then
  exec gemini "$@" </dev/null
fi

exec gemini -m "${DEFAULT_MODEL}" "$@" </dev/null
