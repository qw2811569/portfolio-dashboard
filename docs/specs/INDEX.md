# Specs 索引

**用途**：實作 contract（要做什麼 · 怎麼做）· spec 落地後不擅自改，要改要寫新 spec 標 supersede。
**Updated**：2026-04-28

## 命名規則

```
docs/specs/YYYY-MM-DD-<topic>.md
```

per `docs/audits/INDEX.md` 整體 doc 規則表。

## 現有 specs

| Spec                                                                             | 日期       | 狀態         | 摘要                                                                                             |
| -------------------------------------------------------------------------------- | ---------- | ------------ | ------------------------------------------------------------------------------------------------ |
| [2026-04-18-portfolio-dashboard-sa.md](./2026-04-18-portfolio-dashboard-sa.md)   | 2026-04-18 | 🟢 canonical | 持倉看板 System Analysis · 9 tab + 6 route page 主架構 · PM / Stakeholder 視角                   |
| [2026-04-18-portfolio-dashboard-sd.md](./2026-04-18-portfolio-dashboard-sd.md)   | 2026-04-18 | 🟢 canonical | 持倉看板 System Design · 元件 / state owner map · Engineer / Designer / QA 視角                  |
| [2026-04-28-dashboard-redesign-spec.md](./2026-04-28-dashboard-redesign-spec.md) | 2026-04-28 | 🟡 草案      | 持倉看板互動介面重設計（Round 1-20 multi-LLM 研究 · 主入口 `docs/research/dashboard-redesign/`） |

## 相關 publish mirror

`docs/portfolio-spec-report/` 是 SA + SD 的 publish output（HTML + asset），source 仍是這 dir 的 .md。

## 跟其他類別的差別

- **Spec**: 要做什麼 / 怎麼做 · implement contract
- **Decision**: 為何選 A 不選 B · 產品策略 / 架構選擇
- **SA / SD vs spec-report**: SA/SD 是 source，spec-report/ 是 publish 渲染（不直接編輯 publish 端）

## 開新 spec 前必做

per `claude.md` 規則：

1. `ls docs/specs/ docs/plans/` 列現有
2. `grep -l "<核心名詞>" docs/specs/` 搜相關主題
3. 寫新 spec 前必先引用既有設計（「此 feature 已在 YYYY-MM-DD 設計文件」）
4. 逐頁掃 mockup PNG · 描述 implied behavior
5. Scope 章節寫完後自問：「repo 既有 docs/specs/ + docs/plans/ + 每張 mockup 還有哪些主 feature / 互動 pattern 我沒列？」
