# Mac Mini Handoff (2026-04-09)

> **給 mac mini 那邊的 LLM 看**
> 寫於 2026-04-09 04:50 (台北時間)
> Branch: `claude-multi-agent-evolution-2026-04-09`
> Base: `origin/main` 7036a00 (你 mac mini 版本的 HEAD)

---

## 0. 為什麼有這個 branch

使用者明確說：
> 「我擔心 mac mini 我沒有完整 push 跟 commit 上去, 所以我等等五個小時後起床到公司, 我要 mac mini 那邊的 llm 重新看你們的版本去做比對, 你要徹底進化整個專案」

所以我（Claude on MacBook）：
- ❌ 沒有 push main
- ❌ 沒有 git pull origin
- ❌ 沒有 merge 任何東西到 main
- ❌ 沒有發 PR
- ✅ 從 `origin/main` 開了**新的 worktree** (`/Users/chenkuichen/APP/test-evolution-2026-04-09`)
- ✅ 在新 branch 上做了 2 個 commit（Phase 1 + Phase 2）
- ✅ 全部用 round-robin review（Codex + Qwen 互審）

**MacBook local main 落後 origin/main 179 commits**（使用者承認沒同步），所以我**故意不從 local 開**，從 `origin/main` 開避免帶髒狀態。

---

## 1. 你（mac mini 那邊的 LLM）該怎麼比對

```bash
# 1. fetch 新 branch
git fetch origin claude-multi-agent-evolution-2026-04-09

# 2. 看 commit log
git log origin/claude-multi-agent-evolution-2026-04-09 --oneline -10

# 3. 看跟 main 的 diff
git log main..origin/claude-multi-agent-evolution-2026-04-09 --oneline

# 4. 看具體變動
git diff main origin/claude-multi-agent-evolution-2026-04-09 --stat

# 5. checkout 看 (但不要 merge 到 main)
git checkout claude-multi-agent-evolution-2026-04-09
```

---

## 2. 這個 branch 有什麼

### 2 個 commit

```
5dbb62f feat(evolution): Phase 1 review fixes + Phase 2 critic dual-lane
db71e00 feat(evolution): Phase 1 - factPack contract + news first-class
```

### 新增的 src 結構

```
src/lib/factPack/                  ← Phase 1 + Phase 1 review fixes
├── evidenceLevels.js              (4 級 + collection_status + severity)
├── metricSemantics.js             (id 帶 dimensions, 防 1717 EPS 稅前/稅後混用)
├── newsScorer.js                  (Codex 6 維度計分 + EPS/配息 keyword)
├── newsClusterer.js               (char-bigram + overlap coefficient + 強信號 fast path)
├── newsFactExtractor.js           (主介面 + Rule 0.5: 21 天窗口)
├── factPackSchema.js              (4 大支柱必填 + FactPackError severity)
├── factPackBuilder.js             (Pre-flight check Rule 0)
└── __tests__/                     (4 份, 69 tests)

src/lib/critic/                    ← Phase 2
├── criticSchema.js                (7 條 critic rule 定義)
├── ruleLane.js                    (deterministic, 5 條規則)
├── severityMerge.js               (rule + LLM 合併, shadow/warn/block)
├── criticRuntime.js               (主介面 runCritic)
└── __tests__/                     (3 份, 32 tests)

src/prompts/                       ← Phase 2 (LLM lane prompt)
└── critic.system.md               (處理 Rule 4/5/7 LLM 部分)
```

### 改動的既有檔案

```
vitest.config.js                   (加 src/**/__tests__/**/*.test.js pattern, collocate)
```

### 測試結果

- **101 tests passed (7 files)**
- 0 fail
- factPack 69 tests + critic 32 tests

---

## 3. 為什麼有這些改動 (1717 失敗的根本原因)

### 1717 4 輪 review 失敗時序

| 輪次 | 我做了什麼 | 漏了什麼 |
|---|---|---|
| v1 | 知識庫 + finmind 4 天 | 漏 3/23 虧損公告、漏所有新聞 |
| v2 | Codex review，校 EPS | 仍漏所有新聞 |
| v3 | Phase A 7 個 dataset | 仍漏所有新聞（沒拉 TaiwanStockNews） |
| v3.1 | 校 Q1 EPS 閾值 | 仍漏所有新聞 |
| **v4 (4/9 凌晨)** | **拉 TaiwanStockNews 14 天 47 則** | **抓到 4 個關鍵新聞 + 改寫策略方向** |

### 4 個關鍵新聞 (4 輪 review 全部漏掉)

1. **3/13 EPS 1.41 公告 + 配息 1 元 + 發 20 億 CB + 精密設備訂單能見度到年底**
2. **3/19-20 法說會釋出 LMC 動能 + 2 家券商目標 75-80**
3. **3/26 取得 WMCM 液態封裝料訂單**（CoWoS 兌現）
4. **3/24 公司澄清不擔心缺料 + 具轉嫁能力**

### 結論變化

- v3.1 寫「中性續抱、審慎樂觀、CoWoS 量化未確認」**錯誤**
- v3.2 補新聞後修正為「混合訊號、有真實 catalyst、72 元賣 1/3、64 元全出」

### 對應的 Rule 0

**任何個股 / 持倉 / 收盤分析必須把消息面當 first-class citizen，與「估值、獲利、籌碼」並列為四大支柱**。

這條規則寫成 code 就是：
- `factPackBuilder.preflightNewsCheck` → news_facts 為空但 source 有資料 → throw
- `criticRule 6` → draft 沒引用 news + factPack 有 material news → critical fail
- `criticRule 7` → main thesis 與 dominant news cluster 不一致 → critical fail

---

## 4. design doc 在哪

主要 4 份 design doc 在 MacBook `/Users/chenkuichen/APP/test/.tmp/reports/`，**沒 commit 進這個 branch**（避免污染 src）。如果你要看：

| 檔 | 用途 |
|---|---|
| `2026-04-09-EVOLUTION-design-doc-v1.md` | round-robin 收斂後的最終設計 |
| `2026-04-09-FINAL-multi-agent-architecture-handoff.md` | 4 家 LLM round 1 對話完整 log |
| `2026-04-09-1717-PROFESSIONAL-research-with-target-price.md` | 1717 投顧風格深度報告 + 目標 70/78/60 |
| `2026-04-09-1717-CASUAL-research-with-target-price.md` | 1717 散戶白話版 + 操作建議 |
| `2026-04-09-1717-changxing-v3.2-FULL-NEWS.md` | 1717 完整 47 則新聞分析 |
| `2026-04-09-codex-phase1-review-response.md` | Codex Phase 1 code review |
| `2026-04-09-qwen-phase1-review-response.md` | Qwen Phase 1 code review |

---

## 5. round-robin review 紀錄

### Architecture round 1 (4 家 LLM)
- Claude → 寫初版 design doc
- Codex → review，加第 7 條規則 + 6 維度計分 + git worktree + automated test
- Qwen → review，加 4 級 evidence + pre-flight check + 分級 fallback
- Gemini → 答完問題 1-2 後 quota 卡，由 Codex 補位完成問題 3-4

### Phase 1 code review (2 家 LLM)
- Codex → 抓 2 個 bug：
  - 純財報 headline (EPS+配息) event_type=0
  - 同事件不同 headline 沒被歸到同 cluster
- Qwen → 抓 3 個 bug：
  - `'出貨'` 同時在 NEG/POS keyword list (sentiment 中和)
  - jaccard 0.5 對中文 tokenizer 太嚴
  - FactPackError 缺 metadata 與 severity 分級

**所有 5 個 bug 已在 Phase 2 commit 中修正**，101 tests 仍全綠。

---

## 6. 你（mac mini LLM）該怎麼決定

### Option A: 接受新 branch，cherry-pick 進 main
```bash
# 你 review 過後覺得方向對
git checkout main
git cherry-pick db71e00 5dbb62f
# 跑測試
npm test
# 如果綠 → push
git push origin main
```

### Option B: 不 merge，但拿去當 reference
- 你的 mac mini 自己有 implementation (那 179 commits)
- 看 claude-multi-agent-evolution-2026-04-09 是想法 reference
- 自己決定要不要採用 factPack 4 大支柱 / critic 7 規則

### Option C: discard 整個 branch
- 如果你覺得方向不對
- `git push origin :claude-multi-agent-evolution-2026-04-09` 刪除
- branch 不影響 main，安全

### 我（Claude on MacBook）的建議

**Option A 或 B 都可**，但**建議至少採用**：
1. **Rule 0 概念**（news 是 first-class）— 這是 1717 失敗教訓
2. **factPack 4 大支柱結構**（estimation/earnings/chip/news）
3. **critic 7 條規則**（特別是 Rule 6 + Rule 7）

不一定要採用我寫的具體 code，但 concept 不能不要。

---

## 7. 如果你發現問題

如果 mac mini 那邊發現我的 code 有 bug 或設計不對：

1. **不要直接改我的 branch**（保留它當對照組）
2. **在 main 開新 branch 做你的版本**
3. **commit message 標 reviewed-by mac-mini**
4. **跟使用者報告兩個版本的差異**

---

## 8. 自動接續任務

我設了 launchd 在 06:58 fire `/Users/chenkuichen/APP/test/.tmp/wake-resume.sh`，**這個 wake script 不會碰你**。它只會：
- 寫一個 marker 檔到 `.tmp/RESUME-FIRED-MARKER.md`
- 發 macOS notification
- (可選) 跑一次 `claude --print` 做 status check

如果你不想要這個 wake，可以：
```bash
launchctl unload /Users/chenkuichen/APP/test/.tmp/com.user.claude-resume.plist
```

---

## 9. 一句話總結

> **我從 origin/main 開了新 branch 不碰你的 main，做了 Phase 1 (factPack 4 大支柱 + Rule 0 enforcement) 與 Phase 2 (critic 7 條規則 dual-lane shadow mode) 的實作，101 tests passed，全部用 Codex + Qwen round-robin 互審。請你 review 後決定 cherry-pick / reference / discard，我不會強迫合併。最重要的概念是 Rule 0 (news first-class) 與 critic Rule 7 (dominant catalyst mismatch)。**

---

## 10. 測試怎麼跑

```bash
cd /Users/chenkuichen/APP/test  # 或你的 worktree
git checkout claude-multi-agent-evolution-2026-04-09
npm install  # 如果你 worktree 沒裝
npx vitest run src/lib/factPack/__tests__/ src/lib/critic/__tests__/

# Expected:
# Test Files  7 passed (7)
# Tests       101 passed (101)
```

---

## 11. 接下來還沒做的 (Phase 3 + Phase 4)

| Phase | 內容 | 為什麼沒做 |
|---|---|---|
| Phase 3 | 持倉看板 news tab UI | 時間不夠, 留給你 |
| Phase 4 | dossier cache 接到 finmindAdapter | 時間不夠 |
| 公開資料源 | MOPS / TWSE OpenAPI / TPEx / TDCC / WebPro / TAIFEX 接入 | Phase 4 範圍 |
| LLM critic lane | criticRuntime 已留 hook, 但 llmLane.js 還沒寫 | 需要 LLM API integration |
| backtest 模組 | Qwen 在 round 1 提的 | v2 範圍 |

---

文件結束。歡迎 mac mini LLM 接手。
