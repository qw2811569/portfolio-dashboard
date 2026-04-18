# Internal Beta Invite + Feedback Flow

Status: `pending-signoff`

## Ship 前提

- `docs/release/internal-beta-signoff.md` 已由 owner 勾完並簽署。
- `node scripts/full-smoke.mjs` 已全綠。
- `docs/release/demo-path.md` 已走完一次且 evidence 完整。

## 邀請包

- release note / Google Doc: `<填入 Google Doc 連結>`
- invite letter final copy: `<填入 Google Doc 連結>`
- feedback form: `<填入 Google Form 連結>`
- Agent Bridge feedback URL: `https://35.236.155.62.sslip.io/agent-bridge/dashboard/`

## 董座邀請信 Template

主旨：
`九財 Voice internal beta 邀請 · 請走 5-8 分鐘 demo path`

內文：

```text
您好，

這一版是 internal beta，只供小範圍試用與回饋，不屬正式上線版本。

建議您先依這份 golden path 走一次：
docs/release/demo-path.md

本輪重點：
1. 持倉看板是否能快速看懂
2. 研究 / 情報脈絡 / 收盤分析是否有幫助
3. 上傳成交與交易日誌是否足夠順手

若遇到問題，請直接用下列任一方式回饋：
- Google Form：<填入連結>
- Agent Bridge dashboard 留言：<填入連結>

謝謝。
```

## 回饋收集方式

### A. Google Form

建議欄位：

- 使用日期 / 時間
- 使用裝置
- 走到哪一步
- 預期看到什麼
- 實際看到什麼
- 嚴重度：`critical / high / medium / low`
- 是否可重現
- 截圖 / 錄影連結

### B. Agent Bridge dashboard 留言

- 適合快速留言、追問、補上下文。
- owner 可要求回報格式固定為：

```text
[beta-feedback]
step=
route=
expected=
actual=
severity=
evidence=
```

## Bug Report Path

- 使用 Agent Bridge dashboard 留言。
- feedback 會進 `coordination/llm-bus/feedback.jsonl`。
- 一律要求帶：
  - `step`
  - `route`
  - `severity`
  - `expected`
  - `actual`
  - `evidence path`

## 每週 Retro

由 owner 決定節奏：

- `weekly`
- `biweekly`
- `ad-hoc only`

建議預設：`weekly`

Retro 最小議程：

- 本週 demo / feedback 數
- top 3 friction
- 是否影響下一輪 invite scope
- 是否需要 halt / rollback

## Owner 執行順序

1. 填入 Google Doc / Google Form 連結。
2. 用 invite letter 發第一封 internal beta 邀請。
3. 指定唯一回饋入口，避免訊息散在 chat / email。
4. 每週固定整理一次 `feedback.jsonl` 與表單回覆。
5. 若出現 critical bug，立即停止新邀請並回到 signoff doc 判定是否 halt。
