# 知識庫自主演化設計方案

最後更新：2026-03-31
狀態：設計提案，待 Codex 審查後實作
作者：Claude（知識庫架構師）

---

## 現況

知識庫 600 條已完成，品質測試 25/25 全過，已串接到 `dossierUtils.js → api/analyze.js`。
但知識庫是**靜態**的——沒有回饋迴圈、沒有自動失效、沒有從交易記錄學習。

## 問題

1. **沒有 usage tracking**：不知道哪些知識被用了、用了有沒有幫助
2. **confidence 是人工標的**：不會根據實際效果調整
3. **strategy-cases 沒有 confidence**：120 個案例無法被品質排序
4. **沒有自動失效機制**：市場環境變了，舊知識可能誤導
5. **排序只看 confidence**：沒有考慮策略相關性權重

## 設計：三層演化機制

### Layer 1：Usage Tracking（最低成本，最高價值）

在 `buildKnowledgeContext()` 被呼叫時，記錄哪些 entry 被選中。

```javascript
// knowledgeBase.js — buildKnowledgeContext 內
// Side-effect: 記錄 usage（不阻塞主流程）
function trackUsage(items) {
  try {
    const log = JSON.parse(localStorage.getItem('kb-usage-log') || '[]')
    const entry = {
      timestamp: Date.now(),
      itemIds: items.map((i) => i.id),
      strategy: items[0]?._strategy || 'unknown',
    }
    log.push(entry)
    // 只保留最近 500 條
    if (log.length > 500) log.splice(0, log.length - 500)
    localStorage.setItem('kb-usage-log', JSON.stringify(log))
  } catch {
    /* silent */
  }
}
```

**成本**：5 行程式碼
**價值**：知道哪些知識真的被用到，哪些從未被用

### Layer 2：Feedback Signal（需要 UI 配合）

在 daily analysis 結果旁邊加一個 👍/👎 按鈕。
用戶標記「這次分析有幫助」時，把當次注入的知識 IDs 記錄為 `helpful`。

```javascript
// 儲存格式
{
  analysisId: "2026-03-31-2308",
  signal: "helpful", // or "misleading"
  injectedKnowledgeIds: ["fa-001", "it-051", "rm-010"],
  timestamp: 1774958000000
}
```

**成本**：1 個按鈕 + localStorage 記錄
**價值**：有了 signal 就能自動調整 confidence

### Layer 3：Confidence Auto-Adjust（自動演化核心）

每季（或每 50 次 feedback）跑一次 confidence 校正：

```
for each entry:
  helpfulCount = feedback where signal='helpful' and entry.id in injectedIds
  misleadingCount = feedback where signal='misleading' and entry.id in injectedIds
  totalUsage = usageLog where entry.id in itemIds

  if totalUsage == 0:
    // 從未被用過，降低 confidence（可能不相關）
    entry.confidence = max(0.50, entry.confidence - 0.05)

  if misleadingCount >= 2 and misleadingCount > helpfulCount:
    // 被標記為誤導多於有幫助
    entry.confidence = max(0.40, entry.confidence - 0.10)
    entry.status = 'pending-review'

  if helpfulCount >= 3 and helpfulCount > misleadingCount * 2:
    // 持續有幫助
    entry.confidence = min(0.95, entry.confidence + 0.05)
```

**成本**：1 個定期腳本
**價值**：知識庫 confidence 從「人工猜測」變成「數據驅動」

## 與 Codex 的 brain proposal 整合

Codex 已完成 `api/research.js` 的 candidate brain proposal。
知識庫演化應該**接在 brain proposal 流程裡**，而不是獨立運作：

```
research evolve
  ├── 產生 candidate brain proposal（Codex 已做）
  ├── 產生 candidate knowledge updates（新增）
  │   ├── proposed_entries: 從研究結果萃取的新知識
  │   ├── entries_to_deprecate: 與研究結果矛盾的舊知識
  │   └── confidence_adjustments: 基於 feedback 的信心度調整
  └── gate / eval
      ├── brain proposal 過 gate → merge brain
      └── knowledge updates 過 gate → merge entries
```

## 實作優先序

| 步驟                             | 誰做              | 複雜度 | 價值                |
| -------------------------------- | ----------------- | ------ | ------------------- |
| 1. Usage tracking (localStorage) | Qwen              | 低     | 高 — 知道哪些被用   |
| 2. Feedback button (👍/👎)       | Qwen              | 中     | 高 — 有了 signal    |
| 3. Confidence auto-adjust script | Codex             | 中     | 高 — 自動演化核心   |
| 4. 接入 research evolve proposal | Codex             | 高     | 最高 — 完整閉環     |
| 5. 自動產生新 entry 從研究結果   | Codex + Claude 驗 | 高     | 中 — 知識庫自我擴充 |

## 已知風險

- confidence 自動調整可能造成「流行偏誤」——被用最多的不一定最好
- 需要足夠的 feedback 數量才有統計意義（至少 50 筆）
- 自動產生 entry 需要嚴格 gate，否則品質會退化

## 壓測發現的其他問題（已修/待修）

| 問題                            | 狀態      | 說明                                                                                                                        |
| ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| rm 擠掉策略知識名額             | ✅ 已修   | 改成 slot-based 分配（策略 4 + rm 1）                                                                                       |
| 事件驅動回傳 fa 而非 nc         | ⚠️ 已知   | nc confidence 普遍 0.65-0.75，被 fa 0.85 擠掉。解法：按 source 順序輪流選取（round-robin），或提升 nc 高品質條目 confidence |
| strategy-cases 無 confidence    | ⚠️ 待補   | Qwen 可批量補上（成功案例 0.75、失敗案例 0.70 為預設）                                                                      |
| 1 個重複 title、3 個重複 action | ⚠️ 小問題 | Qwen 可清理                                                                                                                 |
