// Vercel Serverless Function — AutoResearch 自主進化系統
// 借鑒 karpathy/autoresearch：AI 自主多輪迭代，累積進化
// 不只研究股票，而是審視整個投資系統並自我改善
import { put, list, del } from '@vercel/blob';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { callAiText, ensureAiConfigured } from './_lib/ai-provider.js';

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN;
const RESEARCH_INDEX_KEY = 'research-index.json';
const DATA_DIR = join(process.cwd(), 'data');

// ── 本地檔案讀寫 ──
function localPath(key) { return join(DATA_DIR, key.replace(/\//g, '__')); }

function readLocal(key) {
  try {
    const p = localPath(key);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch { return null; }
}

function writeLocal(key, data) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(localPath(key), JSON.stringify(data, null, 2));
  } catch {}
}

async function read(key) {
  const local = readLocal(key);
  if (local) return local;
  try {
    const { blobs } = await list({ prefix: key, limit: 1, token: TOKEN });
    if (!blobs.length) return null;
    const r = await fetch(blobs[0].url);
    const data = await r.json();
    writeLocal(key, data);
    return data;
  } catch { return null; }
}

async function write(key, data) {
  writeLocal(key, data);
  try {
    try { await del(key, { token: TOKEN }); } catch {}
    await put(key, JSON.stringify(data), {
      access: 'public', token: TOKEN, contentType: 'application/json', addRandomSuffix: false,
    });
  } catch {}
}

async function callClaude(system, user, maxTokens = 4000) {
  return callAiText({ system, user, maxTokens });
}

async function updateResearchIndex(report) {
  const current = readLocal(RESEARCH_INDEX_KEY) || [];
  const next = [report, ...current.filter(item => item.timestamp !== report.timestamp)]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 30);
  await write(RESEARCH_INDEX_KEY, next);
}

function normalizeHoldingDossiers(value) {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item === 'object' && typeof item.code === 'string')
    : [];
}

function formatPromptNumber(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return digits === 0 ? String(Math.round(num)) : num.toFixed(digits);
}

function formatFreshnessLabel(status) {
  if (status === 'fresh') return '新';
  if (status === 'stale') return '舊';
  return '缺';
}

function summarizeTargetReports(reports, limit = 2) {
  const rows = (Array.isArray(reports) ? reports : [])
    .map(report => {
      const firm = report?.firm || '未署名';
      const target = Number(report?.target);
      const date = report?.date || '日期未知';
      if (!Number.isFinite(target) || target <= 0) return null;
      return `${firm} ${target} (${date})`;
    })
    .filter(Boolean);
  return rows.length > 0 ? rows.slice(0, limit).join('；') : '無';
}

function summarizeEventList(items, limit = 3) {
  const rows = (Array.isArray(items) ? items : [])
    .map(event => {
      const label = event?.title || '未命名事件';
      const date = event?.date || event?.trackingStart || event?.exitDate || '日期未定';
      const status = event?.status || 'pending';
      return `${label}(${date}/${status})`;
    })
    .filter(Boolean);
  return rows.length > 0 ? rows.slice(0, limit).join('；') : '無';
}

function formatFundamentalsSummary(entry) {
  if (!entry || typeof entry !== 'object') return '尚未建立';
  const parts = [
    entry.revenueMonth ? `${entry.revenueMonth} 營收` : null,
    Number.isFinite(Number(entry.revenueYoY)) ? `YoY ${Number(entry.revenueYoY) >= 0 ? '+' : ''}${Number(entry.revenueYoY).toFixed(1)}%` : null,
    Number.isFinite(Number(entry.revenueMoM)) ? `MoM ${Number(entry.revenueMoM) >= 0 ? '+' : ''}${Number(entry.revenueMoM).toFixed(1)}%` : null,
    Number.isFinite(Number(entry.eps)) ? `EPS ${Number(entry.eps).toFixed(2)}` : null,
    Number.isFinite(Number(entry.grossMargin)) ? `毛利率 ${Number(entry.grossMargin).toFixed(1)}%` : null,
    Number.isFinite(Number(entry.roe)) ? `ROE ${Number(entry.roe).toFixed(1)}%` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '尚未建立';
}

function formatPortfolioNotesContext(notes) {
  if (!notes || typeof notes !== 'object') return '個人備註：無';
  const lines = [
    notes.riskProfile ? `風險屬性：${notes.riskProfile}` : null,
    notes.preferences ? `操作偏好：${notes.preferences}` : null,
    notes.customNotes ? `自訂備註：${notes.customNotes}` : null,
  ].filter(Boolean);
  return lines.length > 0 ? `個人備註：\n${lines.join('\n')}` : '個人備註：無';
}

function brainRuleText(rule) {
  if (typeof rule === 'string') return rule.trim();
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return '';
  return String(rule.text || rule.rule || '').trim();
}

function brainRuleSummary(rule) {
  const text = brainRuleText(rule);
  if (!text) return '';
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return text;
  const meta = [
    rule.when ? `條件:${rule.when}` : null,
    rule.action ? `動作:${rule.action}` : null,
    rule.scope ? `範圍:${rule.scope}` : null,
    Number.isFinite(Number(rule.confidence)) ? `信心${Math.round(Number(rule.confidence))}/10` : null,
    Number.isFinite(Number(rule.evidenceCount)) && Number(rule.evidenceCount) > 0 ? `驗證${Math.round(Number(rule.evidenceCount))}次` : null,
  ].filter(Boolean);
  return meta.length > 0 ? `${text}（${meta.join('｜')}）` : text;
}

function summarizeBrainRules(rules, limit = 4) {
  const rows = (Array.isArray(rules) ? rules : [])
    .map(brainRuleSummary)
    .filter(Boolean);
  return rows.length > 0 ? rows.slice(0, limit).join('；') : '無';
}

function summarizeBrainChecklists(checklists) {
  if (!checklists || typeof checklists !== 'object') return '無';
  const sections = [
    Array.isArray(checklists.preEntry) && checklists.preEntry.length > 0 ? `進場前：${checklists.preEntry.join('；')}` : null,
    Array.isArray(checklists.preAdd) && checklists.preAdd.length > 0 ? `加碼前：${checklists.preAdd.join('；')}` : null,
    Array.isArray(checklists.preExit) && checklists.preExit.length > 0 ? `出場前：${checklists.preExit.join('；')}` : null,
  ].filter(Boolean);
  return sections.length > 0 ? sections.join('\n') : '無';
}

function buildResearchDossierContext(dossier, { compact = false } = {}) {
  if (!dossier) return '無 dossier，可依持倉與 meta 基本資料分析。';
  const position = dossier.position || {};
  const meta = dossier.meta || {};
  const thesis = dossier.thesis || {};
  const targets = dossier.targets || {};
  const fundamentals = dossier.fundamentals || {};
  const analyst = dossier.analyst || {};
  const events = dossier.events || {};
  const research = dossier.research || {};
  const brainContext = dossier.brainContext || {};
  const freshness = dossier.freshness || {};

  return [
    `【${dossier.name}(${dossier.code})】`,
    `持倉：${position.type || '股票'} | 現價 ${formatPromptNumber(position.price)} 成本 ${formatPromptNumber(position.cost)} | 累計 ${Number(position.pct) >= 0 ? '+' : ''}${formatPromptNumber(position.pct, 2)}% | 股數 ${formatPromptNumber(position.qty, 0)}`,
    `定位：${meta.industry || '未分類'} / ${meta.strategy || '未分類'} / ${meta.period || '?'}期 / ${meta.position || '未定'} / ${meta.leader || '未知'}`,
    thesis.summary ? `thesis：${thesis.summary}` : null,
    thesis.catalyst ? `催化劑：${thesis.catalyst}` : null,
    thesis.status ? `狀態：${thesis.status}` : null,
    targets.avgTarget ? `目標價：均值 ${formatPromptNumber(targets.avgTarget, 0)}；${summarizeTargetReports(targets.reports, compact ? 2 : 3)}` : '目標價：無',
    (fundamentals.eps != null || fundamentals.grossMargin != null || fundamentals.roe != null || fundamentals.revenueYoY != null) ? `財報/營收：${formatFundamentalsSummary(fundamentals)}${fundamentals.source ? `；來源 ${fundamentals.source}` : ''}` : '財報/營收：無',
    analyst.latestSummary ? `公開報告：${analyst.latestSummary}` : '公開報告：無',
    `事件：待觀察 ${summarizeEventList(events.pending, compact ? 2 : 3)} | 追蹤中 ${summarizeEventList(events.tracking, compact ? 2 : 3)}`,
    research.latestConclusion ? `最近研究：${research.latestConclusion}` : '最近研究：無',
    Array.isArray(brainContext.matchedRules) && brainContext.matchedRules.length > 0 ? `相關規則：${brainContext.matchedRules.slice(0, compact ? 2 : 4).map(brainRuleSummary).join('；')}` : null,
    Array.isArray(brainContext.matchedCandidateRules) && brainContext.matchedCandidateRules.length > 0 ? `候選規則：${brainContext.matchedCandidateRules.slice(0, compact ? 2 : 3).map(brainRuleSummary).join('；')}` : null,
    Array.isArray(brainContext.matchedMistakes) && brainContext.matchedMistakes.length > 0 ? `常見風險：${brainContext.matchedMistakes.slice(0, compact ? 2 : 4).join('；')}` : null,
    `資料新鮮度：價格${formatFreshnessLabel(freshness.price)} / 目標價${formatFreshnessLabel(freshness.targets)} / 財報${formatFreshnessLabel(freshness.fundamentals)} / 研究${formatFreshnessLabel(freshness.research)}`,
  ].filter(Boolean).join('\n');
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    ensureAiConfigured();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  // GET: 讀取歷史研究報告（本地優先）
  if (req.method === "GET") {
    try {
      const { code } = req.query;
      const cached = (await read(RESEARCH_INDEX_KEY)) || [];
      if (cached.length > 0) {
        const reports = code ? cached.filter(r => r.code === code).slice(0, 10) : cached.slice(0, 10);
        return res.status(200).json({ reports });
      }
      const prefix = code ? `research/${code}/` : 'research/';
      const blobs = await list({ prefix, token: TOKEN });
      const reports = [];
      for (const blob of blobs.blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 10)) {
        const r = await fetch(blob.url);
        reports.push(await r.json());
      }
      if (reports.length > 0) writeLocal(RESEARCH_INDEX_KEY, reports);
      return res.status(200).json({ reports });
    } catch {
      return res.status(200).json({ reports: [] });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    stocks,
    holdings,
    holdingDossiers,
    meta,
    brain,
    events,
    analysisHistory,
    portfolioNotes,
    mode,
    persist = true,
  } = req.body;

  try {
    const today = new Date().toLocaleDateString("zh-TW");
    const results = [];
    const dossiers = normalizeHoldingDossiers(holdingDossiers);
    const dossierByCode = new Map(dossiers.map(item => [item.code, item]));
    const notesContext = formatPortfolioNotesContext(portfolioNotes);

    if (mode === "single" && stocks?.length === 1) {
      // ── 單股深度研究：3 輪迭代 ──
      const s = stocks[0];
      const m = meta?.[s.code] || {};
      const dossier = dossierByCode.get(s.code) || null;
      const dossierContext = buildResearchDossierContext(dossier);
      const holdingRow = holdings?.find(h => h.code === s.code) || null;

      const round1 = await callClaude(
        `你是專業的台股研究分析師。你必須先讀完整的持股 dossier，再對「${s.name}(${s.code})」做研究。
如果 dossier 標示某些欄位是 stale 或 missing，要直接說出不確定性，不要虛構最新財報或投顧數字。
產業：${m.industry || "未分類"} | 策略：${m.strategy || "未分類"} | 產業地位：${m.leader || "未知"}`,
        `${notesContext}

持股 dossier：
${dossierContext}

請對 ${s.name}(${s.code}) 進行深度基本面分析：

1. **公司定位與護城河**：主要業務、競爭優勢、市場地位，並檢查現有 thesis 是否仍成立
2. **財務體質**：根據 dossier 內已知資訊評估近期營收趨勢、毛利率走勢、EPS 軌跡、ROE；若缺資料要說明
3. **產業趨勢**：所處產業的景氣循環位置、未來 1-2 季展望
4. **投顧/目標價支撐**：目前目標價共識是否支持 thesis？若資料偏舊請明講
5. **技術面與事件驗證點**：支撐、壓力、均線結構，以及最近待觀察事件如何影響判斷

現價：${s.price} | 成本：${s.cost} | 損益：${s.pnl >= 0 ? "+" : ""}${s.pnl}(${s.pct}%)

請用 dossier 內已有的具體數據和邏輯推演，不要空泛描述。`
      );

      const round2 = await callClaude(
        `你是台股風險評估專家，你的工作是挑戰 Round 1 的結論。
如果 Round 1 看多，你要找出看空的理由；如果 Round 1 看空，你要找出被低估的可能。
你的價值在於找到分析師遺漏的風險，而不是附和前一輪的結論。
禁止使用「短期震盪不改長期趨勢」「逢低布局」「持續觀察」等模糊用語。`,
        `${notesContext}
持股 dossier：\n${dossierContext}\n\n前一輪分析結果：\n${round1}\n\n你的任務是反駁上面的分析，請：
1. **挑戰 Round 1 結論**：Round 1 的判斷哪裡可能是錯的？有什麼被忽略的反面證據？
2. **主要風險因子**：最可能導致下跌的 3 個因素（必須給具體情境和觸發條件）
3. **催化劑失效風險**：Round 1 提到的催化劑為什麼可能不會實現？或已被市場定價？
4. **同業比較**：vs 同產業對手的估值差異，是否有更好的替代標的？
5. **黑天鵝情境**：最壞情況下的股價目標和虧損金額

現有持倉：${s.code} 持有 ${holdingRow?.qty || "?"}股，成本 ${s.cost}`
      );

      const brainCtx = brain ? `策略大腦核心規則：\n${summarizeBrainRules(brain.rules, 8)}\n候選規則：${summarizeBrainRules(brain.candidateRules, 4)}\n決策檢查表：\n${summarizeBrainChecklists(brain.checklists)}\n常犯錯誤：${(brain.commonMistakes || []).join("、") || "無"}` : "";
      const round3 = await callClaude(
        `你是持倉策略顧問。綜合所有研究結果，給出明確的操作建議。`,
        `${notesContext}
持股 dossier：\n${dossierContext}\n\n基本面分析：\n${round1}\n\n風險催化劑分析：\n${round2}\n\n${brainCtx}
股票：${s.name}(${s.code}) | 策略定位：${m.strategy}/${m.period}期/${m.position}

請給出：
1. **研究結論**：一句話總結（看多/看空/中性+信心度1-10）
2. **操作建議**：具體的買賣策略（何時加碼/減碼/停損，目標價位），要明確引用 dossier 中的 thesis / 目標價 / 事件
3. **關鍵觀察指標**：接下來最需要追蹤的 3 個指標/事件，並標明哪些資料目前偏舊
4. **持倉調整建議**：是否調整倉位大小、持有週期`
      );

      const report = {
        code: s.code, name: s.name, date: today, timestamp: Date.now(),
        mode: "single",
        rounds: [
          { title: "基本面深度分析", content: round1 },
          { title: "風險與催化劑", content: round2 },
          { title: "策略建議", content: round3 },
        ],
        meta: m, priceAtResearch: s.price,
      };
      if (persist) {
        writeLocal(`research/${s.code}/${Date.now()}.json`, report);
        await updateResearchIndex(report);
      }
      if (persist && TOKEN) {
        try { await put(`research/${s.code}/${Date.now()}.json`, JSON.stringify(report), { access: 'public', token: TOKEN, contentType: 'application/json' }); } catch {}
      }
      results.push(report);

    } else if (mode === "evolve" || mode === "portfolio") {
      // ══════════════════════════════════════════════════════════════
      // ── 統一的全組合研究 + 系統進化流程（4 輪迭代）──
      // ══════════════════════════════════════════════════════════════
      // 合併了舊的 portfolio（個股掃描+組合建議）和 evolve（系統診斷+大腦進化）
      // 現在不管從哪個按鈕觸發，都走同一個完整流程

      const brainCtx = brain ? JSON.stringify(brain) : "（尚未建立）";
      const evtSummary = (events || []).slice(0, 15).map(e =>
        `[${e.correct===true?"✓":e.correct===false?"✗":"⏳"}] ${e.date} ${e.title} 預測${e.pred==="up"?"漲":"跌"} ${e.actualNote||""}`
      ).join("\n");
      const histSummary = (analysisHistory || []).slice(0, 5).map(r =>
        `${r.date} 損益${r.totalTodayPnl>=0?"+":""}${r.totalTodayPnl} ${r.aiInsight ? r.aiInsight.slice(0,200)+"..." : ""}`
      ).join("\n---\n");

      // ── Round 1：個股快掃（由下往上）──
      const stockSummaries = [];
      for (const s of (stocks || []).slice(0, 20)) {
        const m = meta?.[s.code] || {};
        const dossier = dossierByCode.get(s.code) || null;
        const dossierContext = buildResearchDossierContext(dossier, { compact: true });
        const summary = await callClaude(
          `你是台股分析師。先讀這檔持股的 dossier，再用 120 字內精要分析這檔持股的當前狀態和操作方向。`,
          `${notesContext}
${dossierContext}

請給出：
1. thesis 是否仍成立（1句）
2. 當前操作方向（1句）
3. 最大驗證點（1句）
4. 信心度(1-10)
如果資料偏舊，請在摘要中直接點出。`,
          800
        );
        stockSummaries.push({ code: s.code, name: s.name, summary, meta: m });
      }
      const stockSummaryText = stockSummaries.map(s =>
        `${s.name}(${s.code})[${s.meta.industry || ""}/${s.meta.position || ""}]: ${s.summary}`
      ).join("\n\n");

      // ── Round 2：系統診斷（由上往下，結合個股掃描結果）──
      const diag = await callClaude(
        `你是投資系統架構師。基於個股研究結果和完整系統資料，診斷這個交易者的投資系統。`,
        `${notesContext}

## 個股研究摘要（Round 1 結果）
${stockSummaryText}

## 策略大腦
${brainCtx}

## 事件預測紀錄
${evtSummary || "（無紀錄）"}

## 近期收盤分析
${histSummary || "（無紀錄）"}

═══ 預測校準要求（最優先完成）═══
上面的事件預測紀錄中，✓ 是正確的，✗ 是錯誤的。
請先計算準確率，並回答：
1. 哪類事件預測最差？為什麼？
2. 近期收盤分析中，AI 說「看好」的股票後來真的漲了嗎？用數字回答。
3. 這個交易者（以及你作為 AI 顧問）最容易犯的系統性錯誤是什麼？
不允許說「整體表現尚可」這類模糊評價。必須用具體數字說話。

═══ 系統診斷 ═══
請診斷這個投資系統：
1. **決策品質**：從事件預測命中率看，哪些類型的判斷最準？哪些最差？為什麼？
2. **策略一致性**：策略大腦的規則 vs 實際操作，有沒有言行不一致的地方？
3. **認知盲點**：從歷史分析看，這個交易者反覆忽略了什麼？
4. **資金效率**：資金配置是否合理？有沒有資金被困在低效益的部位？
5. **情緒模式**：從交易紀錄能推斷出什麼情緒傾向？（追高、恐慌出場、過度自信等）
6. **個股問題**：根據個股研究摘要，哪幾檔最需要立即行動？
7. **AI 顧問自我檢討**：如果你就是之前做出這些分析的 AI，你自己最大的盲點是什麼？`
      );

      // ── Round 3：進化建議 + 組合調整（合併策略建議與系統改善）──
      const evolveAdvice = await callClaude(
        `你是投資系統優化顧問兼組合管理專家。基於個股研究和系統診斷，提出完整的改善方案。`,
        `${notesContext}\n\n個股研究摘要：\n${stockSummaryText}\n\n系統診斷結果：\n${diag}\n\n請提出：

## 一、組合層級建議
1. **組合健康度評分** (1-10)
2. **最需要行動的 3 檔**（結合個股研究的信心度和系統診斷的問題）
3. **產業配置調整**（目前配置 vs 建議配置）
4. **資金調度建議**（具體到哪檔減碼、哪檔加碼、金額比例）
5. **未來 1 個月最大風險**

## 二、系統改善建議
1. **策略大腦更新建議**：哪些規則要修改？要新增什麼？要刪除什麼過時規則？
2. **決策流程改善**：進場前多問什麼問題？出場常犯的錯怎麼防？
3. **事件追蹤優化**：目前追蹤夠不夠？漏掉哪些重要的觀察角度？
4. **下週具體行動清單**：按優先順序列出 5 個最應該做的事`
      );

      // ── Round 4：更新策略大腦（JSON output）──
      const newBrainText = await callClaude(
        `基於所有研究和診斷結果，輸出更新後的策略大腦。回傳**純JSON**（不要markdown code block）。
結構：{"rules":[{"text":"規則","when":"適用情境","action":"建議動作","scope":"適用範圍","confidence":1到10,"evidenceCount":整數,"lastValidatedAt":"日期","source":"ai/user","status":"active","checklistStage":"preEntry/preAdd/preExit"}],"candidateRules":[{"text":"待驗證規則","when":"情境","action":"動作","confidence":1到10,"evidenceCount":整數,"status":"candidate"}],"checklists":{"preEntry":["進場前檢查項"],"preAdd":["加碼前檢查項"],"preExit":["出場前檢查項"]},"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":[...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"日期","evolution":"這次進化摘要一句話"}`,
        `個股研究：\n${stockSummaryText}\n\n系統診斷：\n${diag}\n\n進化建議：\n${evolveAdvice}\n\n現有策略大腦：\n${brainCtx}\n\n今天是 ${today}。請整合以上所有資訊，輸出進化後的策略大腦。保留有效的舊規則，加入新的。`
      );

      let parsedBrain = null;
      try {
        const clean = newBrainText.replace(/```json|```/g, "").trim();
        parsedBrain = JSON.parse(clean);
      } catch(e) { /* 解析失敗就不更新 */ }

      // 存新版策略大腦
      if (persist && parsedBrain && TOKEN) {
        await put(`strategy-brain.json`, JSON.stringify(parsedBrain), { access: 'public', token: TOKEN, contentType: 'application/json' });
      }

      const report = {
        code: "EVOLVE", name: "全組合研究 + 系統進化", date: today, timestamp: Date.now(),
        mode: "evolve",
        rounds: [
          { title: "個股快掃", content: stockSummaries.map(s => `### ${s.name}(${s.code})\n${s.summary}`).join("\n\n") },
          { title: "系統診斷", content: diag },
          { title: "進化建議 + 組合調整", content: evolveAdvice },
          { title: "策略大腦更新", content: parsedBrain ? `✅ 策略大腦已自動更新\n\n**進化摘要：** ${parsedBrain.evolution || "—"}\n\n**新規則數：** ${parsedBrain.rules?.length || 0}\n**累積教訓：** ${parsedBrain.lessons?.length || 0}` : "⚠️ 策略大腦更新失敗，請手動檢查" },
        ],
        stockSummaries,
        newBrain: parsedBrain,
      };
      if (persist) {
        writeLocal(`research/EVOLVE/${Date.now()}.json`, report);
        await updateResearchIndex(report);
      }
      if (persist && TOKEN) {
        try { await put(`research/EVOLVE/${Date.now()}.json`, JSON.stringify(report), { access: 'public', token: TOKEN, contentType: 'application/json' }); } catch {}
      }
      results.push(report);
    }

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: "研究失敗", detail: err.message });
  }
}
