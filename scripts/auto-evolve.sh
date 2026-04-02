#!/usr/bin/env bash
# OpenClaw 自動進化循環
# 用法：bash scripts/auto-evolve.sh
#
# 這個腳本做三件事：
# 1. 健康檢查（測試、build、lint）
# 2. 把問題寫到 docs/status/auto-evolve-tasks.md
# 3. 自動派工給 Codex 修復
#
# OpenClaw 只需要定期跑這個腳本，不需要人盯。

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

TASK_FILE="docs/status/auto-evolve-tasks.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
PROBLEMS=()
WARNINGS=()

echo "=== auto-evolve 開始 ($TIMESTAMP) ==="

# ─── Step 1: Build 檢查 ───
echo "[check] npm run build..."
BUILD_OUTPUT=$(npm run build 2>&1) || true
if echo "$BUILD_OUTPUT" | grep -q "error TS\|Build failed\|ERROR\|SyntaxError"; then
  BUILD_ERRORS=$(echo "$BUILD_OUTPUT" | grep -E "error TS|ERROR|SyntaxError|Build failed" | head -10)
  PROBLEMS+=("BUILD_FAIL: $BUILD_ERRORS")
  echo "[❌] build 失敗"
else
  echo "[✅] build 通過"
fi

# ─── Step 2: Lint 檢查 ───
echo "[check] npm run lint..."
LINT_OUTPUT=$(npm run lint 2>&1) || true
LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -c " error " 2>/dev/null || echo "0")
if [[ "$LINT_ERRORS" -gt 0 ]]; then
  LINT_DETAIL=$(echo "$LINT_OUTPUT" | grep " error " | head -10)
  PROBLEMS+=("LINT_ERROR ($LINT_ERRORS errors): $LINT_DETAIL")
  echo "[❌] lint 有 $LINT_ERRORS 個 error"
else
  echo "[✅] lint 無 error"
fi

# ─── Step 3: 測試檢查 ───
echo "[check] npx vitest run..."
TEST_OUTPUT=$(npx vitest run 2>&1) || true
if echo "$TEST_OUTPUT" | grep -q "Tests.*failed\|FAIL "; then
  TEST_FAILS=$(echo "$TEST_OUTPUT" | grep -E "FAIL |×|✗" | head -10)
  PROBLEMS+=("TEST_FAIL: $TEST_FAILS")
  echo "[❌] 測試有失敗"
else
  TEST_SUMMARY=$(echo "$TEST_OUTPUT" | grep -E "Tests |Test Files " | tail -2)
  echo "[✅] 測試通過 — $TEST_SUMMARY"
fi

# ─── Step 4: Git 狀態 ───
UNCOMMITTED=$(git status --short | grep -v "^??" | wc -l | tr -d ' ')
UNTRACKED=$(git status --short | grep "^??" | wc -l | tr -d ' ')
if [[ "$UNCOMMITTED" -gt 0 ]]; then
  WARNINGS+=("有 $UNCOMMITTED 個未 commit 的改動")
fi

# ─── Step 5: 產出任務檔 ───
if [[ ${#PROBLEMS[@]} -eq 0 ]]; then
  echo ""
  echo "=== 全部通過，沒有需要修的問題 ==="

  cat > "$TASK_FILE" <<TASKEOF
# Auto-Evolve Tasks

Last check: $TIMESTAMP

## Status: ✅ ALL CLEAR

Build、lint、測試全部通過。目前沒有需要自動修復的問題。

$(if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "## Warnings"
  for w in "${WARNINGS[@]}"; do echo "- $w"; done
fi)
TASKEOF

  AI_NAME=OpenClaw bash scripts/ai-status.sh done "auto-evolve 檢查完成，全部通過" >/dev/null 2>&1 || true
  echo ""
  echo "結果已寫入 $TASK_FILE"
  exit 0
fi

# 有問題，產出任務
echo ""
echo "=== 發現 ${#PROBLEMS[@]} 個問題，準備派工 ==="

TASK_DESCRIPTION=""
for p in "${PROBLEMS[@]}"; do
  TASK_DESCRIPTION+="- $p
"
done

cat > "$TASK_FILE" <<TASKEOF
# Auto-Evolve Tasks

Last check: $TIMESTAMP

## Status: ❌ NEEDS FIX

發現 ${#PROBLEMS[@]} 個問題需要修復：

$TASK_DESCRIPTION

## Instructions for Codex

請依照以下順序修復：
1. 先修 BUILD_FAIL（如果有的話）
2. 再修 TEST_FAIL
3. 最後修 LINT_ERROR
4. 每修一項跑一次驗證（build / test / lint）
5. 完成後用 \`AI_NAME=Codex bash scripts/ai-status.sh done "auto-evolve 修復完成"\` 回報

$(if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "## Warnings"
  for w in "${WARNINGS[@]}"; do echo "- $w"; done
fi)
TASKEOF

echo "任務已寫入 $TASK_FILE"

# ─── Step 6: 自動派 Codex ───
if command -v codex >/dev/null 2>&1; then
  CODEX_PROMPT="讀 docs/status/auto-evolve-tasks.md，裡面有 build/test/lint 的失敗項目。請逐一修復，每修一項跑驗證確認通過。完成後用 AI_NAME=Codex bash scripts/ai-status.sh done 回報。"
  echo "[dispatch] 派 Codex 修復..."
  AI_NAME=Codex bash scripts/ai-status.sh start "auto-evolve 修復：${#PROBLEMS[@]} 個問題" >/dev/null 2>&1 || true
  nohup codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox -C "$ROOT_DIR" "$CODEX_PROMPT" > /tmp/codex-auto-evolve.log 2>&1 &
  echo "[dispatch] Codex 已在背景啟動 (PID: $!)"
else
  echo "[dispatch] Codex CLI 不存在，問題已寫入 $TASK_FILE，等待手動處理"
  AI_NAME=OpenClaw bash scripts/ai-status.sh blocker "auto-evolve 發現 ${#PROBLEMS[@]} 個問題但 Codex 不可用" >/dev/null 2>&1 || true
fi

echo ""
echo "=== auto-evolve 結束 ==="
