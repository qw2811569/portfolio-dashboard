# Dashboard Redesign · 抓取工具（Scrapers / Tools）

**主入口**：[`./INDEX.md`](./INDEX.md)

本研究蒐集 ref 過程中為了避開 WAF / 解 JS-rendered 內容寫的可重用工具，**每個工具都可獨立呼叫**，給 Codex / 自動化流程後續用。

> ⚠️ 用前確認：`node_modules/playwright` 已安裝（`ls node_modules/playwright`）+ chromium binary 在 `~/Library/Caches/ms-playwright/chromium-*`。

---

## 工具一覽

| 工具                                                                                  | 用途                                                                                                                  | 輸出                                                                         |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`scripts/fetch-dribbble-shot.mjs`](../../../scripts/fetch-dribbble-shot.mjs)         | Render Dribbble shot 過 WAF challenge，抓 page.html + page-text.md + 縮圖                                             | `<dest>/page.html` + `page-text.md` + `img-NN.<ext>`                         |
| [`scripts/parse-dribbble-shotdata.mjs`](../../../scripts/parse-dribbble-shotdata.mjs) | 從 page.html 解嵌入 JSON `shotData` 取**原圖（3200×2400）+ 結構化案例文**                                             | 改寫 `page-text.md` + 下載 `img-NN-original.<ext>` / `video-NN-original.mp4` |
| [`scripts/fetch-dribbble-profile.mjs`](../../../scripts/fetch-dribbble-profile.mjs)   | 抓 Dribbble studio profile（如 RonDesignLab）所有 shot 列表 + 縮圖 catalog                                            | `<dest>/profile-shots.md` + `top-urls.txt`                                   |
| [`scripts/fetch-muzli-listicle.mjs`](../../../scripts/fetch-muzli-listicle.mjs)       | Render muz.li 編輯 listicle，scroll lazy-load + 抓全部 entry 圖 + 文字                                                | `<dest>/page.html` + `page-text.md` + `img-NN.<ext>`                         |
| [`scripts/fetch-behance-gallery.mjs`](../../../scripts/fetch-behance-gallery.mjs)     | Render Behance gallery，抓 module 圖（去掉 avatar / icon 噪訊靠人工）                                                 | `<dest>/page.html` + `page-text.md` + `img-NN.<ext>`                         |
| [`scripts/fetch-listing-page.mjs`](../../../scripts/fetch-listing-page.mjs)           | 通用公開 listing 抓取（Awwwards / Codrops / Land-book / Refero / SiteInspire / SaaSframe / SaaSpages / Landingfolio） | `<dest>/page.html` + `page-text.md` + `img-NN.<ext>`                         |
| [`scripts/extract-chat-images.py`](../../../scripts/extract-chat-images.py)           | 從 Claude Code session JSONL 把貼上的 base64 inline 圖檔解碼到本地                                                    | `<dest>/<prefix>-NN.<ext>`                                                   |

---

## 用法範例

### A. Dribbble shot 完整抓取（兩階段）

```bash
# 1. 用 Playwright 過 WAF + 取縮圖（page.html 同時落檔）
node scripts/fetch-dribbble-shot.mjs \
  "https://dribbble.com/shots/27231820-StreamLogic-Industrial-Dashboard-Smart-Pump-Monitoring-UI" \
  "docs/research/dashboard-redesign/refs/07-dribbble-streamlogic"

# 2. 從步驟 1 的 page.html 解 shotData JSON 取原圖 + 結構化案例文
node scripts/parse-dribbble-shotdata.mjs \
  "docs/research/dashboard-redesign/refs/07-dribbble-streamlogic"

# 補充：只重寫 page-text.md（不重抓圖）
node scripts/parse-dribbble-shotdata.mjs \
  "docs/research/dashboard-redesign/refs/07-dribbble-streamlogic" \
  --skip-download
```

**為什麼分兩階段**：fetch 階段過 WAF 比較花時間，parse 階段純解 JSON 很快。可獨立 re-run parse 來修 markdown 格式。

### B. Muz.li 編輯整理 listicle

```bash
node scripts/fetch-muzli-listicle.mjs \
  "https://muz.li/blog/dashboard-design-inspirations-in-2024/" \
  "docs/research/dashboard-redesign/refs/15-muzli-dashboard-2024"
```

抓到後**手工**寫 `summary.md` 把 entries 結構化（per Ref 15 範例）。

### C. Behance gallery

```bash
node scripts/fetch-behance-gallery.mjs \
  "https://www.behance.net/gallery/237850033/Startify-SaaS-Analytics-Platform-UX-UI-Design" \
  "docs/research/dashboard-redesign/refs/16-behance-startify-saas"
```

**注意**：Behance gallery 抓回會夾帶 avatar / 工具 icon / related-project thumb 噪訊（~30 張）。**人工清掉小檔再 renumber**：

```bash
# 範例：清噪訊 + renumber 09-30 為 01-22
cd docs/research/dashboard-redesign/refs/16-behance-startify-saas
for i in 01 02 03 04 05 06 07 08 31 32 33 ... 57; do rm -f "img-$i.png" "img-$i.jpg"; done
for i in 09 10 11 ... 30; do
  new=$(printf "%02d" $((10#$i - 8)))
  [ -f "img-$i.png" ] && mv "img-$i.png" "img-$new.png"
done
```

### D. 從聊天提取貼上的圖片

```bash
python3 scripts/extract-chat-images.py \
  "docs/research/dashboard-redesign/refs/01-ron-design-statistics-app" \
  --last 5 \
  --prefix slide
```

完整說明見 memory：`feedback_extract_chat_pasted_images.md`

---

## Source URL 永遠保留

每個 ref 子資料夾的 `page-text.md`（不論 Dribbble / muz.li / Behance）都把**來源 URL** 寫在頂部 `Source URL` 欄位。

要批次撈所有來源：

```bash
grep -h "Source URL" docs/research/dashboard-redesign/refs/**/page-text.md
```

---

## 為什麼留這份文件

- **避免 Codex / 後續 LLM 重新發明輪子**：用過的抓取邏輯（過 Dribbble WAF / 解嵌入 JSON / muz.li lazy-scroll / Behance module 篩選）已經痛過，文件化讓下次直接套用。
- **避免孤兒 script**：scripts/ 目錄沒有 README，不寫這份的話 5 支 .mjs/.py 沒人知道是什麼用途，會被當成死檔刪掉。
- **避免重複爬**：同一 URL 重新爬會產生相同檔案；本文件附 `--skip-download` 等避免帶寬浪費的 flag 用法。

---

## 變更紀錄

| 日期       | 變更                                                                                 | by     |
| ---------- | ------------------------------------------------------------------------------------ | ------ |
| 2026-04-28 | 開檔 · 列 5 個工具（dribbble fetch + parse / muzli / behance / extract-chat-images） | Claude |
