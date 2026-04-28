# Research 索引

**用途**：探索類資料（市場、設計、技術調研）· 不是 spec / decision · 是寫 spec 前的素材。
**Updated**：2026-04-28（R32 R12 補建）

## 命名規則

```
docs/research/<topic>.md
docs/research/<topic>/INDEX.md  # 大型研究帶 INDEX
```

不用日期前綴 · research 是「持續累積的素材」。

## 根目錄 research（單檔）

| File                                                                           | 摘要                                                                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| [taiwan-stock-data-sources-v3-deep.md](./taiwan-stock-data-sources-v3-deep.md) | 台股資料源 canonical research（FinMind / Yahoo / Goodinfo / cnyes 等）· 寫 spec 前必讀                                     |
| [vercel-cost-investigation.md](./vercel-cost-investigation.md)                 | Vercel cost root cause（已 supersede by `docs/decisions/2026-04-25-vercel-full-decoupling.md` 全棄 Vercel · 留作歷史脈絡） |

## 大型研究子專案

| Subdir                                                         | 狀態        | 摘要                                                                                                 |
| -------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| [`dashboard-redesign/INDEX.md`](./dashboard-redesign/INDEX.md) | 🟢 R20 完成 | 持倉看板互動介面重設計 · Round 1-20 multi-LLM 研究 · 25 ref · 29 pattern · spec 草案在 `docs/specs/` |

## 跟 specs/ + decisions/ 的差別

- **Research**: 探索 · 開放結尾 · 不一定有 action
- **Decision**: 拍板 · 為何做 X 不做 Y
- **Spec**: 要做什麼 / 怎麼做 · implement contract

一輪 research 跑完 · 收斂的部分寫成 decision + spec · research 文檔留作素材庫。

## 開新 Research 前必做

1. 先 grep 這份 INDEX · 看相同主題已有沒有
2. 大型 research（多 round / 多 ref）→ 開 subdir + 自帶 INDEX.md
3. 單篇 research（< 10 KB）→ 直接放 `docs/research/<topic>.md`
4. 收斂後若有產品決定 · 必補 decision 到 `docs/decisions/`
