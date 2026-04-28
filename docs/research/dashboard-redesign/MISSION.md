# Dashboard Redesign · MISSION（Claude + Codex 兩 LLM 都必讀）

**主入口**：[`./INDEX.md`](./INDEX.md)
**開立**：2026-04-28
**狀態**：🟢 active — Round 1+ 蒐集 + 多 LLM 互相辯證中

---

## 用戶（小奎）的核心訴求（原文 · 不要 paraphrase）

> 我希望這個專案的互動，在資訊給到充足的情況，不會讓使用者資訊焦慮，要讓他們一打開馬上知道他的持倉狀況，然後使用者根本不知道自己要看什麼才了解怎麼操作股票，否則他們根本不會想使用這個，我們面對是一般散戶，不是高手。所以我們要給資訊充足，但同時避免失焦，所以要「**漸進式披露**」，這很重要！還有我一直強調的**美感**，因為台灣的網站都是以實用為主，從來不知道美感的重要性，他們不知道美感才能使使用者停留與多使用。國外很注重這一塊，我們太缺少網頁的動畫跟互動了。
>
> ——用戶 2026-04-28（Auto Mode 啟動 · 至少 20 輪研究）

---

## 五個必須同時成立的 design principle（**任何一輪 round 結論都要回扣這五條**）

### 1. 一打開馬上知道持倉狀況（Zero-Click Awareness）

- 進入任一 route page 第 1 秒，user 必須知道**「整體部位健康嗎 / 今天賺賠多少 / 有沒有需要立刻處理的事」**。
- 不能逼 user 找 menu / 切 tab / 滑頁面才看得到主要資訊。
- 對應 ref 證據：Ref 16 Startify 6-KPI 一字排（綠/黃/灰 分群）· Ref 13 Ronas 投組 Total balance hero · Ref 02 Vorxs hero number 字級巨大。

### 2. 資訊充足但漸進式披露（Progressive Disclosure ⭐️ 用戶最強調）

- 第一層：**3-5 個關鍵指標 + 1-2 個 alert**。其餘**全部默認收起**。
- 第二層：點 / hover / 展開 accordion 才出細節。
- 第三層：點細節後再進 detail page / drawer 看完整資料。
- **不能等大平鋪**（per Refs 02-06 觀察 — 我們現在就是平鋪所以難聚焦）。
- 對應 ref 證據：Ref 06 Klar accordion `..` 收合 · Ref 16 Startify Recommended sub-table 並排 · Ref 02 Vorxs card-stacked spotlight。

### 3. 散戶教學語境（Beginner-Friendly Guidance）

- User 「不知道自己要看什麼」是 default 狀態。設計要**主動引導**：
  - 視覺指向（光錐 / spotlight cursor / yellow highlight）— 像 Ref 01 Ron Design statistics app 的「箭頭指焦點」。
  - 文字 nudge：軟語氣（per `project_soft_language_style`）—「市場主力剛進場 · 無空軍壓力」式描繪而非命令。
  - 「該看什麼」的元 metadata：Ref 16 Startify 右上 Pill-Tag 標明「這是 SaaS Dashboard」可借鑒當「這是你的持倉概覽 / 這是個股深入頁」。
- **不能假設 user 認得 K 線、籌碼、MACD**。要陪走第一步。

### 4. 美感是留人的核心（Aesthetic = Retention）

- 用戶觀察：「**台灣的網站都是以實用為主，從來不知道美感的重要性**」。國外（Ref 02-06 financeux + Ref 16 Behance Startify）都靠美感停留。
- 評估標準：
  - 字型 hierarchy 陡（hero number ≥ 第二級 4 倍以上 — per Ref 02-04 紀律）
  - color discipline 嚴（≤ 3 個 accent — per Ref 05 Quicked cyan 1 色 / Ref 02 Vorxs coral+yellow / Ref 16 Startify 黃綠灰 3 色）
  - 留白足、不擠
  - 大量 hero number / display-typography moments
  - 至少 1 個「微互動」每頁（hover / cursor / scroll trigger）

### 5. 動畫與互動是台灣最缺的（Motion as Default, Not Decoration）

- 用戶觀察：「**我們太缺少網頁的動畫跟互動了**」。
- 已有 decision [`2026-04-26-motion-relax`](../../decisions/2026-04-26-motion-relax.md) 撤銷動畫禁令。
- 動效角色（per 各 ref 推測）：
  - hero number 從 0 滾到目標值
  - cursor 沿曲線滑進 spotlight 點
  - accordion 展開 height auto fade
  - tile selection 整塊變色 transition
  - chart 切時段 smooth morph
- **每個動效都要服務易讀性 / 漸進式披露**，不是裝飾。
- 仍尊重 `prefers-reduced-motion`。

---

## 研究目標

把這五條原則 × 已蒐集的 16 份 ref + Round 1+ 的新 ref → **產出一份 web 版 + 一份 mobile 版的互動介面 spec**。

至少 20 輪 multi-LLM round（Claude + Codex 互相辯證 + 補 ref + 收斂結論）。

---

## 給每個 round 的自檢題（**寫結論前必答**）

每輪在 [`rounds/discussion.md`](./rounds/discussion.md) append round 時，**回扣這五條**：

1. 這輪發現的 pattern 能在第 1 秒服務 Zero-Click Awareness 嗎？
2. 這個 pattern 是「漸進式披露」還是「等大平鋪」？
3. 對散戶（不是高手）來說好懂嗎？要哪些教學引導？
4. 這個 pattern 跟「停留 / 美感」有什麼關係？只實用沒美感的不收。
5. 這個 pattern 用什麼動效會更好？無動效是減分（不是預設可接受）。

**所有結論必引 ref 編號 + 圖檔路徑當證據**，不能 paraphrase。

---

## 變更紀錄

| 日期       | 變更                          | by     |
| ---------- | ----------------------------- | ------ |
| 2026-04-28 | 開檔 · 五條原則 · 20 輪計畫起 | Claude |
