# Vercel Build Minutes 成本調查 — $43/週太貴

> 最新執行規則已收斂到 `claude.md` §4「一大輪才 push（不是每個 commit 都 push）」。
> 這份調查保留作為原因追查與成本證據；若要看當前 action，先讀 `claude.md`、`docs/CANONICAL-INDEX.md`，再進對應 current decision / audit。

用戶回報 Vercel Build Minutes 一週花 $43 美金。調查為什麼 + 怎麼降。

## 要做

1. 查 Vercel build 頻率：`npx vercel ls jiucaivoice-dashboard | head -30` 看最近 7 天幾次 build
2. 查每次 build 時間：成功的 build 幾秒？Cancel 的算不算 build minutes？
3. 查 ignoreCommand 是否真的在擋不必要 build（commit 68ed3cd 修過 shallow clone bug）
4. 查是不是 push 太頻繁導致重複 build（本 session 20+ commits）
5. 建議優化方案：batch commit / 減少 push 頻率 / 改 ignoreCommand 更嚴格 / 或 Vercel 降 Hobby

## 回報

- 最近 7 天 build 次數
- 成功 vs canceled vs error 比例
- 每次 build 秒數
- 總 build minutes 估算
- Top 3 省錢建議
