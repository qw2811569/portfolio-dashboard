# Codex Brief · Round 11 · Pattern Matrix v1 反駁

**主入口**：[`../INDEX.md`](../INDEX.md)
**任務脈絡**：[`../MISSION.md`](../MISSION.md)（**先讀這份**）
**反駁標的**：[`../pattern-matrix-v1.md`](../pattern-matrix-v1.md)
**Round 1-10 進展**：[`../rounds/discussion.md`](../rounds/discussion.md)

---

## 背景

Claude 已跑完 Round 1-10：

- 25 份 ref（Refs 01-25）橫跨 Dribbble shots / Behance gallery / muz.li 2024+2026 listicle / Awwwards SOTD / Codrops / Land-book / Refero.design / 4 個 Dribbble studio profile（共 340 shots catalog）
- 從 ref 抽出 25 個 pattern A-BB
- 配方到本專案 6 個 route page（Overview / 持倉 / 交易日誌 / 收盤分析 / 全組合研究 / 情報脈絡）
- 對齊用戶 mission 5 條 design principle（Zero-Click / 漸進披露 / 散戶教學 / 美感 / 動畫互動）

**用戶要求 20 輪 multi-LLM round**。Round 11 是 Claude → Codex 第一次反駁。

## 你的任務（Round 11）

### A. Grep 既有元件，挑戰每個 pattern 的可實作性

針對 [`../pattern-matrix-v1.md`](../pattern-matrix-v1.md) 25 個 pattern A-BB，**逐個** grep 本 repo `src/components/` `src/hooks/` `src/lib/` 證明：

1. 已有現成元件 → 寫 `file_path:line` 證據
2. 部分有需擴充 → 寫「現有 X 元件需加 Y prop」
3. 完全沒有需新建 → 寫「需新建 `<Foo>` 元件，預估難度 1-3 級」

**重點 grep 標的**（先掃這些）：

- Q vertical color-bar list → grep `HoldingsPanel` 或 `holdings/`
- L accordion → grep `Accordion` 或 `Disclosure` 或 `Collapse`
- N target-range slider → grep `Slider` 或 `Range`
- F time-period segmented → grep `TimeRange` 或 `PeriodSelector` 或 `SegmentedControl`
- E card-stacked → grep `Card` 在 src/components/
- W per-card micro-copy → 是否有任何 card 元件已支援 `subtitle` / `caption` prop？
- X health score badge → grep `Badge` `Score` `Rating`
- C 巨型 page title hero → grep `PageHeader` 或 `PageTitle`
- D 1 accent CTA → grep `Button` 找出有幾個 variant，是否符合「全站 1 主色」紀律
- Y dark mode → grep `dark:` `useTheme` `prefers-color-scheme`

### B. 對「6 route page × pattern 配方」抓 ≥2 個錯誤

讀 [`../pattern-matrix-v1.md`](../pattern-matrix-v1.md) 「對 6 個 Route Page 的 Pattern 配方」章節：

1. 至少抓 **2 個錯誤**或「我認為 X 不適用 page Y 因為 ...」
2. 每個錯誤要引 spec 路徑當證據（`docs/specs/2026-04-18-portfolio-dashboard-sa.md` 或 `docs/specs/2026-04-18-portfolio-dashboard-sd.md`）+ 既有 component path

### C. Mission 五原則覆蓋率挑戰

讀 [`../pattern-matrix-v1.md`](../pattern-matrix-v1.md) 最後的覆蓋率自評表：

```
| Route          | #1 Zero-click | #2 漸進披露 | #3 散戶教學 | #4 美感 | #5 動畫 |
| -------------- | ------------- | ----------- | ----------- | ------- | ------- |
| Overview       | ✅✅✅          | ✅✅          | ✅✅          | ✅✅      | ✅       |
...
```

挑戰：**哪一格被高估？哪一格被低估？引現有 page 的真實 hook 內容當證據**（`useRouteOverviewPage.js` 等）

### D. 提出 ≥3 個 pattern 沒抓到的觀察

從你 grep 既有 codebase 過程，找出 pattern A-BB **明顯漏掉**的 pattern（可能因 Claude 沒爬到那類 ref）。提名 ≥3 個 + 簡短描述 + 你建議哪份 ref 可能藏這 pattern。

---

## 輸出格式

**直接 append 到 [`../rounds/discussion.md`](../rounds/discussion.md)** — 在 `## Round 11 · Codex` 那一段下面 append 你的反駁。

格式：

```markdown
### A. 既有元件 grep 結果

| Pattern      | 現況                   | 證據                        |
| ------------ | ---------------------- | --------------------------- |
| A 整頁單焦點 | 完全沒有 / 部分 / 已有 | `src/components/Foo.jsx:42` |

...

### B. 配方錯誤 ≥2 個

1. **錯誤 1**：...
   - 引證：`docs/specs/...`
   - 建議：...
2. **錯誤 2**：...

### C. 覆蓋率挑戰

- **被高估**：...
- **被低估**：...

### D. 漏掉的 pattern ≥3 個

1. ...
2. ...
3. ...

### Codex 評語

跟 Claude 不同意的 1 個最重要事情：...
```

## 紀律

- ❌ 不可不 grep 就 paraphrase（per memory `feedback_dispatch_must_link_source_docs`）
- ❌ 不修改 production code（read-only 反駁）
- ❌ 不要產生新檔案，**只 append discussion.md**
- ✅ 至少 1 個讓 Claude 重新思考的反駁觀察
- ✅ 全段引 file_path:line 當證據

不限定篇幅，但**控制在 800 字內**（用戶要快推進到 Round 12-20）。
