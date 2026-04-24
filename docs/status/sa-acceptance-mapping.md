# SA §2.2 五條驗收標準 · Commit Mapping

**用途**：Gemini R7 指出 SA §2.2 5 條驗收標準雖由個別 commit 實作 · 但沒明文追蹤對應關係。本檔補上每條 → 實作 commit 的 traceability · 給 signoff 用。

**最後更新**：2026-04-24（R141 收口 · 60+ commits ahead of origin）

---

## 驗收標準 1 · 分析要準 · 不可以把資料幻覺包裝成語氣自信

| 實作                              | Commit                                                        | 機制                                                              |
| --------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Accuracy Gate `T38`               | 既有 · `src/lib/prompt/accuracyGate`                          | 5 條 gate：citation / dossier / confidence / insider / self-check |
| Contract strict reject（Q-D1）    | R120 decision `docs/decisions/2026-04-24-r120-scope-batch.md` | Zod strict mode · fail-closed · 不 coerce 壞資料                  |
| FinMind 319 call-method-error 修  | `T27` earlier                                                 | 資料品質底線                                                      |
| Accuracy Gate hard-block UX（B7） | `3f255d5`                                                     | Fail UI 不顯 placeholder · 顯 explicit reason                     |
| FinMind degraded UX（UX-28）      | `a06e809`                                                     | 3x retry · classify（timeout/quota）· Blob last-good fallback     |
| Markdown leak fix（R141 #1）      | `3b2584d`                                                     | AI 輸出 render 安全 · 不漏原始 markdown symbol                    |

**Verdict**：✅ covered

---

## 驗收標準 2 · 視覺要美 · 有品味有節制可久看

| 實作                                | Commit                        | 機制                                            |
| ----------------------------------- | ----------------------------- | ----------------------------------------------- |
| SD 1.1/1.3/1.4/1.6 canonical tokens | UX-01a `0f4233b` · C1a/b/c    | Palette / typography / spacing 全面 canonical   |
| AA contrast 280 處修                | UX-03 `243c70b`               | ink/charcoal 正文 · 彩色僅 border/fill          |
| 首屏軟語 headline（不再命令）       | UX-04 `46b6b91`               | `dashboardHeadline.js` 依持股狀態生成           |
| Hero shareability polish            | UX-19 `e4052f4`               | display clamp 36-56 / hero 56-76 / tabular-nums |
| Facade alias freeze + migration     | C1a/b/c `475999c` → `67fa53c` | 153 hit → 0 · 防 palette drift                  |
| Docs mockup refresh SD 1.6          | `ffb3ace`                     | 8 張 PNG 重 render                              |
| a11y color-contrast dashboard 修    | final-QA `7c63114`            | axe critical 清                                 |

**Verdict**：✅ covered

---

## 驗收標準 3 · 使用後冷靜 · 不更焦躁

| 實作                   | Commit                                  | 機制                                              |
| ---------------------- | --------------------------------------- | ------------------------------------------------- |
| 砍命令 banner 換軟語   | UX-04 `46b6b91`                         | 「先補齊資料再做深度研究」banner → 軟語 headline  |
| Loading skeleton       | UX-15 `0a473ef`                         | `Skeleton.jsx` bone pulse · 冷 start 不白屏       |
| Empty state onboarding | UX-15 同 commit                         | `EmptyState.jsx` 軟語引導                         |
| 錯誤 UI 非 silent fail | UX-09 `6558f3c` + `DataError.jsx`       | 顯「資料暫無 · 重試 / 之後看」                    |
| Thesis 空狀態不 nag    | R141 #2 `509c3df`                       | 空就整 section 不顯 · 不嘮叨                      |
| 軟語 copy 全面         | `memory/project_soft_language_style.md` | 投資網紅式 · 不命令 · 描述市場 + 籌碼 + 論述 diff |
| 合規 banner 插頂       | UX-10 `56e1107`                         | insider-compressed Daily 頂 banner · 不藏         |
| FinMind degraded UX    | UX-28 `a06e809`                         | 資料慢 / 掛 顯軟語 · 不假裝正常                   |

**Verdict**：✅ covered

---

## 驗收標準 4 · 每一頁都要能指向「下一步」不是停在資訊展示

| 實作                                        | Commit                                   | 機制                                     |
| ------------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Holdings drill pane thesis/pillar/valuation | UX-05 `ac5aa48`                          | 點股展開行動洞察                         |
| Holdings filter chip bar                    | R141b `694bd55`                          | 多層篩選 · 立即行動縮 scope              |
| Holdings detail pane（右側）                | R141c · pending                          | 近 3 日 daily + research + events · 深看 |
| Daily t0/t1 diff control                    | UX-17 `bf245ac` + 7865 fixture `f94e77d` | 展開差異 · 看什麼變了                    |
| Dashboard compare strip（我+金聯成）        | M-VIEW `e535803`                         | 首屏即看對比 · 決定先看哪組合            |
| Dashboard X1-X5 焦慮指標                    | UX-29 `184f94b`                          | 點 X 連相應頁 handoff                    |
| News → Daily handoff                        | UX-25 realUserSim + existing             | 新聞 impact → daily 分析                 |
| Trade preview + confirm + audit             | B2 `4bcede3`                             | 行動前有明確下一步                       |
| Morning Note deep-links                     | B1 `c3acf72`                             | 上游入口 → Events/Holdings/Daily         |

**Verdict**：✅ covered · 部分 R141c pending

---

## 驗收標準 5 · 同時服務技術型操作者 + 審美敏感的高階 stakeholder

| 實作                                                 | Commit                                                             | 機制                          |
| ---------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| viewMode contract（owner/retail/insider-compressed） | UX-06 `1fcf6e7`                                                    | Render layer 分流             |
| Insider rules（7865 董座）                           | UX-10 `56e1107` · B1 insider path · B2 memo · UX-17 insider toggle | 不產買賣建議 · aggregate only |
| Persona fixture canonical                            | UX-16 `dc6a2c7` · UX-25-bug-4 `f94e77d`                            | me + 7865 測試資料對齊        |
| Raw id 隱藏                                          | UX-07 `9b4fc82`                                                    | 董座截圖分享不 debug look     |
| Multi-portfolio switcher                             | existing + UX-23 + UX-27                                           | 快速切 · 記住 last tab        |
| 管理者視圖（全組合）                                 | OverviewPanel + M-VIEW polish + compare strip                      | 跨組合並列可讀                |
| Copy Tone Matrix（顧問 / 編輯 / 同事 / 系統）        | 全面 soft-language adoption                                        | per page voice 區分           |
| iPhone 44×44 touch                                   | UX-08 `4ab3a7d` · M-U3 `4cce96c`                                   | 手機實用                      |
| Dashboard canonical surface（not ghost）             | UX-23 `9cddeed`                                                    | 軟語 hero 真實可見            |

**Verdict**：✅ covered

---

## 整體 Ship Readiness Scorecard

| 標準               | 實作覆蓋 | Remaining                                               |
| ------------------ | -------- | ------------------------------------------------------- |
| 1 · 分析要準       | ✅ 100%  | —                                                       |
| 2 · 視覺要美       | ✅ 100%  | SD §1.9 motion 未做（非 Phase 1 必要）                  |
| 3 · 使用後冷靜     | ✅ 100%  | —                                                       |
| 4 · 每頁指下一步   | 🟡 90%   | R141c detail pane pending · X1 benchmark worker pending |
| 5 · 服務雙 persona | ✅ 100%  | —                                                       |

**Ship gate 距離**：R141c 收完 · 5/5 ≥ 95%。

---

## Gemini R7 補充 · 未被 LLM 討論 SA/SD 條號

依 Gemini R7（2026-04-24）audit · 3 條 SA/SD 條號個別 commit 雖間接覆蓋 · 但沒被 LLM 明文追蹤：

1. **SA §2.2 五條驗收標準** ← **本檔補齊**
2. **SD §1.9/1.10 Motion 原則** → 目前無 motion 實作 · 記 backlog · 非 Phase 1 必要
3. **SA §9 Cross-page Integration Contract** → 延伸 audit · 見下方 §9 mapping（若後續補寫）

---

## SA §9 Cross-page Integration · 簡表

| Handoff                              | 實作                                        |
| ------------------------------------ | ------------------------------------------- |
| Morning Note → Holdings/Events/Daily | ✅ B1 deep-links                            |
| News → Daily（reverseLookup）        | ✅ UX-25 realUserSim 驗                     |
| Daily → Research（deep dive）        | 🟡 既有 但 integration audit 未跑           |
| Holdings drill → Thesis edit         | ✅ R141 #2「寫理由」CTA                     |
| Trade preview → Log                  | ✅ B2 trade-audit JSONL                     |
| Events → Research（法說會 slice）    | 🟡 M-EVENT-TW 建立 · integration 未全 audit |

**Verdict**：🟡 Coverage 尚可 · 整體 audit 未明文執行 · 可排 R142 後續 task。
