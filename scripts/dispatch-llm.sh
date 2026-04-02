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
    if command -v gemini >/dev/null 2>&1; then
      echo "[dispatch] 啟動 Gemini：$TASK"
      bash scripts/launch-gemini-research-scout.sh "$TASK" &
      echo "[dispatch] Gemini 已在背景啟動 (PID: $!)"
    else
      echo "[dispatch] Gemini CLI 不存在，已寫入 current-work blocker"
      AI_NAME=Gemini bash scripts/ai-status.sh blocker "Gemini CLI 不存在，無法自動啟動。請先執行 npm install -g @anthropic-ai/gemini-cli 或手動安裝。" >/dev/null 2>&1 || true
    fi
    ;;
  codex)
    if command -v codex >/dev/null 2>&1; then
      echo "[dispatch] 啟動 Codex：$TASK"
      AI_NAME=Codex bash scripts/ai-status.sh start "Codex CLI 啟動：$TASK" >/dev/null 2>&1 || true
      nohup codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox -C "$ROOT_DIR" "$TASK" > /tmp/codex-dispatch.log 2>&1 &
      echo "[dispatch] Codex 已在背景啟動 (PID: $!)"
    else
      echo "[dispatch] Codex CLI 不存在，已寫入 current-work blocker"
      AI_NAME=Codex bash scripts/ai-status.sh blocker "Codex CLI 不存在，無法自動啟動。請先安裝 codex CLI 或提供可執行入口。" >/dev/null 2>&1 || true
    fi
    ;;
  qwen)
    if command -v qwen >/dev/null 2>&1; then
      echo "[dispatch] 啟動 Qwen：$TASK"
      AI_NAME=Qwen bash scripts/ai-status.sh start "Qwen CLI 啟動：$TASK" >/dev/null 2>&1 || true
      nohup qwen --auth-type qwen-oauth --approval-mode yolo --sandbox false "$TASK" > /tmp/qwen-dispatch.log 2>&1 &
      echo "[dispatch] Qwen 已在背景啟動 (PID: $!)"
    else
      echo "[dispatch] Qwen CLI 不存在，已寫入 current-work blocker"
      AI_NAME=Qwen bash scripts/ai-status.sh blocker "Qwen CLI 不存在，無法自動啟動。請先安裝 qwen CLI 或提供可執行入口。" >/dev/null 2>&1 || true
    fi
    ;;
  claude)
    if command -v claude >/dev/null 2>&1; then
      echo "[dispatch] 啟動 Claude：$TASK"
      AI_NAME=Claude bash scripts/ai-status.sh start "Claude CLI 啟動：$TASK" >/dev/null 2>&1 || true
      nohup claude --print --permission-mode bypassPermissions "$TASK" > /tmp/claude-dispatch.log 2>&1 &
      echo "[dispatch] Claude 已在背景啟動 (PID: $!)"
    else
      echo "[dispatch] Claude CLI 不存在，已寫入 current-work blocker"
      AI_NAME=Claude bash scripts/ai-status.sh blocker "Claude CLI 不存在，無法自動啟動。請先安裝 claude CLI 或提供可執行入口。" >/dev/null 2>&1 || true
    fi
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
