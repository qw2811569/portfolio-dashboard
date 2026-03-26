#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

MESSAGE="${1:-manual-checkpoint}"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
SAFE_MESSAGE="$(printf '%s' "${MESSAGE}" | tr ' /:' '---' | tr -cd '[:alnum:]_-')"
CHECKPOINT_DIR="${REPO_ROOT}/checkpoints/${TIMESTAMP}-${SAFE_MESSAGE}"
STATE_DIR="${CHECKPOINT_DIR}/state"

mkdir -p "${STATE_DIR}"

copy_if_exists() {
  local src="$1"
  local dest_name="$2"
  if [[ -f "${src}" ]]; then
    cp "${src}" "${STATE_DIR}/${dest_name}"
  fi
}

# 只備份真正有助於還原 app 狀態的 JSON，不直接把整個 data/ 或 .anythingllm-storage 都塞進 git。
copy_if_exists "data/holdings.json" "holdings.json"
copy_if_exists "data/events.json" "events.json"
copy_if_exists "data/strategy-brain.json" "strategy-brain.json"
copy_if_exists "data/analysis-history-index.json" "analysis-history-index.json"
copy_if_exists "data/research-index.json" "research-index.json"

cat > "${CHECKPOINT_DIR}/manifest.md" <<EOF
# Checkpoint

- created_at: $(date '+%Y-%m-%d %H:%M:%S %Z')
- message: ${MESSAGE}
- git_head: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
- branch: $(git branch --show-current 2>/dev/null || echo "unknown")

## Included state files

$(find "${STATE_DIR}" -maxdepth 1 -type f -print | sed 's#^.*/#- #' | sort)

## Notes

- 這份 checkpoint 只備份 server-side/落地 JSON 狀態，不包含瀏覽器 localStorage。
- 如果你要完整保住每個 portfolio 的本機狀態，仍應搭配 app 內建的「備份 / 匯入」JSON。
- 建議在頁面穩定時先執行這支腳本，再視需要進行 git commit / push。
EOF

echo "Checkpoint created:"
echo "  ${CHECKPOINT_DIR}"
