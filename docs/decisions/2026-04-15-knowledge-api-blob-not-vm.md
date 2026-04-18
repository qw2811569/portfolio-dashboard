# Knowledge API 搬 Vercel Blob，不搬 VM

**日期**：2026-04-15
**參與者**：Claude + Qwen + Codex（2 輪 consensus）
**源頭**：`.tmp/infra-01-knowledge-api/brief-v2-blob.md`, `.tmp/infra-01-consensus/round2-blob-design.md`

## 背景

Claude v1 提「VM runtime + fs.watch + memory cache + 11 個分檔 endpoint」，被 Qwen + Codex 雙殺：「把公開小 JSON 分發錯做成常駐 VM 狀態同步系統」。

## 決議（8 點）

1. **Read 直連 Blob public URL**，**不經 proxy**（YAGNI，repo 已有 8 個直連 @vercel/blob routes）
2. **Write 走 `/api/knowledge/update`**（auth required, `ifMatch` conditional write）
3. **Blob `cacheControlMaxAge: 60`**，接受 60s 傳播延遲
4. **Immutable versioning**：`knowledge/v{n}/*.json` + `manifest.json{current:"vN"}` 原子切版
5. **Dev/Prod 分 Blob store**（不是分 prefix — token 是 store 級）或 **dev 走本地 import**（Mode A 預設）
6. Response headers `x-knowledge-version` + `x-knowledge-source`
7. 前端 `knowledgeBase.js` 改 **async factory pattern**（Vite 不支援 runtime conditional import）
8. Manifest endpoint + 30s cache

## 為什麼不用 VM

- 知識檔總量 432KB（小）
- Read-heavy、write-rarely（週 1-3 次 vs 日 1000+ 次）
- `fs.watch` Linux inotify 有邊界 case（events 漏失、race condition）
- `revalidatePath()` 不管 Blob CDN
- VM cold restart 會造成 memory cache 空洞
- 多一份 fallback snapshot = 資料漂移

## 待做（Codex Phase 1）

- `scripts/seed-knowledge-blob.mjs`：上傳初版 v1
- `scripts/bump-knowledge-version.mjs`：原子切版
- `api/knowledge/update.js`：write endpoint
- `src/lib/knowledge-client.js`：read client
- Vercel env：`VITE_KNOWLEDGE_BLOB_BASE` + `BRIDGE_AUTH_TOKEN`

## infra-04 (Phase 2)

## 2026-04-16 後續

[`2026-04-16-vm-maximization-roadmap.md`](./2026-04-16-vm-maximization-roadmap.md) 推 VM 為主，但 Knowledge API 仍維持本決議：知識檔 read path 走 Blob，僅把其他更適合長任務與 runtime orchestration 的工作搬往 VM；Blob 是這裡明定的例外。

- 11 個 static import 改 `await getKnowledgeBase()`
- 保留本地 JSON 作 offline dev fallback（Mode A）

## 4 個待定問題

1. Dev mode 預設 A or B？Claude 建議 A
2. `VITE_KNOWLEDGE_BLOB_BASE` 放 env var 還是 source？Claude 建議 env var
3. auto-classifier 並發：短期 queue vs 等 SDK `ifMatch`？
4. 完全移除舊 import vs 保留做 offline fallback？
