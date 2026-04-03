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

# ─── QA 函數：分三層檢查 ───
run_qa() {
  local problems=0
  local details=""
  local qa_summary=""

  # ═══ Level 1：CI 基礎（build/lint/test）═══
  log "QA Level 1: CI 基礎..."

  # Build
  BUILD_OUT=$(npm run build 2>&1) || true
  if echo "$BUILD_OUT" | grep -qE "error TS|Build failed|ERROR|SyntaxError"; then
    problems=$((problems + 1))
    details+="BUILD_FAIL: $(echo "$BUILD_OUT" | grep -E 'error TS|ERROR|SyntaxError|Build failed' | head -3)\n"
    log "  🔴 build FAIL"
    qa_summary+="build:FAIL "
  else
    log "  ✅ build"
    qa_summary+="build:OK "
  fi

  # Lint
  LINT_OUT=$(npm run lint 2>&1) || true
  LINT_ERRS="$(echo "$LINT_OUT" | grep -c " error " || true)"
  LINT_ERRS="${LINT_ERRS:-0}"
  if [[ "$LINT_ERRS" -gt 0 ]]; then
    problems=$((problems + 1))
    details+="LINT_ERROR: $(echo "$LINT_OUT" | grep ' error ' | head -5)\n"
    log "  🔴 lint ($LINT_ERRS errors)"
    qa_summary+="lint:FAIL "
  else
    log "  ✅ lint"
    qa_summary+="lint:OK "
  fi

  # Test
  TEST_OUT=$(npx vitest run 2>&1) || true
  if echo "$TEST_OUT" | grep -qE "Tests.*failed|FAIL "; then
    problems=$((problems + 1))
    TEST_FAILS=$(echo "$TEST_OUT" | grep -E "FAIL |×|✗" | head -5)
    details+="TEST_FAIL: $TEST_FAILS\n"
    log "  🔴 test FAIL"
    qa_summary+="test:FAIL "
  else
    TEST_SUMMARY=$(echo "$TEST_OUT" | grep -E "Test Files|Tests " | tail -2 | tr '\n' ', ')
    log "  ✅ test ($TEST_SUMMARY)"
    qa_summary+="test:OK "
  fi

  # ═══ Level 2：API handler 驗證（不走 HTTP，直接 node 檢查）═══
  log "QA Level 2: API handler 檢查..."

  # 檢查關鍵 API 檔案存在且能被 node 解析
  API_OK=0
  API_TOTAL=0
  for api_file in api/brain.js api/analyze.js api/event-calendar.js api/research.js api/finmind.js; do
    API_TOTAL=$((API_TOTAL + 1))
    if [[ -f "$api_file" ]]; then
      # 檢查檔案能被 node 語法解析（不執行）
      if node --check "$api_file" 2>/dev/null; then
        API_OK=$((API_OK + 1))
      else
        problems=$((problems + 1))
        details+="API_SYNTAX_ERROR: $api_file 有語法錯誤\n"
        log "  🔴 $api_file 語法錯誤"
      fi
    else
      problems=$((problems + 1))
      details+="API_MISSING: $api_file 不存在\n"
      log "  🔴 $api_file 缺失"
    fi
  done
  log "  API handlers: $API_OK/$API_TOTAL 語法正確"
  qa_summary+="api:${API_OK}/${API_TOTAL} "

  # 檢查 API 有正確的 export default function
  MISSING_EXPORT=$(grep -rL "export default\|module.exports" api/*.js 2>/dev/null | head -3)
  if [[ -n "$MISSING_EXPORT" ]]; then
    problems=$((problems + 1))
    details+="API_NO_EXPORT: $(echo "$MISSING_EXPORT" | tr '\n' ', ') 缺少 export\n"
    log "  🔴 部分 API 缺少 export"
  fi

  # 如果 vercel dev 在跑，額外測首頁
  FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:3002/ 2>/dev/null || echo "000")
  if [[ "$FRONTEND" == "200" ]]; then
    log "  ✅ 首頁 HTTP 200"
    qa_summary+="frontend:OK "
  elif [[ "$FRONTEND" != "000" ]]; then
    problems=$((problems + 1))
    details+="FRONTEND_DOWN: HTTP $FRONTEND\n"
    log "  🔴 首頁 HTTP $FRONTEND"
    qa_summary+="frontend:FAIL "
  else
    qa_summary+="frontend:N/A "
  fi

  # ═══ Level 3：Qwen 深度驗證（派 Qwen 跑功能測試）═══
  log "QA Level 3: Qwen 深度驗證..."
  QWEN_REPORT=$(openclaw agent --agent qwen \
    --message "你是 QA 測試員。讀 QWEN.md 了解你的角色。現在做快速功能檢查：
1. 跑 node -e \"const kb = require('./src/lib/knowledgeBase.js'); console.log('KB entries:', Object.keys(kb).length)\" 看知識庫是否能載入
2. 檢查 src/App.jsx 是否存在且無明顯語法問題
3. 檢查 src/hooks/useDailyAnalysisWorkflow.js 是否存在
4. 跑 git log --oneline -3 確認最近改動合理

用以下格式回報，第一行必須是 PASS 或 FAIL：
PASS/FAIL
- 項目1: OK/FAIL 原因
- 項目2: OK/FAIL 原因" \
    --timeout 90 2>&1) || true

  log "  Qwen: $(echo "$QWEN_REPORT" | head -1)"
  if echo "$QWEN_REPORT" | head -1 | grep -qi "FAIL"; then
    problems=$((problems + 1))
    details+="QWEN_QA_FAIL: $(echo "$QWEN_REPORT" | head -5 | tr '\n' ' ')\n"
    qa_summary+="qwen:FAIL "
  else
    qa_summary+="qwen:OK "
  fi

  # ═══ 寫結果 ═══
  echo "$problems" > /tmp/auto-loop-qa-count
  printf "%b" "$details" > /tmp/auto-loop-qa-details

  # 追加到對話紀錄
  if [[ "$problems" -eq 0 ]]; then
    convo "QA" "全部通過 ✅ [$qa_summary]"
  else
    convo "QA" "發現 $problems 個問題 [$qa_summary]：$(printf '%b' "$details" | tr '\n' ' ')"
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
    --message "你是這個專案的技術架構師。自動閉環已跑到第 $ROUND 輪。

先讀 docs/status/loop-conversation.md 了解完整歷程（包括 QA 的詳細結果），再做以下檢查：
1. git log --oneline -10
2. 讀 docs/status/current-work.md 的 Objective 和 Latest checkpoint
3. 檢查 loop-conversation.md 中 QA 的 api 項目是否全部 OK

重要：不要自己去 curl localhost，本地 vercel dev 的 API 路由有已知限制。只根據 QA 紀錄中的結果判斷。

判斷標準（全部滿足才算 STABLE）：
- QA 紀錄顯示 build/lint/test 全綠
- QA 紀錄顯示 API handler 語法檢查通過
- 沒有已知的未修復 blocker（看 current-work.md）
- Qwen QA 沒有回報 FAIL

回答第一個詞必須是 STABLE 或 UNSTABLE，然後用 50 字以內說明。
如果 UNSTABLE，列出 1-3 個具體的 Codex 可修的問題（附檔名）。
回覆中不要用反引號或特殊符號。" \
    --timeout 120 2>&1) || true

  log "Claude 回覆完成"
  echo "${CLAUDE_RESULT:-empty}" > /tmp/auto-loop-claude-result
  convo "Claude" "$(echo "${CLAUDE_RESULT:-empty}" | head -5)"
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
$(cat /tmp/auto-loop-claude-result)

## 最後 QA
- build: ✅
- lint: ✅
- test: ✅
RESULTEOF

        AI_NAME=OpenClaw bash scripts/ai-status.sh done "自動閉環完成：$ROUND 輪後穩定" >/dev/null 2>&1 || true
        exit 0
      else
        log "Claude 認為還不穩定，派 Codex 處理..."
        CLAUDE_FILE="/tmp/auto-loop-claude-result"
        openclaw agent --agent codex \
          --message "讀 /tmp/auto-loop-claude-result 檔案，裡面是 Claude 的審查結果。請針對 Claude 指出的問題進行修復。完成後用 AI_NAME=Codex bash scripts/ai-status.sh done 回報。" \
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
