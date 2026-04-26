# Motion 原則放寬 · 動畫只要易讀 + 觀賞 + 不沉悶

**日期**：2026-04-26
**參與者**：用戶（拍板）+ Claude（記錄）
**主題**：撤掉「不要做動畫炫技」禁令，改成 motion-aided readability 原則
**狀態**：✅ 決議完成 · 立即生效

---

## 決議

撤銷舊規則：

- ~~SD §1.10 「有感但不炫技」「不做大面積彈跳」「僅用於狀態確認、層級切換、抽屜開合」~~
- ~~audit §5「不要做」清單第 5 條「動畫炫技」~~

新原則：

> 動畫應有助於**易讀性**與**觀賞性** — 把使用者眼睛帶到該看的地方，把長停留的畫面變得不沉悶不呆板。

允許的動畫範例：

- 價格異動 row pulse（draw attention to changed data）
- 數字翻轉 / count-up animation
- Streaming AI 文字逐字出
- Chart bar grow-in
- Card hover lift / shadow expand
- Drawer / modal slide
- Skeleton shimmer
- Toast slide-in / fade
- 切 tab 短 fade transition
- Status badge 出現時 small bounce / scale-in

仍避免：

- 突兀大面積彈跳（造成 layout reflow）
- 會引發暈眩 / 視覺疲勞的高頻運動
- 跟內容無關的純炫耀（例如 hover 所有按鈕都 rainbow rotate）
- prefers-reduced-motion 必尊重（per SD §7.4）

---

## 為什麼推翻先前 decision

### 舊 decision

SD §1.10（2026-04-18）寫「有感但不炫技 / 不做大面積彈跳 / 僅用於狀態確認、層級切換、抽屜開合」

audit §5（2026-04-26）寫「不要做：動畫炫技」

兩個都是 conservative 立場 — 怕動畫變成 distraction。

### 為什麼現在改

實作 R6 派工 brief 時（2026-04-26），把 `holding-price-deviation-pulse` 列為 「動畫炫技」要拿掉 — 但這個 pulse 其實是真正幫用戶注意異動 row（行情大波動），是「易讀性 cue」不是炫耀。

用戶 review brief 時當場指出：「動畫炫技沒差，所以改掉 sa/sd 裡面的這個規則，只要動畫有助於易讀性跟觀賞性，不要讓使用者覺得沈悶呆板即可」

### 重新權衡

inspiration `inspiration-2026-04-17/06.jpg` (MONDAY todo) 雖然視覺極簡，但**完成 task 那刻 5km run 帶橘色 strikethrough animation** — 這就是「易讀性 + 觀賞性」motion。inspiration 02 SIMPLE MARKETING 那 4 卡轉場、04 SLEEP 數字翻轉，都不是「沒動畫」是「motion serves data」。

新原則更貼 inspiration 真實 DNA：**motion 是 communication，不是 decoration**。

---

## 連動修訂

- ✅ `docs/specs/2026-04-18-portfolio-dashboard-sd.md` §1.10 已加新原則 + 標 supersede 舊原則
- ✅ `docs/audits/2026-04-26-pm-ux-audit.md` §5 「不要做」第 5 條已 strikethrough + 引本決議
- ⚠ Codex R6 brief（task `bpxnhb58r` 在跑）的 §A.3「動畫炫技 1 處」instruction 過時 — Codex 若已執行 = R7 補回 pulse；若還沒到 = 寫 R7 brief 時更正
- ⚠ Designer audit §D-5 「`transition: all` 反 pattern」仍生效（不是動畫炫技問題，是 layout reflow 風險），保留

---

## 不變

- prefers-reduced-motion 必尊重
- transition 不用 `all`（要列明屬性，避免 reflow）
- Performance budget 60fps
- Skeleton/loading/transitional 動畫週期維持 SD §1.9 表格規格（hover 200ms / drawer 240-300ms / ease-out）

---

## 執行 ownership

- Claude：審查未來派工 brief 不再列「禁動畫」
- Codex：實作可加 motion，PR review 評估「是否 serve data / 易讀」
- Designer：個案評估，遇模糊跟 Claude 討論
