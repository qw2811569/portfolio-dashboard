#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${HOME}/.gemini"

if [[ -f "${HOME}/.gemini/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${HOME}/.gemini/.env"
  set +a
fi

exec gemini "$@"
