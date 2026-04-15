# CMoney Notes 作為 Target Price Phase 3 Fallback

**日期**：2026-04-16
**作者**：Codex
**狀態**：✅ 實作完成
**主題**：將 CMoney `notes/?tag=78570` 接進 target-price pipeline

## 結論

`CMoney /notes/?tag=78570` 進入 Phase 3，但定位明確：

1. **單券商文**：可抽 `firm + target + stance + date + source_url + evidence`
2. **多券商文**：只當 aggregate fallback，保留 `min / max / medianTarget / source_article_url`
3. **串接位置**：`Gemini grounding → RSS extract → CMoney notes → per-band`
4. **開關**：用 `USE_CMONEY_NOTES=1` 控制，先試跑不強制全開

## 實作範圍

- 新增 `api/cmoney-notes.js`
- `api/analyst-reports.js` 接 CMoney fallback
- 同 firm 多來源衝突時，**保留最新 date**
- response header `x-target-price-source` 維持 `gemini | rss | cmoney | per-band`

## 為什麼不是 primary source

- CMoney tag feed 很適合補小型股 coverage
- 但多券商文大多仍是 aggregate summary，不是完整逐家明細
- 所以它應該補在 RSS/Gemini 後面，而不是取代它們

## Aggregate 格式

當 article 只有區間摘要時，回：

```json
{
  "aggregate": {
    "firms": [],
    "medianTarget": 60.65,
    "min": 57.3,
    "max": 64,
    "date": "2026-04-15",
    "source_article_url": "https://www.cmoney.tw/notes/note-detail.aspx?nid=1168560"
  }
}
```

`medianTarget` 在目前 CMoney range-only 文中以 `(min + max) / 2` 推得，因原文未提供真正 median。

## 不做

- 不加 cron 排程
- 不改 Blob schema
- 不直接 deploy prod
