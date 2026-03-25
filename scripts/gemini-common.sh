#!/usr/bin/env bash
set -euo pipefail

GEMINI_HOME_DIR="${HOME}/.gemini"
GEMINI_ENV_FILE="${GEMINI_HOME_DIR}/.env"
GEMINI_USAGE_LOG="${GEMINI_HOME_DIR}/usage-log.tsv"

gemini_init_env() {
  mkdir -p "${GEMINI_HOME_DIR}"

  if [[ -f "${GEMINI_ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${GEMINI_ENV_FILE}"
    set +a
  fi
}

gemini_has_model_flag() {
  local arg
  for arg in "$@"; do
    case "${arg}" in
      -m|--model|--model=*)
        return 0
        ;;
    esac
  done
  return 1
}

gemini_log_launch() {
  local mode="$1"
  local model="$2"
  local tag="$3"
  local cwd="$4"
  local ts
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  printf "%s\t%s\t%s\t%s\t%s\n" "${ts}" "${model}" "${mode}" "${tag}" "${cwd}" >> "${GEMINI_USAGE_LOG}"
}
