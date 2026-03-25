#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/gemini-common.sh"
gemini_init_env

echo "Gemini CLI Healthcheck"
echo
echo "node: $(command -v node)"
echo "node version: $(node -v)"
echo "gemini: $(command -v gemini)"
echo "gemini version: $(bash "$(dirname "$0")/launch-gemini.sh" --version)"
echo
echo "Default models"
echo "  general: ${GEMINI_MODEL:-gemini-2.5-flash}"
echo "  scout:   ${GEMINI_SCOUT_MODEL:-gemini-3.1-flash-lite-preview}"
echo
echo "Auth"
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  echo "  GEMINI_API_KEY: loaded"
else
  echo "  GEMINI_API_KEY: missing"
fi
echo
bash "$(dirname "$0")/gemini-usage-status.sh"
