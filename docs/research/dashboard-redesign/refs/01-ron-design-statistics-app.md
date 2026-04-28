# Ref 01 · RON DESIGN — Statistics App (focus / sleep / mood tracker)

**主入口**：[`../INDEX.md`](../INDEX.md) ｜ **Ref 索引**：[`./README.md`](./README.md)

- **來源**：Instagram `https://www.instagram.com/p/DTasvbojGQ7/?img_index=5`（用戶 2026-04-27 提出）
- **作者浮水印**：RON DESIGN（IG `@ron_design` 推測）
- **取得日期**：2026-04-27
- **由誰提出**：用戶
- **檔案**：6 張 binary 已落檔在 [`./01-ron-design-statistics-app/`](./01-ron-design-statistics-app/)
  - `slide-1.png` ~ `slide-3.png`：第一組 PNG（手機畫面 / 浮動 widget / 局部放大，2026-04-26 ~ 04-27 提供）
  - `slide-4.jpg` ~ `slide-5.jpg`：第一組 JPG（手持手機 / 倚石頭構圖）
  - `slide-6.png`：clean 版 Progress chart card（2026-04-27 提供，無背景照片，純 widget）
  - IG carousel 指示器顯示共 7 張，目前缺第 7 張

> ✅ Binary 由 Claude 從 Claude Code session JSONL 解 base64 落檔。
> 後續再從聊天提取圖檔：`python3 scripts/extract-chat-images.py <dest-folder> [--last N] [--prefix slide]`

## 為什麼存這份

用戶 2026-04-27 觀察：

> 「我們現在的網頁太長，資訊量太多很難聚焦。」

這個 ref 是**反向參考**：示範「如何用單頁 + 大留白 + 單一 hero metric 做到瞬間聚焦」。

## 視覺 / 互動觀察

### 配色

- **底**：純白偏暖灰（`#F4F2EE` ish），背景照片帶輕微 grain
- **主字**：純黑 / 深灰，無多色
- **唯一 accent**：飽和黃（`#F5D544` ish），只用在「當前焦點 metric」一處（33 +103%）
- **無 secondary color**，無 success/warning/danger 色階

### 字型

- **主 UI 字**：geometric sans（看起來像 Neue Haas Grotesk / Söhne 系），lowercase optical 大量留白
- **數字**：dot-matrix / pixel 顯示風（仿復古 LED），單純為了「這個數字最重要」的視覺鏢點 — 實際 production 不一定要 dot-matrix，重點是 **hero number 用獨立字型 family** 跟 UI 區隔
- **層次**：標題 / dates / 軸標籤都是同一灰階低對比，僅 hero number 用最高對比 + accent 黃 highlight

### 主互動模式 — 單一 metric Spotlight

每張 slide 都同一個畫面：

- 主 chart = `Progress` 折線圖
- X 軸：Jun / Sep / Dec（月）
- Y 軸：12 / 20 / 40（focus 數值）
- 4 tab：`Total / Focus / Sleep / Mood`，當前選 `Focus`（粗體 + 下方 dot）
- **唯一 hero**：曲線右端有個 spotlight cursor，「33 +103%」用 dot-matrix + 黃色光錐打出來

整個 UI 只**強迫使用者看一個東西**：「2025 年 12 月 Focus = 33，比基期 +103%」。其他資訊（軸、過去月份、次要曲線）全降到背景灰。

### 資料密度

**極低**。整頁只有 1 個主指標 + 1 個對照（次要灰曲線）+ 4 個 tab 切換器。**沒有 KPI grid、沒有列表、沒有多 card**。

跟我們現在持倉看板對比：我們一頁有 9 tab × 多 KPI × event tracker × watchlist × portfolio cards，密度高 10-20 倍。

### 動效角色（推測，從靜態截圖判斷）

- Slide 1：完整 widget 浮在 user 側臉前（VR/AR 即視感）
- Slide 2：放大 hero number 局部（spotlight 焦點）
- Slide 3-5：手持手機 → 不同角度 → 倚石頭（產品物理化）

整組 carousel 是「**一個畫面、多角度展示同一焦點**」。動效推測：cursor 沿曲線滑到當前點，光錐展開，數字 dot-matrix 滾動到 33。**動效服務於焦點，不是裝飾**。

### Tab Bar / Navigation

底部圓角 pill bar，5 顆按鈕（home / chart / progress(active, 黑底白圖) / calendar / 額外）。**選中態用 dark fill + 黑底色塊**，跟現在持倉看板的多 segment 切換有相通處（但持倉看板的切換器在頂部，且密度高）。

## 可借鑒到本專案的點

1. **單頁單焦點原則** — 每個 route page 找到 1 個「最該被看到的數字」當 hero，其他資訊降階
   - 持倉看板 candidates：`今日損益 / 報酬率 / 最該關注的個股 alert`
2. **顏色紀律** — 全站僅 1-2 個 accent，不要 success/warning/info 全用色階堆
3. **Hero 數字獨立字型 family** — 不是非要 dot-matrix，但 hero metric 跟 UI 字區隔能瞬間導引視線
4. **次要資訊降到淺灰** — 不要全部「等大」，現在持倉看板很多 card / chart 都同階
5. **Carousel = 同焦點多角度**（不是不同資訊）— 用戶滑切的應該是「同一指標的不同切面」（時間維度 / 對照組）而非「不同指標」

## 不適用本專案的點

1. **dot-matrix 字型** — 跟「投資網紅軟語氣」不搭（per `project_soft_language_style`），數字應該是 elegant serif/sans，不是 retro pixel
2. **資料密度過低** — 投資人需要至少 KPI grid + 個股 list，不能像 wellness app 一頁一指標。應**降階不刪除**：保留資料量，但靠視覺層次讓「當下最重要的那條」自動冒出來
3. **VR 頭盔意象** — 純行銷照，不影響產品
4. **Wellness app 主題** — focus/sleep/mood 跟金融完全異質，互動 metaphor（spotlight、光錐）能借，內容架構不能借

## 給 Codex 的提問（待 Round 1 討論）

1. 持倉看板每個 route page 的「當下最該看的 1 個數字」分別是什麼？（要回去 grep 既有 SA/SD 給答案，不能憑感覺）
2. 「降階不刪除」能用哪些既有 design token / Tailwind class 直接做？還是要新增 `text-muted-3` / `bg-spotlight` 之類？
3. 我們 9 tab 結構要不要因此重新檢討（少即是多）？還是只動每 tab 內部的視覺層次？— 注意 9 tab 已經是 2026-04-18 SA 拍板，動結構要寫推翻 decision
