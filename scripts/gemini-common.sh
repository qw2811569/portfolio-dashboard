#!/usr/bin/env bash
set -euo pipefail

GEMINI_HOME_DIR="${HOME}/.gemini"
GEMINI_ENV_FILE="${GEMINI_HOME_DIR}/.env"
GEMINI_USAGE_LOG="${GEMINI_HOME_DIR}/usage-log.tsv"

gemini_use_compatible_node() {
  local nvm_dir="${HOME}/.nvm"
  local nvm_sh="${nvm_dir}/nvm.sh"
  local node_bin=""

  if [[ -s "${nvm_sh}" ]]; then
    # shellcheck disable=SC1090
    source "${nvm_sh}"
    if node_bin="$(nvm which current 2>/dev/null)" && [[ -n "${node_bin}" && -x "${node_bin}" ]]; then
      PATH="$(dirname "${node_bin}"):${PATH}"
      export PATH
      return 0
    fi
  fi

  return 0
}

gemini_init_env() {
  mkdir -p "${GEMINI_HOME_DIR}"

  gemini_use_compatible_node

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
