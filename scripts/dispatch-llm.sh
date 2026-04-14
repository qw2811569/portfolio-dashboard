#!/usr/bin/env bash
# 調度中心腳本 — 唯一入口（status / restart / push / evolve / loop / analyze）
# AI 調度改用 scripts/launch-codex.sh|launch-qwen.sh|launch-gemini.sh
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
PORT="3002"
LOCAL_URL="http://127.0.0.1:${PORT}"
TAILSCALE_IP="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
TAILSCALE_DNS="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys; data=json.load(sys.stdin); print((data.get("Self",{}).get("DNSName","") or "").rstrip("."))' 2>/dev/null || true)"

print_access_urls() {
  echo "=== Access URLs ==="
  echo "Local : ${LOCAL_URL}"
  if [[ -n "${TAILSCALE_DNS}" ]]; then
    echo "Remote: http://${TAILSCALE_DNS}:${PORT}"
  fi
  if [[ -n "${TAILSCALE_IP}" ]]; then
    echo "IP    : http://${TAILSCALE_IP}:${PORT}"
  fi
}

case "$CMD" in
  status)
    echo "=== 最近 commit ==="
    git log --oneline -5
    echo ""
    echo "=== 最新 checkpoint ==="
    grep -m3 "^- " docs/status/current-work.md | head -3
    echo ""
    print_access_urls
    echo ""
    echo "=== local server ==="
    curl -s -o /dev/null -w "HTTP %{http_code}" "${LOCAL_URL}/" 2>/dev/null || echo "未啟動"
    echo ""
    echo "=== 未 commit 的改動 ==="
    git status --short | grep -v "anythingllm" | head -5
    ;;
  restart)
    echo "[dispatch] 重啟 vercel dev..."
    bash scripts/redeploy-local.sh
    ;;
  url|urls)
    print_access_urls
    ;;
  push)
    echo "[dispatch] 推送到 GitHub..."
    git push origin main 2>&1
    ;;
  analyze)
    echo "[dispatch] 測試收盤分析 API..."
    curl -s -w "\nHTTP:%{http_code} TIME:%{time_total}s" -X POST "${LOCAL_URL}/api/analyze" \
      -H "Content-Type: application/json" \
      -d '{"systemPrompt":"測試","userPrompt":"用30字分析台達電","maxTokens":100}' \
      --max-time 20 | tail -3
    ;;
  evolve)
    echo "[dispatch] 啟動自動進化循環..."
    bash scripts/auto-evolve.sh 2>&1
    ;;
  loop)
    echo "[dispatch] 啟動自動閉環（QA→修→驗→審，直到零 bug）..."
    bash scripts/auto-loop.sh 2>&1
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
    echo "  url      — 顯示本機 / 遠端訪問網址"
    echo "  push     — 推送到 GitHub"
    echo "  analyze  — 測試收盤分析 API"
    echo "  evolve   — 單次偵測+建議修復"
    echo "  loop     — 自動閉環（QA→修→驗→審，直到零 bug）"
    echo "  report   — 進度彙報"
    echo ""
    echo "AI 調度："
    echo "  bash scripts/launch-codex.sh \"任務描述\"                       — 派 Codex"
    echo "  bash scripts/launch-codex.sh docs/status/auto-evolve-tasks.md — 派 Codex 讀 brief"
    echo "  bash scripts/launch-qwen.sh -p \"任務描述\" --output-format text --yolo"
    echo "  bash scripts/launch-gemini.sh \"任務描述\"                    — 派 Gemini"
    ;;
esac
