# 全棄 Vercel · 拉到 VM 自有 stack

**日期**：2026-04-25
**參與者**：用戶（拍板）+ Claude（架構）+ Codex 2a（技術稽核）+ Codex 2b（盲點人格）
**源頭**：`.tmp/vercel-full-decoupling/discussion.md`（Round 1-3）
**主題**：把所有 Vercel 上的職責（hosting / Blob / cron / runtime env / CDN）搬到自有 GCP VM stack
**狀態**：🟡 決議完成 · phase 0 進行中

---

## 決議

**目標函數變更**：從「分家共存」改為「single-cloud sovereignty」。

具體目標：

1. 前端 hosting 從 `jiucaivoice-dashboard.vercel.app` 搬到 VM nginx + 自有 domain
2. 所有 `@vercel/blob` 寫入路徑改為 GCS（同 GCP project，避免跨雲）
3. `vercel.json` 的 cron / headers / CSP / maxDuration 全部用 VM 等價物（systemd timer / nginx config / process supervisor）取代
4. `VERCEL_ENV` / `VERCEL_URL` / `VERCEL_OIDC_TOKEN` runtime 引用全部清除
5. 結束後 `vercel.json` + `@vercel/blob` npm dep + 相關測試移除
6. Vercel 帳號保留作 emergency rollback plane（不付費 / free tier sufficient），burn-in 完才完全退場

---

## 為什麼推翻先前 decision

### 舊 decision

- `2026-04-15-knowledge-api-blob-not-vm.md` — Blob 是 VM-maximization 的明定例外，理由：read-heavy / write-rarely / 檔小 / fs.watch 邊界 case
- `2026-04-16-vm-maximization-roadmap.md` — Vercel 留 CDN + 輕量 API + Auth；Blob 例外
- `2026-04-16-product-gap-and-arch-direction.md` — 全棄 Vercel 需 3 前提：VM 穩 3 個月 / 演過 zone 事故 / 接 Stripe

### 為什麼現在改

**目標函數從「分家共存」改為「single-cloud sovereignty」**。

不是舊 decision 錯了 · 是用戶在 2026-04-25 明示重新權衡：

- operational sovereignty（單一 stack 控制權）
- mental clarity（不用記哪個職責在哪邊）
- 預算邊界乾淨（GCP 一條帳單）
- 即使 3 前提未達 · 用戶選擇承擔轉換期 risk 換長期清爽

舊 decision 的事實基礎（Blob read-heavy 適合 CDN、Vercel build flaky、cron timeout）**全部仍然成立**；只是 weighting 改了。

### 多 LLM 紀錄

3 方獨立輸入（Claude Explore agent / Codex 2a 技術 / Codex 2b 盲點）**都建議延後**，理由 collated 在 `.tmp/vercel-full-decoupling/discussion.md` Round 3。

用戶 override 該 consensus。本決議**忠實記錄此 override**，不竄改 LLM 結論。

---

## Phase 計畫（採 Codex 2a 提案 · 非 Claude 原 4 phase）

```
Phase 0 · capability inventory + migration manifest + cutover flag + regression tests
Phase 1 · 清 VERCEL_ENV / VERCEL_URL / vercel.json runtime assumption + 補 valuation systemd
Phase 2 · 低風險 keyspace PoC (last-success-*.json) + tracked-stocks CAS PoC（GCS generation precondition）
Phase 3 · keyspace-by-keyspace cutover（shadow-write + read-primary flag · 不 big-bang）
Phase 4 · 前端 hosting cutover（Vercel hosting 保留當 rollback 到最後一刻）
Phase 5 · burn-in 後才刪 vercel.json / @vercel/blob / Vercel-coupled tests
```

**Phase 0 不可省**。Codex 2a 的核心 insight：repo 內 `@vercel/blob` 至少 29 個 reference（不是初估的 7+），分 5 類 write semantics（last-writer-wins / CAS / append-like RMW / prefix scan / local+remote hybrid），需要先 inventory 才能設計 adapter。

---

## 不做（避免常見陷阱）

- ❌ 不寫 `storage.js` 一刀切抽象層（Codex 2a 反駁：5 類 write semantics 會被抹平）→ 改用 capability-based adapter
- ❌ 不 Blob 一次搬完再說 rollback（假回滾，新寫入回不去舊 store）→ 必有 migration manifest + bucket versioning + read-primary flag + shadow-write
- ❌ 不在 Phase 1 動 Blob → 先清 runtime coupling 才動 data plane
- ❌ 不直接拿 `etag` 對應 GCS → 用 opaque `versionToken`（內部映射 GCS `generation`）
- ❌ 不假設搬完就完成 → burn-in 期間保留 reverse shadow-write 或 delta replay

---

## 連動風險（Round 2b 盲點人格 B4 點名）

### 1. Decision graph 信用

9 天內推翻一份兩輪 consensus 的明文例外 · 後續讀 `docs/decisions/` 的人會困惑。本決議用「目標函數改了」明寫 · 而非「以前錯了」 · 降低 context 稅。

### 2. Data governance（**真正的大題**）

`docs/runbooks/restore-drill.md` 已把 private Blob 寫成 shared artifact canonical source。搬 Blob 不只是換存儲後端 · 還包括：

- backup 策略（GCS object versioning + scheduled snapshot）
- 保留期（per keyspace 各自不同）
- 權限邊界（IAM + signed URL）
- 災難復原責任（誰負責 / SLA / drill cadence）

**獨立 P2 ticket**：`docs/decisions/<YYYY-MM-DD>-data-governance-post-vercel.md` 在 Phase 2 完成前必須拍板 · 否則 Phase 3 的 keyspace cutover 不可開始。

### 3. VM 還沒 boring

`feedback_vm_deploy_pitfalls.md` / `feedback_auto_mirror_vm_after_commit.md` 顯示 VM 仍有 SSH key / scp / pm2 in-memory state / transitive dep / 手動 mirror discipline。搬完 = 所有風險集中 VM。

**緩解**：

- Phase 4 前 · 所有 VM deploy pitfall 必須有 runbook 並 drill 過
- Vercel 帳號保留 free tier · burn-in 30 天無回退才退場

---

## 執行 ownership

- **Claude**：架構決策 + multi-LLM 協調 + 決議 review
- **Codex**：所有實作（Phase 0-5 全部）
- **Qwen**：Phase 0 capability inventory 的廣度爬梳（若 Codex 單獨 cover 不全）
- **用戶**：每個 phase cutover 前的 explicit go/no-go

---

## 開始條件 · 結束條件

**開始**（已達成 2026-04-25）：

- ✅ 用戶 override 既有 consensus 並理解 3 風險（decision graph / data governance / VM 不 boring）
- ✅ 本決議落地

**Phase 0 結束**：

- migration manifest 完成（29+ call site 全部分類 + write semantics 標註）
- cutover flag 機制 design 完成
- regression test baseline 跑過

**整體結束**（觸發 Vercel 帳號退場）：

- Phase 5 burn-in 30 天無回退
- 所有 VM deploy pitfall 有 runbook
- data governance decision 落地

---

## 相關

- `.tmp/vercel-full-decoupling/discussion.md` — 多 LLM 完整討論（Round 1-3）
- `docs/status/2026-04-24-vm-api-rollout-handoff-v2.md` — 6 API VM 部署 handoff（執行中 · 與本決議方向一致）
- `docs/decisions/2026-04-15-knowledge-api-blob-not-vm.md` — 被本決議 supersede
- `docs/decisions/2026-04-16-vm-maximization-roadmap.md` — 被本決議 supersede（Blob 例外移除）
- `docs/runbooks/restore-drill.md` — Phase 2 前必須先 review

---

## 後續

Phase 0 brief：`.tmp/vercel-full-decoupling/phase-0-brief.md`（Codex 執行）
