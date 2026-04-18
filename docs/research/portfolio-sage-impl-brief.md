# 持倉看板 Ship 新美學 — Calm Sage + Bone（用戶拍板通過）

**派給**：Codex
**日期**：2026-04-16
**用戶**：「持倉看板跟 agent bridge 的新版設計都可以用」✅

## 任務

**覆寫 bb388b1（深夜底 + 粉藍 neon）→ 新 calm sage + bone 美學**

Spec 來源：`.tmp/portfolio-styleguide-v2/round2-spec.md`
Mockup 參考：`design-mockups/portfolio-styleguide-v2-2026-04-16/index.html`

## Design tokens（最終版，直接用）

```css
:root {
  --ink: #202823;
  --bone: #eee7db;
  --bone-soft: #f4efe6;
  --line: #cfc6b8;
  --muted: #6f746b;
  --sage: #a8b59a;
  --sage-soft: #c4ceb5;
  --up: #6f8568;
  --down: #b65a4d;
  --warning: #b9853e;
  --danger: #b65a4d;
  --font-headline: 'Source Serif 4', 'Noto Serif TC', serif;
  --font-body: 'Source Sans 3', 'Noto Sans TC', sans-serif;
  --font-num: 'Source Serif 4', 'IBM Plex Mono', serif;
  --inset-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  --tactile-shadow: 0 1px 0 rgba(32, 40, 35, 0.06);
  --ease: 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

## 字體 Google Fonts

```html
<link
  href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&family=Source+Sans+3:wght@400;500;600&family=Noto+Serif+TC:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

## 改哪些檔

| 檔案                                         | 改什麼                                          |
| -------------------------------------------- | ----------------------------------------------- |
| `src/theme.js`                               | 整組 palette tokens 覆寫                        |
| `src/components/AppShellFrame.jsx`           | font import + body style                        |
| `src/components/Header.jsx`                  | tab bar + header bar 色                         |
| `src/components/common/Base.jsx`             | Card / SectionHeader / EmptyState / Button 語言 |
| `src/components/holdings/HoldingsTable.jsx`  | 表格列 + 數字字體 + 漲跌色                      |
| `src/components/overview/DashboardPanel.jsx` | KPI 卡 + hero summary                           |

## 跟 Agent Bridge 家族感

- **共用**：bone 底 + ink 字 + line 分隔 + Source Serif 4 headline
- **分家**：Agent Bridge accent = 赤陶 `#B85C38` / 持倉看板 accent = sage `#A8B59A`

## 禁止

- ❌ NO gradient / glow / blur / scanline / VHS
- ❌ NO neon（bb388b1 的 `#6FD6FF` 粉藍全砍）
- ❌ 不超過 4 font family load
- ❌ 不碰 Agent Bridge（`agent-bridge-standalone/`）

## Paper grain（optional, 極微）

```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url('data:image/svg+xml,...'); /* subtle noise */
  opacity: 0.04;
  z-index: 0;
}
```

先做，覺得擠視覺就砍。

## 驗收

```bash
npm run test:run  # 全綠（白話化 drift 要同步改 test）
npm run build     # clean
npm run lint      # clean
```

截圖 3 張存 `design-mockups/portfolio-sage-shipped/`：

- `01-overview.png`
- `02-holdings.png`
- `03-research.png`

比對 mockup 跟 live — 氣質要一致。

## 不做

- ❌ 不改 Agent Bridge
- ❌ 不加 filter bar（Phase 1 另一 round）
- ❌ 不改後端
- ❌ 不 `--no-verify`

## 回報

```
done:
changed files:
test: N passed
screenshot paths:
我反駁 Claude 的地方:
```
