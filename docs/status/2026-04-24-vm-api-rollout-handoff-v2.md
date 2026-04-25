# VM API Rollout Handoff · v2 · 2026-04-24

**From**：本 session（R139-R144 完）· HEAD `49f483e`
**To**：另一 session 接手 VM deployment
**Target**：全部 API 上 VM · 不走 Vercel
**Review**：Codex R144 技術稽核已合併 · Gemini R10 quota 限流未回（有空 retry）

---

## 0 · 給接手人的 TL;DR（本次最重要）

**VM 部署架構已在 repo · 不需要你從頭寫**。你主要做 4 件：

1. `git pull` 到 HEAD `49f483e`
2. `npm ci`（注意 `ws` transitive dep 陷阱 · 見 §4）
3. `pm2 startOrReload deploy/pm2-ecosystem.config.cjs --only jcv-api,agent-bridge,jcv-deploy-webhook --update-env`
4. 驗 loopback `curl http://127.0.0.1:3000/healthz` 通 · 再驗 public

6 個 新 API（morning-note / tracked-stocks / daily-snapshot-status / valuation / portfolio-benchmark-zscore / trade-audit）都是 `api/*.js` · `jcv-api` auto-mount 會帶起。

**但有 3 個坑**：

- `valuation` cron 還在 `vercel.json:6-23` · VM 沒對應 systemd timer · 要另配
- PM2 環境變數沒 EnvironmentFile 載入 · 要確認 secrets 入口
- snapshot worker 要 `.tmp/localstorage-backups/latest.json` 先存在

---

## 1 · VM 當前 API 狀態

**部署好**（HTTP probe 2026-04-24）：

- `/api/finmind` · `/api/brain` · `/api/event-calendar` · `/api/target-prices` · `/api/analyst-reports`

**缺部署**（404 · 都是 R139-R141 wave）：

| API                               | Feature              | Commit    | 依賴                                                                                                              |
| --------------------------------- | -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `/api/morning-note`               | B1 08:30 cron        | `c3acf72` | Blob `snapshot/morning-note/<date>.json` · worker `morning-note-worker.mjs` · systemd `jcv-morning-note.timer`    |
| `/api/tracked-stocks`             | R133 + Blob race fix | `4d0879b` | Blob `tracked-stocks/<portfolio>/latest.json` · ETag + ifMatch                                                    |
| `/api/daily-snapshot-status`      | R121 §11             | `ebfad63` | Blob `last-success/daily-snapshot/<date>.txt` · worker `snapshot-worker.mjs` · systemd `jcv-daily-snapshot.timer` |
| `/api/valuation`                  | R132a P/E band       | earlier   | Blob `valuation/<code>/latest.json` · **⚠️ cron 還在 Vercel · VM 無 timer**                                       |
| `/api/portfolio-benchmark-zscore` | UX-29 X1             | `a21cbb3` | Blob `benchmark/0050/<date>.json` · worker 在 snapshot-worker 內                                                  |
| `/api/trade-audit`                | B2                   | `4bcede3` | VM 本機 `logs/trade-audit-YYYY-MM.jsonl` append-only                                                              |

---

## 2 · VM 部署拓撲（repo 已有）

**不用猜 · 全在 repo**：

```
PM2 ecosystem      · deploy/pm2-ecosystem.config.cjs (app: jcv-api, agent-bridge, jcv-deploy-webhook)
API server         · scripts/vercel-api-server.mjs (auto-mount api/**/*.js)
Nginx              · deploy/nginx-jcv.conf:87-111 (/api/* → 127.0.0.1:3000)
Worker systemd     · deploy/systemd/jcv-morning-note.{service,timer}
                   · deploy/systemd/jcv-daily-snapshot.{service,timer}
Log rotation       · deploy/logrotate-jcv.conf (PM2 logs only; worker logs NOT rotated)
```

6 個新 API handler `api/*.js` 格式已與 `scripts/vercel-api-server.mjs` 的 auto-mount 相容 · 不需要改 mount 邏輯。

---

## 3 · 建議 deploy 順序（R144 Codex 稽核）

每步含 rollback：

### Step 1 · Baseline check（no-op · 看現狀）

```bash
pm2 show jcv-api
curl -sS http://127.0.0.1:3000/healthz
```

Rollback：無。

### Step 2 · 拉 code

```bash
cd /home/chenkuichen/app/test
git fetch origin
git checkout 49f483e        # 或當前 main HEAD
git pull --ff-only origin main
npm ci
```

**⚠️ `ws` transitive dep 陷阱**：`agent-bridge-standalone/server.mjs:16` import `ws` · 但 `package.json:45-77` 沒直接宣告 · 現靠 transitive。**避免 `npm ci --omit=dev`** · 否則可能 resolve 不到 `ws` · Agent Bridge 起不來。

Rollback：`git checkout <previous-sha> && npm ci`

### Step 3 · Secrets load（兩個 runtime family）

**PM2 側**：`deploy/pm2-ecosystem.config.cjs:15-57` **無 `EnvironmentFile`**。secrets 靠 shell env / pm2 start 環境 inherit。`pm2 startOrReload ... --update-env` 時帶入：

```
BLOB_READ_WRITE_TOKEN
FINMIND_TOKEN
CRON_SECRET
ANTHROPIC_API_KEY                    # morning-note AI copy 需
```

**⚠️ 警告**：若 set `VERCEL_ENV=production` · `api/_lib/auth-middleware.js:76-91` **停止把 VM 當 local** · auth 行為會變。

**systemd 側**：worker 走 `/etc/agent-bridge/secrets.env`（見 `deploy/systemd/jcv-morning-note.service:11` + `jcv-daily-snapshot.service:10`）

Rollback：恢復舊 env file / shell export · pm2 reload + systemctl restart。

### Step 4 · PM2 reload

```bash
pm2 startOrReload deploy/pm2-ecosystem.config.cjs \
  --only jcv-api,agent-bridge,jcv-deploy-webhook --update-env
```

Rollback：恢復 repo sha + env · 重跑相同命令。

### Step 5 · Loopback health check

```bash
curl -sS http://127.0.0.1:3000/healthz      # jcv-api
curl -sS http://127.0.0.1:3010/healthz      # jcv-deploy-webhook
```

**若 loopback fail**：revert repo + env · 不要從 nginx 除錯。

### Step 6 · Snapshot worker prereq

若 `.tmp/localstorage-backups/latest.json` 不存 · 跑：

```bash
node scripts/backup-to-vm.mjs /path/to/portfolio-backup-YYYY-MM-DD.json
```

驗這三個檔存在：

- `data/research-index.json`
- `data/strategy-brain.json`
- `data/analysis-history-index.json`

Rollback：從舊 dated backup 複製回 `.tmp/localstorage-backups/latest.json` · repo 舊 sha 恢復 missing data。

### Step 7 · systemd timers enable

```bash
sudo systemctl enable --now jcv-morning-note.timer
sudo systemctl start jcv-morning-note.service       # manual trigger
sudo systemctl enable --now jcv-daily-snapshot.timer
sudo systemctl start jcv-daily-snapshot.service
```

Rollback：`systemctl stop` + `systemctl disable`。

### Step 8 · Valuation cron ownership decision（⚠️）

`vercel.json:6-23` 仍 schedule `/api/cron/compute-valuations`。VM 無對應 timer。

選一：

- **a · VM 接管**：加 `deploy/systemd/jcv-valuation-compute.{service,timer}` + enable
- **b · Vercel 繼續跑 valuation cron**：`valuation` 不算真「離 Vercel」· handoff scope 說清楚

Rollback：`systemctl stop` VM timer + restore Vercel cron。

### Step 9 · Per-endpoint smoke

loopback 先：

```bash
for ep in morning-note tracked-stocks daily-snapshot-status valuation portfolio-benchmark-zscore trade-audit; do
  curl -sS -o /dev/null -w "$ep → %{http_code}\n" "http://127.0.0.1:3000/api/$ep"
done
```

public 後：

```bash
for ep in morning-note tracked-stocks daily-snapshot-status valuation portfolio-benchmark-zscore trade-audit; do
  curl -sS -o /dev/null -w "$ep → %{http_code}\n" "https://35.236.155.62.sslip.io/api/$ep"
done
```

兩者都 **!= 404** 才算通。

### Step 10 · Rollback 工具

- **Static dist**：`scripts/vm-rollback.sh /var/www/app`（只 flip `/var/www/app/current`）
- **API code**：`git checkout <previous-sha> && npm ci && pm2 reload` · **不是** `vm-rollback.sh`（它只管 static）

---

## 4 · 6 個 API 各自 quirk

詳 `.tmp/handoff-review-r144/api-deploy-matrix.md`（Codex 產）。摘要：

### `/api/morning-note`（B1）

- Env：`ANTHROPIC_API_KEY`（AI 軟語）· `BLOB_READ_WRITE_TOKEN` · `CRON_SECRET`
- Blob prereq：`snapshot/morning-note/<date>.json`（worker 生）
- Cold start：空 snapshot 時返 fallback copy「今日 pre-open 無更新」· 不 crash
- Manual trigger：`curl -X POST http://127.0.0.1:3000/api/morning-note?portfolioId=me`
- Worker：`agent-bridge-standalone/workers/morning-note-worker.mjs`
- systemd timer：`deploy/systemd/jcv-morning-note.timer`（08:30 Asia/Taipei）

### `/api/tracked-stocks`（R133 + Gemini R8 race fix）

- Env：`BLOB_READ_WRITE_TOKEN`
- Blob prereq：`tracked-stocks/<portfolio>/latest.json`（first write 會建）
- **⚠️ 保留 ETag + `ifMatch` 邏輯**（commit `4d0879b` · 防 concurrent sync race）
- Manual trigger：`curl "http://127.0.0.1:3000/api/tracked-stocks?portfolioId=me"`

### `/api/daily-snapshot-status`（R121 §11）

- Env：`BLOB_READ_WRITE_TOKEN` · `CRON_SECRET`
- Blob prereq：`last-success/daily-snapshot/<date>.txt`
- Cold start：沒跑過 cron → `fresh=false` · UI 顯 StaleBadge
- Manual trigger：`curl "http://127.0.0.1:3000/api/daily-snapshot-status?portfolioId=me"`
- Worker：`agent-bridge-standalone/workers/snapshot-worker.mjs`
- systemd timer：`deploy/systemd/jcv-daily-snapshot.timer`（03:00 Asia/Taipei）

### `/api/valuation`（R132a）

- Env：`FINMIND_TOKEN` · `BLOB_READ_WRITE_TOKEN`
- Blob prereq：`valuation/<code>/latest.json`
- **⚠️ cron 歸屬未決 · 見 Step 8**
- Manual trigger：`curl "http://127.0.0.1:3000/api/valuation?code=2330"`

### `/api/portfolio-benchmark-zscore`（UX-29 X1）

- Env：`BLOB_READ_WRITE_TOKEN` · `FINMIND_TOKEN`
- Blob prereq：`benchmark/0050/<date>.json`（在 snapshot-worker.mjs 內 · 共用 snapshot timer）
- Cold start：benchmark 空 → UI 顯「今天對比大盤 · 稍後再看」fallback
- Manual trigger：`curl "http://127.0.0.1:3000/api/portfolio-benchmark-zscore?portfolioId=me"`

### `/api/trade-audit`（B2）

- Env：`CRON_SECRET`（proof-of-action）
- **不用 Blob** · 寫 VM 本機 `logs/trade-audit-YYYY-MM.jsonl`（append-only）
- Log rotation：**目前未在 `deploy/logrotate-jcv.conf` 管轄** · 隨時間長大 · 建議新增 rotation rule
- Manual trigger：`curl -X POST http://127.0.0.1:3000/api/trade-audit` with trade payload

---

## 5 · R143 UI 改動（已 land · commit `49f483e`）

Codex R143 已 push：

- 401 / 404 detection · `dataError.js` + `accuracyGateUi.js` 分類
- `useUpstreamHealth` hook · ≥2 upstream fail 合成 1 條 top banner
- Today PnL `priceMap` 空 → `todayTotalPnl = null` → render `—`
- Playwright `tests/e2e/errorUiStorm.spec.mjs` 3 scenario

部 6 個 API 後 · R143 404 UI 自動消失（沒 404 = 沒 banner）。R143 是 VM partial deploy 期間保險。

---

## 6 · Handoff 漏寫項（R144 稽核補）

### 🔴 Critical

- **PM2 沒 EnvironmentFile 載入** · secrets 入口靠 shell / startup command · 接手人必須確認
- **`VERCEL_ENV=production` 會改 auth middleware 行為**（`api/_lib/auth-middleware.js:76-91`）· 設錯造成 401 storm
- **`valuation` cron VM 無 timer** · 若「離 Vercel」要補 · 否則 valuation 資料不更新
- **`ws` transitive dep** · 不要 `npm ci --omit=dev`

### 🟡 Nice-to-have

- worker log rotation 不在 `deploy/logrotate-jcv.conf` · 會長爆
  - `.tmp/morning-note-worker.log`
  - `.tmp/daily-snapshot-worker.log`
  - `logs/trade-audit-YYYY-MM.jsonl`
- `run-monthly-restore-rehearsal.mjs` 無 systemd unit · 是人工 · 別當 cron 錯排
- nginx 不用加 per-route `location /api/morning-note` · 既有 `/api/*` 已 cover

### 🟢 Minor

- Loopback health probe 用 `http://127.0.0.1:3000/healthz`（不是 `/api/health`）
- `jcv-deploy-webhook` loopback port `3010`
- Static dist rollback（`vm-rollback.sh`）vs API rollback（`git + pm2 reload`）路徑不同

---

## 7 · 環境變數清單（完整）

```
# Blob
BLOB_READ_WRITE_TOKEN                 ← 私有 Blob read/write（必）
PUB_BLOB_TELEMETRY_TOKEN              ← 公有 telemetry（選）

# Data API
FINMIND_TOKEN                         ← FinMind 1600/hr

# Auth
CRON_SECRET                           ← cron auth
VERCEL_OIDC_TOKEN                     ← （若保留 Vercel 雙棲 · VM only 可能可略）

# AI
ANTHROPIC_API_KEY                     ← morning-note / Claude CLI（if used）
GEMINI_API_KEY                        ← Gemini multi-LLM review（非 API server 需）

# ⚠️ 敏感：VERCEL_ENV
VERCEL_ENV=local                      ← 預設 VM 當 local · auth middleware 寬鬆
VERCEL_ENV=production                 ← 若設 · auth fail-closed · 需配 Bearer token
```

---

## 8 · 別動

- ❌ Vercel push（除非 valuation cron 決策要留 Vercel）
- ❌ `backup/pre-r138-*` 分支（2026-05-01 觀察期後刪）
- ❌ Secret rotation（R120 Q-I1）
- ❌ facade alias re-add（C1a/b/c freeze）
- ❌ 不要 `npm ci --omit=dev`（ws transitive）

---

## 9 · 驗收

```bash
# loopback
for ep in morning-note tracked-stocks daily-snapshot-status valuation portfolio-benchmark-zscore trade-audit; do
  echo -n "$ep: "
  curl -sS -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3000/api/$ep"
done

# public
for ep in morning-note tracked-stocks daily-snapshot-status valuation portfolio-benchmark-zscore trade-audit; do
  echo -n "$ep: "
  curl -sS -o /dev/null -w "%{http_code}\n" "https://35.236.155.62.sslip.io/api/$ep"
done
# 兩者都 != 404 算通

# cron 驗（08:30 / 03:00 Asia/Taipei 後）
sudo systemctl status jcv-morning-note.timer
sudo systemctl status jcv-daily-snapshot.timer

# Blob 驗
curl -sH "authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
  https://blob.vercel-storage.com/snapshot/morning-note/$(date +%Y-%m-%d).json

# E2E
PORTFOLIO_BASE_URL=https://35.236.155.62.sslip.io/ \
  npx playwright test tests/e2e/realUserSim.spec.mjs --project=ios-safari
```

---

## 10 · 相關 docs

- `docs/runbooks/restore-drill.md`（L8-e · restore 流程）
- `docs/decisions/2026-04-16-vm-maximization-roadmap.md`（VM max 策略）
- `docs/portfolio-spec-report/architecture.md` §2.1（Deployment View）
- `memory/feedback_vm_deploy_pitfalls.md`（SSH/scp/pm2 雷區）
- `.env.local`（gitignored · secrets）
- `.tmp/handoff-review-r144/api-deploy-matrix.md`（每 API 細節 · Codex 產）
- `.tmp/handoff-review-r144/improvements.md`（handoff 漏寫項 · Codex 產）

---

## 11 · 本 session 剩的 Claude work（接手人不用管）

- `backup/pre-r138-*` 刪（2026-05-01 觀察期後）
- VM Claude CLI auth 401 fix（UX-24 wrapper · nice-to-have）
- Conflicts docs cleanup 剩 5-6 條
- L8-h invite / Exit signoff 等用戶
- Gemini R10 quota 限流通後 retry（這份 v2 做 blind-spot 最後審）

**接手人 focus**：完成 §3 的 10 步 · §4 的 API quirks 驗 · §9 驗收過 · 就完。

---

## 12 · 重要規則

- 本 handoff v2 已合 R144 Codex 稽核 · supersede v1
- 若過程中遇到 handoff 沒寫的 · 先查 `.tmp/handoff-review-r144/` · 再問
- 完成後 · append 一個「部署後記」到本 doc · 記載際部署碰到什麼 / 調整什麼

---

## 13 · Gemini R10 補（2026-04-24 後審）

### Vercel 角色 · 不是「完全棄用」· 修正 header

依 `docs/decisions/2026-04-16-vm-maximization-roadmap.md`：

- **Vercel**：前端 CDN + 輕量 API + Auth · 作 VM proxy
- **VM**：execution engine（cron / workers / 這 6 個 API 計算層）
- Ship 後 strategy：Vercel 不 push 新 feature · 但不關服務 · 因 Auth / CDN / reverse proxy 仍走 Vercel

### Manual worker trigger（cron 等不及時）

```bash
# morning-note-worker（產 Blob snapshot/morning-note/<date>.json）
sudo systemctl start jcv-morning-note.service
# 或直接
node agent-bridge-standalone/workers/morning-note-worker.mjs

# snapshot-worker（產 daily snapshot + benchmark）
sudo systemctl start jcv-daily-snapshot.service
# 或直接
node agent-bridge-standalone/workers/snapshot-worker.mjs

# 看 worker log
pm2 logs morning-note-worker
journalctl -u jcv-morning-note.service -f
```

驗 Blob 有寫入：

```bash
curl -sH "authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
  "https://blob.vercel-storage.com/snapshot/morning-note/$(date +%Y-%m-%d).json" | head
```

### Blob ACL 驗證（ship gate 漏寫）

加進 §9 驗收：

```bash
# 1. 私有 Blob · 無 auth 應 403
curl -so /dev/null -w "private morning-note (no auth): %{http_code}\n" \
  "https://blob.vercel-storage.com/snapshot/morning-note/$(date +%Y-%m-%d).json"
# 期望 403 Forbidden

# 2. 私有 Blob · 有 auth 應 200
curl -so /dev/null -w "private morning-note (authed): %{http_code}\n" \
  -H "authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
  "https://blob.vercel-storage.com/snapshot/morning-note/$(date +%Y-%m-%d).json"
# 期望 200

# 3. 公有 Blob（telemetry）· 無 auth 應 200
curl -so /dev/null -w "public telemetry (no auth): %{http_code}\n" \
  "https://<pub-blob-url>/telemetry/latest.json"
# 期望 200
```

驗清單同時覆蓋：

- `snapshot/morning-note/<date>.json` · 私
- `tracked-stocks/<portfolio>/latest.json` · 私
- `last-success/daily-snapshot/<date>.txt` · 私
- `valuation/<code>/latest.json` · 私
- `benchmark/0050/<date>.json` · 私

### API 回應 content 驗（不只 status code）

§9 的「!= 404」不夠 · 加 content check：

```bash
# morning-note · 驗 JSON shape
curl -s "http://127.0.0.1:3000/api/morning-note?portfolioId=me" | jq '.ok, .note' | head
# 預期 .ok = true 或 false · .note 有結構

# valuation · 驗不是 "compute required" fallback
curl -s "http://127.0.0.1:3000/api/valuation?code=2330" | jq '.hint' | head
# 若 hint = "compute required"，表示 upstream worker 沒跑
# 需先跑 worker 再重驗
```

### Valuation upstream worker（gap 明確化）

Gemini R10 指出：`valuation.js` 是純 reader · 完全靠 upstream worker 餵 Blob。**repo 裡沒看到 `valuation-worker.mjs`** · 也沒 systemd timer。

解法二選一（呼應 §8）：

- **VM 接管**：寫 `agent-bridge-standalone/workers/valuation-worker.mjs` + systemd timer · 每日 03:30 跑
- **Vercel cron 暫留**：`vercel.json:6-23` 既有 cron 就 let it stay · 其他 5 API 上 VM · valuation 混合 mode

### Update v2 header

**原**：`Target：全部 API 上 VM · 不走 Vercel`
**改為**：`Target：6 個 R139-R141 wave API 上 VM（execution engine）· Vercel 保留 Auth + CDN + reverse proxy · 依 2026-04-16 vm-maximization-roadmap 決議`

---

## 14 · 3 LLM audit summary

| LLM        | Round      | 發現                                                                                                                           |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Codex R144 | 技術稽核   | repo 已有 VM 部署拓撲（PM2 + auto-mount + nginx）· 10-step deploy order · ws transitive / VERCEL_ENV 陷阱 · valuation cron gap |
| Gemini R10 | Blind-spot | Blob ACL 驗證漏 · manual worker trigger 細節 · Vercel 角色矛盾 · API content check                                             |
| Claude     | 統整       | v1 → v2（Codex 合併）→ v3 = v2 + §13/§14（Gemini 合併）                                                                        |

3 LLM 並行 review 後 · 交接文件達到可操作狀態。接手人讀 §0-§14 + `.tmp/handoff-review-r144/*.md` · 應能 0 溝通成本 onboard。

---

## 15 · 2026-04-25 Corrigendum · §13 SUPERSEDED

**用戶 2026-04-25 拍板新決議**：
[`docs/decisions/2026-04-25-vercel-full-decoupling.md`](../decisions/2026-04-25-vercel-full-decoupling.md) · commit `78500cd`

### 變動

§13 寫的「Vercel 留 CDN + Auth + proxy · 不完全棄用」**已過時**。新方向：

- **Single-cloud sovereignty** · 全棄 Vercel
- 前端 hosting 搬 VM nginx + 自有 domain
- `@vercel/blob` 寫入改 GCS（同 GCP project）
- `vercel.json` cron / headers / CSP / maxDuration → systemd timer / nginx / process supervisor
- `VERCEL_ENV` / `VERCEL_URL` / `VERCEL_OIDC_TOKEN` runtime 清除
- `vercel.json` + `@vercel/blob` dep 移除
- Vercel 帳號保留 emergency rollback plane（free tier · burn-in 完才完全退場）

採 Codex 2a 提出的 **6-phase** 順序（不是 Blob big-bang）。

### 影響本 handoff 哪些段

- §0 TL;DR：「Vercel 不 push 但保留」改成「Vercel 退場 · 6-phase 漸進」
- §6 Codex 稽核補：valuation cron 二選一改成「VM 接管」（無 Vercel 留路）
- §13 Gemini 補：Vercel 角色澄清 → ❌ 過時 · 看新 decision

### Source of truth

**接手人應以 `docs/decisions/2026-04-25-vercel-full-decoupling.md` + `.tmp/vercel-full-decoupling/discussion.md` Round 1-3 為準**。本 handoff 細節（pm2 / nginx / systemd / Blob race ETag / worker manual trigger）仍有效 · 但 Vercel 角色相關段已 superseded。

### 3 方 LLM 共識被 override

舊 3-way consensus（Claude Explore / Codex 2a / Codex 2b）**都建議延後**全棄。用戶 2026-04-25 明示：operational sovereignty + mental clarity + 預算清晰 > 轉換期 risk · 採 Codex 2a 6-phase 折衷。

LLM 結論不竄改 · 紀錄保留在 `.tmp/vercel-full-decoupling/discussion.md` Round 3。
