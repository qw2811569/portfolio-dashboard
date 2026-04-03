#!/usr/bin/env bash
# 確保本地伺服器在跑 — 所有腳本共用入口
# 用法：source scripts/ensure-server.sh  或  bash scripts/ensure-server.sh
#
# 檢查 127.0.0.1:3002 是否回應 200，不通就自動拉起

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=3002
URL="http://127.0.0.1:${PORT}"
PID_FILE="/tmp/local-server.pid"
SERVER_LOG="/tmp/serve.log"

# 載入 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 24 > /dev/null 2>&1 || true
if ! command -v node >/dev/null 2>&1; then
  NODE24_BIN="$HOME/.nvm/versions/node/v24.13.1/bin"
  [ -d "$NODE24_BIN" ] && export PATH="$NODE24_BIN:$PATH"
fi

check_server() {
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "$URL/" 2>/dev/null || echo "000")
  [[ "$status" == "200" ]]
}

start_server() {
  echo "[ensure-server] 伺服器未回應，啟動中..."

  # 確保 dist 目錄存在
  if [[ ! -d "$ROOT_DIR/dist" ]]; then
    echo "[ensure-server] dist/ 不存在，先 build..."
    (cd "$ROOT_DIR" && npm run build > /dev/null 2>&1)
  fi

  # 殺掉舊的（只殺我們自己記錄的 PID）
  if [[ -f "$PID_FILE" ]]; then
    local old_pid
    old_pid=$(cat "$PID_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi

  # 啟動
  (cd "$ROOT_DIR" && nohup npx serve dist -l "$PORT" > "$SERVER_LOG" 2>&1 &
   echo $! > "$PID_FILE")

  # 等待啟動
  local retries=0
  while [[ $retries -lt 10 ]]; do
    sleep 1
    if check_server; then
      echo "[ensure-server] ✅ 伺服器已啟動 (PID: $(cat "$PID_FILE"), $URL)"
      return 0
    fi
    retries=$((retries + 1))
  done

  echo "[ensure-server] ❌ 伺服器啟動失敗"
  return 1
}

# 主邏輯
if check_server; then
  echo "[ensure-server] ✅ 伺服器正常 ($URL)"
else
  start_server
fi
