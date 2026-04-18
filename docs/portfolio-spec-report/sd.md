# 持倉看板 System Design

> 日期：2026-04-18  
> 文件類型：SD（System Design）  
> 目標讀者：Engineer / Designer / QA

---

## 1. Design Tokens

### 1.1 Base Palette

```css
:root {
  --ink: #0b120e;
  --charcoal: #2f3232;
  --iron: #838585;
  --bone-deep: #d9d3d1;
  --bone: #e7e0d6;

  --warning: #f0a145;
  --positive: #ef7d2f;
  --cta: #ec662d;
  --hot: #fc6d2b;

  --negative: #3c3c3c;
}
```

### 1.2 Token Roles

| Token         | 用途                                        |
| ------------- | ------------------------------------------- |
| `--ink`       | 最深文字、重要標題、dark surface foundation |
| `--charcoal`  | 次深容器、divider、深色區塊背景             |
| `--iron`      | 次要字、outline、neutral status             |
| `--bone-deep` | 邊框、分隔、淡底層級                        |
| `--bone`      | 主背景、淺底卡片                            |
| `--warning`   | pending、aging、需注意但未出錯              |
| `--positive`  | 台股上漲 / 獲利 / 正向結果                  |
| `--cta`       | 主要操作、品牌主按鈕                        |
| `--hot`       | 唯一更高注意力訊號，如低信心 outline dot    |
| `--negative`  | 下跌、虧損、冷向風險                        |

### 1.3 禁止事項

- 不使用舊 sage palette
- 不用綠色當正向主語義
- 不把 `--cta` 與 `--positive` 混成同一個場景
- 不把 `--hot` 灑成全站 accent

### 1.4 Typography Scale

| Token          | 建議值                     | 用途                     |
| -------------- | -------------------------- | ------------------------ |
| `font-display` | 36-56 / 1.0-1.08 / 600-700 | hero 數字、頁首主標      |
| `font-title`   | 24-32 / 1.15 / 600         | card title、section lead |
| `font-section` | 18-22 / 1.25 / 600         | 區塊標題                 |
| `font-body`    | 14-16 / 1.58-1.7 / 400-500 | 主要內容                 |
| `font-caption` | 11-12 / 1.4 / 500          | meta label、時間、來源   |

### 1.5 字體規則

- 英文 meta label 可較緊 tracking
- 中文長文需較寬 line-height
- 數字使用 tabular-nums
- 大字數字與中文段落不可共用同一字級節奏

### 1.6 Spacing Scale

```txt
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
```

### 1.7 Spacing 使用原則

- 4 / 8：icon、badge、inline gap
- 12 / 16：card 內距、表單、列表項
- 24 / 32：section gap、card gap、mobile breathing
- 48 / 64：hero break、major chapter break

### 1.8 Radius 與 Stroke

- small radius：8
- medium radius：12
- large radius：16
- outline：1px
- emphasis line：1.5px

### 1.9 Motion

| 類型                                | 規格      |
| ----------------------------------- | --------- |
| hover / fade                        | 200ms     |
| drawer / modal / section transition | 240-300ms |
| easing                              | ease-out  |

### 1.10 Motion 原則

- 有感但不炫技
- 不做大面積彈跳
- 僅用於狀態確認、層級切換、抽屜開合

---

## 2. Semantic Mapping

### 2.1 台股語境對照

| 意義                         | 顏色         |
| ---------------------------- | ------------ |
| 漲 / 獲利 / positive         | `--positive` |
| 跌 / 虧損 / negative         | `--negative` |
| pending / aging              | `--warning`  |
| 主要 CTA                     | `--cta`      |
| 最重要單點提醒               | `--hot`      |
| 中性驗證完成 / insider badge | `--iron`     |

### 2.2 關鍵規則

- Jaffa 感 warm family 才能對齊台股紅漲綠跌直覺
- `--negative` 要冷靜，不是血紅
- `confidence < 0.7` 使用 `--hot` outline + dot，不用滿版底色
- `validated` 在 Events 用 neutral，不用 positive

### 2.3 文義與顏色解耦

- `CTA` 不代表 positive
- `warning` 不代表錯誤
- `neutral complete` 不代表平庸，而是 workflow 結案

---

## 3. Component Library

### 3.1 Button

#### 3.1.1 Variants

- Primary
- Secondary
- Outline
- Text

#### 3.1.2 States

| State    | 規格                         |
| -------- | ---------------------------- |
| default  | 清楚 label、對比足夠         |
| hover    | 亮度微調或淡色底，不改版面   |
| pressed  | `translateY(1px)` + 亮度微降 |
| disabled | 降對比但仍可辨識，不可像消失 |

#### 3.1.3 Rules

- Primary 用 `--cta`
- 不能每頁超過 1 個 hero 級 primary
- News 頁避免過重的 growth-style CTA

### 3.2 Form

#### 3.2.1 States

| State    | 規格                           |
| -------- | ------------------------------ |
| empty    | `--bone` 底 + `--bone-deep` 邊 |
| focused  | `--ink` 或 `--hot` focus ring  |
| filled   | `--bone` 底 + 正常文字         |
| error    | `--hot` 邊框 + 簡短錯誤文案    |
| disabled | 降飽和、不可編輯、仍保 label   |

#### 3.2.2 Rules

- label 與 helper text 必須存在
- placeholder 不能代替 label
- 表單錯誤不只靠顏色

### 3.3 Badge

#### 3.3.1 v2 Outline

- 用於一般狀態、stale、low confidence、lightweight tags
- 預設深字 + outline

#### 3.3.2 v3 Solid Hero

- 用於 hero 強訊號或核心分類
- 數量要少

#### 3.3.3 Special badges

| Badge          | 規則                              |
| -------------- | --------------------------------- |
| `👑 公司代表`  | `--iron` fill + 深字              |
| low confidence | `--hot` outline + dot             |
| stale          | `--warning` outline               |
| positive chip  | `--positive` 只用於明確漲勢或成果 |

### 3.4 Empty State Template

每個空態至少包含：

- thin-stroke illustration
- headline
- 一句 help copy
- 單一 CTA

### 3.5 Empty State 類型

| 頁面     | 圖像方向     |
| -------- | ------------ |
| Holdings | briefcase    |
| Events   | calendar     |
| News     | newspaper    |
| Research | telescope    |
| Trade    | upload cloud |
| Log      | notebook     |

### 3.6 Skeleton

- shimmer 週期約 1.2s
- 手機版改 horizontal flow
- 至少有 card / table / timeline 三模板
- `connecting < 2s` 可不顯示，避免閃爍

### 3.7 Danger Modal

#### 3.7.1 結構

- Step 1：解釋後果
- Step 2：再次確認

#### 3.7.2 適用場景

- 刪除 portfolio
- 套用不可逆資料覆寫
- 清空重要紀錄

### 3.8 Daily Principle Card

#### 3.8.1 內容

- 經典語錄
- 來源人名
- 今日 context line
- 一鍵複製按鈕

#### 3.8.2 規則

- 只出現在 Dashboard
- 語錄池至少 10 則，支援雙語
- 文字不是雞湯，而是「心法 + 今日脈絡」

### 3.9 Detail Pane Drawer

- 桌機是右側固定 pane
- 平板是右側可調寬 pane
- 手機是全螢幕 drawer

#### 3.9.1 內容分區

- recent close
- thesis scorecard
- events / pillar impact
- research mentions / action area

### 3.10 Navigation

#### 3.10.1 Desktop

- top bar 承載 8 個 route tab、portfolio switcher、profile
- tab 順序對齊正式 IA：Dashboard / Holdings / Events / News / Daily / Research / Trade / Log
- portfolio switcher 放在 tab group 右側，profile 固定最右

#### 3.10.2 Mobile

- 採 sticky bottom tab bar，不用 hamburger
- 5 個 primary tab：Dashboard / Holdings / Events / Daily / Research
- 3 個 secondary route 收進 overflow menu：News / Trade / Log
- 選型理由：現代 iOS HIG 不鼓勵把主導航藏進 hamburger，底部 tab 更符合高頻 ritual product

#### 3.10.3 Active State

- active route 用 tangerine 2px underline
- active icon 改 filled
- inactive route 保持 iron text + outline icon

---

## 4. 8 頁 IA 與 Wireframe 描述

### 4.1 Dashboard

#### 4.1.1 主區塊

- sticky meta
- Morning Note
- Today in Markets
- KPI group
- Daily Principle Card
- 持倉結構
- 今日焦點 / 明日操作

#### 4.1.2 響應式

- 手機：section 分卡，首屏留 breathing room
- 桌機：左主右輔，KPI 與摘要並置

### 4.2 Holdings

#### 4.2.1 主區塊

- multi-portfolio switcher
- filter bar
- grouped holdings list / table
- summary strip
- detail pane

#### 4.2.2 響應式

- 手機：grouped list + drawer
- 平板：兩欄 50/50 或 60/40
- 桌機：列表 + 380-420px detail pane

### 4.3 Events

#### 4.3.1 主區塊

- editorial hero summary
- event timeline
- state chips
- review queue
- pillar impact summary

#### 4.3.2 響應式

- 手機：單欄 timeline，左線與 dot 清楚
- 桌機：timeline + side summary

### 4.4 News

#### 4.4.1 主區塊

- headline card
- source/time badges
- filtered list
- objective summary

#### 4.4.2 響應式

- 手機：單一開場卡 + 摺疊 filter
- 桌機：主卡 + 側欄

### 4.5 Daily

#### 4.5.1 主區塊

- 今日摘要
- 3 pillar summary
- 5 action hints
- accuracy status
- archive entry list

#### 4.5.2 響應式

- 手機：長文與 hints 分段
- 桌機：主分析 + 右欄摘要 / archive

### 4.6 Research

#### 4.6.1 主區塊

- research trigger / target picker
- streaming result area
- confidence / source / freshness badges
- backlog / needs-data area

#### 4.6.2 響應式

- 手機：垂直分段，不把三卡塞同屏
- 桌機：主文 + 右側 status stack

### 4.7 Trade

#### 4.7.1 主區塊

- upload stepper
- dropzone
- parse result
- preview diff
- memo / compliance questions
- apply action

#### 4.7.2 響應式

- 手機：step by step，避免同屏過滿
- 桌機：左邊預覽，右邊說明與 apply

### 4.8 Log

#### 4.8.1 主區塊

- log timeline
- filters
- reflection cards
- export / review actions

#### 4.8.2 響應式

- 手機：timeline 間距加大，避免像 spreadsheet
- 桌機：timeline + filter side panel

---

## 5. Responsive Breakpoints

### 5.1 Mobile `< 768px`

- 單欄
- accordion / grouped list pattern
- sticky header
- detail pane 轉全螢幕 drawer
- CTA 集中於可觸區

### 5.2 Tablet `768px - 1199px`

- 兩欄
- detail pane 約 40-50%
- filter 與內容可同屏

### 5.3 Desktop `>= 1200px`

- 大兩欄
- detail pane 固定 380-420px
- section gap 更明確

### 5.4 Mobile Specific Rules

- base text 不小於 14px
- grouped list 背景可用 `--bone-deep` / `--bone`
- major chapters 間距至少 24-32px

---

## 6. Interactive State Catalog

### 6.1 Global Loading

- app bootstrapping
- panel lazy loading
- streaming connecting

### 6.2 Data Freshness

- fresh
- aging
- stale
- fallback
- source unavailable

### 6.3 AI Confidence

- high confidence
- medium confidence
- low confidence `< 0.7`
- blocked by insider rule

### 6.4 Selection

- row selected
- pane open
- filter active
- portfolio active

### 6.5 Streaming

| State      | 行為                                        |
| ---------- | ------------------------------------------- |
| connecting | 2 秒內可不顯示 skeleton                     |
| streaming  | 顯示 partial content、persona / source meta |
| complete   | 顯示完整文與結構欄位                        |
| degraded   | 顯示 fallback copy                          |
| error      | 顯示 retry 與原因                           |

### 6.6 Trade

- idle
- drag-active
- parsing
- parsed
- apply-confirm
- applied
- failed

### 6.7 Event Lifecycle

- upcoming
- pending review
- validated
- closed

### 6.8 Modal / Drawer

- open
- closing
- dismissed
- confirmed

---

## 7. Accessibility Contract

### 7.1 基本要求

- WCAG AA 對比
- 所有互動 target 至少 44x44
- 狀態不可只靠顏色
- drawer / modal 必須 trap focus
- keyboard reachable

### 7.2 Dynamic Type

- 長文不裁切
- card 高度自適應
- 中文長段可換行

### 7.3 Screen Reader

- badge 要有可讀語意
- icon 不當作唯一資訊
- source / time / confidence 需有 aria 說明

### 7.4 Motion Safety

- 尊重 reduced motion
- drawer / skeleton 可降動效

---

## 8. Copy Tone Matrix 與禁用詞

### 8.1 Tone Matrix

| 頁面 / 模塊            | Voice           |
| ---------------------- | --------------- |
| Dashboard              | 顧問            |
| Holdings               | 系統中性        |
| Events                 | 專業記錄官      |
| News                   | 編輯轉述        |
| Daily                  | 顧問 + 結構化   |
| Research               | 策略分析        |
| Trade                  | 嚴肅合規 / 同事 |
| Log                    | 回顧內省 / 同事 |
| Error / Toast / Status | 系統            |

### 8.2 禁用詞

- 內部人
- 小偷
- beta
- canonical
- SSE
- routing
- preview + diff
- tracking
- accordion
- 主腦
- pillar impact

### 8.3 建議替代詞

| 禁用詞         | 替代詞              |
| -------------- | ------------------- |
| 內部人         | 公司代表 / 管理階層 |
| preview + diff | 預覽差異            |
| tracking       | 追蹤中              |
| accordion      | 展開收起            |
| backlog        | 資料待補中心        |

---

## 9. Insider UX Rules

### 9.1 Badge

- 顯示 `👑 公司代表`
- 使用 neutral `--iron`
- 不做警報化視覺

### 9.2 Compliance Copy Versions

#### Version A

`此部位屬公司代表持股，系統僅提供風險與事件紀錄，不產生買賣建議。`

#### Version B

`此檔為管理階層相關部位，以下內容以資訊整理與風險提示為主。`

#### Version C

`因持股身分特殊，本段分析不提供操作方向，僅保留事件、論述與部位變化記錄。`

### 9.3 規則

- buy / sell CTA 隱藏
- AI action hint 改為風險摘要
- 自家新聞不做 AI impact judgment
- Weekly PDF 另起 insider section

---

## 10. Accuracy Gate 5 條與 UI 表現

### 10.1 Gate 規則

1. source citation 必須存在
2. 數字必須對齊 dossier
3. `confidence < 0.7` 顯性降級
4. insider 跳過買賣建議
5. prompt 內含 self-check

### 10.2 UI 表現

| 狀況            | UI                         |
| --------------- | -------------------------- |
| 正常可顯示      | 正常內容 + source/time     |
| low confidence  | `--hot` outline chip + dot |
| stale           | `--warning` outline        |
| fallback        | 顯示 fallback 說明         |
| insider blocked | 改為 compliance copy       |

### 10.3 Entry Points

必須全盤點以下區域：

- Dashboard summary
- Daily analysis
- Research result
- Detail pane AI summary
- Tomorrow actions
- Weekly PDF narrative

---

## 11. Phase 1 Must Checklist

### 11.1 Must Items

1. Dashboard 盤前 / 盤後雙模式成立
2. Morning Note 可 handoff 到其他頁
3. Holdings multi-portfolio switcher 完成
4. Holdings multi-filter 完成
5. Detail pane 以單一 dossier 驅動
6. 五個焦慮指標有清楚 UI contract
7. Accuracy Gate 套到所有 AI entry points
8. Trade -> Holdings / Log 同步打通
9. insider UX 與 Weekly PDF insider section 完成
10. empty / skeleton / interactive states 補齊

### 11.2 工時與節奏

- 預估總工時：55-75h
- 預估時程：4-6 工作日

### 11.3 QA Gate

- 手機 390 實測
- iPad 768 實測
- 桌機 1200+ 實測
- iOS Safari 手感驗證
- low confidence / stale / insider 三種特殊狀態都需覆蓋

### 11.4 Phase 1 vs Phase 2 DoD 交付物清單

#### 11.4.1 Phase 1 DoD

- 10 個 Must items ship 前，每項都要有 screenshot、demo video、test pass 三種驗收證據
- QA 與設計驗收必須能回指到 route / state / viewport，不接受只寫「看起來 OK」
- 任何 Must item 缺證據，視為未達 ship-ready

#### 11.4.2 Phase 2 Entry 條件

- Phase 1 已在 production 穩定連續 2 週
- 2 週內無 P0 bug
- trust contract 與 insider / stale / low-confidence guard 皆無回退

#### 11.4.3 Checklist Template

| Checkbox | Item           | Owner      | Due        | Evidence                 |
| -------- | -------------- | ---------- | ---------- | ------------------------ |
| [ ]      | Must item 名稱 | 指定 owner | YYYY-MM-DD | screenshot / demo / test |
| [ ]      | Must item 名稱 | 指定 owner | YYYY-MM-DD | screenshot / demo / test |
| [ ]      | Must item 名稱 | 指定 owner | YYYY-MM-DD | screenshot / demo / test |

---

## 12. Phase 2 延伸

### 12.1 視覺與輸出

- dark mode
- Weekly PDF cover 滿版色塊版本
- meta dramatic 進一步拉高編輯感

### 12.2 工作流延伸

- Weekly PDF 更完整版面
- richer share flow
- 更完整 research backlog 與 observability

### 12.3 原則

- Phase 2 不可破壞 Phase 1 的 trust contract
- 新增戲劇性時，不可犧牲清楚與可讀性

---

## 13. 測試重點清單

### 13.1 Functional QA

- 切換 portfolio 不串資料
- insider 同 stock 在不同 portfolio 呈現不同規則
- Detail pane 內容與 Research / Daily 一致
- Events 驗證會更新 thesis
- Trade apply 後 Holdings / Log 同步

### 13.2 Visual QA

- 無綠色殘留
- positive / cta / hot 三者不混用
- mobile breathing 充足
- grouped list / sticky header / drawer 行為正確

### 13.3 Content QA

- 禁用詞未出現
- 技術詞外露已中文化
- 顧問 / 編輯 / 同事 / 系統 voice 無漂移

---

## 14. 實作備註

- route hook 可以保留 view-state，但共享 domain state 應留在 canonical AppShell runtime
- `HoldingDossier` 是 detail pane、Daily、Research、Weekly PDF 的共同來源
- palette 與 semantic 已鎖定，Phase 1 不再回到 sage palette 討論
- 若未來切正式 router，需先保 shared state contract，不得先拆碎再補救

## Round 92 · Codex · SA/SD 補 + HTML render + nav · 2026-04-18 02:56 CST

- 補齊 Phase 1 / Phase 2 DoD、evidence gate 與 checklist template，讓 ship-ready 有可驗收清單。
- Component Library 新增 Navigation 設計，明確定義桌機 top bar、手機 bottom tab、overflow menu 與 active state。
