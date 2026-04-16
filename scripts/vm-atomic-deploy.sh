#!/usr/bin/env bash

set -euo pipefail

SOURCE_DIR="${1:-}"
TARGET_ROOT="${2:-/var/www/app}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

if [[ -z "$SOURCE_DIR" ]]; then
  echo "usage: $0 <source-dir> [target-root]" >&2
  exit 64
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "source dir not found: $SOURCE_DIR" >&2
  exit 66
fi

RELEASES_DIR="${TARGET_ROOT%/}/releases"
CURRENT_LINK="${TARGET_ROOT%/}/current"
DEPLOY_LOG="${TARGET_ROOT%/}/deploy-history.log"
TIMESTAMP="$(date '+%Y%m%d%H%M%S')"
RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"

mkdir -p "$RELEASES_DIR"
mkdir -p "$RELEASE_DIR"

rsync -a --delete "${SOURCE_DIR%/}/" "${RELEASE_DIR}/dist/"

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RELEASE_DIR" >> "$DEPLOY_LOG"

old_releases=()
while IFS= read -r release; do
  old_releases+=("$release")
done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
release_count="${#old_releases[@]}"
if (( release_count > KEEP_RELEASES )); then
  remove_count=$((release_count - KEEP_RELEASES))
  for ((i = 0; i < remove_count; i++)); do
    rm -rf "${old_releases[$i]}"
  done
fi

echo "$RELEASE_DIR"
