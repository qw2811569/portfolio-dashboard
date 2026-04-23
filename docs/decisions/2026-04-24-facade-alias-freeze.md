# Facade Alias Freeze · 2026-04-24

**日期**：2026-04-24
**狀態**：✅ 決議
**來源**：R139 Round 2 Q5
**延續**：`docs/decisions/2026-04-24-r120-scope-batch.md`

## 背景

`src/theme.js` 仍保留 SD 1.0 時代的 facade alias，包含 `blue / olive / teal / cyan / fillPrimary / blueBg / oliveBg / tealBg`。UX-01a 已把 theme token pipeline 對齊 canonical，但 consumer 端仍有約 29 檔 / 215 hit 依賴這批 alias。

這批 legacy consumer 暫時不硬砍，避免一次性重寫擴大風險；但從 2026-04-24 起，**不允許新增 consumer**，否則後續 UX-01b/c/d/e 的拆除成本會持續上升。

## 決議

### Freeze 範圍

以下 facade alias 視為 frozen，不得新增 consumer：

- `C.blue`
- `C.olive`
- `C.teal`
- `C.cyan`
- `C.fillPrimary`
- `C.blueBg`
- `C.oliveBg`
- `C.tealBg`

### Enforcement

- `scripts/check-facade-alias.mjs` 會掃 staged diff 的新增行，阻擋新的 frozen alias consumer。
- `.husky/pre-commit` 直接執行 staged gate，commit 前就會 fail。
- `npm run verify:local` 也會執行同一支腳本：local 會補抓 staged/unstaged/untracked；CI 環境則再加掃 `origin/main...HEAD` 的新增 consumer。
- `src/theme.js` 與 `src/theme.generated.js` 本身不在 gate 掃描範圍內，避免碰到 alias 定義檔或 generated artifact 自己。

### 例外條款

若某一行因 legacy-consistency 原因必須暫時保留 frozen alias，允許同一行加：

```js
// facade-alias-exception: reason
```

沒有 inline reason 的新增 alias 一律視為違規。

### Canonical 替代方向

新增 consumer 應改用 canonical semantics，不再引入 facade alias。優先選用：

- `C.up` / `C.down`
- `C.amber` / `C.orange`
- 需要更底層 token 時，直接回到 `src/theme.generated.js` 的 `TOKENS.*`

## 移除時程

- `UX-01b`：先處理最常改、最容易繼續擴散的 panel consumer
- `UX-01c`：清掉 shared/base layer 的 alias surface
- `UX-01d`：掃尾 remaining route/panel consumer
- `UX-01e`：確認 repo 歸零後，正式刪除 `src/theme.js` facade alias 定義

在 `UX-01e` 之前，既有 consumer 可以分批遷移，但不得新增新的依賴面。

## Grep

核心 alias inventory：

```bash
git grep 'C\.(blue|olive|teal|cyan|fillPrimary)' src/
```

完整 frozen scope：

```bash
git grep 'C\.(blue|olive|teal|cyan|fillPrimary|blueBg|oliveBg|tealBg)' src/
```
