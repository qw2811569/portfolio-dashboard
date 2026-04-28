# Internal Beta Demo Path

Status: `pending-signoff`

- primary URL: `http://104.199.144.170/`（jcv-dev VM · 2026-04-28 切離 Vercel hosting）
- alt URL: `https://35.236.155.62.sslip.io/`（bigstock VM · 夥伴 dev env · demo 也可用此台）
- owner context: 小奎 / 金聯成董座
- cust_id: `7865`
- target duration: `5-8 min`
- ship rule: 任一步驟失敗即停止 demo，不繼續往下演

## Preflight

- 先確認 `node scripts/full-smoke.mjs` 已全綠。
- 準備一個 demo CSV；若沒有現成檔案，改用 `上傳成交` 頁內建的 `手動新增交易` fallback。
- 若前一輪登入狀態不乾淨，先清站點 cookie / local storage，再開始。

## Golden Path

| Step | 操作                                                                                                        | 預期看到什麼                                                                                            | 失敗時 rollback                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1    | 打開 `http://104.199.144.170/`                                                                              | 頁面可載入，沒有白屏；若有 auth gate，能看到登入入口或已登入 session                                    | refresh 一次；仍失敗就停止 demo，截圖存證，回報到 Agent Bridge            |
| 2    | 輸入 `cust_id=7865` 登入；若已是 session 直入，就改做 owner context 確認                                    | owner context 指向金聯成董座 / insider slice；不應掉到錯 portfolio                                      | 清 cookie 後重試一次；還是不對就停止 demo，標記 auth / RBAC blocker       |
| 3    | 進站後第一張先看 `持倉` / `持倉看板`                                                                        | 能看到持股 KPI、今日摘要、資料新鮮度；沒有錯 portfolio 或空殼 fallback                                  | 切回首頁一次；仍異常就回報並停止 demo                                     |
| 4    | 左側 nav 切 `研究`，先看 `深度研究`                                                                         | 可見研究卡、資料補齊中心或風險卡；至少有一張研究主卡，不是空白                                          | refresh 當前 route 一次；仍失敗就回 `持倉`，停止後續研究 demo             |
| 5    | 在 `研究` 群組內切 `情報脈絡`                                                                               | 可見新聞串或 news preview；至少有 headline / list item，不應 500 或 console-facing error                | 回 `研究` 主頁一次；仍空白就停止 demo，標記事件/新聞 blocker              |
| 6    | 切 `收盤分析`；若出現 `收盤快版`，按 `跑資料確認版`，本步視同「送審」                                       | 可看見 `t0-preliminary / 收盤快版` 到 `t1-confirmed / 資料確認版` 的流程；若已是 `資料確認版` 也算 pass | 不要硬重複點；refresh 一次仍失敗就停止 demo，保留當前畫面與時間戳         |
| 7    | 切 `交易日誌`                                                                                               | 能看到既有 log entry；目前此頁以 read-only 為主，用來驗證寫入結果                                       | 若頁面空白或資料錯亂，先記錄 evidence，不在這頁嘗試修復                   |
| 8    | 切 `上傳成交`，先試 drag demo CSV；若沒有 demo CSV，直接用 `手動新增交易` 建一筆，再按 `跳過備忘，直接寫入` | 有拖曳區、可 parse / 建立待寫入交易；寫入後回 `交易日誌` 能看到新 entry                                 | 若 parse / write 失敗，停止 demo，不要重複寫入；截圖並回報到 Agent Bridge |
| 9    | 結束時 logout；若此 build 沒有顯性 logout button，就清 cookie / local storage 後關頁                        | session 可以明確結束，不把 owner session 留在展示裝置上                                                 | 若無法退出，就手動清站點資料，並記錄為 signoff 備註                       |

## Step 6 備註：t0 / t1 判讀

- `收盤快版` = `t0-preliminary`
- `資料確認版` = `t1-confirmed`
- 若頁面顯示系統正在自動補跑確認版，也算 pass，但需截圖留下 evidence

## Step 7-8 備註：交易日誌與手動記錄

- 目前「手動記一筆」實作位於 `上傳成交` route 的 `手動新增交易` 卡，不在 `交易日誌` route 直接編輯。
- ship gate demo 以「在 `上傳成交` 手動新增一筆，接著在 `交易日誌` 看得到」作為同等驗收。

## Demo 結束後要留下的 evidence

- holdings 首屏
- research 或 news 任一成功畫面
- daily `收盤快版` / `資料確認版` 畫面
- trade write 成功後的 `交易日誌`
- logout 或清 session 完成證據

## Halt 條件

- 任一步驟遇到 `401` / `403` / 白屏 / 寫入錯誤。
- insider `7865` 出現推進買賣語氣。
- 交易寫入成功但 `交易日誌` 看不到。
- step 6 無法說清楚目前是 `t0` 還是 `t1`。
