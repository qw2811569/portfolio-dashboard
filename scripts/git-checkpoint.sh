#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

MESSAGE="${1:-checkpoint}"
PUSH_FLAG="${2:-}"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M')"

git add \
  src \
  api \
  docs \
  scripts \
  tests \
  public \
  .vscode \
  checkpoints \
  package.json \
  package-lock.json \
  vite.config.js \
  vercel.json

if git diff --cached --quiet; then
  echo "No staged changes to commit."
  exit 0
fi

git commit -m "checkpoint: ${MESSAGE} (${TIMESTAMP})"

if [[ "${PUSH_FLAG}" == "--push" ]]; then
  git push origin HEAD
fi
