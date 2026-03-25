#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/gemini-common.sh"
gemini_init_env

if [[ ! -f "${GEMINI_USAGE_LOG}" ]]; then
  echo "No Gemini usage log yet."
  exit 0
fi

TODAY_LOCAL="$(date +"%Y-%m-%d")"
PRIMARY_MODEL="${GEMINI_HIGH_MODEL:-gemini-2.5-flash}"
PRIMARY_MODEL_SOFT_LIMIT="${GEMINI_HIGH_MODEL_SOFT_LIMIT_PER_DAY:-40}"

echo "Gemini Usage Status"
echo "Date: ${TODAY_LOCAL}"
echo

awk -F '\t' -v today="${TODAY_LOCAL}" '
  index($1, today) == 1 {
    total += 1
    model[$2] += 1
    tag[$4] += 1
    mode[$3] += 1
  }
  END {
    printf("Today launches: %d\n", total + 0)
    print ""
    print "By model:"
    for (k in model) printf("  %s\t%d\n", k, model[k])
    print ""
    print "By tag:"
    for (k in tag) printf("  %s\t%d\n", k, tag[k])
    print ""
    print "By mode:"
    for (k in mode) printf("  %s\t%d\n", k, mode[k])
  }
' "${GEMINI_USAGE_LOG}"

PRIMARY_MODEL_COUNT="$(awk -F '\t' -v today="${TODAY_LOCAL}" -v model="${PRIMARY_MODEL}" '$1 ~ "^"today && $2 == model { count += 1 } END { print count + 0 }' "${GEMINI_USAGE_LOG}")"
echo
echo "Soft budget reference:"
echo "  ${PRIMARY_MODEL} launch soft budget: ${PRIMARY_MODEL_SOFT_LIMIT}/day"
echo "  ${PRIMARY_MODEL} launches today: ${PRIMARY_MODEL_COUNT}/${PRIMARY_MODEL_SOFT_LIMIT}"

if [[ "${PRIMARY_MODEL_COUNT}" -ge "${PRIMARY_MODEL_SOFT_LIMIT}" ]]; then
  echo "  status: reached soft budget, shift lower-value scouting back to Claude local / Qwen / AnythingLLM."
elif [[ "${PRIMARY_MODEL_COUNT}" -ge $((PRIMARY_MODEL_SOFT_LIMIT * 3 / 4)) ]]; then
  echo "  status: high usage, reserve remaining launches for high-value public research only."
else
  echo "  status: healthy, keep routing high-value external research to Gemini."
fi

TMP_ROOT="$(python3 - <<'PY'
import tempfile
print(tempfile.gettempdir())
PY
)"
LATEST_ERROR="$(ls -t "${TMP_ROOT}"/gemini-client-error-* 2>/dev/null | head -n 1 || true)"
if [[ -n "${LATEST_ERROR}" ]]; then
  echo
  echo "Latest known Gemini API error:"
  python3 - "${LATEST_ERROR}" <<'PY'
import json, sys, pathlib
path = pathlib.Path(sys.argv[1])
try:
    data = json.loads(path.read_text())
except Exception:
    print(f"  unable to parse: {path}")
    raise SystemExit(0)
msg = data.get("error", {}).get("message", "").strip() or "unknown"
context = json.dumps(data)
model = "unknown"
if "model: gemini-3-flash" in context:
    model = "gemini-3-flash-preview"
elif "model: gemini-2.5" in context:
    model = "gemini-2.5"
elif "model: gemini-3.1" in context:
    model = "gemini-3.1"
print(f"  file: {path.name}")
print(f"  model hint: {model}")
print(f"  message: {msg}")
PY
fi
