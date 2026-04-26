#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SYSTEMD_DIR="${SCRIPT_DIR}/systemd"
DEST_DIR="/etc/systemd/system"

shopt -s nullglob
UNITS=("${SYSTEMD_DIR}"/jcv-*.service "${SYSTEMD_DIR}"/jcv-*.timer)
TIMERS=()

for timer in "${SYSTEMD_DIR}"/jcv-*.timer; do
  TIMERS+=("$(basename "${timer}")")
done

if (( ${#UNITS[@]} == 0 || ${#TIMERS[@]} == 0 )); then
  echo "No jcv systemd service/timer files found in ${SYSTEMD_DIR}" >&2
  exit 1
fi

sudo install -m 0644 "${UNITS[@]}" "${DEST_DIR}/"
sudo systemctl daemon-reload
sudo systemctl enable --now "${TIMERS[@]}"
systemctl list-timers 'jcv-*'
