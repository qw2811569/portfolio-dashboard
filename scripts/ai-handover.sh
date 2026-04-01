#!/bin/bash

set -euo pipefail

if [[ $# -lt 2 ]]; then
    echo "用法：./scripts/ai-handover.sh [AI 名稱] [交接訊息]" >&2
    exit 1
fi

AI_NAME="$1"
shift
MESSAGE="$*"

AI_NAME="$AI_NAME" bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ai-status.sh" handover "$MESSAGE"
