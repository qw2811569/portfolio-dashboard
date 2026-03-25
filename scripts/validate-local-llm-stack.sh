#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_TS="$(date +"%Y%m%d-%H%M%S")"
OUT_DIR="${ROOT_DIR}/coordination/llm-bus/runs/${RUN_TS}"
mkdir -p "${OUT_DIR}"

run_with_timeout() {
  local label="$1"
  local seconds="$2"
  local command="$3"
  local outfile="${OUT_DIR}/${label}.txt"
  local statusfile="${OUT_DIR}/${label}.status"

  python3 - "$seconds" "$command" "$outfile" "$statusfile" <<'PY'
import subprocess
import sys
from pathlib import Path

timeout_s = int(sys.argv[1])
command = sys.argv[2]
outfile = Path(sys.argv[3])
statusfile = Path(sys.argv[4])

try:
    result = subprocess.run(
        command,
        shell=True,
        text=True,
        capture_output=True,
        timeout=timeout_s,
    )
    combined = (result.stdout or "") + ("\n" if result.stdout and result.stderr else "") + (result.stderr or "")
    outfile.write_text(combined, encoding="utf-8")
    statusfile.write_text(str(result.returncode), encoding="utf-8")
except subprocess.TimeoutExpired as exc:
    combined = (exc.stdout or "") + ("\n" if exc.stdout and exc.stderr else "") + (exc.stderr or "")
    outfile.write_text((combined or "") + "\n[TIMEOUT]\n", encoding="utf-8")
    statusfile.write_text("124", encoding="utf-8")
PY
}

echo "Validation run directory: ${OUT_DIR}"

GEMINI_PROMPT='請用繁體中文輸出一份 facts pack，主題是 6274 台燿。格式固定四段：facts、citations、freshness、unresolved_questions。不要假裝自己是最終真值層；若月營收、EPS、毛利率、ROE、正式目標價缺少一手來源，必須直接說需要官方或結構化資料再驗證。'
QWEN_PROMPT='請先閱讀 coordination/llm-bus/README.md。你現在只能做低風險工作。請輸出一份最小 low-risk patch draft，不要真的修改檔案。任務：針對 scripts/gemini-healthcheck.sh 提出一個最小、安全、可回滾的改善，格式固定為：files、why_safe、validation、draft_diff。不得碰 strategyBrain、holdings、sync、cloud、truth-layer。'
CLAUDE_PROMPT='請用繁體中文輸出三段：1. verdict guardrails 2. freshness checklist 3. downgrade rules。主題是台股收盤分析。必須包含月營收、財報、法說、公開目標價/報告 freshness，不足資料時要改判 stale 或 needs verification。請精簡。'

run_with_timeout \
  "gemini-research" \
  90 \
  "cd '${ROOT_DIR}' && bash scripts/launch-gemini-research-scout.sh -p \"${GEMINI_PROMPT}\""

run_with_timeout \
  "qwen-low-risk-patch" \
  180 \
  "cd '${ROOT_DIR}' && bash scripts/launch-qwen.sh -p \"${QWEN_PROMPT}\" --output-format text --yolo"

run_with_timeout \
  "claude-local-guardrail" \
  180 \
  "cd '${ROOT_DIR}' && bash scripts/launch-claude-ollama.sh -p \"${CLAUDE_PROMPT}\""

echo
echo "Validation status summary:"
for status_path in "${OUT_DIR}"/*.status; do
  label="$(basename "${status_path}" .status)"
  status="$(cat "${status_path}")"
  printf "  %-24s %s\n" "${label}" "${status}"
done

echo
echo "Artifacts saved to: ${OUT_DIR}"
