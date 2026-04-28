# Decision · 持倉看板互動介面重設計（Round 19）

**主入口（spec）**：[`../specs/2026-04-28-dashboard-redesign-spec.md`](../specs/2026-04-28-dashboard-redesign-spec.md)
**研究脈絡**：[`../research/dashboard-redesign/INDEX.md`](../research/dashboard-redesign/INDEX.md) ｜ [`MISSION.md`](../research/dashboard-redesign/MISSION.md)
**Round notes**：[`../research/dashboard-redesign/rounds/discussion.md`](../research/dashboard-redesign/rounds/discussion.md)

**狀態**：🟡 草案 · 待用戶拍板（2026-04-28）

---

## 拍板

1. ✅ 採納 5 條 design principle（[MISSION.md](../research/dashboard-redesign/MISSION.md)）為**未來所有 dashboard 互動 PR 的紀律**
2. ✅ 採納 Codex Round 11 strategic warning：**Inside-out（contract → pattern）**而非 outside-in
3. ✅ 三大 anchor 不變：HoldingDossier / AccuracyGate / OperatingContext
4. ✅ Pattern 工具庫：A-FF 共 29 個，每個 pattern 有 ref 證據 + 既有元件 grep 證據
5. ✅ 6 route page 配方：每頁 spec 含 Layer 1/2/3 結構
6. ✅ 動效：12 個 canonical 動效 + 紀律（每頁 ≥3 / ≤5 並發 / 尊重 reduced-motion）
7. ✅ Typography Scale + Color Discipline 必新增 design token
8. ✅ Web 加左 sidebar / Mobile 不重開 9-tab

---

## 不重開的舊 decision

- [`./2026-04-18-portfolio-dashboard-sa.md`](../specs/2026-04-18-portfolio-dashboard-sa.md) — 9 tab + 6 route
- [`./2026-04-24-mobile-sticky-policy.md`](./2026-04-24-mobile-sticky-policy.md) — Mobile sticky
- [`./2026-04-26-motion-relax.md`](./2026-04-26-motion-relax.md) — 動畫禁令撤銷
- [`./2026-04-16-naming-portfolio-vs-agent-bridge.md`](./2026-04-16-naming-portfolio-vs-agent-bridge.md) — 命名

---

## 修正過的舊判斷（Codex Round 11）

| 修正                                           | 理由                                          |
| ---------------------------------------------- | --------------------------------------------- |
| Overview 不放 News + ticker chip               | 違反 News/Events 分流 spec sa.md:393          |
| 收盤分析不套 Time-Period Segmented `1H/1D/...` | 違反「盤後 single ritual」spec sa.md:490      |
| Overview #3 散戶教學從 ✅✅ 升 ✅✅✅          | 既有 helper copy 已實作（DashboardPanel:512） |
| 收盤分析 #5 動畫從 ✅✅ 降 ✅                  | 既有只有 view-state，非 motion                |

---

## 實作優先級摘要

| Tier | Sprint count | 範圍                                               |
| ---- | ------------ | -------------------------------------------------- |
| P0   | 1-2          | W / L / BB / EE — 既有元件 polish                  |
| P1   | 2-3          | H / Q / X / AA+DD / FF — 部分擴充                  |
| P2   | 3-4          | C / RitualStepStrip / J / P / Z / Y / S — 全新元件 |

---

## 變更紀錄

| 日期       | 變更                                | by     |
| ---------- | ----------------------------------- | ------ |
| 2026-04-28 | Round 19 decision 草案 · 待用戶拍板 | Claude |
