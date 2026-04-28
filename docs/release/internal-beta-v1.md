# Internal Beta v1 · Release Note

**版本**：`1.0.0` internal beta
**Candidate SHA**：`509c3df`（current committed HEAD）
**Candidate note**：包含 `f94e77d`（UX-25-bug-4）、`3b2584d`（markdown render）、`509c3df`（thesis empty hide）
**日期**：2026-04-24
**來源依據**：SA §2.2 五條驗收標準 · `internal-beta-checklist.md` · `internal-beta-signoff.md`

---

## 1 · 這一版要解什麼問題

依 SA §2.2 五條驗收標準：

1. **分析要準 · 不幻覺** — Accuracy Gate（T38 · `src/lib/prompt/accuracyGate`）+ contract strict parse（R120 Q-D1）+ FinMind `319 call-method-error` 修（T27）
2. **視覺要美 · 有節制** — SD 1.1/1.4/1.6 canonical palette / typography / spacing 全面落地（UX-01~20）
3. **使用後冷靜 · 非焦躁** — 砍首屏命令 banner 換軟語（UX-04）· loading skeleton + empty state（UX-15）· 錯誤 UI 非 silent fail（UX-09）
4. **每頁指向下一步** — thesis drill pane（UX-05）· daily diff control（UX-17）· compliance note top banner（UX-10）
5. **同時服務技術型 + 高階 stakeholder** — viewMode contract 分流 retail / insider-compressed（UX-06）· persona fixture 對齊（UX-16）· raw id 隱藏（UX-07）

---

## 2 · Highlights（21 件 UX + 基建）

### UX 層（UX-01a ~ UX-21）

- **Token pipeline canonical**（UX-01a）：`src/theme.generated.js` 乾淨 SD 1.1/1.4/1.6
- **AA contrast 修 ~280 處**（UX-03）：正文只用 ink/charcoal · 彩色僅做 border/fill
- **首屏軟語 headline**（UX-04）：依 `dashboardHeadline.js` 依持股狀態產生
- **Holdings drill pane**（UX-05）：thesis / pillar dots / valuation band（R132a）/ freshness / missing-data 軟語
- **viewMode contract**（UX-06）：`owner | retail | insider-compressed` · SA §6.10 合規落地
- **Raw id 隱藏**（UX-07）：`portfolioDisplay.js` canonical label
- **iPhone 44×44 HIG**（UX-08）：touch target 69 fail → <10
- **錯誤 UI**（UX-09）：`DataError.jsx` shared error state
- **Spacing / typography scale 清**（UX-11 · UX-12）：155 off-scale → 0
- **NewsPanel 合併 canonical**（UX-13）：砍 PAPER 子系統
- **Focus ring WCAG 2.1 AA**（UX-14）
- **Loading skeleton + empty state**（UX-15）：`Skeleton.jsx` + `EmptyState.jsx`
- **Persona fixture contract**（UX-16）：`persona-canonical.json` · drift = 0
- **Daily t0/t1 diff control**（UX-17）：always-visible toggle
- **Tab IA 重命名**（UX-18）：催化驗證→事件追蹤 · 情報脈絡→新聞聚合
- **Hero shareability polish**（UX-19）：display clamp 36-56 · hero 56-76
- **Secondary panel scale**（UX-20）：CmdK / Dialogs / Toast 對齊
- **Mobile sticky shrink**（UX-21）：iPhone sticky 339→99px · `useIsMobile` hook

### 基建 / 決策層

- **R120 scope batch**（`2026-04-24-r120-scope-batch.md`）：15 題 contract / scope / infra 一次拍板
- **R131 canonical theme consolidation + CI gate**
- **R132a P/E band valuation engine MVP**
- **R133 tracked-stocks live sync**
- **R134c Blob private migration**
- **R137/R138 repo hygiene**：25 commit push Vercel + history rewrite 省 301 MB
- **Mobile sticky policy**（`2026-04-24-mobile-sticky-policy.md`）：ship 後紀律
- **Facade alias freeze**（C1a · pre-commit gate · 防新 consumer）

---

## 3 · 已知限制 / 延後（明文列）

依 R120 decision 延後 · 不 block ship：

- Secret rotation（Q-I1）· 正式產品上線前不啟動
- Weekly export email channel（Q-P2）· 內部 beta 用 clipboard + markdown/html
- Today in Markets v2 美股/匯率/commodity（Q-P3）· v1 只 TW
- Daily Principle share image（Q-P4）· 只 copy
- Persona 完整 reasoning trace 露出（Q-D5）· 只分數+簡短理由

依 R139 decision 延後：

- UX-22b NewsPanel polish（chip / notice / filter ergonomics）
- UX-01b/c/d/e facade alias consumer migration（C1b/c · 29 檔 / 215 hit）
- ~~`sync-to-vm-root --mirror-vercel` flag（C3 · 等第二次 hash 漂移再開）~~ **取消**（2026-04-28 Vercel disconnect 後沒 hash 可漂移 · flag 失效）
- Recurring Ops Overlay（R121 §11）· cron + monthly restore rehearsal ship 後排
- R141 #3 Holdings multi-level filter + detail pane（R6.10 / SA §5.4 carry-over）

---

## 4 · 驗收依據

### Ship-Before 30 條（`internal-beta-checklist.md`）

- ✅ done: 25 / 30
- 🟡 deferred-per-decision: 1 · `T48` rotate secret（依 R120 Q-I1）
- 🔴 blocked: `T64` · `M04` · `M09`（ship 後收口 · 不 block ship）
- 🟡 pending-signoff: `T72b`（本檔收口）

### 跨瀏覽器矩陣

見 `docs/qa/cross-browser-matrix.md`（L8-d 已建；內容仍需跟 current HEAD 同步刷新）。

### 真機 smoke

見 `.tmp/m-u3-iphone-smoke/findings.md`（已有 emulation evidence；是否仍要求 owner 真機 smoke 待 `Q06` decision）。

### Restore drill

見 `docs/runbooks/restore-drill.md`（L8-e 已建；monthly evidence cadence 仍待累積）。

---

## 5 · Rollback Plan

若 ship 後有 critical regression：

### 5.1 Git 層

- Anchor 分支：`backup/pre-r138-20260424-011724`（c0d92c6）· 保留至 2026-05-01 觀察期
- Force push 回 anchor：`git push --force-with-lease origin backup/pre-r138-20260424-011724:main`
- 預計時間：< 5 min

### 5.2 Asset 層

- jcv-dev VM（你 dev · `104.199.144.170`）：SSH 進 VM · `cd /var/www/app` · `current` symlink 切回前一個 `releases/<prev-stamp>`（atomic rollback · 不需 rebuild）
- bigstock VM（夥伴 dev · `35.236.155.62`）：同樣 atomic symlink 切回 prev release
- Vercel cold backup：~~已 disconnect 2026-04-28~~。若日後 cold backup 啟用，手動 `vercel deploy --prebuilt` 推預建 dist
- 重新 build 才能修：從 `backup/pre-r138-*` 本機 build → 推到目標 VM 走 webhook 或手動 `scripts/sync-to-vm-root.mjs`

### 5.3 Data 層

- Private Blob snapshot：依 `docs/runbooks/restore-drill.md` 選 daily 03:00 snapshot · 套回
- localStorage：用戶端清 + re-import `checkpoint`（T62）

### 5.4 決策點

- 退版前必須 Claude / Codex / owner 三方同步確認非「snapshot 無法推進」的 transient 問題
- rollback 完後須 append evidence 到 `docs/runbooks/restore-drill-log.md`

---

## 6 · Release Candidate SHA → Production SHA

| Stage     | SHA       | 描述                                               |
| --------- | --------- | -------------------------------------------------- |
| Candidate | `509c3df` | current committed HEAD · 含 `f94e77d` + R141 #1/#2 |
| Previous  | `ab20a48` | origin/main post-R137+R138 · 保留 audit trace      |
| Anchor    | `c0d92c6` | backup/pre-r138-20260424-011724 · rollback target  |

若 signoff 前再有新 commit，需更新 Candidate SHA。

---

## 7 · Signoff 要求

見 `docs/release/internal-beta-signoff.md`：

- owner signoff 簽名 + 日期
- legal 四欄（disclaimer / privacy-lite / data residency / audit）
- demo evidence bundle（附 M-U3 screenshots）
- invite-feedback-flow Google Doc / Form 連結（M-U4 · 用戶手動）

---

## 8 · 產出物清單

```
docs/
├── decisions/
│   ├── 2026-04-24-r120-scope-batch.md
│   └── 2026-04-24-mobile-sticky-policy.md
├── qa/
│   └── cross-browser-matrix.md              (L8-d)
├── runbooks/
│   └── restore-drill.md                     (L8-e)
└── release/
    ├── internal-beta-v1.md                  (this)
    ├── internal-beta-signoff.md             (L8-g update)
    ├── internal-beta-checklist.md
    ├── demo-path.md
    └── invite-feedback-flow.md              (M-U4 · 用戶手動)
```
