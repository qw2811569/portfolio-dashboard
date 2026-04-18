# Sage 主題補完 — Header + DashboardPanel + HoldingsTable

**派給**：Codex
**commit base**：40340a0（theme.js + AppShellFrame + Base 已 sage）
**任務**：把 sage tokens 應用到剩下 3 個 UI 檔

## 目標檔（只改這 3 個）

1. `src/components/Header.jsx`
2. `src/components/overview/DashboardPanel.jsx`
3. `src/components/holdings/HoldingsTable.jsx`

## 🚨 絕對禁止（上輪踩雷）

- **不刪檔**（特別是 HoldingsTable.jsx — 上次被刪救回）
- **不重構**（不合併、不拆檔、不改 export）
- **不改 function 邏輯**（只改樣式 token）
- **不改 props / API**

## 允許做的

- 把 hardcoded color 改成 `C.xxx` token 讀（theme.js 已更新）
- 加 `--font-headline` / `--font-num` 到大數字 / 標題
- 邊框顏色用 `C.border`（= `#CFC6B8`）
- 卡片底色用 `C.card`（= bone `#F4EFE6`）
- 漲跌色用 `C.up`（sage green）/ `C.down`（clay red）

## 原則

> **最小變更**。先改樣式 token，非必要不碰結構生命週期。

## 驗收

```bash
npm run build  # clean
npm run test:run tests/components/AppPanels.contexts.test.jsx  # 綠
```

改完手動 commit：`style(持倉看板): apply sage tokens to header + dashboard + holdings table`

## 反駁 Claude

- 如果某檔現在 hardcoded color 太多改不完，**只改最 visible 的 top 5 行**，其他留註解 TODO
- 如果 HoldingsTable 某行邏輯需要搬動才能套 sage，**停下來先說，不動手**
