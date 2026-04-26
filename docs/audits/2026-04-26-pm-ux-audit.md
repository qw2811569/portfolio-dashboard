# 2026-04-26 · PM + UX + Designer Audit

**Lens**：產品經理 + UX + 視覺設計
**Target**：`http://104.199.144.170/` 新 VM（R148-R151 修法已 ship）
**參與**：Claude（5 輪 PM）+ Codex（5 輪 PM）+ Claude / Codex 接續 5 輪 Designer
**狀態**：🟡 部分修中

## 結構

- §1 PM lens（已完成 · 5 + 5 輪 · 43 觀察 · Top 10 + 次要）
- §2 Designer lens（待補 · 5 + 5 輪 · 視覺 / typography / 色彩 / motion）
- §3 整合修法分批

---

## §1 PM lens（10 輪 · Claude + Codex）

### Top 10 立即提升用戶感受（依 PM impact 排序）

#### 1. 第一次打開像「闖進別人工作台」（HIGH）

新用戶 localStorage 清空後 · 直接落入「小奎主要投資 20檔 +16.4%」成熟 dashboard · 沒 onboarding。8 個 tab 各自叫「上傳成交」「新增觀察股」「前往收盤分析」 · 沒共用 next step。

**修法**：第一次打開先做 3 步（建組合 → 加持倉 → 看分析）· 老手介面延後到「有資料」之後。8 個 tab 共用同一條 onboarding progress rail。

**Severity**：HIGH · **工時**：6-8h · **負責**：未指派

---

#### 2. 5 焦慮卡有 3 張永遠寫「待補 · 上線時才有」（HIGH）

X1 對比大盤 / X2 thesis pillar / X3 法人五日 都未上線 · 每天打開看到 60% 卡待補 · 信任打折。

**修法**：未上線的卡 collapse 成 1 行 · 不要全展開占主視覺。「上線時才有」也可考慮整張卡先不顯。

**Severity**：HIGH · **工時**：1.5h

---

#### 3. 失敗時的話太 dev 口氣（HIGH）

「pre-open」「T1」「資料補齊中」「上線時才有」「待補」散戶聽不懂。沒「下次什麼時候會好」期待管理。

**修法**：改日常話 + ETA。例「明早 06:00 自動補齊」「下次開盤後會有早盤摘要」。

**Severity**：HIGH · **工時**：2h（grep 替換 + reviewer 確認）

---

#### 4. Mobile fold 1 看不到價值（HIGH）

手機 header 占 25% 螢幕（103-153px）· 第一眼只看到 header + headline + 損益 · KPI / pie / 焦慮卡都要滾動。散戶 80% 用 mobile · 第一眼沒 value 就走人。

**修法**：mobile headline 縮 24→18 · 損益 chip 提上 hero · KPI 一行 4 格塞 fold 1。

**Severity**：HIGH · **工時**：3h

---

#### 5. 沒一句話講清楚「這 app 是什麼」（HIGH）

差異化是「持倉論述追蹤 + 多組合對比 + AI 收盤分析」· 但首頁 / footer / 空殼都沒這句話。新用戶下載完不知道為什麼用我們不用 Yahoo Finance。

**修法**：hero / empty state 加 tagline「把成交、持倉、事件、memo 整成每天可行動的投資清單」。

**Severity**：HIGH · **工時**：1h（copy）

---

#### 6. 7865 insider 合規邊界破洞（HIGH）

- 切到 7865 後 · header 沒 persistent compliance ribbon
- 收盤分析合規 OK · 但**事件追蹤仍漏「預測看漲」「停損」「出場」action cue**
- 上傳成交 / 交易日誌沒 insider 文案
- Persona 視覺只換內容沒換氣氛

**修法**：insider mode 做成跨 tab contract · 不只 Daily 生效。Header 加 mode ribbon。事件追蹤 / 上傳成交 / 交易日誌 都加 insider guardrail。

**Severity**：HIGH · **工時**：4-6h

---

#### 7. 重度用戶 60+ 筆紀錄管不了（HIGH）

- 60 筆 trade log：沒 search / filter / 月份分組
- 35 檔 watchlist：純 35 個編輯/刪除排下去 · 沒 sort / group
- 90 天 daily history：只看到最新一天 · 沒 timeline / calendar

**修法**：3 處都補 search + filter + sort。daily history 必補 calendar / 7 天切換器。

**Severity**：HIGH · **工時**：6-8h

---

#### 8. 多 tab 像 3 個平行宇宙（HIGH）

R148 #11 修了 watchlist multi-tab sync · 但 activePortfolio / analysis status / dailyReport 還沒 cross-tab。Tab A 切 7865 · Tab B 仍在 me。

**修法**：BroadcastChannel 擴到 activePortfolio + analysis 狀態。

**Severity**：HIGH · **工時**：2-3h

---

#### 9. 第一螢幕 8-9 個資訊卡爭舞台（MEDIUM）

hero / Buffett quote / Restore Snapshot / Morning Note / Today in Markets / 5 焦慮卡 / 持倉 ring 全用同一套米色 + 圓角。F-pattern 掃時主 CTA「展開看看」「去 Holdings 看論點」全埋在卡底（漏掉）。

**修法**：分 3 層（主決策 / 今日補充 / 偶發支援）· Buffett quote / 空 Morning Note / Restore Snapshot 改 only-when-useful · 主 CTA 提到卡上半區。

**Severity**：MEDIUM · **工時**：4h

---

#### 10. 競品 baseline 三件缺（MEDIUM）

| 缺                                  | 影響                          |
| ----------------------------------- | ----------------------------- |
| 沒 push alert（買入/到價/事件當天） | 用戶要每天主動開 app · 留存差 |
| 沒 onboarding tour                  | 新用戶不知道功能價值          |
| 沒 dark mode                        | 戶外刷慘 · 晚上看刺眼         |

**修法**：先做 web push（PWA service worker）· 4 步 onboarding tour · theme toggle。

**Severity**：MEDIUM · **工時**：8-12h（push alert 最重）

---

### 次要痛點 11-20（可後續批次）

11. 「未同步」紅旗第一眼焦慮 · 改中性「本機備份就緒」
12. KPI「需要補充 0 / 追蹤中 3」label 不懂 unit · tooltip + 改名
13. Portfolio switch 2.4s 慢 · optimistic UI（先換 header label · lazy 內容）
14. 持倉 detail pane 手機半全屏 hybrid · 二選一（route page or 真 sheet）
15. Trade form 同頁塞 3 組任務太重 · wizard
16. 「軟語」vs「硬數字」搶戲 · 決定首屏主導語氣
17. 第一螢幕沒「AI 生成 · 僅供參考」disclaimer · 心法卡 / 焦慮卡角落小字
18. 「全組合」是陷阱分頁（切了切不回來）· 移到 portfolio switcher 內
19. 空狀態看到歷史事件 / 市場新聞像借來的 · 標 sample / 視覺區隔
20. 沒 CSV 匯出 / help link · backlog

### 修法批次建議

| 批次                          | 工時 | 內容                                                                |
| ----------------------------- | ---- | ------------------------------------------------------------------- |
| **A · 速成 copy 拆彈**        | 4h   | #2 焦慮卡 collapse + #3 失敗 copy + #5 tagline + #11 未同步改 copy  |
| **B · Onboarding 體驗**       | 8h   | #1 第一次打開 3 步 + #19 空狀態切 sample · 跟 designer 5 輪結果結合 |
| **C · Mobile 重整**           | 6h   | #4 mobile fold 1 + #14 detail pane + #18 全組合移走                 |
| **D · 7865 insider 補齊**     | 6h   | #6 跨 tab contract + 事件追蹤 / 上傳成交 / 交易日誌 guardrail       |
| **E · 重度用戶資料管理**      | 8h   | #7 trade log / watchlist / daily history search + filter            |
| **F · 多 tab sync 補完**      | 3h   | #8 BroadcastChannel 擴                                              |
| **G · 競品 baseline**         | 12h  | #10 push + onboarding tour + dark mode                              |
| **H · 視覺分層 + CTA polish** | 4h   | #9 + #16 視覺三層 + 主 CTA 上半區                                   |

**A + B + C + D = 24h** · 基礎完整度跳升一級。
**E + F + G + H = 27h** · 重度用戶 + 競品 baseline 補齊。

---

## §2 Designer lens（10 輪 · Claude + Codex · 完成 2026-04-26）

Claude 5 輪測：Typography / Color / Components / Layout / Motion
Codex 5 輪測：Mobile responsive / 三狀態視覺 / Cross-tab consistency / Brand voice / Polish

### Top 10 Designer 痛點（依視覺執行 impact）

#### D-1. Typography scale 散 13 個 size · 應 7-8 個（HIGH）

量到：`76 / 56 / 32 / 30 / 28 / 24 / 22 / 20 / 16 / 14 / 13 / 12 / 11`。`30/28/32` 三個 size 在 4px 區間 · `24/22/20` 同樣 · `14/13/12/11` body 4 size 太細。

**修法**：定義 type scale token：`xs=11 / sm=13 / base=16 / md=20 / lg=24 / xl=32 / hero=56`。砍中間 size。
**工時**：3-4h

---

#### D-2. Headline 188px 撐爆 fold 1 · KPI 推到 fold 邊（HIGH）

Dashboard headline serif 188px 高 · KPI `dashboard-today-pnl-value` 在 y=766（接近 900px fold 邊緣）。Mobile 上 hero 占 300px+ · headline 進不來。

**修法**：headline padding 收 + 字級降一階（mobile 24-32 / desktop 40-48 不要再 76）· 應在 100-130px 高內。
**工時**：2h

---

#### D-3. Mobile header + control band 雙層占 300px+（HIGH · Codex）

Mobile 390 上 header 103px + 第二排 control band（收盤價 / 新組合 / 全部總覽 / 管理組合）→ hero 從 y=300+ 才開始。讀起來像「兩層 nav 在搶」 · product surface 進不來。

**修法**：phone 收成單列 sticky（brand + active portfolio + 1 menu button · 56-64px）· 其他 control 進 bottom sheet 或 hero 後 action row。
**工時**：3h

---

#### D-4. Design tokens 沒系統（HIGH）

3 個次問題合一：

- **5 種 gray 服務同一語義**：`(11,18,14)` `(47,50,50)` `(47,50,50,0.75)` `(0,0,0)` `(60,60,60)` `(131,133,133)` — 應 consolidate 成 3 token：`text` `textSec` `textMute`
- **8 個 border radius**：`4 / 10 / 12 / 14 / 20 / 22 / 50% / 999px` · 10/12/14 太接近 · 20/22 太接近 — 應 5 token：`sm=4 md=8 lg=12 xl=20 pill=999 circle=50%`
- **26 個 button 沒 variant 分類**：watchlist 用實心橘 · daily 用淡色寬塊 · research 用黑/橘 gradient — 應定義 4 variant：`primary / secondary / ghost / danger`

**修法**：建立 `theme.tokens.ts` 包 type / color / radii / button variant。code 全面替換。
**工時**：6-8h（系統性 refactor）

---

#### D-5. UI 幾乎無 micro-interaction · `transition: all` 反 pattern（HIGH）

量到：3 個 unique transition · 0 unique animation。多數 component 沒 hover state / active feedback / tab change motion。`transition: all` 會把 layout 一起動畫 · reflow 風險。

**修法**：

- 改成明確列：`transition: background-color 0.18s, transform 0.18s, box-shadow 0.18s`
- 加 motion token：`button:active scale(0.98) 80ms` / `tab change fade-in 200ms` / `card hover 1px translate + shadow`
- Boot keyframes 從 inline `<style>` 移到 global stylesheet

**工時**：4h
**Why 重要**：跟 brand「投資網紅同伴」voice 不符 · 死板 = 不像私人助理

---

#### D-6. 語義色不嚴格 · 同一概念多色（HIGH · Codex）

- **上漲色** 不一致：`+40.6%` `+122.9%` 有時黑 / 橘 / 不是 C.up
- **Amber** 過用：active portfolio / events / warnings / CTAs · 4 種語義同 amber
- **Gray** 過用：inactive / pending / needs attention · 3 種狀態同 gray

**修法**：lock token 語義：

- `C.up` 漲 / 潛力上升
- `C.down` 跌 / 風險
- `C.amber` 警示 / pending（不做 CTA）
- `C.orange` 主 action 強調（不做 warning）
- neutral gray 只 metadata

**工時**：3h（grep 替換 + visual audit）

---

#### D-7. Empty / Loading / Error 三狀態跨 tab 視覺不一致（HIGH · Codex）

- Dashboard 空：大 icon + serif headline + CTA
- Watchlist 空：tiny dotted circle + solid orange CTA
- Holdings 空：空 ring 顯 `TOTAL 0` 再接 onboarding card
- Trade log 失敗：暖 banner「audit 暫時讀不到」（清楚）
- Dashboard 失敗：被 stale local 內容蓋過 · 沒 source-failure indicator

**修法**：定義 3 個 primitive component：`<EmptyPanel>` `<LoadingSkeleton>` `<ErrorBanner>` · 強制 same icon size / headline scale / CTA placement。Daily 的 accuracy gate 也走同一視覺 grammar。
**工時**：5h

---

#### D-8. 橘色 5+ 種語義（MEDIUM）

橘 `rgb(239, 125, 47)` 出現在：brand accent / 主 CTA / warning / 選中 chip / gradient 卡 / source status。沒明確分工 · 用戶分不出哪個橘代表什麼。

**修法**：橘只留 brand accent + 主 CTA。warning 改 amber · upside 改 green · research placeholder 改 neutral shell + 1px 橘 accent line。
**工時**：2h（見 D-6）

---

#### D-9. Cross-tab page intro 不一致（MEDIUM · Codex）

Watchlist / events / news / daily / research 共用「現在先看這裡」 · Dashboard 用 editorial hero · Trade 用 compliance card · Log 用 operational summary。差異 OK 但**沒 variant 系統** · 切 tab 像切到不同產品。

**修法**：建 `<PageIntro variant="status|compliance|operational|editorial">` 統一 margin / chip row / heading scale · variant 只換內容跟 accent。
**工時**：3h

---

#### D-10. Icon 混 + 英文 taxonomy chip 違 TC voice（MEDIUM）

- Header `☁`、dashboard `🔔`、watchlist `⚡`、search 浮動 magnifier emoji-like、cards 線性 SVG icon — emoji + line + minimalist 三套並存
- 英文 chip：`PORTFOLIO ONBOARDING` `daily principle` `RESEARCH STANDBY` 跟「文人氣」TC voice 衝突

**修法**：

- 統一 1 套 line icon 給 controls / states
- Emoji 只留 user-authored 或 editorial 內容
- 英文 chip 翻中或縮成 small + secondary

**工時**：4h

---

### 次要痛點 D-11 ~ D-25（可後續批次）

| #    | 觀察                                                                | Severity |
| ---- | ------------------------------------------------------------------- | -------- |
| D-11 | 76px hero serif on mobile 占 1/4 螢幕高                             | MED      |
| D-12 | textMute `(131,133,133)` on bone bg 對比 ~4:1 邊緣 WCAG AA Large    | MED      |
| D-13 | 64px 空白 between tabs row 與 reminder toggle                       | MED      |
| D-14 | Card padding 不規律（12/14 vs 20）                                  | MED      |
| D-15 | 768 iPad 仍用 phone-style「更多 5」dropdown                         | MED      |
| D-16 | Empty dashboard 心法卡 + Today in Markets 跟 onboarding 搶舞台      | MED      |
| D-17 | Accuracy / unavailable 都用 amber 但 visual grammar 不同            | MED      |
| D-18 | Accuracy gate 只 Daily 暴露 · 其他 tab 沒                           | MED      |
| D-19 | 「現在先看這裡」soft copy 跨 tab 模板化 · 失去 tab-specific 意義    | MED      |
| D-20 | Operational tabs 太米色 · 數據沒 urgency · data layer 需 sharpen    | MED      |
| D-21 | Badge / chip padding / border 不規律（status chip 看起來像 button） | MED      |
| D-22 | Numeric semantic 不一致（gains 有時黑有時橘 · 小數位不統一）        | MED      |
| D-23 | Mobile card padding 太鬆 · vertical rhythm 太閒                     | LOW      |
| D-24 | Boot skeleton 4 mini tabs 不 match real header 9 tabs               | LOW      |
| D-25 | English taxonomy chip 違 TC voice                                   | LOW      |
| D-26 | HoldingsRing 配色淡 peach 對比軟 · 圖讀不清                         | LOW      |
| D-27 | Focus ring 黑粗 · 跟暖系 palette 衝                                 | LOW      |
| D-28 | Boot animation inline `<style>` · 沒進 global motion token          | LOW      |

### Designer 修法批次（合併進 §3）

| 批次                             | 工時 | 內容                                                                                          |
| -------------------------------- | ---- | --------------------------------------------------------------------------------------------- |
| **I · Token system foundation**  | 8h   | D-1 type scale + D-4 colors/radii/button variants（一次重寫 theme.tokens · 後續修法都吃這個） |
| **J · Headline + Mobile fold 1** | 5h   | D-2 headline 收 + D-3 mobile 雙層 nav 收成單列                                                |
| **K · 三狀態統一**               | 5h   | D-7 EmptyPanel / LoadingSkeleton / ErrorBanner 三 primitive                                   |
| **L · 語義色 + 橘色 lock down**  | 5h   | D-6 + D-8 + D-22 numeric semantic 一起                                                        |
| **M · Cross-tab consistency**    | 7h   | D-9 PageIntro variant + D-15 tablet rail + D-18 accuracy gate 跨 tab                          |
| **N · Motion 補基本**            | 4h   | D-5 micro-interaction + boot keyframes 規範                                                   |
| **O · Polish**                   | 6h   | D-10 icon + D-21 chip + D-25 English chip + D-26 chart palette + D-27 focus ring              |

**I + J + K + L = 23h** · 完成後視覺感受跳一級
**M + N + O = 17h** · 完成後跨 tab 一致 + 有 rhythm

---

## §3 整合 / 動工順序

合併 §1 PM 8 批 + §2 Designer 7 批 = 15 批。建議優先序（依用戶 perceived value）：

| 優先  | 批次                                                          | 工時 | 說明                                                     |
| ----- | ------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| 🔥 1  | A · 速成 copy 拆彈（PM）                                      | 4h   | dev 口氣 / tagline / 焦慮卡 collapse · 立即降低 friction |
| 🔥 2  | I · Token system foundation（Designer）                       | 8h   | 後續所有修法吃這個 token · 先建立 base                   |
| 🔥 3  | B · Onboarding（PM）+ K · 三狀態統一（Designer）              | 13h  | 第一次打開體驗 + 空/載入/錯誤狀態系統化                  |
| 🟡 4  | C · Mobile 重整（PM）+ J · Headline + mobile fold（Designer） | 11h  | mobile 80% 用戶 · 必須先到位                             |
| 🟡 5  | D · 7865 insider 補齊（PM）                                   | 6h   | 合規必修 · 法律風險                                      |
| 🟡 6  | L · 語義色 + 橘色 lock（Designer）+ H · 視覺分層（PM）        | 9h   | 用戶感受層整理                                           |
| 🟢 7  | E · 重度用戶資料管理（PM）                                    | 8h   | 60+ 筆 trade log / 35 watchlist / 90 天 history          |
| 🟢 8  | M · Cross-tab consistency（Designer）                         | 7h   | 切 tab 像切產品 · 一致性                                 |
| 🟢 9  | F · 多 tab sync 補完（PM）                                    | 3h   | 重度用戶 daily-use friction                              |
| 🟢 10 | N + O · Motion + Polish（Designer）                           | 10h  | 質感層                                                   |
| 🌊 11 | G · 競品 baseline（PM）                                       | 12h  | push alert + onboarding tour + dark mode                 |

**🔥 + 🟡 = 51h** · ~6 個工作天 · 完成後產品上一個層級
**🟢 = 28h** · ~3 個工作天 · 重度用戶 + 跨 tab 完整度
**🌊 = 12h** · ~1.5 工作天 · 競品 baseline

合計 ~91h · 約 11 個工作天 全做完 · 跟 ship 友 / beta launch 對齊。

---

## §4 Spec / Mockup Drift（Codex PM 人格 Round 6 · 2026-04-26）

R152 / R153 audit 都只看 live · 漏 SA + SD + 16 張 mockup。Codex 用 PM 人格補做 Round 6 · 對照 SA (558行) + SD (754行) + 16 張 mockup PNG · 找出 implementation drift。

### Top 5 Spec Drift（PM impact 排序）

1. **Trade 沒 wizard** — SA §5.9 + SD §4.7 + `mockup-trade-preview.png` 都寫 `upload → parse → preview → apply`。Live 是合規提醒 + 4 組手動表單（成交 / 目標價 / 財報 / 營收混在一起）。**用戶不敢把成交套進系統**。
2. **Holdings 沒右側 pane 4 卡** — `mockup-holdings-preview.png` 明畫右欄固定 4 卡：心法卡摘要 / 今天先做 / 今天不做 / 風險提醒。Live 完全沒這 4 卡 · 用戶要自己從 20 檔表格推出今天行動邊界。
3. **Daily 沒交付收盤 ritual 成品** — SA §6.3 + `mockup-daily-preview.png` 要 streaming + 3 pillar + per holding 5 actions + 7 天 archive + hit-rate chart。Live 卡在「資料確認 / 待復盤 / 重新分析」入口層。
4. **Dashboard 持倉結構偏離 PM intent** — `mockup-dashboard-preview.png` 寫**策略分類**（成長股 56% / 事件驅動 18% / ETF 14% / 權證 12%）· 這是讓用戶理解自己曝險。Live 改成 ticker market cap top-5 圓餅 · 注意力帶回價格不是策略。
5. **Insider 不是 per-portfolio trust contract** — SA §4.2 + §6.10 + SD §9 全寫 7865 是商業核心。Live 金聯成 Dashboard 沒 `👑 公司代表` badge · Events 仍預測/利多語氣 · Weekly PDF insider section 沒做。

### 重新定位 R152 PM 10 痛點（多數其實 spec 寫了沒做）

| 痛點 #                        | 性質                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------ |
| #1 第一次打開像闖進別人工作台 | **部分新發現**（SA 沒明寫 onboarding tour）+ SD §11.1 要 empty states 寫了沒做 |
| #2 5 焦慮卡 3 張待補          | **spec 寫了沒做** SA §6.8 + SD §11.1 #6                                        |
| #3 失敗 copy 太 dev           | **spec 寫了沒做** SA §7.4 + SD §8.2 禁工程黑話                                 |
| #4 Mobile fold 1 看不到       | **mockup + SD 寫了沒做** SD §3.10.2 + §7.1                                     |
| #5 沒一句話講清楚 app         | **新發現** · spec 沒明寫 onboarding tagline                                    |
| #6 7865 insider 邊界          | **spec 寫了沒做完整** SA §4.2 + §6.10 + SD §9                                  |
| #7 60+ 筆 record 管不了       | **mockup 寫了** filter/export/reflection · live dogfood scale 是新發現         |
| #8 多 tab 像平行宇宙          | **spec 有 shared-state 原則** · BroadcastChannel 是新發現                      |
| #9 第一螢幕爭舞台             | **mockup 寫只 2-3 卡 live 變 7+**                                              |
| #10 競品 baseline 缺          | **大多新發現** dark mode SA §2.4 明說非 Phase 1 必要                           |

### Scope Creep（live 多做 spec 沒寫）

- **`觀察股` tab** — SA §5.1 明寫 Watchlist 不列正式 route
- **`全組合` tab** — 應 view mode 不該並列 nav
- **全域 .md / .html / 備份 / 匯入 toolbar** — 搶 ritual product 入口層
- **Events「三檔接力投資計畫」** — 帶分批出場/加碼/停損語言 · 偏 strategy 不是 catalyst validation
- **Trade 混入目標價 + 財報維護** — 違反 SA §5.9 trade job 純粹性
- **Log 的 `trade audit` 技術稽核語言** — 違反 SD §8.2

### 完全沒做的 spec 必要功能

| Feature                                                   | Spec §   | 狀態                        |
| --------------------------------------------------------- | -------- | --------------------------- |
| Morning Note handoff to other pages                       | SA §6.1  | ❌ live 只 fallback「待補」 |
| Close Analysis streaming + 3 pillar + per holding actions | SA §6.3  | ❌ 卡 standby               |
| Weekly PDF + insider section                              | SA §6.4  | ❌ 只有 .md/.html           |
| Holdings detail right pane                                | SA §6.7  | ❌ dossier 跑列表下方       |
| Accuracy Gate 5/5 explicit display                        | SA §6.9  | ⚠️ 部分                     |
| `👑 公司代表` insider badge                               | SA §6.10 | ❌                          |

---

## §5 Design Style Consensus · 用戶喜歡的設計風格（R155 · Claude + Codex 看 inspiration 兩資料夾）

13 張 inspiration 雙 LLM 共識。

### 一句話：「**像高級雜誌的封面 + 投資電報的冷靜 + 一抹很敢的橘**」

不是溫柔筆記 · 是有重量的投資海報。

### 5 個強訊號（雙 LLM 同意）

**1. 顏色 — Tangerine Alloy palette（用戶存了 3 次 · 強訊號）**

- 近黑 `#0B120E` + 深灰 `#2F3232` + 中灰 `#838585` + 米色 `#D9D3D1` + **橘 `#EC662D`**
- 04-18 又存更熱版本 `#E74504 #FC6A0A #F5ECE4 #292929 #585757`
- → 米當底 · 黑灰當骨架 · 一抹橘當印章 · **沒有第二個彩色**

**2. 橘色要果斷不能稀釋**

- Inspiration 橘是大圓 / 大色塊 / 主 CTA / 圖表節點 — 像印章重擊
- Live 橘弄成淡 wash / gradient / 漸層卡底色 → 記憶點消失
- → 橘只給「最重要的那個位置」其他都不准用

**3. 黑灰要撐骨架（不能只米色）**

- Inspiration 反覆出現大面積黑 / 煤灰深色區塊 — 撐重量
- Live 幾乎全米色 + 淺橘 wash · 缺重量 · 看起來軟
- → 加大塊 `#0B120E` / `#2F3232` / `#292929` panel · 才有「電報感」

**4. 巨大數字 / 標題當主角**

- 每張參考都有「一眼看到的主角」：Strava `67` / 天氣 `37°` / 睡眠 `8 12` / 海報 `MONDAY`
- Live hero 是 serif 軟句子「16 檔資料有點久了」· 不夠 punch
- → Hero 換 bold sans 大數字 · serif 退到次標

**5. 第一螢幕只一個主角 · 不是 8-9 卡爭舞台**

- Inspiration 海報式一屏一主視覺
- Live 第一螢幕同時 hero + KPI + ring + 5 焦慮 + Today + Buffett quote → 重心散 7 處
- → 第一螢幕收剩 1 主視覺 + 1 副視覺 · 其餘下沉

### 兩個 R153 Designer Round 5 我做反了（Codex 抓到）

- ❌ 我說「全用 serif 是對的」· 其實 inspiration 大量用**粗 sans**（Strava / 天氣 / Monday）· serif 只在 03 styleguide 出現一次當小調味
- ❌ 我說「米色暖系」是核心 · 其實**黑灰重量同樣核心** · 沒黑就沒骨架

### 不要做（inspiration 沒出現）

- 紫 / 藍 / 綠 amber 多色
- 漸層卡（gradient card）
- 玻璃擬態 / 光澤效果
- 圓潤可愛圓角
- ~~動畫炫技~~ **2026-04-26 移除**：用戶決議動畫只要有助易讀性 + 觀賞性 + 不沉悶呆板就允許，per `docs/decisions/2026-04-26-motion-relax.md` + SD §1.10 修訂版

### Top-3 立即動工 visual 對齊（雙 LLM 共識）

1. **第一螢幕改海報式 · 1 主視覺 + 1 副視覺**（現在 8-9 卡爭舞台）
2. **加黑灰大色塊撐重量**（現在全米軟 · 缺骨架）
3. **橘色變少變準** · 只給 CTA / 主數據 / 重要缺口（現在橘灑得到處）

---

## §6 整合動工順序 v2（合 §1 PM + §2 Designer + §4 Spec drift + §5 Design style）

依「修了用戶感受立即跳級」優先：

| 優先  | 批次                                                          | 工時 | 為什麼先做                                |
| ----- | ------------------------------------------------------------- | ---- | ----------------------------------------- |
| 🔥 1  | **§5 #3 橘色 lock down · 米色 + 黑灰 + 1 橘**                 | 4-6h | 視覺感最快變強 · token 改 1 處全 app 受益 |
| 🔥 2  | **§4 #4 Dashboard 持倉結構回到策略分類**                      | 3h   | mockup intent · 用戶看曝險不看 ticker     |
| 🔥 3  | **§1 A 速成 copy 拆彈 + §1 #2 焦慮卡 collapse**               | 5h   | dev 口氣修 + 焦慮卡待補 collapse          |
| 🟡 4  | **§4 #2 Holdings 右側 pane 4 卡（心法/今天先做/不做/風險）**  | 8h   | mockup 明畫但完全沒做 · 大幅補 spec drift |
| 🟡 5  | **§4 #1 Trade wizard upload→parse→preview→apply**             | 10h  | 用戶不敢用核心功能 · 商業 risk            |
| 🟡 6  | **§5 #5 第一螢幕收剩 1 主 1 副 · §1 #4 mobile fold**          | 8h   | 海報式對齊 inspiration · mobile 同時改    |
| 🟡 7  | **§4 #5 7865 `👑 公司代表` badge + 跨 tab insider contract**  | 6h   | 合規必修 · 法律 risk                      |
| 🟢 8  | **§4 #3 Daily 補 streaming + 3 pillar + per holding actions** | 12h  | 收盤 ritual 完成品 · 大工                 |
| 🟢 9  | **§5 #4 Hero bold sans 大數字 · 換字體 + 黑灰大色塊**         | 6h   | 視覺骨架重塑                              |
| 🟢 10 | **§1 E 重度用戶 search/filter · §1 F multi-tab sync**         | 11h  | 留存層                                    |
| 🌊 11 | **§1 G 競品 baseline · Weekly PDF · onboarding tour**         | 18h  | 完整度層                                  |

**🔥 = 12-15h ~2 工作天 · 第一個用戶感受跳級**
**🟡 = 32h ~4 工作天 · 完成後對齊 spec/mockup PM intent**
**🟢 + 🌊 = 47h ~6 工作天 · 完整度**
