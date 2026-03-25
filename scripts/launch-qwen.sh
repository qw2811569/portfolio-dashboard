#!/usr/bin/env bash
set -euo pipefail

NVM_DIR="${HOME}/.nvm"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${NVM_DIR}/nvm.sh"
  if node_bin="$(nvm which current 2>/dev/null)" && [[ -n "${node_bin}" && -x "${node_bin}" ]]; then
    PATH="$(dirname "${node_bin}"):${PATH}"
    export PATH
  fi
fi

export OPENAI_API_KEY="${OPENAI_API_KEY:-ollama}"
MODEL="${QWEN_MODEL:-qwen3:14b}"
BASE_URL="${QWEN_BASE_URL:-http://127.0.0.1:11434/v1}"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" || "${1:-}" == "--version" || "${1:-}" == "-v" ]]; then
  exec qwen "$@"
fi

if [[ "$#" -gt 0 ]]; then
  exec qwen \
    --auth-type openai \
    --openai-base-url "${BASE_URL}" \
    --model "${MODEL}" \
    "$@" </dev/null
fi

exec qwen \
  --auth-type openai \
  --openai-base-url "${BASE_URL}" \
  --model "${MODEL}"
