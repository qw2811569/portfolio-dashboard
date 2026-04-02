#!/usr/bin/env bash
# 自動恢復機制 — 偵測卡住的 AI 並重新派工
# 用法：bash scripts/auto-recover.sh
#
# OpenClaw 定期跑這個腳本（例如每 30 分鐘），偵測：
# 1. AI 狀態是 working 但超過 30 分鐘沒更新 → 可能卡住
# 2. 有 blocker 未處理 → 需要介入
# 3. auto-evolve-tasks.md 有任務但沒人在做 → 重新派工

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

TIMEOUT_MINUTES=30
NOW_EPOCH=$(date +%s)
RECOVERED=0

echo "=== auto-recover 開始 ($(date '+%Y-%m-%d %H:%M')) ==="

# 用 python 解析 ai-activity.json 偵測卡住的 AI
python3 - "$NOW_EPOCH" "$TIMEOUT_MINUTES" <<'PYEOF'
import json, sys, os
from datetime import datetime

now_epoch = int(sys.argv[1])
timeout_min = int(sys.argv[2])

activity_file = "docs/status/ai-activity.json"
if not os.path.exists(activity_file):
    print("[skip] ai-activity.json 不存在")
    sys.exit(0)

with open(activity_file) as f:
    data = json.load(f)

stuck = []
blockers = []

for member in data.get("members", []):
    name = member.get("name", "?")
    status = member.get("status", "idle")
    last_active = member.get("lastActive", "")

    if not last_active:
        continue

    try:
        # parse "2026-04-02 23:37" format
        last_dt = datetime.strptime(last_active, "%Y-%m-%d %H:%M")
        last_epoch = int(last_dt.timestamp())
        minutes_ago = (now_epoch - last_epoch) // 60
    except Exception:
        minutes_ago = -1

    if status == "working" and minutes_ago > timeout_min:
        stuck.append(f"{name}: working 但已 {minutes_ago} 分鐘沒更新")
        print(f"[⚠️] {name} 可能卡住 — status=working, 最後活動 {minutes_ago} 分鐘前")

    if status == "blocker":
        task = member.get("currentTask", "未知")
        blockers.append(f"{name}: {task}")
        print(f"[🚫] {name} 有 blocker — {task}")

if not stuck and not blockers:
    print("[✅] 所有 AI 狀態正常，沒有卡住或 blocker")

# 寫出結果供 bash 讀取
with open("/tmp/auto-recover-result.txt", "w") as f:
    f.write(f"STUCK={len(stuck)}\n")
    f.write(f"BLOCKERS={len(blockers)}\n")
    for s in stuck:
        f.write(f"STUCK_DETAIL:{s}\n")
    for b in blockers:
        f.write(f"BLOCKER_DETAIL:{b}\n")
PYEOF

# 讀取 python 分析結果
if [[ -f /tmp/auto-recover-result.txt ]]; then
  STUCK_COUNT=$(grep "^STUCK=" /tmp/auto-recover-result.txt | cut -d= -f2)
  BLOCKER_COUNT=$(grep "^BLOCKERS=" /tmp/auto-recover-result.txt | cut -d= -f2)

  # 如果有 AI 卡住，重跑 evolve 來重新派工
  if [[ "$STUCK_COUNT" -gt 0 ]]; then
    echo ""
    echo "[recover] 偵測到 $STUCK_COUNT 個 AI 卡住，重跑 auto-evolve..."
    bash scripts/auto-evolve.sh 2>&1
    RECOVERED=1
  fi

  # 如果有 blocker，嘗試請 Claude 判斷怎麼處理
  if [[ "$BLOCKER_COUNT" -gt 0 ]]; then
    BLOCKER_DETAILS=$(grep "^BLOCKER_DETAIL:" /tmp/auto-recover-result.txt | sed 's/^BLOCKER_DETAIL://' | tr '\n' '; ')
    echo ""
    echo "[recover] 偵測到 $BLOCKER_COUNT 個 blocker，請 Claude 判斷..."
    if command -v claude >/dev/null 2>&1; then
      bash scripts/claude-review.sh "有 AI 回報 blocker：$BLOCKER_DETAILS。請判斷怎麼處理。" 2>&1
      RECOVERED=1
    else
      echo "[recover] Claude CLI 不可用，blocker 等待人工處理"
    fi
  fi

  rm -f /tmp/auto-recover-result.txt
fi

# 檢查是否有未處理的 auto-evolve 任務
if [[ -f "docs/status/auto-evolve-tasks.md" ]]; then
  if grep -q "NEEDS FIX" "docs/status/auto-evolve-tasks.md"; then
    # 確認是否有 AI 正在處理
    ANYONE_WORKING=$(python3 -c "
import json
with open('docs/status/ai-activity.json') as f:
    data = json.load(f)
working = [m['name'] for m in data.get('members', []) if m.get('status') == 'working']
print(','.join(working) if working else 'none')
" 2>/dev/null || echo "unknown")

    if [[ "$ANYONE_WORKING" == "none" ]]; then
      echo ""
      echo "[recover] auto-evolve 有未處理任務但沒有 AI 在工作，重新派工..."
      bash scripts/auto-evolve.sh 2>&1
      RECOVERED=1
    else
      echo "[ℹ️] auto-evolve 有任務，$ANYONE_WORKING 正在處理中"
    fi
  fi
fi

if [[ "$RECOVERED" -eq 0 ]]; then
  echo ""
  echo "=== 一切正常，不需要恢復 ==="
fi

echo "=== auto-recover 結束 ==="
