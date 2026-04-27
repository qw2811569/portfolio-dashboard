# 持倉看板 QA Checklist · 雙重確認版（白話）

**日期**：2026-04-26（R8/R9 後重 verify）
**驗證**：Claude + Codex 雙邊獨立 re-verify after R8/R9 → **11 條原 ☐ 中 10 條轉 ☑，剩 1 條（#10 禁用詞 src/ identifier）需 decision**
**規則**：☑ = 雙邊都確認過 · ☐ = 至少一邊找到問題或無法 confirm
**Live**：http://104.199.144.170/

---

## 看板（Dashboard）

### Desktop

- ☑ 第一螢幕只看到 hero 主數字 + 持倉組別 + 今日焦點黑 panel 3 區塊
- ☑ Hero 大數字粗 sans
- ☑ Hero headline「把市場的雜訊...」punchy 句
- ☑ 「今日焦點」黑色 panel 在右側
- ☑ 持倉組別 4-5 條 bar 只 1 條橘
- ☑ Portfolio chip 中性 + 1 cta dot
- ☑ 5 焦慮 collapse 1 行
- ☑ Morning Note handoff 跨頁
- ☑ 數字顏色台股紅漲 / 不用綠色當正向
- ☑ Voice 顧問口氣

### Mobile

- ☑ Header 高度 ≤ 64px · R8 commit `87f02a8` mobile single row 55px
- ☑ Mobile fold 1 看到 hero + 持倉 + 黑 panel
- ☑ Bottom sticky tab bar 5 primary + 3 overflow · R8 commit `87f02a8` mobile-bottom-tab-bar testid + bottom: 0 fixed

### 看板頁不要做 4 條

- ☑ 沒漸層 / 沒玻璃 / 沒紫藍綠 / 全方角 · per grep 0

---

## 持倉（Holdings）

### Desktop

- ☑ Tab nav underline 不 pill
- ☑ Multi-portfolio switcher
- ☑ Multi-filter（類型/產業/狀態/thesis/搜尋）
- ☑ 表格列出股號/名/qty/cost/price/PnL/action
- ☑ 右側 4 卡心法/今天先做/今天不做/風險
- ☑ Detail pane single dossier
- ☑ Hover row 不抬升
- ☑ Voice 系統中性

### Mobile

- ☑ Grouped list + drawer
- ☑ 點 row → 全螢幕 drawer

### 持倉頁不要做 4 條

- ☑ 全 4 條

---

## 事件追蹤（Events）

### Desktop

- ☑ Timeline「今天」橘 marker
- ☑ Labels 不重疊 aggregate
- ☑ 預測命中率 chart
- ☑ Status chip 顏色
- ☑ Voice 專業記錄官 不出現「預測看漲 / 停損 / 出場」 · R8 commit `df64b7a` getPredictionMeta 改「正向催化 / 負向風險 / 中性記錄」
- ☑ Insider mode 自家股事件去 buy/sell 暗示 · R9 commit `f6d3c7c` EventsPanel wire isInsiderSelfStock + getPredictionMeta return null on insider self-stock

### Mobile

- ☑ Timeline 單欄垂直
- ☑ Status / dot 清楚

### 事件頁不要做 4 條

- ☑ 全 4 條

---

## 情報脈絡（News）

### Desktop

- ☑ 列表 source/time/持股關聯
- ☑ 篩選持股/來源/影響方向
- ☑ Insider 自家股隱 AI impact
- ☑ Voice 編輯轉述
- ☑ 主橘只用「判讀影響」

### Mobile

- ☑ 主卡 + 摺疊 filter

### 新聞頁不要做 4 條

- ☑ 全 4 條

---

## 收盤分析（Daily）

### Desktop

- ☑ 今日盤後 hero + 複製按鈕
- ☑ 3 pillar row
- ☑ 每檔今日該做 list
- ☑ 動作 chip 中性 + 紅停損出場
- ☑ 7 天 archive timeline + 日曆
- ☑ 30 天命中率 chart
- ☑ Insider mode 不顯示 per-holding actions
- ☑ Accuracy Gate 6 entry
- ☑ Voice 顧問 + 結構化
- ☑ Streaming 文字 live generation 時逐字 · R8 commit `fba9b83` 新 `StreamingText.jsx` + `DailyHero.jsx` 接入

### Mobile

- ☑ 垂直堆疊

### Daily 頁不要做 4 條

- ☑ 全 4 條

---

## 全組合研究（Research）

### Desktop

- ☑ Streaming AI 結果區（live 逐字） · R8 commit `fba9b83` `ResearchPanel.jsx` 接入 `StreamingText`
- ☑ 每份研究含目標持股 / 信心 / 來源 / 新鮮度 badges
- ☑ 風險揭示 / 資料待補 list
- ☑ Weekly PDF 入口 + Insider compliance section
- ☑ Voice 策略分析

### Mobile

- ☑ 主分析中欄 + status 垂直

### Research 頁不要做 4 條

- ☑ 全 4 條

---

## 上傳成交（Trade）

### Desktop

- ☑ Compliance disclaimer modal
- ☑ STEP 1-4 progress bar
- ☑ Step 1 三入口
- ☑ Step 2 警告 + 「下一步」disabled
- ☑ Step 3 confirm disabled
- ☑ Step 4 「✅ 已寫入 N 筆」
- ☑ Apply 同步 Holdings + Log
- ☑ Voice 嚴肅合規 + 同事

### Mobile

- ☑ 4 step 一頁一個
- ☑ Compliance modal 全屏

### Trade 頁不要做 4 條

- ☑ 全 4 條

---

## 觀察股（Watchlist）

### Desktop

- ☑ Search bar + sort
- ☑ 每股 row 標準
- ☑ 編輯/刪除 button 方角不 pill · R8 commit `df64b7a` borderRadius 12 → 8

### Mobile

- ☑ 每股 row vertical card
- ☑ 35+ 檔 actions 收斂

### 觀察股頁不要做 4 條

- ☑ 全 4 條

---

## 交易日誌（Log）

### Desktop

- ☑ 60+ 筆 search + filter
- ☑ 紀錄 4 元素
- ☑ 月回顧 / 反思卡（部分 — file:line evidence 但無「月回顧」字樣）
- ☑ Voice 回顧內省

### Mobile

- ☑ Timeline 間距加大

### Log 頁不要做 4 條

- ☑ 全 4 條

---

## 跨頁全局（Header）

- ☑ 純文字下載按鈕無 emoji · R8 commit `df64b7a` `⟳ 收盤價` → 純文字「更新收盤價」 + cloudIndicator「雲端 / 本機」純文字（無 icon）
- ☑ 沒 .html 下載
- ☑ 沒單獨 `?` button（已 rename「重看導覽」）
- ☑ Insider 7865 切換 Header 出現 `👑 公司代表` badge
- ☑ Tab nav active 2px tangerine underline
- ☑ Tab inactive iron 灰文字

### Cross-page workflow

- ☑ Morning Note → tab + context
- ☑ Trade apply → Holdings + Log 同步
- ☑ Events 驗證 → thesis pillar 變化

### 全站禁用詞 0 出現

- ☐ **禁用詞 src/ identifier**（**唯一未修**） · R8/R9 後仍命中：`canonical` (PortfolioLayout.jsx route-shell text) / `SSE streaming` (useResearchWorkflow.js) / `tracking` (useCmdK.js / WatchlistPanel.jsx) / `策略大腦` (useStrategyBrain.js) / `內部人` (chip-analysis.json data) · **要新 decision**：是否例外允許 internal identifier / data file 含禁用詞，或全 refactor rename（大工）

---

## Insider 模式（金聯成 / 7865）

- ☑ Header `👑 公司代表` badge
- ☑ Daily / Holdings / Trade / Log / News compliance copy
- ☑ News 自家股隱 AI impact
- ☑ Weekly PDF insider section
- ☑ Events 自家股不出現預測看漲 · R9 commit `f6d3c7c` insider self-stock filter wired
- ☑ Trade / Log insider 文案邊界
- ☑ Persona 視覺氣氛

---

## 視覺 Motion

- ☑ Hero 數字 prev → next 過渡 · R8 commits `df64b7a` + `7cd33fc` AnimatedNumber 加 prevRef + transition state（phase enter/roll/settled）+ render previous/current 雙 span 透明度過渡
- ☑ Strategy bar grow-in 300ms
- ☑ Tab / panel mount fade
- ☑ Card hover lift Watchlist + KPI
- ☑ Drawer slide 240ms
- ☑ Holdings price-deviation pulse 保留
- ☑ Low-confidence dot pop
- ☑ prefers-reduced-motion guard

---

## Phase 1 Must（10 條）

- ☑ Dashboard 雙模式
- ☑ Morning Note handoff
- ☑ Holdings switcher
- ☑ Holdings multi-filter
- ☑ Detail pane single dossier
- ☑ 5 焦慮 X1-X5
- ☑ Accuracy Gate 6 entry
- ☑ Trade → Holdings + Log
- ☑ Insider UX 跨 tab 一致 · R9 commit `f6d3c7c` Events 完成 insider self-stock filter wire，全 tab Header / News / Daily / Events 一致
- ☑ Empty / Skeleton / Error / 互動 / 完成 五狀態

---

## 統計

|     | Claude | Codex |   雙邊整合 |
| --- | -----: | ----: | ---------: |
| ☑   |    106 |   133 | **約 110** |
| ☐   |     14 |    12 |  **約 11** |

雙邊都 ☑ 才打勾，任一邊 ☐ 就保 ☐。

---

## R8 必修清單（11 條 ☐）

1. **EventsPanel.jsx:82 「預測看漲」改 voice**（spec drift · 嚴重，影響 Insider 跨 tab 一致性 + Events Voice 兩條）
2. **Header.jsx `⟳ 收盤價` 改純文字 / line icon**
3. **Header.jsx `cloudIndicator` 「雲端」改純文字 status text**（已是純文字，但要看視覺）
4. **AnimatedNumber.jsx 真做 prev → next 過渡**（R6 spec drift）
5. **WatchlistPanel.jsx:345, 364 編輯/刪除 button radius 12 → 8**
6. **Mobile Header 高度 > 64px** · 收成單列 sticky（per SD §3.10.2 + audit §D-3）
7. **Mobile bottom sticky tab bar** · 加底部 5 primary + 3 overflow（per SD §3.10.2）
8. **Daily streaming live 逐字 / line-reveal 實作**（per Codex discussion 1.1 共識）
9. **Research streaming live 逐字 / line-reveal 實作**（同上）
10. **全站禁用詞 src/ identifier 殘留**：`canonical / SSE / tracking / 主腦` 在 hook / lib name 內 — refactor 改名（不易，可能要新 decision 是否例外允許 internal identifier）
11. **Insider Events handoff missing**（同 #1）

幾條合併修：#1 + #11 同時做。

---

## R12 雙人 Mutual QA 結果（2026-04-27）

**Method**：Codex Playwright 14 路由 × 3 browser = 42 passed (11.4m)；Claude + Codex 各自獨立 hostile review；最終採 Codex 嚴判 + Claude 補充。
**詳細**：`.tmp/r156-full-execute/round12/r12-mutual-qa-merged.md` + `codex-r12-qa-report.md` + `claude-r12-qa-source-prereview.md`

### 9 HIGH 議題真實狀態

| #   | 議題                      | 狀態                                                                                                                                                        |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mobile 首頁今天先做       | 部分修（hero 對 ✅；CTA「去 Events 看日程」新引入英文）                                                                                                     |
| 2   | jargon 中文化             | 部分修（多處漏：Streaming 摘要 / Thesis placeholder / Morning Note / Saved filter / 進入 Trade 頁 / EARNINGS / EX-DIVIDEND / SHAREHOLDING-MEETING / Legal） |
| 3   | Research 第一屏           | 部分修 / 未驗收（source 對；R12 visual-audit 14 路由沒含 research 頁）                                                                                      |
| 4   | Daily 狀態打架            | **沒修**（source gate 對但 live 截圖 05/05b 仍 waiting + 行動建議同屏）                                                                                     |
| 5   | Holdings 賺/賠最多 mobile | 部分修（source 有 MobilePnlQuickEntries，但位置在 ring/結構/篩選之後，5 秒首屏看不到）                                                                      |
| 6   | Mobile 底部覆蓋           | **沒修**（safe-area 加了；但 modal/nav z-index 沒處理：06b trade modal CTA 被 nav 擋 / 08b watchlist 大數字被 search 浮鈕橫切）                             |
| 7   | 桌機相似盒子              | **沒修**（0 commit；Daily/Events 桌機仍同階層 Card 平鋪）                                                                                                   |
| 8   | 事件顏色標籤太吵          | 部分修（prediction chip 統一 charcoal alpha 8 ✅；events filter EARNINGS 英文 + impact emoji 還在）                                                         |
| 9   | 桌機 filter 太重          | **修了 ✅**（desktopExpanded false default + 收合 1 行摘要 + 表格提前露出）                                                                                 |

**真實覆蓋率**：1 修（HIGH#9）/ 5 部分修 / 2 沒修 / 1 沒驗收

### 最終評分（採 Codex 嚴判）

- 視覺質感（設計師）: **7.1 / 10**
- 散戶可用（5 秒 test）: **6.6 / 10**
- §5 紀律遵守: **7.4 / 10**

R12 hostile QA **不過**。

### R13 必修任務（5 HIGH + 3 MEDIUM + 4 流程）

詳 `.tmp/r156-full-execute/round12/r12-mutual-qa-merged.md` § F

---

## R13 雙人 Mutual QA 結果（2026-04-27）

**Method**：8 commits（Codex 4 + Claude 4）+ Codex 1 補 jargon = 9 commits；fresh 14 chromium screenshots（VM force rebuild 後）；Claude + Codex 各自獨立 hostile review
**詳細**：`.tmp/r156-full-execute/round13/r13-mutual-qa-final.md` + `codex-r13-qa-report.md`（stale 截圖判定 — 部分需重評估）+ `codex-r12-investigate-report.md`

### 9 HIGH 真實狀態（fresh-evidence-based）

| #   | 議題                      | R12             | R13                                                                                           |
| --- | ------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| 1   | Mobile 首頁今天先做       | 部分修          | **FIXED** ✅ (CTA「去看事件日程」中文化)                                                      |
| 2   | jargon 中文化             | 部分修          | **MOSTLY FIXED**（17 處 + Today in Markets 補）                                               |
| 3   | Research 第一屏           | 部分修 / 沒驗收 | **SOURCE FIXED · 仍沒 visual 驗收** ⚠️（visual-audit 14 路由仍沒含 research）                 |
| 4   | Daily 狀態打架            | 沒修            | **FIXED** ✅（state machine waiting/partial/ready · partial 不 render actions · 截圖證實）    |
| 5   | Holdings 賺/賠最多 mobile | 部分修          | **FIXED** ✅（MobilePnlQuickEntries 移到 grid 之前）                                          |
| 6   | Mobile 底部覆蓋           | 沒修            | **FIXED**（modal context · overlay portal land）✅                                            |
| 7   | 桌機相似盒子              | 沒修            | **PARTIAL** ⚠️（Card variant primitive land + 14 callers migrate · Daily/Events 桌機仍 flat） |
| 8   | 事件顏色標籤太吵          | 部分修          | **FIXED** ✅（filter 9 條中文 + 統一 charcoal alpha + 無 emoji）                              |
| 9   | 桌機 filter 太重          | 修了            | **MAINTAINED** ✅                                                                             |

**真實覆蓋率**：6 fully fixed (1/2/4/5/6/8) + 1 maintained (9) + 1 partial (7) + 1 source-only (3 visual gap)
**R12 → R13**：1 修 / 5 部分修 / 2 沒修 → 6 修 / 1 partial / 1 visual 缺

### R12 6 條新引入問題：R13 全解 ✅

### §5 4 條紀律：4/4 clean + 圓角真清

### 最終評分（fresh-evidence）

| 維度                  | R12 | R13     |
| --------------------- | --- | ------- |
| 視覺質感（設計師）    | 7.1 | **8.0** |
| 散戶可用（5 秒 test） | 6.6 | **7.5** |
| §5 紀律               | 7.4 | **8.7** |

R13 仍未達 9.95。最大 gap：HIGH#7 桌機 hierarchy 視覺差異不夠強 / HIGH#3 research 沒 visual 驗收 / jargon 92 known allowlist 仍壓著。

### 關鍵流程教訓

VM webhook deploy **不可信** — route-daily 4/26 build vs git head 4/27 一直沒 rebuild，Codex 看 stale 截圖判 HIGH#4/#6/#8「沒修」全錯。R14 必加 deploy verification gate（commit 後 force `vite build` VM + curl HTML asset hash 驗對齊才拍 screenshots）。

### R14 必修任務

詳 `.tmp/r156-full-execute/round13/r13-mutual-qa-final.md` § 7

---

## R14 雙人 Mutual QA 結果（2026-04-27）

**Method**：7 commits（Codex 4 + Claude 3）+ verify-vm-bundle.mjs deploy gate；16 fresh screenshots（含 research 10/10b first visual）。

### R14 ship commits

- `31afae7` Card hero 2px border + deep shadow + 4px accent + caller dilution 拔（Codex）
- `c89bdf3` lavender/choco @deprecated + neutralIron/neutralCharcoal + 6 caller swap（Codex）
- `3b1c1d3` visual-audit 補 research + seed fixture（14→16 路由）（Codex）
- `494266b` jargon V2 sweep 31 處（Claude）
- `01791ee` verify-vm-bundle.mjs + npm verify:vm/audit:visual + git notes log（Codex）
- `bc23263` lint baseline prune 84→35（Claude）
- `eb5d112` ResearchPanel `仍 OK` → `維持`（Claude）

### 評分

| 維度                  | R12 | R13 |         R14 |
| --------------------- | --: | --: | ----------: |
| 視覺質感（設計師）    | 7.1 | 8.0 |    **8.15** |
| 散戶可用（5 秒 test） | 6.6 | 7.5 |    **7.85** |
| §5 紀律               | 7.4 | 8.7 | **8.55** ⚠️ |

R14 不過 9.95。§5 微回退（Card hero 過度使用 + lavender/choco caller 殘留）。

### R14 暴露的 R15 必修 HIGH

1. **Research visual 不可 ship**：first visual 截圖暴露 ResearchPanel.jsx:1470 `undefined` row + line 376 + 1469 🧬 / 🔬 emoji CTA + SeasonalityHeatmap 空 cards
2. **Mobile safe-area not global**：08b/09b/10b/05b 都有 fixed nav 蓋 list content（不只 modal context）
3. **桌機 Daily/Events hierarchy 仍 flat**：hero primitive 強化但 callers 沒 demote 周圍 same-depth white cards

### R15 任務（auto-dispatch · 不問用戶）

詳 `.tmp/r156-full-execute/round14/r14-mutual-qa-final.md` § 4
