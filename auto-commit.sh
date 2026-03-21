#!/bin/bash
# ── auto-commit.sh ────────────────────────────────────────────────
# 自動偵測專案變更，有變更就 commit + push
# 每次執行時間：由 launchd 控制（預設每 30 分鐘）
# ─────────────────────────────────────────────────────────────────

REPO_DIR="$HOME/APP/test"
LOG_FILE="$HOME/Library/Logs/portfolio-autosave.log"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")

log() {
  echo "[${TIMESTAMP}] $1" >> "$LOG_FILE"
}

cd "$REPO_DIR" || { log "❌ 找不到專案目錄：$REPO_DIR"; exit 1; }

# 檢查是否有任何變更（包含 untracked 檔案）
if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  log "✅ 無變更，跳過 commit"
  exit 0
fi

log "📝 偵測到變更，開始自動儲存..."

# Stage 所有變更
git add -A

# Commit（附時間戳）
COMMIT_MSG="auto: 自動儲存 ${TIMESTAMP}"
git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
  log "✅ Commit 成功：${COMMIT_MSG}"
else
  log "❌ Commit 失敗，請查看上方錯誤訊息"
  exit 1
fi

# Push 到遠端
git push origin main >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
  log "🚀 Push 成功"
else
  log "⚠️  Push 失敗（可能是網路或憑證問題），commit 已保留在本機"
  exit 1
fi
