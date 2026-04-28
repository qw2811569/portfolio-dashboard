# R142+ Next Wave

更新基準：`509c3df`

## 🔴 Ship blocker（必修 / 先決策）

- 決定 `Q06` / `M-U3` 的驗收真相。現在 manual iPhone gate 與「Playwright 模擬真人、不派用戶驗」同時存在，signoff 永遠會卡在半綠。
- 完成 R141 #3：Holdings multi-level filter + detail pane。這不是新想法，是 R6.10 / SA §5.4 / `CLAUDE.md` R7.5 連續漏提後留下的正式 scope debt。
- 刷新 release/signoff truth 到當前 branch。`internal-beta-signoff.md`、`internal-beta-v1.md`、`cross-browser-matrix.md` 仍停在 `ab20a48` / `b8eb2ec` 敘事，且還把 `UX-25-bug-4` 寫成 blocked。
- 決定 route-shell contract。若 route shell 仍對外可達，就不能一邊寫「migration-only / limited」，一邊保留 trade live-write 例外與 error-boundary 差異。

## 🟡 Follow-up（這輪可做 / 小於 2 hr）

- docs-only 收口：
  - 更新 `internal-beta-signoff.md` 的 candidate SHA、`UX-25-bug-4` 狀態、manual rows 描述
  - 更新 `internal-beta-v1.md` 的 candidate / pending local / R141 status
  - 更新 `cross-browser-matrix.md` 的 stale gap 列
- `tw-events-worker` failure marker call shape。這是 Gemini R8 audit 留下的 isolated backend follow-up，不碰 UI，不和 R141 surface 衝突。
- 補 `Hostile QA` disposition appendix，把原 open bug 與後續 fixed / no current repro 對齊，避免再被重派。
- 若只想做最小技術債，可在 R141 #3 之前先做 docs-only `route-shell contract note`，明寫 trade write 是例外而非假裝不存在。

## 🟢 Backlog（記住，但不要在這輪散開）

- UX-26 follow-up 三件：holdings wrapper dedupe、route-state parity audit、route error-boundary parity audit。
- Gemini R7 blindspot rerun（quota 恢復後跑 Gemini 2.5 flash 即可）。
- Gemini R8 後續 theoretical blob races：
  - `daily-events/latest.json` single-owner / `ifMatch`
  - `telemetry-events.json`
  - `analysis-history-index.json`
  - `research-index.json`
  - monthly NDJSON pseudo-append
- Deploy-time promotion gate：明確防 preview token / preview env 觸 prod bridge。
- `UX-29` X1-X5 unified anxiety indicators panel。先定義最小 cohesive slice，再決定是否升 P1。
- 真正 screenshot-diff / pixel-alarm CI gate。這條是 dogfood discipline，不是當前熱修。
- R121 recurring ops 的月度 restore rehearsal 證據化，當 recurring duty，不再包裝成一次性 done。

## 建議執行順序

1. 先做 docs truth cleanup，因為這是最低風險、最高減少誤判的項。
2. 同步拍板 `Q06` 真相與 route-shell contract，兩者不先定，後面每份 signoff / QA 文件都會繼續互相打架。
3. 再開 R141 #3 正式 brief，明拆 `filter bar` 與 `detail pane` 兩段，避免 2.5 天 scope 一次爆開。
