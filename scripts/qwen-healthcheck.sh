#!/usr/bin/env bash
set -euo pipefail

echo "Qwen Healthcheck"
echo
echo "launcher: $(pwd)/scripts/launch-qwen.sh"
echo
bash "$(dirname "$0")/launch-qwen.sh" --help >/dev/null
echo "status: launcher reachable"
echo "note: this launcher now uses plain Qwen CLI only; Ollama dependency has been removed."
