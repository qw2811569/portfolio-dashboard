#!/usr/bin/env bash

set -euo pipefail

AI_NAME="${AI_NAME:-Codex}"

case "$AI_NAME" in
  Codex)
    AI_GIT_AUTHOR_NAME="AI Codex"
    AI_GIT_AUTHOR_EMAIL="ai+codex@local.ai"
    ;;
  Qwen)
    AI_GIT_AUTHOR_NAME="AI Qwen"
    AI_GIT_AUTHOR_EMAIL="ai+qwen@local.ai"
    ;;
  Gemini)
    AI_GIT_AUTHOR_NAME="AI Gemini"
    AI_GIT_AUTHOR_EMAIL="ai+gemini@local.ai"
    ;;
  Claude)
    AI_GIT_AUTHOR_NAME="AI Claude"
    AI_GIT_AUTHOR_EMAIL="ai+claude@local.ai"
    ;;
  *)
    slug="$(printf '%s' "$AI_NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-_')"
    AI_GIT_AUTHOR_NAME="AI ${AI_NAME}"
    AI_GIT_AUTHOR_EMAIL="ai+${slug:-agent}@local.ai"
    ;;
esac

if [[ -d "${HOME}/.blameprompt/bin" ]]; then
  export PATH="${HOME}/.blameprompt/bin:${PATH}"
fi

if [[ -d "${HOME}/.local/bin" ]]; then
  export PATH="${HOME}/.local/bin:${PATH}"
fi

export AI_GIT_AUTHOR_NAME
export AI_GIT_AUTHOR_EMAIL
export GIT_AUTHOR_NAME="$AI_GIT_AUTHOR_NAME"
export GIT_AUTHOR_EMAIL="$AI_GIT_AUTHOR_EMAIL"
export GIT_COMMITTER_NAME="$AI_GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$AI_GIT_AUTHOR_EMAIL"

if [[ "${1:-}" == "--print" ]]; then
  printf 'AI_NAME=%s\n' "$AI_NAME"
  printf 'GIT_AUTHOR_NAME=%s\n' "$GIT_AUTHOR_NAME"
  printf 'GIT_AUTHOR_EMAIL=%s\n' "$GIT_AUTHOR_EMAIL"
fi
