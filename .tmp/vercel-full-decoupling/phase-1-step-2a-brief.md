# Phase 1 Step 2a brief · GCS adapter PoC for ops.last_success · Codex A

## 任務 · 第一個真正的 storage adapter

寫 GCS singleton-write adapter · 套到 `last-success-*` keyspace · cutover flag 預設 `vercel-only` 不改變 behavior。

當前分支：`vercel-decouple-phase1`（Step 1 已 commit `72b61ff`）。繼續 commit 在這個分支。

## 已有 design

- `.tmp/vercel-full-decoupling/phase-1/capability-contract.md`（你 Round 5 寫的）
- `.tmp/vercel-full-decoupling/phase-1/gcs-bucket-iam.md`（3 bucket 結構）
- `.tmp/vercel-full-decoupling/phase-0/cutover-flag-design.md`

照那份 design 執行。

## VM 端基礎設施已就緒（Claude 處理）

- GCS buckets：`gs://jcv-dev-public`、`gs://jcv-dev-private`、`gs://jcv-dev-archive`（asia-east1）
- VM service account：`1079524639248-compute@developer.gserviceaccount.com` 已有 `roles/storage.objectAdmin`
- VM scope：`cloud-platform`（已驗證 GCS write 從 VM 跑通）
- VM IP：`104.199.144.170`（new static）

## Scope · Step 2a

僅做 `ops.last_success_public` + `ops.last_success_private` 這 2 個 keyspace。**不碰其他 keyspace**。

具體 Vercel Blob path：
- private：`last-success/morning-note/<date>.txt`、`last-success/daily-snapshot/<date>.txt` 之類
- public：依 inventory 找

## 必做

### 1. 安裝 dep

```bash
npm install @google-cloud/storage
```

確認 commit 含 `package.json` + `package-lock.json` 改動。

### 2. 寫 adapter

`api/_lib/gcs-storage.js` — 只實作 capability: **singleton-write** + **read**：

```js
export async function gcsRead(bucketName, key) // returns { body, etag, contentType, generation } | null
export async function gcsWrite(bucketName, key, body, opts = {}) // { contentType, cacheControl, public }
export async function gcsHead(bucketName, key) // returns { etag, generation, lastModified } | null
```

注意：
- 用 `@google-cloud/storage` 官方 SDK · 不要自己 implement REST
- Bucket name 從 env 讀（`GCS_BUCKET_PUBLIC` / `GCS_BUCKET_PRIVATE`）
- service account auth 走 VM workload identity（不傳 key file）· 但 dev 機可走 `GOOGLE_APPLICATION_CREDENTIALS` · SDK 自動處理
- 失敗模式：404 → `null`、permission → throw、network → throw with retry hint

### 3. cutover flag dispatcher

新檔 `api/_lib/last-success-store.js`（或改既有 helper）：

```js
const PRIMARY = process.env.STORAGE_PRIMARY_OPS_LAST_SUCCESS || 'vercel-only';
// values: 'vercel-only', 'vercel-primary-gcs-shadow', 'gcs-primary-vercel-shadow', 'gcs-only'

export async function readLastSuccess(scope, date) { ... }
export async function writeLastSuccess(scope, date, payload) { ... }
```

### 4. shadow-read divergence 計數

當 flag = `vercel-primary-gcs-shadow` 或 `gcs-primary-vercel-shadow`：
- 同步從 secondary 讀
- 比對結果是否一致
- 不一致 → log warning（不影響 response）
- 結果計數 emit metric（簡單寫到 `logs/storage-divergence-YYYY-MM.jsonl`）

### 5. migration script

`scripts/migrate-last-success-to-gcs.mjs`：

```bash
node scripts/migrate-last-success-to-gcs.mjs --dry-run
node scripts/migrate-last-success-to-gcs.mjs              # actual
node scripts/migrate-last-success-to-gcs.mjs --resume     # 從 manifest 接續
```

要求：
- **idempotent**：跑兩次第二次什麼都不做（compare ETag/hash · 一致跳過）
- **dry-run**：列要 copy 的 key + size · 不寫
- **resume**：寫 manifest 到 `.tmp/migration-state/last-success.json` · 中斷可接續
- **verify**：每個 copy 後 read-back 比 hash · 一致才 mark done
- **rollback**：寫 reverse manifest（GCS keys list · 方便日後刪）
- 不在 production data 上執行 · 只 prep migration · Claude 會在 VM 跑

### 6. caller 改寫

找到所有現在直接呼叫 `last-success/*` Blob path 的 call site（從 Phase 0 inventory 找）· 改成走 `last-success-store.js` 的 `readLastSuccess` / `writeLastSuccess`。

不刪 Vercel Blob call · 整條 path 走 dispatcher · backend 由 flag 決定。

### 7. Tests

`tests/api/gcs-storage.test.js`：
- mock GCS SDK · 驗 read/write/head/null path
- 不真的打 GCS

`tests/api/last-success-store.test.js`：
- mock 兩個 backend · 驗 4 個 flag 行為
- 驗 shadow-read divergence log

### 8. env example 更新

`.env.example` 加：
```
GCS_PROJECT=
GCS_BUCKET_PUBLIC=
GCS_BUCKET_PRIVATE=
STORAGE_PRIMARY_OPS_LAST_SUCCESS=vercel-only
```

`.env.local.example` 加 dev value：
```
GCS_PROJECT=jcv-dev-2026
GCS_BUCKET_PUBLIC=jcv-dev-public
GCS_BUCKET_PRIVATE=jcv-dev-private
STORAGE_PRIMARY_OPS_LAST_SUCCESS=vercel-only
```

## 不做（嚴格）

- ❌ 不碰其他 keyspace（valuation / tracked-stocks / brain etc.）
- ❌ 不刪任何 Vercel Blob call
- ❌ 不在 production VM 跑 migration（Claude 在 jcv-dev VM 跑）
- ❌ 不改 `STORAGE_PRIMARY_OPS_LAST_SUCCESS` default 從 `vercel-only` 改別的
- ❌ 不 push（commit 在 `vercel-decouple-phase1` 即可）
- ❌ 不用 generic `storage.js`（已 design ban）

## 驗證

```bash
npm run typecheck
npm run lint
npm run test:run -- tests/api/gcs-storage.test.js tests/api/last-success-store.test.js --run
```

3 個都過才算 done。

## 回報

完成後 append `## Round 7 · Codex A · Phase 1 Step 2a · 2026-04-25 HH:MM`：

- commit SHA
- 改了 / 新建了哪些檔（file:line list）
- 4 個 flag 的 behavior 表
- migration script 的 idempotent / resume / verify 設計重點
- 你發現 brief 漏的或 design doc 沒涵蓋的
- 給 Codex B (QA) 的 hint：你最不確定哪部分 · 最希望 B 對抗性 attack 哪邊

## Done criteria

- 全部 8 個必做項完成
- 3 個 typecheck/lint/test 過
- commit 在 `vercel-decouple-phase1`
- Round 7 已 append

## Round 7 · Codex A · Phase 1 Step 2a · 2026-04-25 13:48

- commit SHA: `fcf71b6`
- 改了 / 新建了哪些檔（file:line）:
  - `package.json:46`
  - `package-lock.json:11`
  - `.env.example:30`
  - `.env.local.example:52`
  - `api/_lib/gcs-storage.js:74`
  - `api/_lib/last-success-store.js:360`
  - `src/lib/cronLastSuccess.js:58`
  - `src/lib/cronLastSuccess.js:87`
  - `src/lib/cronLastSuccess.js:144`
  - `src/lib/cronLastSuccess.js:198`
  - `api/daily-snapshot-status.js:5`
  - `scripts/migrate-last-success-to-gcs.mjs:53`
  - `scripts/migrate-last-success-to-gcs.mjs:69`
  - `scripts/migrate-last-success-to-gcs.mjs:217`
  - `scripts/migrate-last-success-to-gcs.mjs:285`
  - `tests/api/gcs-storage.test.js:20`
  - `tests/api/last-success-store.test.js:12`
- 4 個 flag behavior：

  | flag | read | write |
  |---|---|---|
  | `vercel-only` | 只讀 Vercel marker | 只寫 Vercel marker |
  | `vercel-primary-gcs-shadow` | 回 Vercel；同步讀 GCS compare；差異寫 `logs/storage-divergence-YYYY-MM.jsonl` + warn | 先寫 Vercel；再 best-effort shadow write GCS |
  | `gcs-primary-vercel-shadow` | 回 GCS；同步讀 Vercel compare；差異寫 `logs/storage-divergence-YYYY-MM.jsonl` + warn | 先寫 GCS；再 best-effort shadow write Vercel |
  | `gcs-only` | 只讀 GCS marker | 只寫 GCS marker |
- migration script 設計重點：
  - idempotent：來源先算 SHA-256；若目的端 GCS 已有同 hash 直接標 `skipped-existing-match`
  - resume：state manifest 固定寫 `.tmp/migration-state/last-success.json`；`--resume` 會跳過 `done` / `skipped-existing-match` / `source-missing`
  - verify：每次 actual write 後立刻 `gcsRead()` read-back，再比一次 SHA-256；不一致直接 fail
  - rollback：同步寫 `.tmp/migration-state/last-success.reverse.json`，列出 `gs://bucket/key`
  - safety：如果 bucket 名稱看起來是 `prod`，script 直接拒跑
- 我發現 brief / design 沒完全對齊的地方：
  - Phase 1 design 把 `last-success/daily-snapshot/{date}.txt` 歸到 `ops.daily_snapshot_marker`，不是 `ops.last_success_private`
  - 所以這次實作嚴格只 cutover `last-success-*.json` 的 public/private marker；`daily_snapshot_marker` call site 沒改
  - 另外 repo 內現有 `tw-events-worker.mjs` 用的是 `markCronFailure(job, error, opts)` 形狀，原 helper signature 其實不吃；這次順手做了 backward-compatible normalize
- 給 Codex B (QA) 的 hint：
  - 最希望 B attack `vercel-primary-gcs-shadow` / `gcs-primary-vercel-shadow` 的 compare path，尤其是「一邊 miss、一邊 hit」和 JSON key order 不同但 payload 等價的情況
  - migration script 最值得對抗性測的是 `--resume` 在中斷後接續、以及目的端先存在舊資料/同資料時的 state 轉移是否乾淨
