#!/usr/bin/env bash
# 進度彙報 — 你回到電腦時跑這個，一眼看全貌
# 用法：bash scripts/progress-report.sh
#       bash scripts/dispatch-llm.sh report

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║        專案進度彙報                       ║"
echo "║        $(date '+%Y-%m-%d %H:%M')                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── AI 狀態 ───
echo "━━━ AI 團隊狀態 ━━━"
if [[ -f "docs/status/ai-activity.json" ]]; then
  python3 -c "
import json
with open('docs/status/ai-activity.json') as f:
    data = json.load(f)
for m in data.get('members', []):
    status_icon = {'working': '🔄', 'idle': '💤', 'blocker': '🚫', 'done': '✅'}.get(m.get('status',''), '❓')
    print(f\"  {m.get('avatar','')} {m['name']:8s} {status_icon} {m.get('status','?'):10s} | {m.get('currentTask', '無')[:60]}\")
    print(f\"{'':13s}最後活動: {m.get('lastActive', '未知')}  完成任務: {m.get('tasksCompleted', 0)}\")
" 2>/dev/null || echo "  （無法讀取 AI 狀態）"
fi
echo ""

# ─── 最近 commit ───
echo "━━━ 最近 commit（自動化之後）━━━"
git log --oneline -8
echo ""

# ─── auto-evolve 狀態 ───
echo "━━━ Auto-Evolve 最新結果 ━━━"
if [[ -f "docs/status/auto-evolve-tasks.md" ]]; then
  head -10 docs/status/auto-evolve-tasks.md | grep -E "Status:|Last check:|發現"
else
  echo "  （尚未跑過 auto-evolve）"
fi
echo ""

# ─── Claude inbox/outbox ───
echo "━━━ Claude 對話 ━━━"
INBOX_MSG=$(grep -c "^### \[" docs/status/claude-inbox.md 2>/dev/null || echo "0")
OUTBOX_MSG=$(grep -c "^### \[" docs/status/claude-outbox.md 2>/dev/null || echo "0")
echo "  收件匣: ${INBOX_MSG} 則待處理"
echo "  發件匣: ${OUTBOX_MSG} 則回覆"
if [[ "$OUTBOX_MSG" -gt 0 ]]; then
  echo ""
  echo "  最新 Claude 回覆："
  # 顯示最新一則回覆的前 5 行
  grep -A5 "^### \[" docs/status/claude-outbox.md 2>/dev/null | head -6 | sed 's/^/  /'
fi
echo ""

# ─── 未 commit 改動 ───
echo "━━━ 未 commit 改動 ━━━"
UNCOMMITTED=$(git status --short | grep -v "^??" | wc -l | tr -d ' ')
UNTRACKED=$(git status --short | grep "^??" | wc -l | tr -d ' ')
echo "  修改: $UNCOMMITTED 檔  未追蹤: $UNTRACKED 檔"
if [[ "$UNCOMMITTED" -gt 0 ]]; then
  git status --short | grep -v "^??" | head -5 | sed 's/^/  /'
fi
echo ""

# ─── 主線狀態 ───
echo "━━━ 最新 checkpoint ━━━"
if [[ -f "docs/status/current-work.md" ]]; then
  grep -A1 "^- \`20" docs/status/current-work.md | head -6 | sed 's/^/  /'
else
  echo "  （無）"
fi
echo ""

# ─── 建議下一步 ───
echo "━━━ 建議操作 ━━━"
if [[ "$UNCOMMITTED" -gt 0 ]]; then
  echo "  → 有未 commit 的改動，考慮 review 後 commit"
fi
if grep -q "NEEDS FIX" docs/status/auto-evolve-tasks.md 2>/dev/null; then
  echo "  → auto-evolve 有未修復的問題，跑 dispatch-llm.sh evolve"
fi
if [[ "$INBOX_MSG" -gt 0 ]]; then
  echo "  → Claude inbox 有訊息，跑 dispatch-llm.sh claude-review"
fi
echo "  → 完整審查：dispatch-llm.sh claude-review"
echo "  → 自動修復：dispatch-llm.sh evolve"
echo ""
