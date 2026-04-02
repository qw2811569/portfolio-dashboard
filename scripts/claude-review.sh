#!/usr/bin/env bash
# Claude 審查與對話腳本
# OpenClaw 用這個腳本讓 Claude 參與專案進化循環
#
# 用法：
#   bash scripts/claude-review.sh                    — 讀 inbox + evolve 結果，給出判斷
#   bash scripts/claude-review.sh "具體問題"          — 直接問 Claude 一個問題
#   bash scripts/dispatch-llm.sh claude-review        — 透過 dispatch 調度
#
# Claude 會：
# 1. 讀 inbox 訊息、auto-evolve 結果、current-work 狀態
# 2. 做整體判斷（架構風險、品質問題、優先順序）
# 3. 回覆寫到 claude-outbox.md
# 4. 如果需要派工，寫出具體指令

set -euo pipefail

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

DIRECT_QUESTION="${1:-}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# 如果有直接問題，寫進 inbox
if [[ -n "$DIRECT_QUESTION" ]]; then
  # 在訊息區插入新訊息（在「（目前沒有新訊息）」之前或訊息區最上面）
  INBOX="docs/status/claude-inbox.md"
  NEW_MSG="### [$TIMESTAMP] 來自：OpenClaw

$DIRECT_QUESTION"

  # 用 python 插入到訊息區頂部
  python3 -c "
import re
with open('$INBOX', 'r') as f:
    content = f.read()
marker = '## 訊息區（新的寫在最上面）'
new_msg = '''$NEW_MSG'''
if '（目前沒有新訊息）' in content:
    content = content.replace('（目前沒有新訊息）', new_msg)
elif marker in content:
    content = content.replace(marker, marker + '\n\n' + new_msg)
with open('$INBOX', 'w') as f:
    f.write(content)
"
  echo "[claude-review] 問題已寫入 inbox"
fi

# 組裝 Claude 的 prompt
CLAUDE_PROMPT="你是這個專案的技術架構師 + 品質總監。現在 OpenClaw 調度你來做審查。

請依序做以下事情：

1. 讀 docs/status/claude-inbox.md — 看有沒有需要回覆的訊息
2. 讀 docs/status/auto-evolve-tasks.md — 看最近一次自動檢查的結果
3. 讀 docs/status/current-work.md 的 Latest checkpoint — 看各 AI 最新進度
4. 快速跑 git log --oneline -10 看最近改動

然後做整體判斷，回覆寫到 docs/status/claude-outbox.md（用追加方式，不要覆蓋舊內容）。

回覆格式：
### [$TIMESTAMP] Claude 審查回覆
**狀態總結**：（一句話描述目前專案狀態）
**主線離可交付還差**：（列出最關鍵的 2-3 件事）
**下一步建議**：（具體要派誰做什麼）
**如果 inbox 有問題**：逐一回答

如果發現需要修的問題，寫出具體派工指令：
- 後端/邏輯/測試問題 → 派 Codex：bash scripts/dispatch-llm.sh codex "具體任務"
- 前台/UI/顯示問題 → 派 Qwen：bash scripts/dispatch-llm.sh qwen "具體任務"
- 需要架構判斷的問題 → 標記等下次跟小奎討論
如果全部正常，就說全部正常，不要找事做。

重要：回覆要簡短、具體、可執行。不要寫長篇大論。"

# 呼叫 Claude CLI
if command -v claude >/dev/null 2>&1; then
  echo "[claude-review] 啟動 Claude 審查..."
  AI_NAME=Claude bash scripts/ai-status.sh start "Claude 審查循環啟動" >/dev/null 2>&1 || true

  CLAUDE_OUTPUT=$(claude --print "$CLAUDE_PROMPT" 2>&1) || true

  if [[ -n "$CLAUDE_OUTPUT" ]]; then
    echo "[claude-review] Claude 已回覆，結果寫入 claude-outbox.md"
    AI_NAME=Claude bash scripts/ai-status.sh done "Claude 審查完成" >/dev/null 2>&1 || true

    # 輸出摘要給 OpenClaw
    echo ""
    echo "=== Claude 回覆摘要 ==="
    echo "$CLAUDE_OUTPUT" | head -30
    echo ""
    if [[ $(echo "$CLAUDE_OUTPUT" | wc -l) -gt 30 ]]; then
      echo "（完整回覆見 docs/status/claude-outbox.md）"
    fi
  else
    echo "[claude-review] Claude 沒有回覆"
    AI_NAME=Claude bash scripts/ai-status.sh blocker "Claude CLI 無回覆" >/dev/null 2>&1 || true
  fi
else
  echo "[claude-review] Claude CLI 不存在"
  AI_NAME=Claude bash scripts/ai-status.sh blocker "Claude CLI 不存在，無法審查" >/dev/null 2>&1 || true
fi
