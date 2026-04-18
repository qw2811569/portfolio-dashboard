#!/usr/bin/env bash

launch_preflight_die() {
  echo "$1" >&2
  exit 1
}

launch_preflight_require_command() {
  local cmd="${1:-}"
  local label="${2:-$cmd}"
  if [[ -z "$cmd" ]]; then
    launch_preflight_die "launch-preflight: missing command name"
  fi
  if ! command -v "$cmd" >/dev/null 2>&1; then
    launch_preflight_die "launch-preflight: ${label} not found in PATH"
  fi
}

launch_preflight_require_env() {
  local name="${1:-}"
  local hint="${2:-}"
  if [[ -z "$name" ]]; then
    launch_preflight_die "launch-preflight: missing env name"
  fi
  if [[ -n "${!name:-}" ]]; then
    return 0
  fi
  if [[ -n "$hint" ]]; then
    launch_preflight_die "launch-preflight: ${name} is required. ${hint}"
  fi
  launch_preflight_die "launch-preflight: ${name} is required"
}

launch_preflight_require_file() {
  local path="${1:-}"
  local hint="${2:-}"
  if [[ -z "$path" ]]; then
    launch_preflight_die "launch-preflight: missing file path"
  fi
  if [[ -r "$path" ]]; then
    return 0
  fi
  if [[ -n "$hint" ]]; then
    launch_preflight_die "launch-preflight: missing file ${path}. ${hint}"
  fi
  launch_preflight_die "launch-preflight: missing file ${path}"
}

launch_preflight_require_env_or_file() {
  local env_name="${1:-}"
  local file_path="${2:-}"
  local hint="${3:-}"
  if [[ -n "${env_name}" && -n "${!env_name:-}" ]]; then
    return 0
  fi
  if [[ -n "$file_path" && -r "$file_path" ]]; then
    return 0
  fi
  if [[ -n "$hint" ]]; then
    launch_preflight_die \
      "launch-preflight: ${env_name} or ${file_path} is required. ${hint}"
  fi
  launch_preflight_die "launch-preflight: ${env_name} or ${file_path} is required"
}
