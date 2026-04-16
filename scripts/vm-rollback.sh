#!/usr/bin/env bash

set -euo pipefail

TARGET_ROOT="${1:-/var/www/app}"
RELEASES_DIR="${TARGET_ROOT%/}/releases"
CURRENT_LINK="${TARGET_ROOT%/}/current"

if [[ ! -d "$RELEASES_DIR" ]]; then
  echo "releases dir not found: $RELEASES_DIR" >&2
  exit 66
fi

current_release=""
if [[ -L "$CURRENT_LINK" ]]; then
  current_release="$(readlink "$CURRENT_LINK")"
fi

releases=()
while IFS= read -r release; do
  releases+=("$release")
done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
if (( ${#releases[@]} < 2 )); then
  echo "rollback requires at least two releases" >&2
  exit 65
fi

target_release=""
for ((i = ${#releases[@]} - 1; i >= 0; i--)); do
  if [[ "${releases[$i]}" != "$current_release" ]]; then
    target_release="${releases[$i]}"
    break
  fi
done

if [[ -z "$target_release" ]]; then
  echo "no previous release found" >&2
  exit 65
fi

ln -sfn "$target_release" "$CURRENT_LINK"

printf '%s rollback %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$target_release" >> "${TARGET_ROOT%/}/deploy-history.log"

echo "$target_release"
