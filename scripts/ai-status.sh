#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AI_NAME="${AI_NAME:-Codex}"

show_help() {
    cat <<'EOF'
AI 工作狀態管理

canonical 規則：
  - 任務 checkpoint 真相：docs/status/current-work.md
  - AI 即時工作狀態：docs/status/ai-activity.json
  - docs-site/state.json：由 bash scripts/sync-state.sh 衍生生成

用法：
  AI_NAME=Qwen ./scripts/ai-status.sh start "整理 knowledge-base"
  AI_NAME=Qwen ./scripts/ai-status.sh progress "正在整理 citations 與 references"
  AI_NAME=Qwen ./scripts/ai-status.sh done "完成 knowledge-base 第一批整理"
  AI_NAME=Qwen ./scripts/ai-status.sh handover "下一步請 Codex 審查"
  AI_NAME=Qwen ./scripts/ai-status.sh suggest "可補自動摘要"
  AI_NAME=Qwen ./scripts/ai-status.sh blocker "等待 API quota"
  AI_NAME=Qwen ./scripts/ai-status.sh idle "等待分配新任務"
  ./scripts/ai-status.sh status
  ./scripts/ai-status.sh sync
EOF
}

run_update() {
    local action="$1"
    shift
    local message="$*"

    if [[ -z "$message" ]]; then
        echo "錯誤：請提供訊息" >&2
        exit 1
    fi

    python3 "$ROOT_DIR/scripts/report-ai-progress.py" "$action" "$AI_NAME" "$message"
    bash "$ROOT_DIR/scripts/sync-state.sh"

    # Push status to VM Dashboard (silent fail — network issues shouldn't break local flow)
    if [[ -n "${VM_STATUS_URL:-}" ]]; then
        local auth_args=()
        if [[ -n "${VM_STATUS_TOKEN:-}" ]]; then
            auth_args=(-H "Authorization: Bearer $VM_STATUS_TOKEN")
        fi
        (
            curl -s -X POST "$VM_STATUS_URL" \
                -H "Content-Type: application/json" \
                "${auth_args[@]}" \
                -d "{\"agent\":\"$AI_NAME\",\"status\":\"$action\",\"message\":$(printf '%s' "$message" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),\"timestamp\":$(date +%s000),\"host\":\"$(hostname)\"}" \
                --connect-timeout 3 --max-time 5 \
                >/dev/null 2>&1 || true
        ) &
    fi
}

if [[ $# -lt 1 ]]; then
    show_help
    exit 1
fi

COMMAND="$1"
shift || true

case "$COMMAND" in
    start)
        run_update start "$*"
        ;;
    progress)
        run_update progress "$*"
        ;;
    done)
        run_update done "$*"
        ;;
    handover)
        run_update handover "$*"
        ;;
    suggest)
        run_update suggest "$*"
        ;;
    blocker)
        run_update blocker "$*"
        ;;
    idle)
        run_update idle "$*"
        ;;
    status)
        bash "$ROOT_DIR/scripts/ai-state.sh" status
        ;;
    sync)
        bash "$ROOT_DIR/scripts/sync-state.sh" "$@"
        ;;
    *)
        show_help
        exit 1
        ;;
esac
