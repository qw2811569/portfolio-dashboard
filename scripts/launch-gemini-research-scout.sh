#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/ai-git-identity.sh"

source "$(dirname "$0")/gemini-common.sh"
gemini_init_env

MODEL="${GEMINI_SCOUT_MODEL:-gemini-2.5-flash}"

BOOTSTRAP_PROMPT=$'你現在是這個 repo 的「台股公開資料蒐集員」。\n請遵守工作區中的 GEMINI.md。\n你的任務是蒐集公開可驗證資料、整理 citations、標示 freshness 與 unresolved questions。\n不要把自己當成最終資料真值來源，不要直接做最終策略判斷，不要直接宣告可回寫 strategy brain 的最終結論。\n如果遇到月營收、EPS、毛利率、ROE、正式目標價等欄位，應優先指出需要用官方或結構化來源再驗證。'

report_ai_start() {
  local message="$1"
  AI_NAME=Gemini bash "$ROOT_DIR/scripts/ai-status.sh" start "$message" >/dev/null 2>&1 || true
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  exec gemini --help
fi

if [[ "$#" -gt 0 ]]; then
  USER_TASK="$*"
  if [[ -t 0 && -t 1 ]]; then
    gemini_log_launch "interactive" "${MODEL}" "taiwan-scout" "${PWD}"
    report_ai_start "Gemini research scout：${USER_TASK}"
    exec gemini -m "${MODEL}" -i "${BOOTSTRAP_PROMPT}

目前任務：
${USER_TASK}"
  fi
  gemini_log_launch "headless" "${MODEL}" "taiwan-scout" "${PWD}"
  report_ai_start "Gemini research scout：${USER_TASK}"
  exec gemini -m "${MODEL}" --yolo --sandbox false -p "${BOOTSTRAP_PROMPT}

目前任務：
${USER_TASK}" </dev/null
fi

gemini_log_launch "interactive" "${MODEL}" "taiwan-scout" "${PWD}"
report_ai_start "Gemini research scout 啟動，等待任務輸入"
exec gemini -m "${MODEL}" -i "${BOOTSTRAP_PROMPT}"
