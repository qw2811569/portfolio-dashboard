#!/usr/bin/env bash
set -euo pipefail

MODEL="${CLAUDE_OLLAMA_MODEL:-qwen3-coder:30b}"

if [[ $# -gt 0 ]]; then
  exec ollama launch claude --model "$MODEL" -- "$@"
fi

exec ollama launch claude --model "$MODEL"
