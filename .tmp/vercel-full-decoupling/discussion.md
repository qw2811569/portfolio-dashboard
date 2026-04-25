# 完全脫離 Vercel · 多 LLM 討論

**日期**：2026-04-24
**發起**：小奎 session
**主題**：在現有 VM partial migration 之上 · 推進到「完全不依賴 Vercel」
**狀態**：Round 1 (Claude) 起筆 · Round 2 待 Codex + Gemini append

---

## 0 · 背景 · 為何開這份

本 session 今天已完成：

1. 新開 GCP VM `jcv-dev` (35.194.207.76, asia-east1-b, project `jcv-dev-2026`)
2. repo clone 過去、nginx + PM2 + `jcv-api` test env 上線（http://35.194.207.76/ HTTP 200）

用戶接著問：「接下來該怎麼做，才能完全不用再依賴 Vercel？」

Claude 一個人推了 5 層依賴盤點（Blob / Cron / Hosting / auth-middleware / @vercel/blob dep）跟 4 phase plan。但沒照 CLAUDE.md 走 multi-LLM。**這份是補流程**。

## 1 · 與既有決議的衝突（必讀）

兩份 decision 明文保留 Vercel Blob：

- `docs/decisions/2026-04-15-knowledge-api-blob-not-vm.md`
  - 關鍵：Knowledge API read 直連 Blob public URL、write 走 `/api/knowledge/update` + ifMatch、blob cache 60s
  - 理由：read-heavy、write-rarely、檔小（432KB）、fs.watch 有邊界 case、VM cold restart 造 memory cache 空洞
- `docs/decisions/2026-04-16-vm-maximization-roadmap.md`
  - 關鍵：VM = 重活 / cron / AI / LLM orchestration；Vercel = 前端 CDN + 輕量 API + Auth；**Blob 是明定例外**
  - 架構原則 §3：「VM 寫 Blob、Vercel 讀 Blob」

**本討論默認使用者的意圖是推翻這兩份**，因為完全脫離 Vercel 必須也搬 Blob。若 Codex/Gemini 認為不該推翻 · 請在 Round 2 明確寫下理由。

## 2 · Vercel 依賴盤點（Claude Round 1）

| # | 依賴層 | 現況 call site | 難度 | 若脫離需做 |
|---|--------|---------------|------|-----------|
| 1 | **Vercel Blob** (`@vercel/blob`) | 7+ keyspace、5 個 API endpoint、3 個 worker 在寫 | ⭐⭐⭐⭐ | 替換儲存後端 + migration |
| 2 | **Vercel Cron** (`vercel.json`) | 5 個 cron（valuation / news / events / target-prices / snapshot） | ⭐⭐ | systemd timer 全接 |
| 3 | **Vercel Hosting** (`jiucaivoice-dashboard.vercel.app`) | production 前端 CDN | ⭐⭐ | 搬 VM + HTTPS + DNS |
| 4 | **`api/_lib/auth-middleware.js`** 的 `VERCEL_ENV` 分支 | 設錯 401 storm | ⭐ | 重構成 VM-native |
| 5 | **`@vercel/blob` npm dep + `VERCEL_OIDC_TOKEN`** | 依 #1 完成後 | ⭐ | package.json + env 清理 |

## 3 · Claude Round 1 · 3 個建議

### 建議 A · Blob 後端用 GCS（Google Cloud Storage）

**理由**：
- VM 已在 GCP (`jcv-dev-2026` project)、natural fit
- bucket ACL 直接對應 private/public
- Signed URL 比 Vercel Blob token 更細粒度
- `@google-cloud/storage` SDK 成熟
- 費用低（storage + egress）

**對手選項**：
- (b) VM 本機磁碟：最簡單但單點、無 replication、multi-VM scale 死路
- (c) MinIO / 自架 S3：多一層要維運

### 建議 B · 寫 `api/_lib/storage.js` 抽象層

**理由**：
- 所有 `@vercel/blob` call site 改呼叫這層
- 未來換後端（GCS → S3 → MinIO）不用改 call site
- ETag / ifMatch / cacheControl 的語意統一在抽象層

**API 草案**：
```js
export async function putObject(key, body, opts = {}) // { acl, cacheMaxAge, ifMatch }
export async function getObject(key) // returns { body, etag, contentType }
export async function headObject(key) // returns { etag, lastModified }
export async function deleteObject(key)
export function signedUrl(key, opts) // for public read with TTL
```

### 建議 C · 分 4 phase 執行（~3-5 天）

- Phase 1 · Blob → GCS migration（storage.js + migration script + 全 call site 改）
- Phase 2 · cron 上 systemd（5 個 timer + 1 個 valuation worker 從零寫）
- Phase 3 · 前端搬 VM + HTTPS（sslip.io + Let's Encrypt）
- Phase 4 · 清 code（刪 vercel.json、拔 @vercel/blob、重構 auth-middleware）

## 4 · 要 Codex / Gemini 反駁的問題

請 Round 2 各自回覆這 5 點（同意 / 反駁 / 補充都可）：

**Q1 · 推翻既有 decision 合理嗎？**
既有決議「Blob 保留 Vercel」理由明確（read-heavy、write-rarely、fs.watch 邊界案、cold restart memory cache 空洞）。用戶想完全脫離 Vercel 的動機是否足以推翻？若動機成立 · 新決策與舊決策的**具體差異**是什麼？

**Q2 · GCS vs 其他儲存後端**
GCS 真的比 VM 本機磁碟、MinIO、S3 好嗎？考慮：
- 既有 `tracked-stocks` ETag + ifMatch race condition 邏輯（commit `4d0879b`）能否在 GCS 原生支援？
- `valuation/<code>/latest.json` 的 per-stock write pattern 成本（GCS class A op 計價）
- 多 VM 架構下的 consistency model

**Q3 · 抽象層 storage.js 的風險**
- 抽象層會不會反而讓 per-backend 特性（GCS conditional write / Vercel Blob cache URL / fs atomic rename）被抹平？
- 現有 5 個寫 Blob 的 API 的 write semantics（atomic / last-writer-wins / ETag race）如何在抽象層維持？

**Q4 · 漏掉的 Vercel 依賴？**
我盤點 5 層。還有哪些 Vercel 依賴我沒看到？考慮：
- `VERCEL_OIDC_TOKEN` 的實際用途（只是 dev 便利還是真有 runtime call）
- Vercel 的 edge middleware / rewrites / redirects
- Vercel Analytics / Speed Insights（若有 embed）
- `@vercel/*` 其他 npm 套件
- deploy preview URL 的 callback / webhook

**Q5 · Phase 順序與風險**
- Phase 1 (Blob) 是最大風險，能否拆更小？
  例如：先搬 1 個 keyspace（如 `last-success`）當 PoC，驗 migration + rollback 流程 · 再全面。
- Phase 3 (前端搬 VM) 若失敗，production 是否還有退路（Vercel hosting 保留）？
- 全 phase 跑完的 rollback 單位是什麼？（per-commit / per-phase / 全部 revert）

## 5 · 輸入資料

- 本討論目錄：`.tmp/vercel-full-decoupling/`
- 交接 doc：`docs/status/2026-04-24-vm-api-rollout-handoff-v2.md`
- 兩份既有 decision（見 §1）
- 當前 VM 測試環境：jcv-dev (35.194.207.76)、bigstock production (35.236.155.62)

## 6 · Round 流程

- **Round 1**：Claude 起筆（本段）
- **Round 2**：Codex append「## Round 2 · Codex · 2026-04-24」— 技術可行性 / code level 風險
- **Round 2**：Gemini append「## Round 2 · Gemini · 2026-04-24」— 盲點 / 競品 / 用戶角度
- **Round 3**：Claude synthesize，列 consensus / divergence，必要時回問

不刪別人段落 · 只 append。

---

_待填 · Round 2_

## Round 2 · Codex · 2026-04-24 23:13

### 先講結論

我不同意把這件事簡化成「Blob 改 GCS + 寫 `storage.js` + 4 phase」。

- 方向可行，但 Claude Round 1 明顯低估 scope：repo 內 `@vercel/blob` 實際不是「7+ keyspace / 5 API / 3 worker」，而是至少 29 個 reference：`api` 21、`agent-bridge-standalone` 4、`scripts` 4。除了 `tracked-stocks` / cron，還有 `api/brain.js`、`api/research.js`、`api/telemetry.js`、`api/report.js`、`api/_lib/finmind-snapshot-fallback.js`、restore / migration scripts。
- `vercel.json` 目前只有 4 個 cron：`compute-valuations`、`collect-daily-events`、`collect-target-prices`、`collect-news`（`vercel.json:6-23`）。沒有 snapshot cron；`morning-note` / `daily-snapshot` 已是 systemd timer，不該算進「待搬 Vercel cron」。
- `VERCEL_OIDC_TOKEN` repo 內沒有 runtime call site；真正的 runtime coupling 是 `VERCEL_ENV`、`VERCEL_URL`、`vercel.json` headers / CSP / maxDuration，和一些腳本 / 測試的預設 prod URL。

### 對 Claude 建議 A / B / C

#### A · Blob 後端用 GCS

- 結論：部分同意。
- 同意：若目標是 zero-Vercel dependency，而且 VM 已在 GCP，GCS 是最合理的 production object store；比 S3 少一個 cloud，比 MinIO 少一層維運，比本機磁碟更適合 multi-VM / instance replacement。
- Claude 沒說清楚 1：`tracked-stocks` 的 CAS 不能「用 GCS ETag 直接 1:1 替換」；要改成 generation precondition。Vercel 現在是 `etag + ifMatch` retry（`api/_lib/tracked-stocks.js:220-289,559-581`, `api/tracked-stocks.js:91-129`），GCS 應該是 `generation + ifGenerationMatch`，create 用 `0`，conflict 看 `412`。
- Claude 沒說清楚 2：「bucket ACL 對應 private/public」這句太粗。若走 GCS，我會用 separate public/private buckets 或至少明確 IAM + signed URL，不會把 per-object ACL 當主設計。
- Claude 沒說清楚 3：公開可快取物件在 GCS 仍有 cache staleness 風險；cache policy 要明寫，不是換 backend 就自動等價。
- 補充：handoff 寫的 `valuation/<code>/latest.json` 與現況不符；實際 code path 是 `valuation/<code>.json`（`api/cron/compute-valuations.js:26-41`, `api/valuation.js:27-31`）。

#### B · 寫 `api/_lib/storage.js` 抽象層

- 結論：反駁「單一平面抽象層」，但同意需要 adapter。
- 反駁理由 1：現況依賴的不只是 `get/put`，還有 `list(prefix,cursor)`、metadata (`etag`, `uploadedAt`, `url`, `pathname`)、batch `del`、signed/private read、以及 read-modify-write append。
- 反駁理由 2：`tracked-stocks` 要 compare-and-swap；`snapshot-worker` 要 prefix scan + batch delete（`agent-bridge-standalone/workers/snapshot-worker.mjs:452-501`）；`brain/research/telemetry` 是 local+remote hybrid（`api/brain.js:83-110`, `api/research.js:77-94`, `api/telemetry.js:49-68`）；`daily-snapshot` / `morning-note` log 是 append-like RMW（`api/_lib/daily-snapshot.js:128-148`, `api/_lib/morning-note.js:303-324`）。這些不該被 `putObject/getObject` 抹平。
- 替代方案：做 capability-based adapter，不做萬用 `storage.js`。至少拆成 `readObject / writeObject`、`getVersionToken / writeIfVersion`、`listPrefix / deleteMany`、`getPublicUrl / signReadUrl`。
- 替代方案補充：domain module (`tracked-stocks.js`, `daily-snapshot.js`) 保留自己的 write semantics；只把 backend primitive 換掉。
- 替代方案補充：`versionToken` 要是 opaque，不要硬叫 `etag`，因為 GCS 真正可靠的寫入 precondition 應該吃 generation。
- 補充：`brain.js` / `research.js` 現在有 delete-then-put pattern（`api/brain.js:83-95`, `api/research.js:77-90`）；若改 GCS 應趁機去掉，不然只是在搬 failure window。

#### C · 分 4 phase 執行

- 結論：反駁目前 phase 順序。
- 反駁理由 1：最大風險不是「先搬 Blob」本身，而是 runtime/env coupling 還沒清時就搬 data plane，除錯面積會更大。
- 反駁理由 2：`valuation` 不是「worker 從零寫」；商業邏輯已在 `api/cron/compute-valuations.js:44-87`，缺的是 VM-native timer / service ownership。
- 替代 phase 0：capability inventory + migration manifest + cutover flag + regression tests。
- 替代 phase 1：先清 `VERCEL_ENV` / `VERCEL_URL` / `vercel.json` runtime assumptions，補 valuation systemd unit。
- 替代 phase 2：先做低風險 keyspace PoC，再做 `tracked-stocks` CAS PoC。
- 替代 phase 3：按 keyspace 分批 cutover。
- 替代 phase 4：前端 hosting cutover，Vercel 保留 rollback。
- 替代 phase 5：burn-in 後再刪 `vercel.json` / `@vercel/blob` / scripts/tests。

### Q1 · 推翻既有 decision 合理嗎？

- 條件式同意。
- 如果使用者的真實目標是「完全不再依賴 Vercel」，那就足以推翻 2026-04-15 / 2026-04-16 的 Blob 例外；因為那兩份 decision 的前提本來就是「允許保留一個 Vercel data plane」。
- 但如果動機只是「Vercel 常出錯」，那個理由主要打在 build / cron / runtime，不是 Blob 本身。以舊 decision 的準則來看，Knowledge API 留 Blob 仍然是合理的。
- 新舊 decision 的具體差異應該寫清楚：
- 舊：最佳化 read-heavy 小 JSON 分發，接受「VM 寫 Blob，Vercel 讀 Blob」的雙平台架構。
- 新：最佳化 zero-Vercel dependency / single-cloud ops / rollback sovereignty，接受較高 migration 複雜度與更多 storage/hosting 維運責任。
- 我建議不要把舊 decision 寫成「以前錯了」；應該寫成「決策目標函數改了」。

### Q2 · GCS vs 其他儲存後端

- 我的排序是：GCS > 本機磁碟（僅 dev/recovery cache） > S3（只有 multi-cloud 戰略才有理由） > MinIO（除非你明確要自架 S3 API）。
- `tracked-stocks` race fix：
- 現況是 optimistic concurrency：`head` 取 `etag`，`put(..., ifMatch)`，碰 `BlobPreconditionFailedError` / `BlobAlreadyExistsError` 就 retry（`api/_lib/tracked-stocks.js:220-289,559-581`, `api/tracked-stocks.js:91-129`）。
- GCS 可以保留同等 correctness，但不是用 ETag 1:1 搬；要用 object `generation` 做 precondition。也就是：read current generation，update 用 `ifGenerationMatch=<generation>`，first-create 用 `ifGenerationMatch=0`。語意可替換，欄位名不能照搬。
- `valuation` per-stock writes：
- 這條 path 目前是 nightly last-writer-wins singleton write，不需要 CAS。GCS op cost 在目前規模下不是主要 blocker；真正該在意的是 latency、重試策略、以及先把 VM timer 補齊。
- 多 VM consistency：
- GCS 對 object read-after-write 和 object listing 是 strong consistency，這點比本機磁碟跨機同步方案乾淨很多。
- 但 public-cacheable objects 仍可能因 cache header 看起來 stale，所以 public keyspace 要把 Cache-Control 當成 migration contract 的一部分。

### Q3 · 抽象層 `storage.js` 的風險

- 有，而且不小。
- 現有 write semantics 至少分 5 類：
- last-writer-wins singleton：`valuation`, `news`, `daily-events`, `target-prices`, `morning-note`, `benchmark`
- CAS merge：`tracked-stocks`
- append-like RMW log：`daily-snapshot` log, `morning-note` log
- prefix scan + metadata sort：`report`, `finmind-snapshot-fallback`, `snapshot-worker`
- local + remote hybrid：`brain`, `research`, `telemetry`
- 如果用一個 generic `storage.js` 把這些全收掉，結果通常是兩種：
- 抽象太薄，call site 還是要知道 backend 細節，抽象形同虛設。
- 抽象太厚，把 concurrency / metadata / URL semantics 藏起來，真正危險。
- 我會保留 domain module，僅把 backend primitive adapter 化。特別是：
- `tracked-stocks` 必須顯式暴露 `versionToken`。
- `snapshot-worker` 需要 `deleteMany`。
- `report` / fallback path 需要 `uploadedAt` 類 metadata（`api/_lib/finmind-snapshot-fallback.js:189-220`）。
- append log 不要偽裝成 atomic append；若未來要改善，應改 local append / Cloud Logging，不是靠抽象名稱自我安慰。

### Q4 · 漏掉的 Vercel 依賴？

- 有，而且比 Round 1 多。
- `VERCEL_ENV`：
- 直接影響 auth 寬鬆/嚴格模式（`api/_lib/auth-middleware.js:76-83`）。

- 也影響 research round count / mode（`api/research.js:475-480`）。
- `VERCEL_URL`：
- 被用來組 internal origin / signed URL origin（`api/_lib/signed-url.js:33-40`, `api/cron/collect-target-prices.js:132-136`, `api/cron/snapshot-portfolios.js:23-27` 等）。
- 若 VM-only，應改成 explicit `APP_ORIGIN` / `INTERNAL_API_ORIGIN`，不是繼續借 `VERCEL_URL`。
- `vercel.json` 本身：
- 不只是 cron；還有 CSP / security headers / API cache headers / function maxDuration / ignoreCommand（`vercel.json:24-79`）。
- `tests/vercel-config.test.js` 直接 assert 這些設定；full decoupling 時測試也要改（`tests/vercel-config.test.js:5-89`）。
- scripts / QA 預設 prod URL：
- `scripts/sync-to-vm-root.mjs:22-24`, `scripts/full-smoke.mjs:20-28`, `tests/e2e/support/qaHelpers.mjs:10-13`, `scripts/vercel-ignore.sh:4-10` 都還把 Vercel 當一級公民。
- nginx/CORS：
- `deploy/nginx-jcv.conf:6-11` 目前明確 whitelist `https://jiucaivoice-dashboard.vercel.app`；hosting cutover 時要決定雙棲窗口與收口時間。
- `@vercel/*` 其他套件：
- 我沒看到 `@vercel/analytics`, `@vercel/speed-insights`, `waitUntil`, `NextRequest`, `NextResponse`, edge middleware runtime 依賴；這塊不是現在的主要問題。
- `VERCEL_OIDC_TOKEN`：
- repo grep 沒有 runtime call site，只有 handoff doc 提到。這不是 blocking dependency。
- 額外一點：
- `api/_lib/signed-url.js:43-58` 的 signing secret 目前會 fallback 到 blob tokens；如果之後拔掉 blob token，又沒設 `BLOB_SIGNING_SECRET`，signed read 會一起壞。

### Q5 · Phase 順序與風險

- 可以，而且應該拆更小。
- 我同意先做 PoC，但我會做兩個：
- PoC 1：generic `last-success-*.json` 這類低風險 singleton marker，驗 list/read/write/ACL/cache/rollback。
- PoC 2：`tracked-stocks`，專門驗 CAS + retry + concurrent writer。
- `valuation` 要先補：
- 不是「商業邏輯還沒寫」，而是 VM-native ownership 還沒寫。最小可行做法是把現有 `collectValuationSnapshots` 包成 systemd worker 或 HTTP-triggered service，先別讓它繼續藏在 Vercel cron 後面。
- 前端 hosting rollback：
- 必須讓 Vercel hosting 保留到最後一刻，DNS / public entrypoint 最後切。只要 origin switch 還沒剪掉，Phase 3/4 失敗都有退路。
- rollback 單位：
- code/runtime：per-commit rollback。
- hosting：per-origin / DNS rollback。
- storage：per-keyspace cutover rollback。
- 我不接受「Blob 一次搬完，再說 rollback」這種說法。真正可用的 rollback 需要：
- migration manifest（path, checksum, contentType, visibility, copiedAt）
- 目標 bucket versioning
- keyspace-level read-primary flag
- burn-in 期間保留 reverse shadow-write 或 delta replay 方案
- 如果沒有最後兩項，所謂 rollback 只是假回滾；因為新寫入資料根本回不去舊 store。

### 我的結論

- 我同意最終目標可以是 GCS + full decouple。
- 我反駁兩點：`storage.js` 一刀切抽象、以及 `Blob migration` 當 Phase 1 big-bang。
- 我會先做 runtime decoupling + valuation ownership，再做 storage keyspace-by-keyspace cutover。

## Round 2b · Codex（盲點人格）· 2026-04-24 23:23

### B1 · Real pain 推斷
從 repo 證據看，使用者的 real pain 比較不像「Blob 被 Vercel 綁住很痛」，而像「Vercel 當開發控制平面時，常用但不穩，會打斷判斷與節奏」。`2026-04-16-vm-maximization-roadmap.md` 列的都是具體事故：ignoreCommand 反覆翻車、env 要手補、news-feed 502、cron 60s 不夠；`docs/research/vercel-cost-investigation.md` 也把 `$43/週` 定位成 build 紀律問題，不是產品成本結構問題；`feedback_vm_url_is_dogfood_surface.md` 更直接說用戶現在日常驗收看的是 VM URL，Vercel 已被降成「少量 build 的輔助面」。所以我推斷「完全脫離 Vercel」更像在追求 operational sovereignty 與心智清爽，而不是單純為了省 Blob 成本。若這個推斷成立，真正該問的不是「怎樣全部搬走」，而是「哪些 Vercel 模式最容易讓我斷線，怎樣把它們降到非關鍵路徑，出錯也不會卡住開發與驗收」。

### B2 · 推翻 decision 的隱性成本
推翻 `2026-04-15-knowledge-api-blob-not-vm.md` 的成本，真正重的不是 migration code，而是 decision graph 的信用。那份決議是 Claude + Qwen + Codex 兩輪 consensus；`2026-04-16-vm-maximization-roadmap.md` 又把它升級成整體原則的一個例外；`docs/runbooks/restore-drill.md` 甚至已把 private Blob 寫成 shared artifact 的 canonical source。若現在改口，之後每個讀 `docs/decisions/`、git log、handoff 的人都得重新理解「當時為何不搬、現在為何又搬、哪些前提變了」；而 `CLAUDE.md` 本來就是靠「先讀既有 decision，避免重開舊題」來壓低混亂。對單人開發來說，這份 context 稅沒有 infra team 幫你攤，最後就是未來的你在每次新 session 裡反覆補課。換句話說，翻案可以，但必須明寫成「目標函數改了」，不是默默把舊 decision 變成歷史噪音。

### B3 · 產品階段 mismatch
以 repo 目前證據，我認為時機不對。`2026-04-16-product-stage-stability-first.md` 已把現階段定義成 prototype → internal beta，並把成本優化、換平台類題目明確延後；`feedback_vm_deploy_pitfalls.md` 顯示 VM deploy 還有 SSH key、scp 路徑、pm2 restart 清空 in-memory state 這些不夠 boring 的操作坑；`feedback_auto_mirror_vm_after_commit.md` 更說明到 2026-04-24 還需要「commit 後立即 mirror VM」這種人肉紀律來維持一致；`2026-04-24-vm-api-rollout-handoff-v2.md` 也還在處理 PM2 secrets 靠 shell inherit、rollback 分兩條路、`npm ci --omit=dev` 會踩 transitive dep。這代表 VM 不是不能用，而是還在收斂成可預期平台。此時再把所有剩餘 Vercel 職責一次壓上去，會把「兩邊都有坑」變成「所有坑都集中在 VM」。盲點人格的判斷是：先把 VM deploy / env / rollback 變成 boring，再談全棧遷出，才符合穩定優先。

### B4 · 三個沒看到的盲點
1. 這不是單純 infra 選型，而是 decision governance 問題。9 天內推翻一個兩輪 consensus 的明文例外，若沒有很乾淨的覆盤與新原則，`docs/decisions/` 會失去「讀了就能信」的作用，bus factor 反而更差。
2. 目前討論把焦點放在 storage / hosting，卻幾乎沒碰 data governance。`docs/runbooks/restore-drill.md` 已把 portfolio / insider 狀態、restore evidence、private artifact retention 寫進操作契約；若離開 Vercel Blob，真正要重寫的是 backup、保留期、權限邊界、災難復原責任，不只是檔案放哪裡。
3. 二元 framing 本身可能就是盲點。repo 已經呈現一個可運作的中間態：VM 是 dogfood 與重活主面，Vercel 被限制成低頻 build、靜態入口或 rollback plane。這個 mixed state 不是半吊子，它可能正是 internal beta 最合理的風險對沖，而不必急著追求「100% 純化」。

### B5 · 反方論點
1. 現在看到的痛，大多是 Vercel 的 build / cron / env 管理方式，不是 Blob 本身；把 heavy jobs 移到 VM、把 Vercel 降成低頻靜態面，已經能處理大部分真痛點，沒必要為了心理上的完整性再付一次全面翻案成本。
2. 產品階段不支持這麼大的 infra 轉向。`2026-04-16-product-stage-stability-first.md` 很明確：現在最該換來的是穩定與可用體驗，不是平台純度。全脫離會直接吃掉 UX、資料品質與內測節奏的注意力。
3. 目前 VM 還不是一個 boring platform。deploy pitfall、env 載入、rollback path、in-memory reset 都還在 repo 裡被明文提醒；把 Vercel 這條 rollback / 備援 / 已知運作路徑也砍掉，等於把單人系統的營運風險集中到一個還在磨的面上。

### 我 2a 人格 vs 2b 人格的分歧
2a 在回答「如果戰略已定，要怎麼技術上搬得動」；2b 在回答「這個戰略目標本身現在是否被證明值得」。所以兩者不矛盾，但權重不同。若今天硬要選一個贏，我會讓 2b 贏：不是因為 full decouple 做不到，而是 repo 證據還不足以證明「現在」做它，比把 VM 先穩定化、更能減少整體風險。

---

## Round 3 · Claude synthesize · 2026-04-24 23:40

### Executive summary

Round 1 的 framing **錯了**。3 個獨立 input（Explore agent 通盤讀 decisions + Codex 2a 技術稽核 + Codex 2b 盲點人格）都獨立收斂到同一結論：**現在不是全棄 Vercel 的正確時機**，而且「完全脫離 Vercel」本來就不是使用者的明文立場。

### Consensus（3 方都同意）

1. **2026-04-16 已定長期目標**：Vercel 純 CDN/SPA + VM 純 backend。**不是「全棄」**，是分家。`docs/decisions/2026-04-16-product-gap-and-arch-direction.md` 明寫 3 個前提（VM 3 個月穩 / 演過 zone 事故 / 接了 Stripe），現在 0/3 達成。
2. **handoff v2 的 6 API 搬 VM = 既定 split 執行中**，不是 decoupling 本身。
3. **使用者 real pain 是 Vercel 的 build/cron/env 管理面**（ignoreCommand / 502 / 60s timeout / $43 build burn），不是 Blob 本身。把重活搬 VM + 降 Vercel push 頻率已經處理 80% 痛點。
4. **產品階段 = internal beta + stability first**（`2026-04-16-product-stage-stability-first.md`）。現在推翻 2 份 consensus decision + 全棧搬遷，會把注意力從 UX 拉走。
5. **VM 還沒 boring**：SSH key / scp / pm2 in-memory state / transitive dep / mirror discipline 都還在 repo 明文提醒（`feedback_vm_deploy_pitfalls.md` / `feedback_auto_mirror_vm_after_commit.md`）。把 Vercel 這條 rollback/backup plane 也砍掉 = 單人系統風險集中到一個還在磨的面。
6. **如果堅持要搬 · storage.js 一刀切抽象層會失敗**（Codex 2a 細節）。5 類 write semantics 不能被 `putObject/getObject` 抹平。要 capability-based adapter。
7. **phase 順序錯**：Blob 先搬不對。應該先清 runtime coupling（VERCEL_ENV / VERCEL_URL / vercel.json headers）+ 補 valuation systemd ownership，再做 keyspace-by-keyspace cutover。

### Divergence（本次沒產生真正分歧）

2a 和 2b 不矛盾：2a 是「若戰略已定，技術上怎麼搬」；2b 是「戰略本身現在值得嗎」。3 方都默認 2b 贏。

### Claude 該告訴用戶的

**錯的問題**：「完全不依賴 Vercel · 我該怎麼做？」

**對的問題**：「怎麼完成 handoff v2 的 6 API VM deploy，並降 Vercel push 頻率到純必要（備援 + CDN + 前端 build）？」

建議路徑（不是 4 phase、不推翻 decision）：

1. **按 handoff v2 §3 的 10 step** 把 6 API 搬到 `bigstock` (production VM)
2. **補 valuation systemd unit**（handoff §13 點名的 gap）
3. **今天開的 jcv-dev VM 定位為 staging / dev-only**，不入 production path
4. **VM 先讓它 boring** 3 個月 + 演過 zone 事故 + 接 Stripe 有付費用戶 → 再回來討論全棄 Vercel

### Blind-spot 盲點人格 B4 提出的真正大題目（值得另開 doc 討論）

**不是** storage 選型 · **是 data governance**：
- backup / 保留期 / 權限邊界 / 災難復原責任
- `docs/runbooks/restore-drill.md` 已把 Blob 寫成 canonical source
- 若未來要搬 Blob · 真正要重寫的是這些契約 · 不是檔案放哪

### 回寫決議

本 discussion 結論建議寫成 `docs/decisions/2026-04-24-vercel-full-decoupling-deferred.md`：
- 明確「全棄 Vercel」**延後到 3 前提達成**（不是推翻 · 是重申既有 decision 的時機點）
- 明示 handoff v2 的 6 API 搬 VM 是 既定 split 執行 · 不歸類為 decoupling
- 盲點人格 B4.2 的 data governance 題目 · 獨立 P2 ticket

---

_End of Round 3. 等使用者決定要不要把結論寫成 decision。_

## Round 4 · Codex Phase 0 deliverable · 2026-04-25 10:31

- Artifact 1: `.tmp/vercel-full-decoupling/phase-0/call-site-inventory.md` · 找到 57 個 call site
- Artifact 2: `.tmp/vercel-full-decoupling/phase-0/write-semantics-matrix.md` · 分類完成 · 28 個 keyspace
- Artifact 3: `.tmp/vercel-full-decoupling/phase-0/migration-manifest.json` · 28 條 manifest entry
- Artifact 4: `.tmp/vercel-full-decoupling/phase-0/cutover-flag-design.md` · cutover flag design

### 我發現 Phase 0 brief 漏掉的：
- `portfolios/active.json` 有 reader，但 repo 內找不到 writer；不先釐清 source-of-truth，Phase 1 會把 unknown state 一起搬走。
- `api/cron/snapshot-portfolios.js` 仍讀 `portfolios/{portfolio}/holdings/latest.json`，repo 內同樣找不到 writer；這是 legacy/unknown keyspace，不應默默假設。
- `api/_lib/signed-url.js` 目前會從 blob tokens 退回簽名 secret；如果 Phase 1 移除 Blob env、卻沒先補明確 `BLOB_SIGNING_SECRET`，private read 會一起壞掉。
- `snapshot-worker` 不是只有 `put/get`，還需要 `listPrefix + metadata(uploadedAt/size) + deleteMany`；這是 capability boundary，不是後面再補的小細節。
- coupling surface 不只 Blob API，還包含 `vercel.json` cron ownership、CSP `*.vercel-storage.com`、以及多個 `.vercel.app` hardcoded ops/test target。

### 我建議 Phase 1 第一個動作：
- 先做「capability contract + unknown writer closure」：定稿 keyspace ID / flag 名稱 / GCS bucket role 與 IAM 契約，補齊 `APP_ORIGIN` 與明確簽名 secret，並先找出 `portfolios/active.json`、`portfolios/{portfolio}/holdings/latest.json` 的 writer；這三件事不做，直接寫 adapter 只會把 unknown 行為包進新抽象。

## Round 5 · Codex Phase 1 prep · 2026-04-25 12:26

- Artifact 1: `.tmp/vercel-full-decoupling/phase-1/unknown-writer-closure.md`
  - 兩個 unknown writer 都重新 closure 了
  - repo grep + git history 都找不到 in-repo writer
  - 結論都不是「暫時沒找到而已」，而是目前 repo 只有 reader、沒有 source-of-truth
- Artifact 2: `.tmp/vercel-full-decoupling/phase-1/capability-contract.md`
  - 28 個 keyspace 全部轉成 canonical `<domain>.<purpose>` ID
  - 每個 keyspace 對應到具名 capability，沒有落回單一 `storage.js`
  - `cas-write` / `prefix-scan` / `local-mirror` / `append-log` 的 backend boundary 已定稿
- Artifact 3: `.tmp/vercel-full-decoupling/phase-1/gcs-bucket-iam.md`
  - 推薦 3 buckets / env：`public`、`private`、`archive`
  - 不走 28 bucket，也不走一個 all-in-one bucket
  - versioning / lifecycle / service account / signed URL TTL 都先收斂到 Phase 1 可執行程度
- Artifact 4: `.tmp/vercel-full-decoupling/phase-1/env-split-design.md`
  - `BLOB_SIGNING_SECRET`、`APP_ORIGIN`、`INTERNAL_API_ORIGIN` 變成 explicit env
  - signed-read 不再依賴 blob token fallback
  - migration order 與 rollback path 已拆成 5 step

### unknown writer 結果

- `portfolios/active.json`
  - **未找到 writer**
  - 現況只有 reader：`api/_lib/tracked-stocks.js`、`api/cron/snapshot-portfolios.js`
  - 兩處 reader 都已有 fallback `[me]`
  - 判定：**legacy unknown -> retire**
- `portfolios/{portfolio}/holdings/latest.json`
  - **未找到 writer**
  - 現況只有 reader：`api/cron/snapshot-portfolios.js`
  - 現役 source 已轉成 owner `holdings.json`、browser localStorage、dated snapshots
  - 判定：**legacy unknown -> retire**

### 我發現 Phase 1 prep brief 還漏一點

- `VERCEL_ENV` 不是單一語意，它同時控制 auth trust、`.env.local` 載入、research round profile；Phase 1 主階段若只做字面 rename，之後還是會留下 hidden coupling。
- `public-cdn-read` 不只 3 個 user-facing keyspace；`llm-dispatches` 與 `telemetry-events` 也是 public object，只是 cache criticality 比較低。
- 這 2 個 unknown keyspace 在 tracked git history 也只看得到 reader introduction，看不到被刪掉的 writer；更像「從一開始就沒有 repo-owned writer」，不是「writer 遺失」。

### 建議 Phase 1 主階段（adapter 前）的下一動作

- 先做一個純 config/runtime PR：
  - 補 `BLOB_SIGNING_SECRET`、`APP_ORIGIN`、`INTERNAL_API_ORIGIN`
  - code 先改成新 env 優先、舊 Vercel fallback 次之
  - 不碰 storage adapter
- 同時把 2 個 legacy unknown keyspace 明確標成:
  - 不進 GCS migration scope
  - 不生成 Phase 2 adapter capability
  - 需要新 source-of-truth 時另開新 keyspace，不 revive 舊 blob path
- 然後再做第一個真正的 storage PoC：
  - `ops.last_success_public`
  - `ops.last_success_private`
  - 最後才輪到 `portfolio.tracked_stocks`

## Round 6 · Codex Phase 1 step 1 deliverable · 2026-04-25 12:50

- commit SHA
  - `72b61ffb97d55be6caaed2d4557fe0ec6601a782`
- 改了哪些檔
  - `api/_lib/signed-url.js:8-145`
  - `api/cron/collect-target-prices.js:1-2,133-135`
  - `api/cron/snapshot-portfolios.js:1-4,23-25`
  - `.env.example:12-20`
  - `.env.local.example:36-43`
  - `tests/api/signed-url.test.js:1-96`
- 結果
  - `npm run typecheck` ✅ pass
  - `npm run lint` ✅ pass
  - `npm run check:fast-refresh` ✅ pass
  - `npm run test:run -- --run --reporter=basic 2>&1 | tail -50` ❌ pre-existing tooling failure
    - 現況 repo 的 `vitest` 會把 `basic` 當 custom reporter 載入，直接在 startup error 結束：`Failed to load custom Reporter from basic`
    - 這不是這次 env-routing 改動引入；我額外跑了 `npm run test:run -- tests/api/signed-url.test.js tests/api/collect-target-prices.test.js tests/api/portfolio-snapshots.test.js --run`，`3 files / 26 tests` 全部通過
- brief 漏的或預期外
  - runtime `VERCEL_URL` 真正還活著的 production code 只有 3 個 resolver 點；其餘 repo 命中是 scripts/docs/tests，不需要在這一步碰
  - `agent-bridge-standalone/` 這一步不用改：兩個 worker 已經優先讀 `INTERNAL_API_ORIGIN`
  - 我保留了 `VERCEL_URL` legacy fallback，但把 signed-url secret fallback 收斂成 `BLOB_SIGNING_SECRET -> blob tokens`，不再借 `BRIDGE_*` / `CRON_SECRET`
  - 依 design / brief 跳過了 script-only `VERCEL_URL` 點：`scripts/backfill-target-prices.mjs`、`scripts/sync-to-vm-root.mjs`
- 建議下一步
  - 直接進 Step 2 PoC 可以，但我建議先做一次短 review；這一步已經把 env contract 固定下來，先確認 `BLOB_SIGNING_SECRET` fallback 收斂與 `INTERNAL_API_ORIGIN` 優先順序都符合預期，再開 low-risk keyspace PoC 會比較穩

## Round 8 · Codex B QA · 2026-04-25 13:56

### 找到的 bug（按嚴重度排）
- 🔴 critical: `readLastSuccess()` 在 shadow-read compare 後會直接 `await appendDivergenceMetric()`；只要 jsonl append / mkdir 失敗，primary read 也會跟著 throw，違反「shadow-read failure 不影響 response」契約。位置：`api/_lib/last-success-store.js:394-408`。我用一次性腳本讓 `appendMetricImpl` 丟 `disk full`，實際結果是整個 read 直接 `THREW disk full`。
- 🟡 major: shadow-read 不是「return primary result; async/parallel diff」；實作會 `await shadowReadPromise` 後才 return primary。位置：`api/_lib/last-success-store.js:368-382`。我用 250ms 慢 shadow backend 測到整體 `elapsed=255ms`，代表 shadow latency 直接加到 response 上。
- 🟡 major: env / flag shape 跟 design contract 漂移。runtime 只看 `STORAGE_PRIMARY_OPS_LAST_SUCCESS` + 4 個 compound mode string。位置：`api/_lib/last-success-store.js:38-56`、`.env.example:29-33`、`.env.local.example:51-55`。但 Phase 1 contract 寫的是 `STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC` / `_PRIVATE`，Phase 0/1 env split 還要求 `STORAGE_SHADOW_READ_*` / `STORAGE_SHADOW_WRITE_*`。我直接設 doc 版 env 後呼叫 `getLastSuccessStorageMode()`，實際仍回 `vercel-only`；照 design 設 env 會 silently no-op，也無法 public/private 獨立 cutover。
- 🟡 major: invalid flag typo 會 silently fallback 到 `vercel-only`，沒有 throw / warn。位置：`api/_lib/last-success-store.js:38-42`。`STORAGE_PRIMARY_OPS_LAST_SUCCESS=vercell-only` 實測結果就是 `vercel-only`。這是 silent compromise，不是 safe failure。
- 🟡 major: `ops.daily_snapshot_marker` 雖然 A 說暫不切，但 helper 已實作且 routing 錯 bucket。dated marker 固定走 `GCS_BUCKET_PRIVATE`。位置：`api/_lib/last-success-store.js:78-92`。design 把 `ops.daily_snapshot_marker` 放 archive bucket；我實測 `getLastSuccessScopeDescriptor('daily-snapshot', '2026-04-25')` 回的是 `bucketName: "jcv-dev-private"`。
- 🟡 major: migration script 的 `--resume` 只對單一 runner idempotent；對雙 instance 不安全。state / reverse manifest 固定寫死同一路徑並用 `writeFile()` 每次整檔覆寫，沒有 lock / lease / atomic rename。位置：`scripts/migrate-last-success-to-gcs.mjs:13-14`、`124-155`、`296-334`。兩個 instance 同時跑會互相覆蓋 state，resume 也可能跳過或重跑錯 item。
- 🟡 major: caller failure contract 不一致。`readLastSuccess()` 對 primary backend failure 會 throw，但 `readLastSuccessMarker()` 把任何錯都吞掉回 `null`。位置：`src/lib/cronLastSuccess.js:58-84`。`api/daily-snapshot-status.js:10-19` 又直接把 `null` 丟進 `computeDailySnapshotHealth()`，而 `computeDailySnapshotHealth()` 會把它當 `badgeStatus: "missing"` 的一般 stale 狀態。位置：`api/_lib/daily-snapshot.js:231-269`。storage outage / misconfig 會被回成 200 + missing，不是 infra failure。
- 🟡 major: migration script 完全沒有 automated tests；`rg` 只找到 script 本體，找不到 `migrate-last-success-to-gcs` 的 test。Step 2a brief 要求的 idempotent / resume / dry-run 都沒有 coverage。
- 🟢 minor: payload contract 沒 guard。JSON path 對 `null` 會寫 `"null"`，對 `undefined` 會把 `undefined` 直接傳給底層 writer。位置：`api/_lib/last-success-store.js:244-245`、`280-283`。我在 Attack C 實測 `json-null` -> `4 bytes`、`json-undefined` -> `typeof body === "undefined"`；如果上游 caller 漏 payload，後果取決於底層 SDK，現在沒有明確防線。
- 🟢 minor: tests 雖然 4 個 mode 各有一個 happy-path case，但沒有覆蓋 invalid flag、shadow log I/O failure、slow shadow latency、migration script、`undefined/null` payload、以及 SDK generation / `ifGenerationMatch` 類真實行為。位置：`tests/api/last-success-store.test.js:24-139`、`tests/api/gcs-storage.test.js:31-150`。

### 通過的部分（A 做對的）
- `Concurrency / race`: shadow divergence log 用的是 `appendFile()`，不是 truncate。位置：`api/_lib/last-success-store.js:330-349`。同月 JSONL 不會因單次 write 把舊資料覆蓋掉。Attack A 也確認 read 只會看到舊 / 新完整 object，不會看到「部分寫入」內容。
- `Cutover flag 切換瞬間`: policy 是每次呼叫進 `readLastSuccess()` / `writeLastSuccess()` 時 resolve 一次。位置：`api/_lib/last-success-store.js:360-363`、`419-422`。所以 in-flight request 會沿用舊 policy，新 request 才吃到新 env；沒有額外 cache 導致半途換 backend。
- `Fallback / failure semantics`: Attack B 實測 `vercel-primary-gcs-shadow` 在 GCS 連續失敗時會 graceful degrade，primary read/write 仍成功；`gcs-only` 則確實 fail-fast throw。shadow-write failure 也沒有把 primary success 回滾。
- `Auth / secrets leak`: 沒看到 service account key / private key 被 commit；log 也沒有直接打印 token。bucket / key 會進 server log，但沒有直接回給 client。
- `Spec compare correctness`: A 自己點名的 JSON key order case 是過的；我用 `{meta:{b:2,a:1}}` vs `{meta:{a:1,b:2}}` 實測 hash 相同，result = `match`。
- `Bucket naming`: runtime bucket 名沒有寫死；真正 runtime 取 `GCS_BUCKET_PUBLIC` / `GCS_BUCKET_PRIVATE` env。`jcv-dev-*` 只出現在 example / test，不是 hardcoded runtime branch。
- `賤招`: 沒看到 TODO / FIXME / XXX / debugger；script 的 `console.log` 屬於 CLI summary，不是殘留 debug。

### A 自己 flag 「希望被 attack 的部分」結果
- `compare path`: JSON key order 不同但 payload 等價，這條沒問題；stable sort compare 有做到。
- `一邊 miss / 一邊 hit`: code 會正確分類成 `primary-miss-shadow-hit` 或 `shadow-miss`，但因為會先 `await shadowReadPromise` 再 return，所以 miss / mismatch 的比對延遲仍會加到 primary response。
- `Attack A · 撞 race`: worker 1 在 `vercel-primary-gcs-shadow` 做 write 時，worker 2 同時 read 同 key，實測回 primary 的新值、shadow 仍是舊值，然後記一筆 divergence。沒有 partial body，但 burn-in 期間會穩定看到舊 / 新 divergence noise。
- `Attack B · 撞 quota`: 我連續模擬 GCS backend down 5 次。`vercel-primary-gcs-shadow` 5 次都回 Vercel 成功；`gcs-only` 5 次都直接 throw。這條跟 design 一致。
- `Attack C · 撞 size`: 1MB JSON / 10MB JSON 都會被 stringify 後整包送下去；empty text body 會寫 0 bytes；`null` 會寫 `"null"`；`undefined` 會直接把 `undefined` 傳給底層 writer。前 3 個可預期，最後一個是 contract 缺口。
- `Attack D · 撞 corruption`: shadow-read mismatch 時，如果 divergence JSONL append 正常，會確實落檔；但只要 append / mkdir 失敗，primary 已經讀到的結果不會被 return，整個 read 直接 throw。這不是 silently lost，而是直接把 request 打爆。

### 我推薦下一動作
- 有 critical + 多個 major。A 必須先修，再談 migration on VM。
- 最少先修 4 件：`appendDivergenceMetric` failure 不能影響 read、shadow-read 不能阻塞 primary return、env/flag shape 要對齊 Phase 0/1 contract、migration script 要補最少的 dry-run / resume / idempotent tests 或至少加 single-run lock。

### 我的 confidence
- adapter correctness: 6/10
- dispatcher correctness: 3/10
- migration script safety: 2/10

## Round 9 · Codex A · fix round · 2026-04-25 14:15

- commit SHA: `0deba05e456f9fcaeb9dc8579beb9e47b0b3f7dc`
- 1. divergence metric append 改成 background compare 內部 `try/catch`；log append / mkdir 失敗只 `warn`，primary read 不再被 cascade 打爆。
- 2. shadow-read 改成 primary read 完就 return；secondary compare + divergence logging 用 fire-and-forget scheduler 跑背景，不再把 shadow latency 算進 response。
- 3. runtime flag 改成讀 `STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC`、`STORAGE_PRIMARY_OPS_LAST_SUCCESS_PRIVATE`、`STORAGE_SHADOW_READ_OPS_LAST_SUCCESS`、`STORAGE_SHADOW_WRITE_OPS_LAST_SUCCESS`，`.env.example` / `.env.local.example` 也同步成 split contract。
- 4. split flag 與 legacy compound flag 都改成 strict parse；非空 typo 直接 throw，只有 undefined / 空字串才 fallback 到 default `vercel`。
- 5. `getLastSuccessScopeDescriptor('daily-snapshot', date)` 現在明確標成 `ops.daily_snapshot_marker` 並 route 到 `GCS_BUCKET_ARCHIVE`，不再默默落到 private bucket。
- 6. migration script 開頭加 `.tmp/migration-state/last-success.lock` pid-file lock；同時跑第二個 instance 會直接 fail `migration already in progress`。
- 7. `readLastSuccessMarker()` 不再吞 backend error；現在會 throw `code: 'STORAGE_OUTAGE'`，`api/daily-snapshot-status.js` 也改成回 500 + `STORAGE_OUTAGE`，不再把 outage 偽裝成 missing。
- 8. 新增 `tests/scripts/migrate-last-success-to-gcs.test.js`，覆蓋 dry-run 不寫 GCS、live rerun idempotent skip、`--resume` 只接續 pending item，另外補一個 lock case。
- 9. `writeLastSuccess()` 入口現在 guard `null` / `undefined` payload；直接 throw `InvalidPayload`，不再把 `null` 寫成字串或把 `undefined` 丟給底層 writer。
- 10. store / GCS tests 補上 invalid flag、metric append failure、不阻塞 primary 的 slow shadow read、archive bucket routing、invalid payload，以及 `ifGenerationMatch` save precondition pass-through。
- 對 B 的 confidence 回應：我預期下一輪 `dispatcher correctness` 從 `3/10` 升到 `8/10`，因為這輪把最危險的 contract drift 都收斂了: primary/secondary 不再互相阻塞、flag shape 已對齊 split contract、invalid config 會 fail-fast、caller 也能區分 missing 與 outage；`migration script safety` 我預期從 `2/10` 升到 `7/10`，因為現在至少有 single-run lock 和 resume/idempotent automated coverage。
- B 沒抓但我自己另外發現的 bug：沒有新的未修復 bug；額外補到的是 `api/daily-snapshot-status` 的 500 path test，確認 route 端真的吃到 `STORAGE_OUTAGE`。

## Round 10 · Codex B re-verify · 2026-04-25 14:32

### 10 個 fix 驗證結果

| # | 嚴重度 | 標題 | 結論 | 證據 |
|---|--------|------|------|------|
| 1 | 🔴 | cascade | ✅ 修好 | runtime harness 重跑 `appendMetricImpl -> disk full`；`readLastSuccess()` 仍 return `{job:'collect-news', ok:true}`，只留下 warn，不再 throw。 |
| 2 | 🟡 | shadow-read blocks primary | ✅ 修好 | 250ms 慢 shadow backend 重跑；primary read `elapsed=0ms`，結果即時回 `{backend:'primary'}`，沒有再被 shadow latency 卡住。 |
| 3 | 🟡 | env shape 漂移 | ✅ 修好 | split env 重跑：`public={primary:'gcs', shadowRead:true, shadowWrite:false}`、`private={primary:'vercel', shadowRead:true, shadowWrite:false}`；legacy compound `gcs-primary-vercel-shadow` 仍可 backward-compat 解析；split + legacy 同時設時 split 贏，並 warn legacy ignored。 |
| 4 | 🟡 | invalid flag silent fallback | ✅ 修好 | 設 `STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC=vercell-only` 後，`getLastSuccessStorageMode()` 直接 throw：`must be "vercel" or "gcs"`；不再 silently fallback。 |
| 5 | 🟡 | daily-snapshot bucket route | ✅ 修好 | `getLastSuccessScopeDescriptor('daily-snapshot','2026-04-25')` 現在回 `keyspace='ops.daily_snapshot_marker'`、`bucketClass='archive'`、`bucketName='jcv-dev-archive'`。 |
| 6 | 🟡 | migration multi-instance lock | ⚠️ 修了但有 regression | integration 重跑：第二個 instance 會正確 throw `migration already in progress`；但我再測 `SIGKILL` 持鎖 process 後，stale lock 會殘留，下一次仍 false-positive throw 同訊息。 |
| 7 | 🟡 | caller failure contract | ✅ 修好 | `readLastSuccessMarker()` 在底層 throw 時會丟 `code='STORAGE_OUTAGE'`；`api/daily-snapshot-status.js` 在 `GCS` primary + 缺 bucket 的 outage 情境下實回 `500` + `{code:'STORAGE_OUTAGE'}`，不再回 `200 + missing`。 |
| 8 | 🟡 | migration tests | ✅ 修好 | `tests/scripts/migrate-last-success-to-gcs.test.js` 已存在；case 含 dry-run、idempotent rerun、resume、lock。targeted `vitest`：4 files / 21 tests 全綠。 |
| 9 | 🟢 | payload guard | ✅ 修好 | `writeLastSuccess(..., null)` 與 `writeLastSuccess(..., undefined)` 都會 throw `InvalidPayload` + `code='INVALID_PAYLOAD'`。 |
| 10 | 🟢 | test coverage | ✅ 修好 | test 名稱可對到 invalid flag、metric append failure、slow shadow latency、archive bucket、invalid payload、`ifGenerationMatch`；`tests/api/daily-snapshot-status.test.js` 也有 500 outage path。補充：invalid payload test file 是 `null` case，`undefined` 我用 runtime harness 另驗也有擋住。 |

### 新發現的 regression

- 🟡 `migration stale lock`: `scripts/migrate-last-success-to-gcs.mjs` 的 pid-file lock 沒有 stale detection / pid liveness check。實測 child process acquire lock 後 `SIGKILL`，lock file 仍留著；下一次 migration 直接 false-positive `migration already in progress`。這條會把後續 migration wedge 住，A 還要補。
- 除了上面這條，這輪沒有再抓到新的 dispatcher / fallback / auth regression。
- `primary throw` 時 shadow read 確實已經發出，但我觀察到 `shadowCalled=true` 且 `unhandledRejection=[]`；目前看是多做了一次無效 I/O，不是漏錯或 crash。
- Round 8 通過項重跑：
- `Concurrency / race`: in-memory race 重跑，writer 還在等 120ms shadow write 時，reader 已讀到 primary 新值 `{version:'new'}`；沒有 partial body regression。
- `Cutover flag 切換瞬間`: 兩次 read 間改 env，結果從 `vercel` 正常切到 `gcs`；沒有 cache regression。
- `Fallback`: `vercel-primary-gcs-shadow` 仍會在 shadow read/write fail 時 graceful degrade；`gcs-only` 仍 fail-fast throw。
- `Auth / secrets`: 我只看到 log site 打 key / error；`rg` 沒看到新的 token / private key 直接打印。

### A 預測 vs 實際
- A 預測 dispatcher correctness 3→8 · 我評：8/10
- A 預測 migration safety 2→7 · 我評：5/10
- adapter correctness · 我評：8/10

### 我推薦下一動作
- 還沒全 clear。A 先補 `stale lock`，再談 migration on jcv-dev VM。

## Round 11 · Codex A · stale lock fix · 2026-04-25 14:50

- commit SHA: `a49296e1d426504c9541d679ff3721fa45f185ed`
- diff 大小: `2 files changed, 125 insertions(+), 29 deletions(-)`
- test 結果: `npm run test:run -- tests/scripts/migrate-last-success-to-gcs.test.js --run` ✅ `1 passed / 4 passed`
- race window 評估: 兩個 instance 仍可能同時看到 stale lock，但 reclaim 之後用 `writeFile(..., { flag: 'wx' })` 重搶，只會有一個成功；輸家會在 retry 時看到新的 lock 並回 `migration already in progress (pid X)`。殘留風險主要是重複清 stale warning，不會變成雙持鎖。

---

## Round 12 · Claude · VM migration executed · 2026-04-25 14:55

### 執行摘要

Phase 1 Step 2a 完整實作 + 對抗性 QA + 真實遷移在 jcv-dev VM 跑通。

### 執行步驟

1. **patch 套用**：`fcf71b6...a49296e` 5 個 commit `git am` 上 `jcv-dev` 從 main HEAD `c25b342` rebase
2. **npm install**：`@google-cloud/storage` SDK 裝好
3. **env 補齊**：`.env` 加 `GCS_PROJECT=jcv-dev-2026` + 3 個 bucket name；**flag 預設 `vercel-only` 沒動 behavior**
4. **PM2 restart with --update-env**：jcv-api online 0s
5. **API regression check**：5 個 endpoint HTTP code 跟 patch 前一模一樣（`/api/valuation` 400 / `/api/target-prices` 400 / `/api/tracked-stocks` 405 / `/api/brain` 400 / `/api/blob-read` 401）
6. **dry-run migration**：列出 7 keyspace · 4 actual + 3 source-missing
7. **actual migration**：
   - `last-success-collect-daily-events.json` → `gs://jcv-dev-public/` ✅ done
   - `last-success-collect-news.json` → `gs://jcv-dev-public/` ✅ done
   - `last-success-collect-target-prices.json` → `gs://jcv-dev-private/` ✅ done · vercel⟷gcs SHA match `e3134d67ed00`
   - `last-success-compute-valuations.json` → `gs://jcv-dev-private/` ✅ done · SHA match `97eff03c4466`
   - 3 source-missing（Vercel Blob 沒寫過 · 預期）
8. **read-back verify**：migration script 自帶 SHA-256 read-back · 4 個 `done` 都通過

### 信心評分（B Round 10 + post-VM）

| 元件 | 起始 | 修後 |
|------|------|------|
| Adapter correctness | 6 | **8/10** |
| Dispatcher correctness | 3 | **8/10** |
| Migration safety | 2 | **9/10**（含 stale lock fix） |

### 沒做的（明確 out-of-scope）

- ❌ 沒切過 `STORAGE_PRIMARY_OPS_LAST_SUCCESS_*` flag（仍 `vercel-only`）
- ❌ 沒在 production VM (`bigstock`) 跑 · 只 jcv-dev
- ❌ 沒 push（5 commit 都 local）
- ❌ 沒 burn-in（理論最少 24h shadow-read 觀察）

### 留給用戶決定

Step 2 PoC 已成功落地。下一動作有 3 條路徑：

1. **緩步驗收**：jcv-dev 切 `vercel-primary-gcs-shadow` 跑 24h burn-in · 看 divergence log 沒事再切 `gcs-primary` · 共需 ~3 天
2. **保守留守**：本步 PoC 已證明 adapter / migration 行得通 · flag 仍 `vercel-only` 無事 · 直接 push 到 GitHub 留紀錄 · 等下一個 keyspace Step 2b（tracked-stocks CAS）再進
3. **積極推進**：直接派 Codex 寫 Step 2b（`portfolio.tracked-stocks` GCS generation precondition CAS）· 用同樣 A→B QA 模式

### 沒處理的 follow-up

- daily-snapshot / morning-note / tw-events-worker 的 marker 應該由 worker 寫 · 目前 source-missing 會在那些 worker 跑過第一輪後自然填上
- `migration-source-inventory.json` 我寫的版本（2 物件）跟實際（4 物件）有差 · 來源是 Vercel Blob list API 的 prefix 行為跟 exact filename match 不同（不是 bug · 是我的 inventory 工具用法錯）

## Round 13 · Codex A · Phase 1 Step 2b · 2026-04-25 17:11

- commit SHA: `38efec8`
- 改 / 新建檔（file:line list）
- `api/_lib/gcs-storage.js:74-201` — 加 `gcsReadWithVersion` / `gcsWriteIfGeneration`，把 GCS 412 正規化成 `PRECONDITION_FAILED`
- `api/_lib/storage-divergence-log.js:1-81` — 抽共用 divergence logger / stable JSON hash / background task scheduler，讓 2a / 2b 共用同一份 logger
- `api/_lib/last-success-store.js:1-11,199-220,498-531` — 只改成吃共用 logger helper，2a behavior 不變
- `api/_lib/tracked-stocks-store.js:1-558` — 新增 tracked-stocks capability adapter，支援 Vercel/GCS primary + shadow read/write + opaque `versionToken`
- `api/_lib/tracked-stocks.js:221-276,545-557` — 既有 tracked-stocks wrapper 改接新 store，保留既有 read fallback API surface
- `api/tracked-stocks.js:5-126` — caller 改成 `readTrackedStocks` + `writeTrackedStocksIfVersion`；retry loop 仍留在 caller
- `scripts/migrate-tracked-stocks-to-gcs.mjs:1-426` — 新增 create-only migration script，state/lock/resume/stale-lock safety 跟 2a 對齊
- `tests/api/gcs-storage.test.js:63-335` — 補 versioned read / create-only / 412 normalize coverage
- `tests/api/tracked-stocks-store.test.js:1-454` — 補 4 mode、shadow divergence、non-blocking shadow write、VERSION_CONFLICT propagate、caller retry
- `tests/scripts/migrate-tracked-stocks-to-gcs.test.js:1-400` — 補 dry-run / idempotent / resume / stale lock / existing-object skip coverage
- `.env.example:38-40`
- `.env.local.example:60-62`

CAS retry 行為：

1. 第一次成功：caller 先 `readTrackedStocks()` 拿到 current payload + opaque `versionToken`，合併 stocks 後一次 `writeTrackedStocksIfVersion()` 成功，直接回 200。
2. 第一次 412 · retry 後成功：primary store 回 `VERSION_CONFLICT`，caller sleep/backoff 後重新 read 最新 payload + 最新 token，再 merge 一次後重寫；若第二次 precondition pass 就成功，不會掉資料。
3. 連續 N 次 412 · 終 throw（max retries reached）：caller 最多跑 `TRACKED_STOCKS_WRITE_RETRY_LIMIT=3` 輪；每輪都 conflict 就把最後一次 `VERSION_CONFLICT` 往外 throw，route 回 500，沒有把 retry 策略藏進 adapter。

與 2a last-success 的設計差異總結：

- 2a 是 Class 1 last-writer-wins；2b 是 Class 2 CAS，所以 adapter 不是單純 `read/write`，而是 `readTrackedStocks` + `writeTrackedStocksIfVersion`。
- 2a 的 shadow write 可以直接寫同 payload；2b 的 shadow write 必須先用 secondary 自己的 version space 讀 secondary token，再 best-effort conditional write，不能拿 primary token 硬套 secondary。
- 2a 的 retry 可以在 backend 邏輯外看起來像 overwrite；2b 明確把 retry loop 留在 caller，因為 max retries / backoff / merge policy 都是 domain semantics。
- 2a migration 可以 overwrite verified singleton；2b migration 嚴格 create-only，目的不是同步最新值，而是安全建立初始 GCS 副本，遇到已存在物件一律 skip，不覆蓋較新的 secondary。

- 給 Codex B QA 的 hint：我最不確定的是 cross-backend shadow-read 的「version 一致」定義。Vercel `etag` 和 GCS `generation` 不是同一個 version domain，所以我採 payload hash 為 divergence 主判準，version 只記錄 presence/hash metadata，不拿 raw token equality 當 mismatch 條件；這塊請優先 challenge。

## Round 17 · Codex A · fix round 2 · 2026-04-25 17:51

- commit SHA: `0a11bc7`
- 我選 **A**。原因：這個 regression 的根因就是 shadow reconcile retry 只刷新 secondary token，沒有刷新 primary payload；在 retry 稀少的前提下，多一次 primary read 成本低、實作面最小，也不需要 metadata sidecar 或 per-key queue。
- 修後 reconcile 邏輯：background shadow write 第一次若因 `VERSION_CONFLICT` 失敗，不再重播原先 capture 的 payload；而是先對 primary backend 做一次 fresh read 取得「當下最新」payload，再重讀 secondary 最新 `versionToken`，最後用 `write(descriptor, latestPrimaryPayload, latestShadowToken)` 重試一次。這樣舊 task 晚到時，只會把 secondary 往最新 primary 收斂，不會把已經寫進 primary / shadow 的 v12 退化回自己手上的 v11。
- 新補 test：`tests/api/tracked-stocks-store.test.js` 新增兩段 coverage。第一段把既有 single-conflict test 改成 stateful primary，確認 retry 真的讀 primary latest；第二段直接重建「舊 task 先讀 shadow / 新 task 先寫完 / 舊 task 後 reconcile」的 interleaving，驗證最終 shadow 仍停在 payload v12，不會退化。
- 驗證：
  - `npm run typecheck` ✅
  - `npm run lint` ✅（有既存 warning：`src/lib/dashboardHeadline.js:54 no-unused-vars`，非本輪引入）
  - `npm run test:run -- tests/api/tracked-stocks-store.test.js tests/api/gcs-storage.test.js tests/scripts/migrate-tracked-stocks-to-gcs.test.js --run` ✅（`26 passed`）
- 信心預測：CAS adapter `5/10 -> 7/10`

## Round 18 · Codex B re-verify · 2026-04-25 17:59

### Round 16 stale task race 是否修好
✅ 已修好。

- 我重跑 repo 內 reproduce case：`npx vitest run tests/api/tracked-stocks-store.test.js -t "does not let an older shadow reconcile overwrite a newer primary payload"` ✅
- 這條 test 在 `tests/api/tracked-stocks-store.test.js:518-667`，interleaving 就是「舊 task 先拿舊 shadow token、 新 task 先把 primary/shadow 推到 v12、舊 task 恢復後吃 conflict」；最終 assert `shadowState` 仍是 payload v12 / `etag-12`（lines 651-664），沒有退化回 v11。
- 修點也對得上：`api/_lib/tracked-stocks-store.js:591-595` conflict 後先 `readLatestPrimaryPayload()`，而不是重播 capture 的 stale payload；helper 在 `api/_lib/tracked-stocks-store.js:478-486`。

### single-conflict reconcile regression check
✅ 通過。

- 我重跑 `npx vitest run tests/api/tracked-stocks-store.test.js -t "reconciles one shadow version conflict so the secondary converges to the latest primary payload"` ✅
- 這條 test 在 `tests/api/tracked-stocks-store.test.js:377-515`；10→11→12 路徑最終 primary/shadow 都收斂到 v12，且 `gcsBackend.read` 只發生 1 次（lines 511-513），沒有新 warning / divergence metric。

### 新發現的 regression
沒找到新的 critical regression。

- primary read 失敗：我用 inline mock 重放，background task 只記 warn + divergence metric，沒有 uncaught rejection；觀察到 `readVersionCalls=1`、`shadowWriteCalls=1`、error=`primary network failure`。
- secondary token re-read 失敗：同樣是 warn + divergence metric，沒有把 background task 打爆；觀察到 `readVersionCalls=2`、`shadowWriteCalls=1`、error=`secondary token reread failed`。
- primary 在 reconcile 期間又 advance：我額外模擬 v12 reread 後 primary 立刻變 v13；shadow 最終寫入的是 reread 當下 snapshot v12，不會偷跟到 v13。這符合預期，但也代表 shadow 可短暫落後 1 個版本，需靠下一次同步收斂；我不把這視為 regression。
- 補充：整檔 `npx vitest run tests/api/tracked-stocks-store.test.js` = `9 passed`。

### A 預測 vs 實際
- CAS adapter 5/10 → 7/10 預測 · 我評：8/10
- migration: 7/10
- overall: 7.5/10

### 我推薦下一動作
- 全 clear → 進 jcv-dev VM migration
- 理由：Round 16 blocker 已關，這輪沒再挖到新的 critical；下一階段主要價值在真環境 burn-in / divergence 觀察，不是在本地 mock 再加一層 retry。

---

## Round 19 · Claude · Step 2b VM migration executed · 2026-04-25 18:08

### 執行摘要

Phase 1 Step 2b（tracked-stocks CAS）完整實作 + 4 輪 A↔B QA + 真實遷移在 jcv-dev VM 跑通。

### A↔B QA 軌跡（CAS 比 last-success 難很多）

| Round | 角色 | 結果 |
|------|------|------|
| 13 | A 寫 | commit `38efec8` 558 行 adapter |
| 14 | B QA | 1 critical (migration verify race) + 1 major (shadow stale) + 1 minor (helper override) |
| 15 | A 修 | commit `e54bae1` 三全修，confidence 預測 6→8 / 2→7 |
| 16 | B 驗 | 三原 bug ✅ · **抓新 race**（舊 task 反蓋新 shadow） |
| 17 | A 修 2 | commit `0a11bc7` reconcile A：先 re-read primary payload + secondary token |
| 18 | B 驗 2 | ✅ 全 clear · 沒新 regression · CAS adapter 8/10 |

### VM 執行（Round 19 本輪）

1. patch 套 `38efec8...fd7e055` 5 commit 上 jcv-dev（commit SHA mapped to `e6d502c..1e02ddd` after `git am`）
2. npm install
3. env 補 `STORAGE_PRIMARY_PORTFOLIO_TRACKED_STOCKS=vercel` + 2 個 shadow flag（皆 false）
4. PM2 restart with `--update-env`
5. API regression check：5 endpoint HTTP code 跟 patch 前一模一樣
6. Dry-run migration：列 114 portfolio
7. **Actual migration：114 個全部 done，0 error, 0 race, 0 missing**
8. Spot-check parity 3 個 portfolio：全 SHA-256 match
9. GCS bucket count：`gs://jcv-dev-private/tracked-stocks/*/latest.json` 共 114 個

### 信心評分（B Round 18）

| 元件 | Step 2a | Step 2b 起始 | Step 2b 終 |
|------|--------|------------|----------|
| Adapter (CAS) | 8/10 | 6/10 | **8/10** |
| Dispatcher | 8/10 | 7/10 | **8/10** |
| Migration | 9/10 | 2/10 | **7/10**（verify-throw 邊界硬，operationally 仍 ok） |

### 沒做（明確 out-of-scope）

- ❌ 沒切 cutover flag（仍 `vercel`）· 行為跟 patch 前一致
- ❌ 沒在 production VM (`bigstock`) 跑
- ❌ 沒 push（commits 全 local）
- ❌ 沒 burn-in shadow read/write

### 累積進度

Phase 1 完成 keyspace：
- ✅ `ops.last_success_*`（2 個 keyspace · 4 + 3=7 keys）
- ✅ `portfolio.tracked_stocks`（1 個 keyspace · 114 keys）

剩 25 個 keyspace 未搬，含：
- Class 1 last-writer-wins（7 個 · 簡單複用 2a 模式）
- Class 4 prefix scan（3 個 · 比 2a 多需 listPrefix + deleteMany）
- Class 5 hybrid local+remote（4 個 · 最難，brain/research/telemetry）
- 其他 dated singleton

### 留給用戶決定

下一個 keyspace 候選（按複雜度）：

1. **Class 1 群**：`valuation`、`news-feed`、`daily-events`、`target-prices`、`morning-note-snapshot`、`benchmark` 等。複用 last-success-store 模式 · 預期一輪 A↔B 各搞定
2. **Class 4**：snapshot prefix scan。要先擴 adapter 加 `listPrefix` + `deleteMany` capability
3. **Class 5**：brain/research/telemetry hybrid。最危險，sync semantics 要設計

或者：

- **(A) 先 burn-in 已搬的 2 個 keyspace**：jcv-dev 切 `vercel-primary-gcs-shadow` 跑 24-48h 觀察 divergence log，確認 zero divergence 才繼續
- **(B) 直接接下一個 keyspace 群**：Class 1 七連戰
- **(C) push 上 GitHub 留紀錄**：8 個 commit local，攢一輪推遠端

## Round 20 · Codex strategy · 2026-04-25 18:10

1. 我站 **C -> B -> A**，但 B 不是「挑 1 個 Class 1 試試」，而是把同屬 last-writer-wins 的那批一次做完。理由：`push` 先解 8 commit 全 local 的單機風險；Class 1 真正在驗的是同一套 dispatcher/shadow contract，分 6 次停下來 burn-in 很浪費；最後再做一次 family-level burn-in，訊號才夠密。
2. 我反駁 Claude 的第 1、3 條。`shadow` 沒跑過真流量，不等於它必須先當 stop-the-line gate；而 tracked-stocks CAS 已經驗過比 Class 1 更難的 precondition/version path。剩餘風險比較像各 keyspace wiring，而不是 adapter framework 本身。
3. `push` 不是零風險：可能喚醒 branch webhook/CI/preview，或讓別的 agent 把這支當成可接手分支；但這仍小於「Mac 掛掉 8 commit 全沒」的風險。做法應是隔離 WIP branch / draft PR，不把它當 deploy signal。
4. 一句話 brief：**先把現有 8 commits 推到隔離 WIP branch，接著整批完成 Class 1 last-writer-wins keyspace，全部進 shadow 後再做一次 24h burn-in。**
5. 信心：**8/10**

## Round 21 · Codex A · Class 1 batch · 2026-04-25 18:37

- commit SHA(s): `33c7fc7`
- 實際做了 `7` 個 keyspace（manifest phase 3 的這輪 Class 1 singleton batch）：`valuation`、`target_prices`、`daily_events_latest`、`news_feed_latest`、`analyst_reports`、`morning_note_snapshot`、`benchmark_snapshots`。比預期 `6` 多了 `analyst_reports`。manifest 原始 `semantics_class:1` 還有其他 dated / legacy / phase 4 family，這輪沒有一併擴進來。
- generic store 抽法總結：新增 `api/_lib/singleton-store.js`，把 env cutover (`primary/shadow-read/shadow-write`)、Vercel/GCS dispatcher、shadow divergence logger、`head`、prefix `list` 都收成同一層；`last-success-store.js` 改成只保留 scope descriptor + legacy/split env policy，7 個新 family 都是薄 wrapper。
- migration script 一句說明：新增 `scripts/migrate-class1-keyspace-to-gcs.mjs`，用 `--keyspace=<name>` / `--all` 跑每個 family 自己的 lock/state/reverse-manifest，複用 2a 驗過的 verify / resume / idempotent pattern。
- 我最不確定、希望 B 對抗的部分：Step 2c 的 scope 到底該停在這 `7` 個 phase 3 singleton family，還是要把 manifest 其餘 `semantics_class:1` dated / legacy family 也算進來；其次是 `benchmark` 這種 prefix-list + exact-read hybrid path 在 `gcs` primary 下的 contract 是否還需要更強對抗測試。

## Round 22 · Codex B QA · 2026-04-25 18:49

### 找到的 bug
- 🔴 critical: 無。這輪沒抓到 `last-success` regression。
- 🟡 major: `scripts/migrate-class1-keyspace-to-gcs.mjs --all` 沒有 batch-level / global lock，只有 per-keyspace lock。實測兩個 `--all` 同時跑時，runner2 先成功做完 `valuation`，到 `target-prices` 才報 `migration already in progress (pid ...)`；不是一開始就整批拒絕。這會造成 partial duplicate work / partial state，跟「整個 batch 只能有一個 instance」預期不一致。
- 🟡 major: `benchmark_snapshots` 的 prefix-list + exact-read hybrid 在 generic store 下沒有 shadow-list compare。`createSingletonStore.list()` 只走 primary，`readBenchmarkSnapshots()` 又先 list 再對該清單 exact read。實測 `gcs` primary + `shadowRead=true` 時，只要 GCS list 少一個 `2026-04-25` key，而 Vercel 其實有，結果只回 `2026-04-24`，而且 divergence metric = `0`；shadow 完全看不到「list 少 key」。
- 🟢 minor: `singleton-store.js` + 7 wrappers 沒掃到 `TODO` / `FIXME` / `console.log` 殘留。

### last-success regression check
✅ 沒發現 regression。

證據：
- `vitest run tests/api/last-success-store.test.js`（`ff6f950`）: `9/9` pass。
- 同一份 current assertions 複製到 `a49296e` snapshot 跑：`9/9` pass。
- 4 個 legacy cutover mode（`vercel-only`、`vercel-primary-gcs-shadow`、`gcs-primary-vercel-shadow`、`gcs-only`）的 `getLastSuccessStorageMode()` 輸出與 refactor 前一致。
- split env 名稱仍是 `STORAGE_PRIMARY_OPS_LAST_SUCCESS_PUBLIC/PRIVATE` + `STORAGE_SHADOW_READ/WRITE_OPS_LAST_SUCCESS`；沒有被 generic `envPrefix` 命名覆蓋。
- divergence log 路徑仍是同一個月檔 `logs/storage-divergence-YYYY-MM.jsonl`；只是 helper 被抽到 `storage-divergence-log.js`。

### 7 keyspace 對照 manifest
- 對：`valuation`、`target_prices`、`daily_events_latest`、`news_feed_latest`、`analyst_reports`、`morning_note_snapshot`、`benchmark_snapshots` 都在 manifest，sample key 對照 pattern 也都吻合。
- 對：7 個 wrapper 都沒自訂 `gcsKey`，所以 GCS key 直接跟 Vercel key 同路徑，不存在雙端 key drift。
- 對：env namespace 7 套互相獨立，沒重疊：`VALUATION`、`TARGET_PRICES`、`DAILY_EVENTS`、`NEWS_FEED`、`ANALYST_REPORTS`、`MORNING_NOTE`、`BENCHMARK_SNAPSHOTS`。
- 可疑但不是 path bug：`morning_note_snapshot`、`benchmark_snapshots` 在 manifest 是 dated Class 1，不是 strict singleton；目前 wrapper 仍保留 dated key shape，path 沒 drift，但真正風險在 `benchmark` 的 list contract（見上面 major）。

### A 自己 flag 的 2 個點
- analyst_reports 合法嗎: 合法。manifest 是 `semantics_class:1, phase:3`；repo 內只有 `api/analyst-reports.js` + store wrapper，GET 讀 latest public snapshot per code，POST refresh fallback 才做 overwrite，符合 last-writer-wins。沒找到 `api/cron/analyst-reports*` 依賴，所以不會直接卡 cron flow。
- benchmark hybrid contract: 有洞。exact key path 本身沒 drift，generic 也真的有 list capability；但 `list` 不做 shadow compare，所以 `gcs` primary 下若 list inventory 漏 key，會 silent 回不完整 history。這不是 path bug，是 abstraction contract bug。

### 4 個 attack 結果
- Attack A · last-success 行為對比：pass。舊版 `a49296e` 與新版 `ff6f950` 跑同一套 current assertions 都 `9/9` pass。
- Attack B · 7 keyspace 同時切 shadow mode：單 process harness 下 7 個 read 都寫進同一個 `storage-divergence-2026-04.jsonl`，共 `7` 行、`7` 個 keyspace 都在，沒掉行。共享單一 divergence log 檔本身不是立即 bug。
- Attack C · partial migration mid-flight：`--all` 跑到第 4 個 (`news-feed`) fail 時會 abort，後面 keyspace 不會繼續跑；前 3 個 state / reverse manifest 都乾淨留下，`--all --resume` 能繼續完成剩下 keyspace。另外 `--keyspace=valuation` 與 `--keyspace=target-prices` 兩個 instance 併跑可同時成功，證明 lock 確實是 per-keyspace。補充：也正因為只有 per-keyspace lock，兩個 `--all` 併跑才會出現上面的 major bug。
- Attack D · keyspace 名稱 typo：`--keyspace=valuationn` 會明確 throw `Unsupported keyspace "valuationn"`，不是 silent fallback。

### confidence
- generic store: 7/10
- 7 wrappers: 8/10
- migration script: 5/10
- last-success regression: 9/10

### 我推薦下一動作
1. 先補 `--all` 的 batch-level lock，否則 migration safety claim 還不成立。
2. 再補 list-family 的 shadow contract：至少讓 `benchmark` 的 list phase 也能 compare primary vs shadow inventory，或在 `gcs` primary 下做 dual-list mismatch detection。
3. 其餘 6 個 wrapper + `last-success` 可以視為基本過關；修完上面兩個點再進 burn-in 比較合理。

## Round 23 · Codex A · fix round · 2026-04-25 18:59

- commit SHA: `94f5992`
- fix 1: `scripts/migrate-class1-keyspace-to-gcs.mjs` 的 `--all` 現在先拿 `.tmp/migration-state/class1-batch.lock`，第二個 batch runner 會在進任何 keyspace 前直接 abort `migration batch already in progress`。
- fix 2: generic `singleton-store.list()` 現在在 `shadowRead=true` 時會 background compare primary/shadow inventory；`benchmark-snapshots` wrapper 也改成把同一組 options 傳進 list+read，所以 `gcs` primary 缺 key 會寫 `list-divergence`。
- race 評估: 兩個獨立 `--keyspace=A` / `--keyspace=B` 仍可 parallel，因為它們完全不拿 batch lock；兩個 `--all` 會被 batch lock 序列化；`--all` 與單獨 `--keyspace=X` 仍只在 `X.lock` 上互斥，所以 overlap case 會早 fail，但不再有 batch-vs-batch 的 partial duplicate work。
- shadow-list divergence jsonl 範例: `{"ts":"2026-04-25T10:59:00.000Z","type":"list-divergence","keyspace":"snapshot.benchmark","key":"snapshot/benchmark","primary":"gcs","shadow":"vercel","op":"list","result":"primary-missing-keys","primaryCount":1,"shadowCount":2,"primaryOnlyKeys":[],"shadowOnlyKeys":["snapshot/benchmark/2026-04-24.json"]}`
- confidence: migration `5 -> 8`；generic store `7 -> 8`

## Round 24 · Codex B re-verify · 2026-04-25 19:10

### 2 個 fix 驗證結果
| # | 修好? | 證據 |
|---|---|---|
| 1 | ✅ | `vitest run tests/scripts/migrate-class1-keyspace-to-gcs.test.js` pass。另用 child-process harness 重跑 Round 22 reproduce：`--all` vs `--all` 時 runner2 只回 `ERROR:migration batch already in progress (pid 93001)`，stdout 沒有任何 `LOAD:`，代表進任何 keyspace 前即 abort；沒有再出現「先做完一部分 keyspace 才 fail」。 |
| 2 | ✅ | `vitest run tests/api/singleton-store.test.js tests/api/benchmark-snapshot-store.test.js` pass。實際用 temp `logs/storage-divergence-2026-04.jsonl` 驗：`gcs` primary / `vercel` shadow 與反向 `vercel` primary / `gcs` shadow，都會寫一筆 `type:\"list-divergence\"`，且含 `primaryOnlyKeys` / `shadowOnlyKeys`；兩端 list 相同時 `logLines=[]`；`readBenchmarkSnapshots()` 在 shadow list/read 各延遲 `350ms` 下主路徑仍只花 `2ms`，log 檔同時分出一行 `type:list-divergence` 與一行 `op:read,result:match`，沒有混成同一種 record。 |

### A 預測 vs 實際
- migration: A 預測 8 · 我評: `8/10`
- generic store: A 預測 8 · 我評: `7.5/10`

### confidence
- migration fix re-verify confidence: `8/10`
- generic store fix re-verify confidence: `7.5/10`

### 新發現的 regression
- 沒找到新的 correctness regression。
- 但有一個新的 observability noise 風險：async shadow-list compare 會吃到 snapshot skew。我另外做了 race probe：primary list 先看到 `["2026-04-25"]`，10ms 後 inventory 前進到 `["2026-04-25","2026-04-26"]`，shadow list 再讀到新清單；即使兩端最終會 converge，仍會寫一筆 `type:list-divergence`。這不影響 primary list/read response，也不影響資料 correctness，但 divergence log 可能出現 false positive noise。

### Round 22 通過項 regression check
- `7 wrappers / last-success / 4 cutover` 仍維持 working。
- `vitest run tests/api/valuation-store.test.js tests/api/target-prices-store.test.js tests/api/daily-events-store.test.js tests/api/news-feed-store.test.js tests/api/analyst-reports-store.test.js tests/api/morning-note-snapshot-store.test.js tests/api/benchmark-snapshot-store.test.js tests/api/last-success-store.test.js`：`8 files / 16 tests` 全 pass。
- `last-success-store` 沒有走 generic `list()`；`rg` 只找到 `readLastSuccess` / `writeLastSuccess` call site，沒掃到 `lastSuccessStore.list`。
- 4 個 legacy cutover mode 仍 resolve 成 Round 22 同樣輸出：`vercel-only`、`vercel-primary-gcs-shadow`、`gcs-primary-vercel-shadow`、`gcs-only`。

### 我推薦下一動作
- 兩個 must-fix 都算修好；若這輪 gate 只看 Round 22 的 2 個 major，我建議 `全 clear → A → jcv-dev VM migration`。
- 但我會另外記一個非阻塞 follow-up：若後面很依賴 `list-divergence` 當高精度告警，A 之後應再補 snapshot-skew / in-flight write 的 noise 說明或去噪策略。

---

## Round 25 · Claude · Class 1 batch VM migration · 2026-04-25 19:23

### A↔B QA 軌跡

| Round | 角色 | 結果 |
|------|------|------|
| 21 | A 寫 | commit `33c7fc7` + `ff6f950` · 7 keyspace + generic `singleton-store.js` + `last-success-store` refactor 共用 |
| 22 | B QA | 0 critical · 2 major (batch lock / benchmark shadow-list) · last-success regression 過 |
| 23 | A 修 | commit `94f5992` 兩 fix |
| 24 | B 驗 | ✅ 全 clear · 1 非阻塞 follow-up（list snapshot skew noise） |

### VM migration 結果

3 個新 commit (`47aec90`, `694ec23`, `372823e` post-`git am`) 套上 jcv-dev：

| Keyspace | Status | objects |
|---------|--------|---------|
| valuation | ✅ done | 26 |
| target_prices | ✅ done | 27 |
| daily_events_latest | ✅ done | 1 |
| news_feed_latest | ✅ done | 1 |
| analyst_reports | ✅ done | 1 |
| morning_note_snapshot | ⏭️ source-empty | 0（worker 還沒跑過） |
| benchmark_snapshots | ⏭️ source-empty | 0（worker 還沒跑過） |

Total migrated: **174 objects** new in this round（含 last-success 4 + tracked-stocks 114 = 累計 292 跨 Phase）。

API regression check 5 endpoint HTTP code 跟 patch 前完全一樣。

### Spot-check parity（5 sample · 1 per migrated keyspace）

```
✅ target-prices/2330.json      MATCH 82b42e9f
✅ analyst-reports/2330.json    MATCH d7e4ec85
❌ daily-events/latest.json     DIVERGE
❌ news-feed/latest.json        DIVERGE
   valuation/2330.json          (Vercel list API exact-match issue · migration SHA-verified write-time)
```

兩個 DIVERGE **不是 migration bug** — 是 active Vercel cron 在 migration 完成後又更新了 source（migration 凍結在 5 分鐘前的 snapshot）。這正是 shadow mode 跑 burn-in 會看到的劇本：
- 在 `vercel-only` 期間，Vercel 是真相，GCS 是 migration snapshot · 自然會 drift
- 一旦切 `gcs-primary` · cron 寫入會走 GCS · drift 才會收斂

### 兩個 source-empty keyspace 行為

`morning_note_snapshot` 和 `benchmark_snapshots` 在 Vercel Blob 都 0 source · script 目前 fail-fast 把空當錯。這是 minor UX wart：
- 影響：只在 `--keyspace=X` 跑空 keyspace 時失敗
- 不阻塞：兩個 keyspace 在 worker 跑過第一輪 cron（08:30 morning-note / 03:00 snapshot）後 source 就會有 · 屆時直接 `--keyspace=morning-note` / `--keyspace=benchmark` 即可
- 後補方向：script 加 `--allow-empty` flag · 或預設把 0 source 當 `skipped-empty-source` 不算 fatal

### 信心評分（B Round 24）

| 元件 | 終值 |
|------|------|
| Generic `singleton-store` | 7.5/10 |
| 7 wrappers | 8/10 |
| Migration script `--all` | 8/10 |
| `last-success` refactor regression | 9/10 |

### 累積進度

GCS 目前有：
- public bucket: 5 物件（last-success-collect-* 2 + daily-events 1 + news-feed 1 + analyst-reports 1）
- private bucket: 169 物件（last-success private 2 + valuation 26 + target-prices 27 + tracked-stocks 114）

Phase 1 Step 2 完成 keyspace：
- ✅ 2a · last-success（2 keyspace）
- ✅ 2b · tracked-stocks CAS（1 keyspace）
- ✅ 2c · Class 1 batch（5 個有 source · 2 個 source-empty 待 worker）

剩 Phase 1 還未做：
- Class 3 RMW append log（daily-snapshot / morning-note log）
- Class 4 prefix scan（snapshot/research, snapshot/brain, snapshot/portfolio-state）
- Class 5 hybrid local+remote（brain, research, telemetry）
- Phase 2 cron systemd
- Phase 3-5 前端 / 清理

### 留給用戶決定下一步

(A) push commits 到 `vercel-decouple-phase1` 分支（push 在前面已做過 1 次 fd7e055；現在多 3 個 commit，再 push 一次同步）

(B) 接 Class 4 prefix scan（snapshot 系列 · 比 Class 1 多需 listPrefix + deleteMany + prefix-list shadow compare）

(C) 接 Class 5 hybrid（brain/research/telemetry · 最難 · local+remote sync semantics）

(D) 跑 24h burn-in（切 7+1+2 個 keyspace 進 `vercel-primary-gcs-shadow` 觀察 divergence log）

## Round 26 · Codex strategy 2 · 2026-04-25 19:23

1. 順序: D//B->C
2. 反駁 Claude 的「先 D 開著並行做 B」: 同意；D 是等時間的風險探針，空等 24h 沒價值。
3. 下一步一句話 brief: 先做 `snapshot/research/` 的 Class 4 prefix scan capability，確認 local/remote 對照，再複製到 `snapshot/brain/`、`snapshot/portfolio-state/`；D 繼續盯 `vercel-primary-gcs-shadow`。
4. 信心: 8

## Round 27 · Codex A · Class 4 snapshot.research · 2026-04-25 19:44

- commit SHA(s): `7ff3161`
- 改 / 新建檔: `api/_lib/prefix-store.js`, `api/_lib/snapshot-research-store.js`, `api/_lib/gcs-storage.js`, `agent-bridge-standalone/workers/snapshot-worker.mjs`, `scripts/migrate-snapshot-research-to-gcs.mjs`, `tests/api/prefix-store.test.js`, `tests/api/snapshot-research-store.test.js`, `tests/scripts/migrate-snapshot-research-to-gcs.test.js`, `.env.example`, `.env.local.example`
- `list` cursor pagination 測過嗎？有。`tests/api/prefix-store.test.js` 跑 page1/page2，cursor 用「上一頁最後一個 logical key」，primary/shadow backend 用同一個 cursor 收斂；另外 `tests/workers/snapshot-worker.test.js` 也補跑確認 worker callsite 沒壞。
- `deleteMany` shadow 行為: primary 先刪；若有 shadow write，先 `head` secondary 判斷是否已不存在，再對存在的 key 做 best-effort delete。secondary 已不存在或 delete 失敗都不 block primary，但會 append `delete-divergence` metric 並 `warn`。
- 驗證: `npm run typecheck` ✅；`npm run lint` ✅（repo 既有 `src/lib/dashboardHeadline.js:54` warning 未處理）；`npm run test:run -- tests/api/prefix-store.test.js tests/api/snapshot-research-store.test.js tests/scripts/migrate-snapshot-research-to-gcs.test.js --run` ✅；額外跑 `tests/workers/snapshot-worker.test.js` ✅
- 我最不確定 / 希望 B 對抗的部分:
  1. page cursor 現在是 key-based，不是 backend-native cursor；第 N 頁會從 prefix 開頭重掃到 cursor 邊界，對 100+ 物件夠用，但大 keyspace 成本會上升。
  2. list shadow compare 目前比的是 logical key inventory + `hasMore` tail，不比 `uploadedAt/size` metadata parity；如果 B 認為 Class 4 需要 metadata divergence，也該現在釘死。
  3. snapshot worker 對 research records 是 `JSON.parse(record.content)` 後再經 store `write()` 重序列化；內容等價，但若未來要 byte-for-byte checksum parity，這段可能要改成 raw-body write path。

## Round 28 · Codex B QA · 2026-04-25 20:34

### 找到的 bug
- 🔴 critical: `scripts/migrate-snapshot-research-to-gcs.mjs` 跟 active worker 並跑時，會把「舊 source snapshot」合法標成 `done`。script 只在一開始讀一次 Vercel source，之後只驗 GCS 是否等於那個舊 hash；如果 worker 在這之後更新同 key，但當下還沒有同步寫到 GCS，migration 仍可能成功結束，`--resume` 之後也會 skip `done` / `skipped-*`，stale copy 會被永久帶過。
- 🟡 major: `api/_lib/prefix-store.js` 的 cursor pagination 是 key-based rescan，不是 backend-native continuation。以現在 worker 的 `limit=100` 實測，100 objects = 1 次 backend `list()`；1000 objects = 10 個 logical pages / 55 次 backend `list()`。若 shadow compare 開著，primary + shadow 合計是 110 次。更重要的是：新 key 若插進已掃過區間或 key `<= cursor`，這次 sweep 會漏掉。
- 🟡 major: `classifyShadowList()` 只比 logical key inventory + `hasMore` tail，不比 metadata/body。`snapshot.research` 目前 production callsite 只有 worker 的 list/write/delete，repo 內沒有 runtime `read()` callsite；所以「same key, different content」在現況下通常不會留下 `list-divergence`，也不會自動留下 `read-divergence`。
- 🟢 minor: worker 現在對 research record 走 `JSON.parse(record.content)` + store `write()` 重序列化，已不是 raw-body preserving path。對 current worker-generated JSON 我沒看到立即 drift regression，但它和 migration 的 raw-buffer copy contract 已經不同，未來若塞進非 canonical JSON text，hash 會變。

### A 自己 flag 的 3 個
A1 · cursor cost: 兩端 backend 的排序鍵方向是對的，我查到官方文件都寫 lexicographical order；但 GCS 有明寫 object listing strong consistency，Vercel 我只找到 order，沒看到 concurrent write 下的 listing consistency / snapshot isolation 保證。這表示「排序基準相同」成立，但「翻頁期間兩端一定在看同一個 moving snapshot」不成立。以 worker 現在的 `limit=100` 看，100 objects 只要 1 次 backend page；1000 objects 需要 55 次 backend page。新 insert 落在未掃區間且 key `> cursor` 會被看到；落在已掃區間或當前 page 且 key `<= cursor` 會漏。
A2 · list metadata: 同意 A 的擔心。`normalizeListedItem()` 其實把 `uploadedAt/size/contentType/metadataValue` 都收進 item，但 `classifyShadowList()` 完全沒用，只看 key 與 `hasMore`。如果 Vercel 跟 GCS 同 key 不同 content，list compare 會過。理論上 `read()` 會打 `read-divergence`，但 `snapshot.research` 現在沒有 production read callsite，所以現實上這類 divergence 很容易完全無 log。
A3 · serialize drift: worker 跟 migration 不是同一條 path。worker parse 後再經 `prefix-store.write()` 用 `JSON.stringify(..., null, 2)` 重寫；migration 直接拿 Blob raw buffer 寫 GCS。對目前 worker 自己 build 出來的 `record.content`，我沒有看到立即 drift regression；但若目標是 byte-for-byte parity，現在 contract 不一致，A flag 合理。

### deleteMany 行為
- primary delete 失敗: 不是 atomic。`deleteManyFromStore()` 會先把整批 key 都跑完，最後只要 `failedKeys.length > 0` 就 throw `DeleteManyError`。也就是說，前面一些 key 可能已刪掉，最後仍然 throw；我用 3 key mock 重現過這個 partial side effect。
- shadow delete: primary 成功後，shadow 先 `head()` 判斷存在，再 best-effort delete。shadow 已不存在或 delete 失敗都不 block primary；只會回傳 `shadowMissingKeys` / `shadowFailedKeys`，再 append `delete-divergence` metric + `warn`。
- concurrent same-key deleteMany: 兩個 caller 同刪一批 keys 時，多半會變成一個 caller `deleted`、另一個 caller `missing`；missing 不算 primary failure，所以行為基本 idempotent，但沒有 transaction / once-only guarantee。
- bulk size limit: A 沒有做 GCS batch delete；`gcsDeleteMany()` 是 per-object `file().delete()` + `Promise.all`，所以不是「1000/req limit 沒處理」這種問題。當前 worker callsite 自己每 100 個切一批，所以 snapshot-worker 這裡還好；generic API 本身沒有 concurrency cap，之後若有其他 caller 一次塞很大批會自己扛平行度。

### migration 補充
- `--dry-run`: 這是 CLI script，不受 serverless timeout 約束；但它會對每個 item 做 source read + destination read，而且每處理一 item 就 whole-file rewrite state / reverse manifest。功能上跑得完，代價是 wall time 跟 disk I/O 會隨 N 顯著上升。
- `--resume`: 這不是 page-cursor resume，而是 item-status resume。每次 resume 都會先重掃整個 `snapshot/research/` inventory，再 merge inventory 後 skip `done` / `skipped-*` / `source-missing`。功能上可續，但不是 `O(remaining)`。
- empty source: 有測到。`tests/scripts/migrate-snapshot-research-to-gcs.test.js` 已 cover empty source no-op，這點不像先前 morning-note 那樣 fail-fast。

### regression check
- `prefix-store` 跟 `singleton-store` 共用的是同一個 `api/_lib/storage-divergence-log.js` helper；這輪沒有改 `singleton-store` / `last-success-store` 本體。
- targeted re-run:
  - `tests/api/prefix-store.test.js tests/api/snapshot-research-store.test.js tests/scripts/migrate-snapshot-research-to-gcs.test.js tests/workers/snapshot-worker.test.js`: `11/11` pass
  - `tests/api/last-success-store.test.js`: `9/9` pass
- 結論: last-success / Class 1 目前看起來 still working；這輪問題集中在新的 prefix-store / snapshot.research / migration contract，不是 shared logger regression。
- test gap 仍在:
  - `tests/workers/snapshot-worker.test.js` 只有 happy path
  - 沒 cover deleteMany primary partial failure
  - 沒 cover cursor pagination concurrent insert / missed-key race
  - 沒 cover same-key different-content divergence
  - migration 沒 cover active worker race

### confidence
- prefix-store: 5/10
- snapshot-research wrapper: 5/10
- deleteMany: 6/10
- migration: 4/10

### 我推薦下一動作
- 不要在 snapshot worker 還可能只寫 Vercel 的情況下直接跑 live migration；先 freeze snapshot writes，或先確保 `snapshot.research` 已經 dual-write，再 migrate，否則 stale copy 會被合法地標成 `done`。
- 在重用 `prefix-store` 到 `snapshot/brain` / `snapshot/portfolio-state` 前，先決定 cursor contract：如果要 one-pass completeness，就不能用現在的 key-based rescan；如果只接受「best-effort + next sweep 補」，要把這個限制寫死。
- 若 burn-in 要依賴 divergence log 當 guardrail，list phase 至少要有 same-key content / metadata detect，或補一個 sampling read compare；否則 same-key divergence 目前是盲點。
- 補 4 類 tests：worker purge path、deleteMany primary partial failure、pagination race、migration active-writer race。

## Round 29 · Codex A · fix round · 2026-04-25 01:48

- commit SHA: `7ff3161f7e81f17f1b66517366916a8d391ebc04`（依 brief 未另開 commit；本輪修改是 dirty working tree 疊在這個 HEAD 上）
- critical fix：選 `C`
  原因：只做 `B` 仍依賴後續 rerun，而 snapshot.research migration 在 destination 已存在時不會主動覆寫；先用 `A` 強制 `STORAGE_SHADOW_WRITE_SNAPSHOT_RESEARCH=true`，再用 `B` 把 verify 後 source drift 標成 `stale-source-changed`，才能把 stale window 壓到最小且讓 `resume` 不會錯把 stale copy 當 `done`
- major fix #1：prefix-store 採 `A`
  在 `api/_lib/prefix-store.js` 開頭加 `LIMITATION` block，並在 `createPrefixStore` JSDoc 明寫 key-based rescan cursor 會漏掉 concurrent insert with key `<= cursor`，caller 依賴後續 sweep 補
- major fix #2：list shadow compare 補 sampling read
  `prefix-store.js` 與 `singleton-store.js` 都新增 shared-key sampling read；`STORAGE_SHADOW_SAMPLE_SIZE` 預設 `5`、`0` 可關閉。same-key different-content 現在會 append `type: "read-divergence"`，不再只看 inventory
- minor doc：在 `snapshot-worker` 的 snapshot.research write callsite 補 comment，說明 canonical JSON write 與 migration raw copy 允許 byte drift；語意一致性看 normalized JSON，不要求 byte-for-byte
- tests：
  `snapshot worker purge / delete path`：新增 `purgeExpiredDailySnapshots()` 測試，驗 research 走 prefix-store delete、generic artifacts 走 batched `delImpl`
  `deleteMany primary partial failure`：新增 prefix-store 測試，primary `gcsDeleteMany` partial failure 會直接 throw `DeleteManyError`，不繼續碰 shadow
  `cursor pagination concurrent insert race`：新增 prefix-store 測試，示範 concurrent insert with key `<= cursor` 會被下一頁略過，對齊 limitation 文件
  `migration active-writer race`：新增 migration 測試，source 在 copy verify 後改變時會標 `stale-source-changed`，reverse manifest 不收進去
  額外補強：prefix-store / singleton-store 都加 same-key different-content sampling read divergence 測試
- 信心預測：
  migration `4/10 -> 8/10`
  prefix-store `5/10 -> 7/10`
