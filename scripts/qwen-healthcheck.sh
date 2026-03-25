#!/usr/bin/env bash
set -euo pipefail

echo "Qwen Healthcheck"
echo
echo "launcher: $(pwd)/scripts/launch-qwen.sh"
echo "default model: ${QWEN_MODEL:-qwen3:14b}"
echo "base url: ${QWEN_BASE_URL:-http://127.0.0.1:11434/v1}"
echo
bash "$(dirname "$0")/launch-qwen.sh" --help >/dev/null
echo "status: launcher reachable"
echo "note: local qwen over Ollama is available, but headless prompt mode may be slow on this machine; keep it for low-frequency, bounded tasks."
