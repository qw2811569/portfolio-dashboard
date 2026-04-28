# VM API Rollout Handoff · 2026-04-24

**From**：本 session（R139-R143 完）· HEAD `42a70b4`
**To**：另一 session 接手 VM deployment
**Target**：全部 API 上 VM · 不走 Vercel

---

## 1 · VM 當前 API 狀態（HEAD https HTTP probe · 2026-04-24）

**部署好**（已回應 405/GET 正常）：

```
/api/finmind            ← FinMind proxy
/api/brain              ← AI brain endpoint
/api/event-calendar     ← Calendar events
/api/target-prices      ← 目標價
/api/analyst-reports    ← 分析師報告
```

**缺部署**（404 · 全是 R139-R141 wave 新加）：

| API                               | 對應 feature                                                         | Vercel 原始碼路徑                                      | 依賴                                                                            |
| --------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `/api/morning-note`               | B1 Morning Note 08:30 cron（commit `c3acf72`）                       | `api/morning-note.js`                                  | Blob `snapshot/morning-note/<date>.json` · VM worker `morning-note-worker.mjs`  |
| `/api/tracked-stocks`             | R133 tracked-stocks live sync + Gemini R8 Blob race fix（`4d0879b`） | `api/tracked-stocks.js` + `api/_lib/tracked-stocks.js` | Blob `tracked-stocks/<portfolio>/latest.json` · ETag + ifMatch                  |
| `/api/daily-snapshot-status`      | R121 §11 stage 3（`ebfad63`）                                        | `api/daily-snapshot-status.js`                         | VM worker `snapshot-worker.mjs` · Blob `last-success/daily-snapshot/<date>.txt` |
| `/api/valuation`                  | R132a P/E band valuation（earlier）                                  | `api/valuation.js`                                     | Blob `valuation/<code>/latest.json`                                             |
| `/api/portfolio-benchmark-zscore` | UX-29 X1 benchmark（`a21cbb3`）                                      | `api/portfolio-benchmark-zscore.js`                    | VM worker snapshot `benchmark/0050/<date>.json`                                 |
| `/api/trade-audit`                | B2 Trade compliance memo（`4bcede3`）                                | `api/trade-audit.js`                                   | VM 本機 `logs/trade-audit-YYYY-MM.jsonl` · JSONL append                         |

---

## 2 · VM deployment pattern（參考既有）

既有 API 應該是用 **agent-bridge-standalone/server.mjs**（Express-like）加 route handler · pm2 管 · nginx reverse proxy。

確認：

```
agent-bridge-standalone/server.mjs:1780 // /api/health
agent-bridge-standalone/server.mjs:1784 // /api/sessions
agent-bridge-standalone/server.mjs:1788 // /api/dashboard-snapshot
...
```

但 **Agent Bridge server 只有 `/api/health|sessions|tasks|workers` 等 bridge 專用路由** · 沒有 finmind / brain 那些 portfolio API。所以 VM 應有**另一隻 node process** 服務 portfolio API · 可能 reuse Vercel handler（`api/*.js`）跑在 VM Node server 上。

**接手人要確認**：

- VM 上是哪個 node process 服務 `/api/finmind` 等 portfolio API？
- 是同一隻 process 還是分開？
- 是用 `@vercel/node` local adapter · 還是包進自己 Express server？
- systemd 單位名 / pm2 process 名？
- 服務 log 在哪？

## 3 · 需要的環境變數（從 `.env.local` 對照）

```
FINMIND_TOKEN                         ← finmind proxy
BLOB_READ_WRITE_TOKEN                 ← 私有 Blob read/write
PUB_BLOB_TELEMETRY_TOKEN              ← 公有 telemetry
CRON_SECRET                           ← cron auth
VERCEL_OIDC_TOKEN                     ← OIDC token（若 VM 保留 Vercel 雙棲）
```

新的 6 個 API 額外需要：

- `ANTHROPIC_API_KEY`（若 morning-note 用 Claude 生 AI 軟語 · 見 `agent-bridge-standalone/workers/morning-note-worker.mjs`）
- （其他可能 · 查各 API 的 `process.env.*` 引用）

## 4 · 部署步驟建議（純文字 · 接手人確認）

1. **拉 code**：VM 已有 repo · 拉到 `42a70b4` HEAD
2. **build front-end**：`npm run build`（SPA dist 對齊）
3. **API server 整合**：把 `api/morning-note.js` 等 6 個 handler 接進 VM 的 API server（查既有 finmind 怎麼接）
4. **env 補齊**：確認 6 個 API 要的環境變數都在 VM 上
5. **VM worker 啟動**：
   - `morning-note-worker.mjs`（08:30 cron）
   - `snapshot-worker.mjs`（03:00 daily snapshot）
   - `run-monthly-restore-rehearsal.mjs`（月首）
   - systemd timer 已在 `deploy/systemd/jcv-morning-note.timer`
6. **nginx route**：確認 `/api/morning-note` 等 6 個 path 被 proxy 到 node process
7. **pm2 restart / reload**
8. **驗**：
   ```bash
   for ep in morning-note tracked-stocks daily-snapshot-status valuation portfolio-benchmark-zscore trade-audit; do
     curl -sI "https://35.236.155.62.sslip.io/api/$ep" | head -1
   done
   # 期望都 !=  404
   ```

## 5 · 6 個 API 各自的 quirk

- **morning-note**：需 VM worker 先跑過 · Blob 有 `snapshot/morning-note/<date>.json` 才能讀。cold start VM · API 會 return fallback 「今日 pre-open 無更新」。
- **tracked-stocks**：Blob race fix ETag 必須保留（`4d0879b`）· concurrent sync 靠 `ifMatch`。
- **daily-snapshot-status**：讀 Blob `last-success/daily-snapshot/*.txt` · 若沒跑過 cron → fresh = false。
- **valuation**：需 FinMind 財報資料 · 計算 P/E band · cache 到 Blob。
- **portfolio-benchmark-zscore**：需 VM worker 每日抓 `0050` 存 Blob `benchmark/0050/<date>.json`。
- **trade-audit**：append-only VM 本機 JSONL（`logs/trade-audit-YYYY-MM.jsonl`）· 不是 Blob（per Gemini R8 audit 判定 log 非 state）。

## 6 · R143 UI 改動（本 session 進行中）

Codex 正在跑 R143（commit 還沒 land）· 會做：

- 401 / 404 detection split（新 banner「功能尚未部署」）
- 多 banner 聚合（>=2 fail 合成 1 條）
- Today PnL priceMap 空 → render `—` 不 `0`

接手人部署好 6 API 後 · R143 的 404 UI 就自然收斂（沒 404 就沒 banner 顯）· R143 不白做 · 作為 VM partial deploy 期間的保險。

## 7 · 別動的東西

- ❌ Vercel push（已被砍 · 用戶要全 VM）
- ❌ `backup/pre-r138-*` 分支（2026-05-01 觀察期後刪）
- ❌ Secret rotation（R120 Q-I1 · 不 rotate）
- ❌ facade alias re-add（C1a/b/c 已 freeze+migrate）

## 8 · 驗收

部署完 · 手動跑：

```bash
# 所有 API 回非 404
for ep in morning-note tracked-stocks daily-snapshot-status valuation portfolio-benchmark-zscore trade-audit; do
  status=$(curl -sI "https://35.236.155.62.sslip.io/api/$ep" -o /dev/null -w "%{http_code}")
  echo "$ep → $status"
done

# SPA 打開不再有 4 個 error banner
open https://35.236.155.62.sslip.io/

# cron 驗
# 等 08:30 Asia/Taipei · 看 `snapshot/morning-note/<today>.json` 有生成
# 等 03:00 Asia/Taipei · 看 `snapshot/portfolio-state/<today>/` 有生成

# Playwright
PORTFOLIO_BASE_URL=https://35.236.155.62.sslip.io/ \
npx playwright test tests/e2e/realUserSim.spec.mjs --project=ios-safari
```

## 9 · 相關 docs

- `docs/runbooks/restore-drill.md`（L8-e · restore 流程）
- `docs/decisions/2026-04-16-vm-maximization-roadmap.md`（VM max 策略）
- `docs/decisions/2026-04-18-appshell-state-ownership.md`（state owner map）
- `memory/feedback_vm_deploy_pitfalls.md`（SSH key / scp / pm2 雷區）
- `.env.local`（gitignored · secrets 都在這 · 包含 `ANTHROPIC_VM_KEY_FALLBACK` 2026-04-24）

## 10 · 緊急回退

若部署壞 VM：

1. `scripts/sync-to-vm-root.mjs --rollback` 回上個 backup dir
2. pm2 revert 到上一個 process config
3. 或從 `backup/pre-r138-20260424-011724` 分支重 clone

---

**本 session 剩下的 Claude work**（接手人不用管）：

- R143 Codex 在跑 · 完成自動 commit + push · VM mirror
- 監督 R143 後續（可能 R143b 補 404 UI 細節）
- backup 分支刪（2026-05-01）
- VM Claude CLI auth 401 fix（UX-24 wrapper · nice-to-have）
- Conflicts docs cleanup（剩 5-6 條）
- L8-h invite / Exit signoff 等用戶

**接手人只需要**：完成 VM API 6 個部署 + 驗收。
