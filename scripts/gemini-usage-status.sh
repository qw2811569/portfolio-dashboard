#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/gemini-common.sh"
gemini_init_env

if [[ ! -f "${GEMINI_USAGE_LOG}" ]]; then
  echo "No Gemini usage log yet."
  exit 0
fi

TODAY_LOCAL="$(date +"%Y-%m-%d")"
HIGH_MODEL="${GEMINI_HIGH_MODEL:-gemini-3-flash-preview}"
HIGH_MODEL_SOFT_LIMIT="${GEMINI_HIGH_MODEL_SOFT_LIMIT_PER_DAY:-200}"

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

HIGH_MODEL_COUNT="$(awk -F '\t' -v today="${TODAY_LOCAL}" -v model="${HIGH_MODEL}" '$1 ~ "^"today && $2 == model { count += 1 } END { print count + 0 }' "${GEMINI_USAGE_LOG}")"
echo
echo "Soft budget reference:"
echo "  ${HIGH_MODEL} launch soft budget: ${HIGH_MODEL_SOFT_LIMIT}/day"
echo "  ${HIGH_MODEL} launches today: ${HIGH_MODEL_COUNT}/${HIGH_MODEL_SOFT_LIMIT}"

if [[ "${HIGH_MODEL_COUNT}" -ge "${HIGH_MODEL_SOFT_LIMIT}" ]]; then
  echo "  status: reached soft budget, shift lower-value scouting back to Claude local / Qwen / AnythingLLM."
elif [[ "${HIGH_MODEL_COUNT}" -ge $((HIGH_MODEL_SOFT_LIMIT * 3 / 4)) ]]; then
  echo "  status: high usage, reserve remaining launches for high-value public research only."
else
  echo "  status: healthy, keep routing high-value external research to Gemini."
fi
