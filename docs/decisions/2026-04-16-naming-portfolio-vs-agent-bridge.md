# 命名規則：持倉看板 vs Agent Bridge

**日期**：2026-04-16
**用戶指示**：

> 「以後持倉看板就用中文持倉看板，dashboard 就叫 agent bridge」

## 決議

### 持倉看板 (Portfolio Dashboard) — 用戶面產品

- **只用中文「持倉看板」**
- **不講** 「dashboard」、「portfolio dashboard」、「Vercel dashboard」、「前端 app」
- **URL**：https://jiucaivoice-dashboard.vercel.app/
- **技術棧**：Vercel + React + `src/components/*`
- **用戶對象**：投資人（付費用戶未來）
- **定位**：持倉管理 + 研究 + 事件追蹤 + AI 分析

### Agent Bridge — LLM 協作 / 開發者面板

- **只叫「Agent Bridge」**（英文保留，這是專有名詞）
- **不講** 「dashboard」、「VM dashboard」、「交接面板」、「admin panel」
- **URL**：https://35.236.155.62.sslip.io/
- **技術棧**：VM + `agent-bridge-standalone/dashboard/index.html`
- **用戶對象**：你（開發者）+ LLM（Codex / Qwen / Gemini 狀態）
- **定位**：LLM 派工 + session live feed + task queue + consensus round

## 禁用語

❌ 「dashboard」單字（太 ambiguous）— 必須講完整名稱
❌ 「VM dashboard」/「portfolio dashboard」（英中混雜）
❌ 「LLM 交接面板」(too generic)

## 適用範圍

- Claude 所有回覆
- Codex / Qwen / Gemini 的 brief
- Commit message
- docs 所有新寫的文件
- `CLAUDE.md` 與其他仍存活的 repo 規則文件
- project-status.json / agent-bridge-tasks.json

## 既有文件不追溯

老 commit / 舊 decision 文件保留原名不改。只新寫的文件對齊。

## 快速對照

| 你講             | 意思                          |
| ---------------- | ----------------------------- |
| 「持倉看板」     | Vercel 側產品                 |
| 「Agent Bridge」 | VM 側 LLM 面板                |
| 「VM」           | 基礎設施層，包含 Agent Bridge |
| 「Vercel」       | 基礎設施層，serve 持倉看板    |
