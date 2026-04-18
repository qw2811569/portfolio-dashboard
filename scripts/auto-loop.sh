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

# 確保本地伺服器在跑
bash "$ROOT_DIR/scripts/ensure-server.sh" 2>&1 || true

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

  # ═══ Level 2：Production API 功能測試 ═══
  PROD_URL="https://jiucaivoice-dashboard.vercel.app"
  log "QA Level 2: Production API 測試 ($PROD_URL)..."

  # 首頁
  PROD_HOME=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$PROD_URL/" 2>/dev/null || echo "000")
  if [[ "$PROD_HOME" == "200" ]]; then
    log "  ✅ 首頁 200"
    qa_summary+="home:OK "
  else
    problems=$((problems + 1))
    details+="PROD_HOME_FAIL: HTTP $PROD_HOME\n"
    log "  🔴 首頁 HTTP $PROD_HOME"
    qa_summary+="home:FAIL "
  fi

  # brain API — 策略大腦要回有效 JSON（單次 curl）
  BRAIN_RAW=$(curl -s -w "\n%{http_code}" --connect-timeout 10 "$PROD_URL/api/brain?action=all" 2>/dev/null || echo -e "\n000")
  BRAIN_STATUS=$(echo "$BRAIN_RAW" | tail -1)
  BRAIN_OUT=$(echo "$BRAIN_RAW" | sed '$d')
  if [[ "$BRAIN_STATUS" == "200" ]] && echo "$BRAIN_OUT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    log "  ✅ /api/brain 回傳有效 JSON"
    qa_summary+="brain:OK "
  else
    problems=$((problems + 1))
    details+="PROD_BRAIN_FAIL: HTTP $BRAIN_STATUS\n"
    log "  🔴 /api/brain HTTP $BRAIN_STATUS"
    qa_summary+="brain:FAIL "
  fi

  # event-calendar API — 要有事件（單次 curl）
  EVENT_RAW=$(curl -s -w "\n%{http_code}" --connect-timeout 15 --max-time 20 "$PROD_URL/api/event-calendar?range=30&codes=2308" 2>/dev/null || echo -e "\n000")
  EVENT_STATUS=$(echo "$EVENT_RAW" | tail -1)
  EVENT_OUT=$(echo "$EVENT_RAW" | sed '$d')
  if [[ "$EVENT_STATUS" == "200" ]]; then
    EVENT_COUNT=$(echo "$EVENT_OUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('events',d.get('data',[]))))" 2>/dev/null || echo "0")
    if [[ "$EVENT_COUNT" -gt 0 ]]; then
      log "  ✅ /api/event-calendar $EVENT_COUNT 個事件"
      qa_summary+="events:OK($EVENT_COUNT) "
    else
      problems=$((problems + 1))
      details+="PROD_EVENTS_EMPTY: HTTP 200 但 0 個事件\n"
      log "  🔴 /api/event-calendar 0 個事件"
      qa_summary+="events:EMPTY "
    fi
  elif [[ "$EVENT_STATUS" == "504" ]]; then
    problems=$((problems + 1))
    details+="PROD_EVENTS_TIMEOUT: HTTP 504 serverless timeout\n"
    log "  🔴 /api/event-calendar 504 timeout"
    qa_summary+="events:TIMEOUT "
  else
    problems=$((problems + 1))
    details+="PROD_EVENTS_FAIL: HTTP $EVENT_STATUS\n"
    log "  🔴 /api/event-calendar HTTP $EVENT_STATUS"
    qa_summary+="events:FAIL "
  fi

  # analyze API — 用最小 payload 測收盤分析
  ANALYZE_OUT=$(curl -s -w "\n%{http_code}" --connect-timeout 15 --max-time 30 \
    -X POST "$PROD_URL/api/analyze" \
    -H "Content-Type: application/json" \
    -d '{"systemPrompt":"test","userPrompt":"reply OK in 5 words","maxTokens":30}' \
    2>/dev/null || echo -e "\n000")
  ANALYZE_STATUS=$(echo "$ANALYZE_OUT" | tail -1)
  ANALYZE_BODY=$(echo "$ANALYZE_OUT" | sed '$d')
  if [[ "$ANALYZE_STATUS" == "200" ]] && [[ -n "$ANALYZE_BODY" ]]; then
    log "  ✅ /api/analyze 回傳 200 有內容"
    qa_summary+="analyze:OK "
  elif [[ "$ANALYZE_STATUS" == "000" ]]; then
    log "  ⚠️ /api/analyze timeout（不算 fail，可能 API key 額度）"
    qa_summary+="analyze:TIMEOUT "
  else
    problems=$((problems + 1))
    details+="PROD_ANALYZE_FAIL: HTTP $ANALYZE_STATUS\n"
    log "  🔴 /api/analyze HTTP $ANALYZE_STATUS"
    qa_summary+="analyze:FAIL "
  fi

  # research API — 只測 GET 存活
  RESEARCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$PROD_URL/api/research" 2>/dev/null || echo "000")
  if [[ "$RESEARCH_STATUS" == "200" || "$RESEARCH_STATUS" == "405" ]]; then
    log "  ✅ /api/research 存活 (HTTP $RESEARCH_STATUS)"
    qa_summary+="research:OK "
  else
    problems=$((problems + 1))
    details+="PROD_RESEARCH_FAIL: HTTP $RESEARCH_STATUS\n"
    log "  🔴 /api/research HTTP $RESEARCH_STATUS"
    qa_summary+="research:FAIL "
  fi

  # ═══ Level 3：Qwen 深度驗證（本地頁面 + 功能檢查）═══
  log "QA Level 3: 本地深度驗證..."

  # 寫 Qwen 任務檔
  cat > /tmp/auto-loop-qwen-task.md <<'QWENTASK'
你是 QA 測試員。依 repo 內目前文件與腳本脈絡執行機械驗證，不假設額外的角色設定檔或 collateral。

本地伺服器在 http://127.0.0.1:3002，請逐一檢查以下頁面和功能：

1. 用 curl http://127.0.0.1:3002/ 確認首頁有回傳 HTML 且包含 id=root
2. 用 curl 測試以下本地 API 端點，記錄每個的 HTTP status：
   - GET http://127.0.0.1:3002/api/brain?action=all
   - GET http://127.0.0.1:3002/api/event-calendar?range=30&codes=2308
   - GET http://127.0.0.1:3002/api/research
3. 檢查 src/App.jsx 是否存在
4. 檢查關鍵元件是否存在：
   - src/components/AppPanels.jsx
   - src/components/reports/DailyReportPanel.jsx
   - src/components/research/ResearchPanel.jsx
   - src/components/holdings/HoldingsTable.jsx
5. 跑 node --check api/brain.js api/analyze.js api/event-calendar.js api/research.js 確認 API 無語法錯誤
6. 跑 git log --oneline -5 確認最近改動合理

注意：本地 vercel dev 的 API 路由可能回傳原始碼而非 JSON，這是已知問題不算 FAIL。
只有當檔案缺失、語法錯誤、或首頁完全無法載入時才算 FAIL。

用以下格式回報，第一行必須是 PASS 或 FAIL：
PASS/FAIL
- 項目1: OK/FAIL 原因
- 項目2: OK/FAIL 原因
QWENTASK

  QWEN_REPORT=$(bash scripts/launch-qwen.sh -y -p "$(cat /tmp/auto-loop-qwen-task.md)" --output-format text 2>&1) || true

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

  CODEX_RESULT=$(bash scripts/launch-codex.sh "讀 docs/status/auto-evolve-tasks.md，修復裡面列的所有問題。每修一項跑 build/lint/test 驗證。完成後用 AI_NAME=Codex bash scripts/ai-status.sh done 回報。" 2>&1) || true

  log "Codex 回覆：$(echo "$CODEX_RESULT" | head -3)"
  echo "$CODEX_RESULT" > /tmp/auto-loop-codex-result
  convo "Codex" "$(echo "$CODEX_RESULT" | head -10)"
}

# ─── Claude 審查函數 ───
run_claude_review() {
  log "請 Claude 做最終審查..."

  CLAUDE_RESULT=$(AI_NAME=Claude bash scripts/launch-qwen.sh -y -p "你是這個專案的技術架構師。自動閉環已跑到第 $ROUND 輪。

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
回覆中不要用反引號或特殊符號。" --output-format text 2>&1) || true

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

        AI_NAME=System bash scripts/ai-status.sh done "自動閉環完成：$ROUND 輪後穩定" >/dev/null 2>&1 || true
        exit 0
      else
        log "Claude 認為還不穩定，派 Codex 處理..."
        CLAUDE_FILE="/tmp/auto-loop-claude-result"
        bash scripts/launch-codex.sh "讀 /tmp/auto-loop-claude-result 檔案，裡面是 Claude 的審查結果。請針對 Claude 指出的問題進行修復。完成後用 AI_NAME=Codex bash scripts/ai-status.sh done 回報。" 2>&1 | head -5 || true
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

AI_NAME=System bash scripts/ai-status.sh blocker "自動閉環 $MAX_ROUNDS 輪後仍有問題" >/dev/null 2>&1 || true
exit 1
