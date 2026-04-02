#!/usr/bin/env bash
# OpenClaw 自動進化循環
# 用法：bash scripts/auto-evolve.sh
#
# 這個腳本做四件事：
# 1. 健康檢查（測試、build、lint、前台）
# 2. 把問題寫到 docs/status/auto-evolve-tasks.md
# 3. 後端/邏輯問題 → 派 Codex 修復
# 4. 前台/UI 問題 → 派 Qwen 修復
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
QWEN_TASKS=()
CODEX_TASKS=()

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

# ─── Step 4: 前台 UI 檢查 ───
echo "[check] 前台元件完整性..."

# 檢查關鍵 UI 元件是否存在且無語法錯誤
UI_ISSUES=""
for comp in src/components/AppPanels.jsx src/components/reports/DailyReportPanel.jsx src/components/research/ResearchPanel.jsx src/App.jsx; do
  if [[ ! -f "$comp" ]]; then
    UI_ISSUES+="缺少關鍵元件 $comp; "
  fi
done

# 檢查 build 產出的 chunk 大小警告（UI 體驗相關）
if echo "$BUILD_OUTPUT" | grep -q "kB.*│.*kB\|chunk .* is larger"; then
  CHUNK_WARNINGS=$(echo "$BUILD_OUTPUT" | grep -E "kB.*│|chunk .* is larger" | tail -3)
  WARNINGS+=("UI_CHUNK_SIZE: $CHUNK_WARNINGS")
fi

# 如果 vercel dev 有在跑，檢查首頁是否正常回應
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:3002/ 2>/dev/null || echo "000")
if [[ "$FRONTEND_STATUS" == "200" ]]; then
  echo "[✅] 前台服務正常 (HTTP 200)"

  # 檢查關鍵 API 端點
  for api in "/api/brain?action=all" "/api/event-calendar?range=7&codes=2308"; do
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://localhost:3002${api}" 2>/dev/null || echo "000")
    if [[ "$API_STATUS" != "200" && "$API_STATUS" != "400" && "$API_STATUS" != "405" ]]; then
      QWEN_TASKS+=("API_ERROR: ${api} 回傳 HTTP $API_STATUS")
    fi
  done
elif [[ "$FRONTEND_STATUS" == "000" ]]; then
  echo "[⚠️] 前台未啟動（localhost:3002 無回應）"
  WARNINGS+=("vercel dev 未啟動，跳過前台 API 檢查")
else
  QWEN_TASKS+=("FRONTEND_ERROR: 首頁回傳 HTTP $FRONTEND_STATUS")
  echo "[❌] 前台異常 (HTTP $FRONTEND_STATUS)"
fi

if [[ -n "$UI_ISSUES" ]]; then
  QWEN_TASKS+=("UI_MISSING: $UI_ISSUES")
  echo "[❌] 前台元件缺失"
else
  echo "[✅] 前台關鍵元件完整"
fi

# ─── Step 5: Git 狀態 ───
UNCOMMITTED=$(git status --short | grep -v "^??" | wc -l | tr -d ' ')
UNTRACKED=$(git status --short | grep "^??" | wc -l | tr -d ' ')
if [[ "$UNCOMMITTED" -gt 0 ]]; then
  WARNINGS+=("有 $UNCOMMITTED 個未 commit 的改動")
fi

# 把 build/test/lint 問題歸到 Codex
for p in "${PROBLEMS[@]}"; do
  CODEX_TASKS+=("$p")
done

# ─── Step 6: 產出任務檔 ───
TOTAL_ISSUES=$(( ${#CODEX_TASKS[@]} + ${#QWEN_TASKS[@]} ))
if [[ "$TOTAL_ISSUES" -eq 0 ]]; then
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
echo "=== 發現 $TOTAL_ISSUES 個問題（Codex: ${#CODEX_TASKS[@]}, Qwen: ${#QWEN_TASKS[@]}），準備派工 ==="

CODEX_DESC=""
for p in "${CODEX_TASKS[@]}"; do
  CODEX_DESC+="- $p
"
done

QWEN_DESC=""
for p in "${QWEN_TASKS[@]}"; do
  QWEN_DESC+="- $p
"
done

cat > "$TASK_FILE" <<TASKEOF
# Auto-Evolve Tasks

Last check: $TIMESTAMP

## Status: ❌ NEEDS FIX

發現 $TOTAL_ISSUES 個問題（Codex: ${#CODEX_TASKS[@]}, Qwen: ${#QWEN_TASKS[@]}）

$(if [[ ${#CODEX_TASKS[@]} -gt 0 ]]; then
cat <<CODEXEOF
## Codex 任務（後端 / 邏輯 / 測試）

$CODEX_DESC
### Instructions for Codex

請依照以下順序修復：
1. 先修 BUILD_FAIL（如果有的話）
2. 再修 TEST_FAIL
3. 最後修 LINT_ERROR
4. 每修一項跑一次驗證（build / test / lint）
5. 完成後用 \`AI_NAME=Codex bash scripts/ai-status.sh done "auto-evolve 修復完成"\` 回報
CODEXEOF
fi)

$(if [[ ${#QWEN_TASKS[@]} -gt 0 ]]; then
cat <<QWENEOF
## Qwen 任務（前台 / UI / API 端點）

$QWEN_DESC
### Instructions for Qwen

請依照以下順序修復：
1. 先修 FRONTEND_ERROR（首頁無法載入）
2. 再修 API_ERROR（API 端點異常）
3. 最後修 UI_MISSING（缺少元件）
4. 每修一項用瀏覽器或 curl 驗證
5. 完成後用 \`AI_NAME=Qwen bash scripts/ai-status.sh done "auto-evolve UI 修復完成"\` 回報
QWENEOF
fi)

$(if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "## Warnings"
  for w in "${WARNINGS[@]}"; do echo "- $w"; done
fi)
TASKEOF

echo "任務已寫入 $TASK_FILE"

# ─── Step 7: 透過 ACP 自動派工 ───
# OpenClaw 的 main agent 會讀 auto-evolve-tasks.md 自行決定派工
# 這裡只輸出建議指令供 OpenClaw 執行

if [[ ${#CODEX_TASKS[@]} -gt 0 ]]; then
  echo ""
  echo "[suggest] 後端問題建議派 Codex："
  echo "  /acp spawn codex \"讀 docs/status/auto-evolve-tasks.md 的 Codex 任務區，逐一修復 build/test/lint 失敗項，每修一項跑驗證。完成後用 AI_NAME=Codex bash scripts/ai-status.sh done 回報。\""
  AI_NAME=Codex bash scripts/ai-status.sh start "auto-evolve 待修：${#CODEX_TASKS[@]} 個後端問題" >/dev/null 2>&1 || true
fi

if [[ ${#QWEN_TASKS[@]} -gt 0 ]]; then
  echo ""
  echo "[suggest] 前台問題建議派 Qwen："
  echo "  /acp spawn qwen \"讀 docs/status/auto-evolve-tasks.md 的 Qwen 任務區，逐一修復前台 UI 和 API 問題。完成後用 AI_NAME=Qwen bash scripts/ai-status.sh done 回報。\""
  AI_NAME=Qwen bash scripts/ai-status.sh start "auto-evolve 待修：${#QWEN_TASKS[@]} 個前台問題" >/dev/null 2>&1 || true
fi

echo ""
echo "=== auto-evolve 結束 ==="
