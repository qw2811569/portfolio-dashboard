#!/usr/bin/env bash
# 自動閉環：QA → 修復 → 驗證 → 審查 → 重複，直到零 bug
#
# 用法：bash scripts/auto-loop.sh
# 停止條件：build + lint + test 全部通過，連續兩輪 QA 零問題
#
# 流程：
#   Round N:
#     1. Qwen 跑 QA（build/lint/test/API）
#     2. 有問題 → Codex 修
#     3. Codex 修完 → Qwen 再跑 QA 驗證
#     4. 還有問題 → 回到 2
#     5. 全部通過 → Claude 做最終審查
#     6. Claude 說 OK → 結束；Claude 說還有事 → 回到 1

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

MAX_ROUNDS=5
CONSECUTIVE_PASS=0
REQUIRED_CONSECUTIVE_PASS=2
ROUND=0
RESULT_FILE="docs/status/auto-loop-result.md"
CONVO_FILE="docs/status/loop-conversation.md"

log() { echo "[loop $(date '+%H:%M')] $*"; }

# 追加對話紀錄
convo() {
  local role="$1"
  shift
  local msg="$*"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M')
  # 用 python 插入到 --- 之後（最新在最上面）
  python3 -c "
content = open('$CONVO_FILE').read()
entry = '### [$ts] $role (Round $ROUND)\n$msg\n'
marker = '---'
idx = content.find(marker)
if idx >= 0:
    pos = idx + len(marker)
    content = content[:pos] + '\n\n' + entry + content[pos:]
else:
    content += '\n' + entry
open('$CONVO_FILE', 'w').write(content)
" 2>/dev/null || true
}

# ─── QA 函數：跑 build/lint/test，回傳問題數 ───
run_qa() {
  local problems=0
  local details=""

  # Build
  log "QA: npm run build..."
  BUILD_OUT=$(npm run build 2>&1) || true
  if echo "$BUILD_OUT" | grep -qE "error TS|Build failed|ERROR|SyntaxError"; then
    problems=$((problems + 1))
    details+="BUILD_FAIL: $(echo "$BUILD_OUT" | grep -E 'error TS|ERROR|SyntaxError|Build failed' | head -3)\n"
    log "  🔴 build FAIL"
  else
    log "  ✅ build PASS"
  fi

  # Lint
  log "QA: npm run lint..."
  LINT_OUT=$(npm run lint 2>&1) || true
  LINT_ERRS="$(echo "$LINT_OUT" | grep -c " error " || true)"
  LINT_ERRS="${LINT_ERRS:-0}"
  if [[ "$LINT_ERRS" -gt 0 ]]; then
    problems=$((problems + 1))
    details+="LINT_ERROR: $(echo "$LINT_OUT" | grep ' error ' | head -5)\n"
    log "  🔴 lint FAIL ($LINT_ERRS errors)"
  else
    log "  ✅ lint PASS"
  fi

  # Test
  log "QA: npx vitest run..."
  TEST_OUT=$(npx vitest run 2>&1) || true
  if echo "$TEST_OUT" | grep -qE "Tests.*failed|FAIL "; then
    problems=$((problems + 1))
    details+="TEST_FAIL: $(echo "$TEST_OUT" | grep -E 'FAIL |×|✗' | head -5)\n"
    log "  🔴 test FAIL"
  else
    log "  ✅ test PASS"
  fi

  # API（如果 vercel dev 在跑）
  FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:3002/ 2>/dev/null || echo "000")
  if [[ "$FRONTEND" == "200" ]]; then
    log "  ✅ frontend HTTP 200"
  elif [[ "$FRONTEND" != "000" ]]; then
    problems=$((problems + 1))
    details+="FRONTEND_ERROR: HTTP $FRONTEND\n"
    log "  🔴 frontend HTTP $FRONTEND"
  else
    log "  ⏭️ frontend not running, skip"
  fi

  # 寫結果到暫存
  echo "$problems" > /tmp/auto-loop-qa-count
  printf "%b" "$details" > /tmp/auto-loop-qa-details

  # 追加到對話紀錄
  if [[ "$problems" -eq 0 ]]; then
    convo "QA" "全部通過 ✅ build/lint/test/frontend"
  else
    convo "QA" "發現 $problems 個問題：$(printf '%b' "$details" | tr '\n' ' ')"
  fi
  return 0
}

# ─── Codex 修復函數 ───
run_codex_fix() {
  local details
  details=$(cat /tmp/auto-loop-qa-details)

  log "派 Codex 修復..."

  # 寫任務檔給 Codex
  cat > docs/status/auto-evolve-tasks.md <<TASKEOF
# Auto-Loop Tasks — Round $ROUND

## 問題清單

$(printf "%b" "$details" | sed 's/^/- /')

## Instructions

修復以上所有問題。每修一項跑驗證確認通過。
修完後用 AI_NAME=Codex bash scripts/ai-status.sh done "Round $ROUND 修復完成" 回報。
不要做額外的事，只修上面列的問題。
TASKEOF

  CODEX_RESULT=$(openclaw agent --agent codex \
    --message "讀 docs/status/auto-evolve-tasks.md，修復裡面列的所有問題。每修一項跑 build/lint/test 驗證。完成後用 AI_NAME=Codex bash scripts/ai-status.sh done 回報。" \
    --timeout 300 2>&1) || true

  log "Codex 回覆：$(echo "$CODEX_RESULT" | head -3)"
  echo "$CODEX_RESULT" > /tmp/auto-loop-codex-result
  convo "Codex" "$(echo "$CODEX_RESULT" | head -10)"
}

# ─── Claude 審查函數 ───
run_claude_review() {
  log "請 Claude 做最終審查..."

  CLAUDE_RESULT=$(openclaw agent --agent claude \
    --message "你是這個專案的技術架構師。自動閉環已跑到第 $ROUND 輪，build/lint/test 全部通過。

先讀 docs/status/loop-conversation.md 了解完整歷程，再做以下檢查：
1. git log --oneline -5
2. git diff --stat HEAD~3
3. 讀 docs/status/current-work.md 的 Latest checkpoint

判斷專案是否穩定可交付。
回答第一個詞必須是 STABLE 或 UNSTABLE，然後用 50 字以內說明原因。
如果是 UNSTABLE，列出最關鍵的 1-2 個 Codex 可以修的具體問題。" \
    --timeout 120 2>&1) || true

  log "Claude 回覆：$CLAUDE_RESULT"
  echo "$CLAUDE_RESULT" > /tmp/auto-loop-claude-result
  convo "Claude" "$CLAUDE_RESULT"
}

# ─── 主循環 ───
log "========================================="
log "自動閉環啟動（目標：零 bug，最多 $MAX_ROUNDS 輪）"
log "========================================="

while [[ $ROUND -lt $MAX_ROUNDS ]]; do
  ROUND=$((ROUND + 1))
  log ""
  log "═══ Round $ROUND / $MAX_ROUNDS ═══"

  # Step 1: QA
  run_qa
  QA_PROBLEMS=$(cat /tmp/auto-loop-qa-count)

  if [[ "$QA_PROBLEMS" -eq 0 ]]; then
    CONSECUTIVE_PASS=$((CONSECUTIVE_PASS + 1))
    log "QA 通過（連續 $CONSECUTIVE_PASS 次）"

    if [[ $CONSECUTIVE_PASS -ge $REQUIRED_CONSECUTIVE_PASS ]]; then
      # Step 5: Claude 最終審查
      run_claude_review
      CLAUDE_RESULT=$(cat /tmp/auto-loop-claude-result)

      if echo "$CLAUDE_RESULT" | grep -qi "^STABLE\|: STABLE\| STABLE$" && ! echo "$CLAUDE_RESULT" | grep -qi "UNSTABLE"; then
        log ""
        log "========================================="
        log "✅ 閉環完成！連續 $CONSECUTIVE_PASS 輪 QA 通過 + Claude 確認穩定"
        log "========================================="

        cat > "$RESULT_FILE" <<RESULTEOF
# Auto-Loop Result

完成時間：$(date '+%Y-%m-%d %H:%M')
總輪數：$ROUND
結果：✅ STABLE

## Claude 審查
$CLAUDE_RESULT

## 最後 QA
- build: ✅
- lint: ✅
- test: ✅
RESULTEOF

        AI_NAME=OpenClaw bash scripts/ai-status.sh done "自動閉環完成：$ROUND 輪後穩定" >/dev/null 2>&1 || true
        exit 0
      else
        log "Claude 認為還不穩定：$CLAUDE_RESULT"
        log "派 Codex 處理 Claude 指出的問題..."
        openclaw agent --agent codex \
          --message "Claude 審查結果：$CLAUDE_RESULT。請針對 Claude 指出的問題進行修復或補強。完成後用 AI_NAME=Codex bash scripts/ai-status.sh done 回報。" \
          --timeout 300 2>&1 | head -5 || true
        CONSECUTIVE_PASS=0
      fi
    else
      log "再通過 $((REQUIRED_CONSECUTIVE_PASS - CONSECUTIVE_PASS)) 次才做最終審查"
    fi
  else
    CONSECUTIVE_PASS=0
    log "發現 $QA_PROBLEMS 個問題"

    # Step 2: Codex 修復
    run_codex_fix

    # Step 3: 修完後立刻再跑一次 QA 驗證
    log "Codex 修完，立刻重跑 QA 驗證..."
    run_qa
    VERIFY_PROBLEMS=$(cat /tmp/auto-loop-qa-count)

    if [[ "$VERIFY_PROBLEMS" -eq 0 ]]; then
      CONSECUTIVE_PASS=1
      log "修復驗證通過（連續 $CONSECUTIVE_PASS 次）"
    else
      log "修復後仍有 $VERIFY_PROBLEMS 個問題，下一輪繼續"
    fi
  fi
done

# 達到最大輪數
log ""
log "========================================="
log "⚠️ 達到最大輪數 ($MAX_ROUNDS)，仍有問題未解決"
log "========================================="

QA_DETAILS=$(cat /tmp/auto-loop-qa-details 2>/dev/null || echo "無")

cat > "$RESULT_FILE" <<RESULTEOF
# Auto-Loop Result

完成時間：$(date '+%Y-%m-%d %H:%M')
總輪數：$ROUND (達到上限)
結果：⚠️ INCOMPLETE

## 剩餘問題
$(printf "%b" "$QA_DETAILS" | sed 's/^/- /')

## 建議
請人工介入處理剩餘問題，或增加 MAX_ROUNDS 後重跑。
RESULTEOF

AI_NAME=OpenClaw bash scripts/ai-status.sh blocker "自動閉環 $MAX_ROUNDS 輪後仍有問題" >/dev/null 2>&1 || true
exit 1
