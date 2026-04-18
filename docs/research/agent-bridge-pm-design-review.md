# Agent Bridge 產品 + 設計 review（Claude 兩頂帽子）

**日期**：2026-04-16
**視角**：PM + 資深設計師雙角度
**前提**：Agent Bridge 剛 ship tp-7-clay 美學（commit `5faaae7`）
**目的**：找**超越 Codex 技術 audit** 的產品 + 設計改善空間

---

## 🎯 PM 視角 — 7 個產品缺口

### P0 — 缺「為什麼」的語境（task context 層）

**現況**：Task card 顯示 `infra-04 / Knowledge API runtime / CODEX` — 只有 what 沒有 why。

**痛點**：用戶（你）或 LLM 進來看，不知道這個 task 跟**哪個產品目標**連接、**為什麼重要**、**誰在等它**。

**改善**：Task card 擴充 3 欄

```
WHY:    Knowledge JSON 改一次要等 Vercel redeploy 2-5 分鐘，阻礙 auto-classifier
WAIT:   feat-06 auto-classifier 等這個完才能做
SHIP BY: 2026-04-20（無硬期限則留空）
```

### P0 — Consensus round 缺主場

**現況**：Multi-LLM 共識討論（這輪 session 跑了 5 輪）在 Agent Bridge 完全看不到，散落 `.tmp/dispatch-logs/`。

**痛點**：你要看 Codex 跟 Qwen 討論到哪、convergence 多少，只能開檔案。這是核心協作流程**沒在 dashboard 上**。

**改善**：新增 **CONSENSUS** tab（第 6 個 tab）— 顯示：

- 每 round 的 agents（Codex / Qwen / Gemini / Claude）
- 各家 verdict（agree / disagree / block）
- Convergence timeline（幾輪後達成共識）
- 點進去看原 brief + 各家回覆 side-by-side

### P1 — Brief ↔ Result 缺連結

**現況**：Session 只看到執行，看不到「當初派的是什麼 brief」。

**改善**：Session detail modal 左右欄：

- Left: 原 brief（markdown render）
- Right: 實際 output（log stream + final summary）

### P1 — 風險 / 阻塞面板

**現況**：session 被 stop / failed / quota exceeded（今天 Qwen 死兩次、Gemini 兩次），dashboard 沒專門視角。

**改善**：Hero 或 Header 加 `BLOCKERS` chip 計數，點開看 incident list：

```
⚠ 3 blockers
  · Qwen OAuth quota exceeded (2x, 今天)
  · Gemini 8s retry quota (1x)
  · VM deploy 上次 stash pop 衝突（已解）
```

### P1 — 第一次用的人不知從何下手

**現況**：你熟，沒問題。未來 4-5 付費用戶第一次進來**不知道該看哪個 tab**。

**改善**：Hero 新增 "你現在可以做" 卡（3 個建議 action）：

```
➊ 看昨晚跑了什麼 → Timeline
➋ 哪些 task 還沒開工 → Tasks
➌ 哪個 AI 正在做事 → Sessions
```

### P2 — 無「我現在在做什麼」個人視角

**現況**：看不出「Claude（我）**這一輪** dispatch 了什麼」— 要從 localActivity 挖。

**改善**：Header 右側 agent slot — 「YOU: 派了 3 個 task 等回報」。

### P2 — 缺 retrospective view

**現況**：每週發生什麼、哪些 decision 定了、多少 consensus 達成？查不到。

**改善**：PROJECTS tab 下加 weekly retro：

```
本週
· 12 個 task 完成
· 5 輪 consensus
· 2 次 revert
· 3 次 deploy
· 最長 task：CMoney feasibility 2h
```

---

## 🎨 資深設計師視角 — 7 個設計改善

### D0 — Information scent 薄（緊張感不足）

**現況**：圖表好看但「**哪個 task 快要 blocked**」「**哪個今天要 ship**」無視覺緊張。

**改善**：

- Task card 邊緣依 urgency 微加赤陶紅 1px tint（close to deadline）
- Session 如果 idle > 5 min，卡片 opacity 降至 60%
- Blocked task 加 diagonal stripe pattern 做標識

### D1 — Empty state 沒品牌

**現況**：沒 session 時應該顯示什麼？現在是空白。

**改善**：

```
「AI 都在休息。
你可以：新增 task / 看昨天完成什麼 / 看最近 consensus」
(bone 色小字 + 側邊微 sage 葉子裝飾)
```

用 serif headline + sans 副文，保持 calm tactile。

### D1 — LLM persona 沒視覺差異

**現況**：Codex / Qwen / Claude / Gemini 同樣卡片格式。但他們個性不同：

- Codex = 技術執行者（精準、直接）
- Qwen = 驗證者（條列、數字）
- Claude = 架構（長思考、文字重）
- Gemini = 反駁者（短、尖）

**改善**：每 agent 有 signature 視覺：

- Codex: IBM Plex Mono 次標題
- Qwen: 更方正 blocky 字
- Claude: serif italic
- Gemini: ultra-condensed

不用整套 theme，只在 agent 名稱 + 該 agent 的 log preview 微差異化。

### D2 — 數字 + 進度結合不夠

**現況**：`62%` 在 Session Dial 是大數字但圓弧沒明顯對 62%。

**改善**：

- 數字字重比圓弧更重（視覺錨點）
- 圓弧留下 38% 用 line 畫而非留白，tactile 感
- 62 後的 % 字級縮 0.6x，凸顯數字

### D2 — Timeline 只量化缺語意權重

**現況**：每日 bar chart 等高，但 12 件跟 18 件 impact 差很多。

**改善**：timeline entry 加 severity badge：

- ⬤ major（deploy / revert / ship）
- ◯ normal（dispatch / commit）
- · minor（sync / heartbeat）
  Bar chart 同一 bar 內可分層（赤陶 = major 數、bone = normal 數）。

### D2 — Tactile 細節可再推

**現況**：已有 paper grain 想法但弱。

**改善**：

- Card 輕微 inset shadow 1px（已經討論過，Codex 允許）
- Hover 時微微浮 0.5px（不是 lift，是 breathing）
- Focus ring 用 sage 2px outline（Styleguide 跟 Agent Bridge 共用）

### D3 — Mobile 體驗未驗證

**現況**：我們從來沒跑 mobile screenshot。

**改善**：

- 下方 tab bar fixed（iOS safe-area 友善）
- 主要 KPI 上拉 bottom sheet（Hero 滾到下方可看 context）
- 觸控範圍 48px min

---

## ⭐ Top 3 如果只做三個（Claude 推薦）

| 優先                                    | 做什麼                                                                             | 直接解的痛                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| **1. CONSENSUS tab**                    | 加第 6 tab 專門視覺化 multi-LLM round（各家 verdict / convergence / brief↔result） | 核心協作機制浮出水面，用戶一眼看懂 AI 討論 |
| **2. Task context 擴充**                | 每 task card 加 why / wait / ship-by 三欄                                          | 解決「這 task 到底為什麼重要」的 why gap   |
| **3. Empty state + Hero「你可以做」卡** | 新用戶友善 + 現有用戶看到 suggested action                                         | 解決 onboard + 降低「進來看一眼就走」風險  |

---

## 跟 Codex 技術 audit 的分工

| 面向             | Codex 做什麼                          | Claude（我）做什麼              |
| ---------------- | ------------------------------------- | ------------------------------- |
| **實作**         | server.mjs + dashboard HTML 碼        | 不做                            |
| **技術優化**     | Mac dispatch sync、tooltip、WebSocket | 不做                            |
| **產品機能設計** | 按 spec 做                            | ✅ 提議 7 個 product gap        |
| **設計細節**     | 執行 token                            | ✅ 提議 7 個 design improvement |
| **功能優先序**   | 不判斷                                | ✅ Top 3                        |

Codex 已派（`br7x7bmhp`）在做**技術層** optimization（sync + tooltip）。本 review 當**Round 2 產品視角 brief**，等 br7x7bmhp ship 完再 dispatch 我這 Top 3。

---

## 下一步

1. 等 `br7x7bmhp` 完（技術優化 ship）
2. 派 Codex Round 5：**實作本 review Top 3**（CONSENSUS tab + Task context 擴充 + Empty state）
3. 同時持倉看板 styleguide mockup 完 → 你挑 → 派 ship
4. infra-03 VM orchestrator 依序做

本輪 review 寫給用戶醒來看，也作為 Round 5 的設計 brief。
