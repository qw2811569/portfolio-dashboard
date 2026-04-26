#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SYSTEMD_DIR="${SCRIPT_DIR}/systemd"
DEST_DIR="/etc/systemd/system"

TIMERS=(
  jcv-compute-valuations
  jcv-collect-daily-events
  jcv-collect-target-prices
  jcv-collect-news
)

TIMER_UNITS=()
ROLLBACK_TIMER_UNITS=()
mapfile -t ACTIVE_TIMERS_BEFORE < <(
  systemctl list-timers --no-legend --plain 'jcv-*' 2>/dev/null \
    | awk '{print $1}' \
    | sed 's#^.*/##' \
    | sort -u \
    || true
)

was_active_before() {
  local timer="$1"
  local active_timer

  for active_timer in "${ACTIVE_TIMERS_BEFORE[@]}"; do
    [[ "${active_timer}" == "${timer}" ]] && return 0
  done

  return 1
}

rollback_enabled_timers() {
  local status=$?
  local timer_unit

  trap - ERR
  set +e

  echo "Install failed; disabling timers newly enabled by this run." >&2
  for timer_unit in "${ROLLBACK_TIMER_UNITS[@]}"; do
    if ! was_active_before "${timer_unit}"; then
      sudo systemctl disable --now "${timer_unit}" >&2
    fi
  done
  sudo systemctl daemon-reload >&2

  exit "${status}"
}

trap rollback_enabled_timers ERR

for timer in "${TIMERS[@]}"; do
  service_file="${SYSTEMD_DIR}/${timer}.service"
  timer_file="${SYSTEMD_DIR}/${timer}.timer"

  if [[ ! -f "${service_file}" || ! -f "${timer_file}" ]]; then
    echo "Missing systemd unit pair for ${timer}" >&2
    exit 1
  fi

  TIMER_UNITS+=("${timer}.timer")
done

for timer in "${TIMERS[@]}"; do
  sudo install -m 0644 "${SYSTEMD_DIR}/${timer}.service" "${DEST_DIR}/${timer}.service"
  sudo install -m 0644 "${SYSTEMD_DIR}/${timer}.timer" "${DEST_DIR}/${timer}.timer"
done
sudo systemctl daemon-reload
for timer_unit in "${TIMER_UNITS[@]}"; do
  ROLLBACK_TIMER_UNITS+=("${timer_unit}")
  sudo systemctl enable --now "${timer_unit}"
done
systemctl list-timers "${TIMER_UNITS[@]}"
