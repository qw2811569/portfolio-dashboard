#!/usr/bin/env bash
# OpenClaw 用這個腳本調度 LLM
# 用法：bash scripts/dispatch-llm.sh <llm> <task>
# 範例：bash scripts/dispatch-llm.sh gemini "蒐集產業新聞"
#       bash scripts/dispatch-llm.sh codex "修復 BRAIN_UPDATE strip"
#       bash scripts/dispatch-llm.sh qwen "補測試"
#       bash scripts/dispatch-llm.sh status "查看所有 LLM 狀態"

set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 載入 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 24 > /dev/null 2>&1 || true

LLM="${1:-status}"
TASK="${2:-}"

case "$LLM" in
  gemini)
    echo "[dispatch] 啟動 Gemini：$TASK"
    bash scripts/launch-gemini-research-scout.sh "$TASK" &
    echo "[dispatch] Gemini 已在背景啟動 (PID: $!)"
    ;;
  codex)
    echo "[dispatch] Codex 任務已寫入 current-work.md"
    echo "- [$(date '+%Y-%m-%d %H:%M')] Codex 新任務（via OpenClaw）：$TASK" >> docs/status/current-work.md
    echo "[dispatch] 請在 VS Code 終端機啟動 Codex 並告訴他讀 current-work.md"
    ;;
  qwen)
    echo "[dispatch] Qwen 任務已寫入 current-work.md"
    echo "- [$(date '+%Y-%m-%d %H:%M')] Qwen 新任務（via OpenClaw）：$TASK" >> docs/status/current-work.md
    echo "[dispatch] 請在 VS Code 終端機啟動 Qwen 並告訴他讀 current-work.md"
    ;;
  claude)
    echo "[dispatch] Claude 任務已寫入 current-work.md"
    echo "- [$(date '+%Y-%m-%d %H:%M')] Claude 新任務（via OpenClaw）：$TASK" >> docs/status/current-work.md
    echo "[dispatch] Claude 會在下次 session 看到這個任務"
    ;;
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
  *)
    echo "用法：bash scripts/dispatch-llm.sh <command> [task]"
    echo "命令：gemini, codex, qwen, claude, status, restart, push, analyze"
    ;;
esac
