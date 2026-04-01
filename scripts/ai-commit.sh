#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AI_NAME="${AI_NAME:-Codex}"

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/ai-git-identity.sh"

if [[ $# -lt 1 ]]; then
  echo "用法：AI_NAME=Qwen bash scripts/ai-commit.sh \"commit message\"" >&2
  exit 1
fi

MESSAGE="$1"
shift || true

if git -C "$ROOT_DIR" diff --cached --quiet; then
  echo "沒有 staged changes，請先 git add" >&2
  exit 1
fi

BODY=$'AI-Agent: '"$AI_NAME"$'\nAI-Status-Source: docs/status/ai-activity.json\nAI-Activity-Log: docs/status/ai-activity-log.json'

git -C "$ROOT_DIR" commit --author "${GIT_AUTHOR_NAME} <${GIT_AUTHOR_EMAIL}>" -m "$MESSAGE" -m "$BODY" "$@"
