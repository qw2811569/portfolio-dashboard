#!/usr/bin/env bash
# OpenClaw 系統操作腳本
# AI 調度已遷移到 ACP（/acp spawn codex|claude|qwen）
# 這個腳本只保留系統維運指令
#
# 用法：bash scripts/dispatch-llm.sh <command> [args]

set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 載入 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 24 > /dev/null 2>&1 || true
if ! command -v node >/dev/null 2>&1; then
  NODE24_BIN="$HOME/.nvm/versions/node/v24.13.1/bin"
  [ -d "$NODE24_BIN" ] && export PATH="$NODE24_BIN:$PATH"
fi

CMD="${1:-status}"
ARG="${2:-}"

case "$CMD" in
  status)
    echo "=== 最近 commit ==="
    git log --oneline -5
    echo ""
    echo "=== 最新 checkpoint ==="
    grep -m3 "^- " docs/status/current-work.md | head -3
    echo ""
    echo "=== vercel dev ==="
    curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3002/ 2>/dev/null || echo "未啟動"
    echo ""
    echo "=== 未 commit 的改動 ==="
    git status --short | grep -v "anythingllm" | head -5
    ;;
  restart)
    echo "[dispatch] 重啟 vercel dev..."
    pkill -f "vercel dev" 2>/dev/null || true
    sleep 1
    nohup npx vercel dev --listen 0.0.0.0:3002 > /tmp/vercel-dev.log 2>&1 &
    sleep 5
    echo "[dispatch] vercel dev 已重啟 (PID: $!)"
    curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3002/
    ;;
  push)
    echo "[dispatch] 推送到 GitHub..."
    git push origin main 2>&1
    ;;
  analyze)
    echo "[dispatch] 測試收盤分析 API..."
    curl -s -w "\nHTTP:%{http_code} TIME:%{time_total}s" -X POST "http://localhost:3002/api/analyze" \
      -H "Content-Type: application/json" \
      -d '{"systemPrompt":"測試","userPrompt":"用30字分析台達電","maxTokens":100}' \
      --max-time 20 | tail -3
    ;;
  evolve)
    echo "[dispatch] 啟動自動進化循環..."
    bash scripts/auto-evolve.sh 2>&1
    ;;
  report)
    bash scripts/progress-report.sh 2>&1
    ;;
  *)
    echo "用法：bash scripts/dispatch-llm.sh <command>"
    echo ""
    echo "系統操作："
    echo "  status   — 查看專案狀態"
    echo "  restart  — 重啟 vercel dev"
    echo "  push     — 推送到 GitHub"
    echo "  analyze  — 測試收盤分析 API"
    echo "  evolve   — 自動偵測+修復 build/test/lint 問題"
    echo "  report   — 進度彙報"
    echo ""
    echo "AI 調度（已遷移到 ACP）："
    echo "  /acp spawn codex \"任務描述\"  — 派 Codex"
    echo "  /acp spawn claude \"任務描述\" — 派 Claude"
    echo "  /acp spawn qwen \"任務描述\"   — 派 Qwen"
    ;;
esac
