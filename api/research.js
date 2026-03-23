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

  const { stocks, holdings, meta, brain, events, analysisHistory, mode, persist = true } = req.body;

  try {
    const today = new Date().toLocaleDateString("zh-TW");
    const results = [];

    if (mode === "single" && stocks?.length === 1) {
      // ── 單股深度研究：3 輪迭代 ──
      const s = stocks[0];
      const m = meta?.[s.code] || {};

      const round1 = await callClaude(
        `你是專業的台股研究分析師。針對「${s.name}(${s.code})」進行深度基本面研究。
產業：${m.industry || "未分類"} | 策略：${m.strategy || "未分類"} | 產業地位：${m.leader || "未知"}`,
        `請對 ${s.name}(${s.code}) 進行深度基本面分析：

1. **公司定位與護城河**：主要業務、競爭優勢、市場地位
2. **財務體質**：近期營收趨勢、毛利率走勢、EPS 軌跡、ROE
3. **產業趨勢**：所處產業的景氣循環位置、未來 1-2 季展望
4. **法人動向**：三大法人近期買賣超方向、外資持股比率趨勢
5. **技術面關鍵位置**：支撐、壓力、均線結構

現價：${s.price} | 成本：${s.cost} | 損益：${s.pnl >= 0 ? "+" : ""}${s.pnl}(${s.pct}%)

請用具體數據和邏輯推演，不要空泛描述。`
      );

      const round2 = await callClaude(
        `你是台股風險評估專家。基於前一輪分析結果，進一步挖掘風險和催化劑。`,
        `前一輪分析結果：\n${round1}\n\n請進一步分析：
1. **主要風險因子**：最可能導致下跌的 3 個因素
2. **催化劑時程**：未來 1-3 個月可能推升股價的事件和時間點
3. **同業比較**：vs 同產業對手的估值差異
4. **資金流向**：融資融券變化、周轉率、大戶籌碼
5. **黑天鵝情境**：最壞情況下的股價目標

現有持倉：${s.code} 持有 ${holdings?.find(h=>h.code===s.code)?.qty || "?"}股，成本 ${s.cost}`
      );

      const brainCtx = brain ? `策略大腦規則：\n${(brain.rules || []).join("\n")}\n常犯錯誤：${(brain.commonMistakes || []).join("、")}` : "";
      const round3 = await callClaude(
        `你是持倉策略顧問。綜合所有研究結果，給出明確的操作建議。`,
        `基本面分析：\n${round1}\n\n風險催化劑分析：\n${round2}\n\n${brainCtx}
股票：${s.name}(${s.code}) | 策略定位：${m.strategy}/${m.period}期/${m.position}

請給出：
1. **研究結論**：一句話總結（看多/看空/中性+信心度1-10）
2. **操作建議**：具體的買賣策略（何時加碼/減碼/停損，目標價位）
3. **關鍵觀察指標**：接下來最需要追蹤的 3 個指標/事件
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
        const summary = await callClaude(
          `你是台股分析師。用 100 字內精要分析這檔持股的當前狀態和操作方向。`,
          `${s.name}(${s.code}) | 產業：${m.industry || "未分類"} | 策略：${m.strategy || "未分類"} | 地位：${m.leader || "未知"}
現價：${s.price} | 成本：${s.cost} | 損益${s.pct >= 0 ? "+" : ""}${s.pct}%
請給出：當前狀態（1句）+ 操作方向（1句）+ 信心度(1-10)`,
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
        `## 個股研究摘要（Round 1 結果）
${stockSummaryText}

## 策略大腦
${brainCtx}

## 事件預測紀錄
${evtSummary || "（無紀錄）"}

## 近期收盤分析
${histSummary || "（無紀錄）"}

請診斷這個投資系統：
1. **決策品質**：從事件預測命中率看，哪些類型的判斷最準？哪些最差？為什麼？
2. **策略一致性**：策略大腦的規則 vs 實際操作，有沒有言行不一致的地方？
3. **認知盲點**：從歷史分析看，這個交易者反覆忽略了什麼？
4. **資金效率**：資金配置是否合理？有沒有資金被困在低效益的部位？
5. **情緒模式**：從交易紀錄能推斷出什麼情緒傾向？（追高、恐慌出場、過度自信等）
6. **個股問題**：根據個股研究摘要，哪幾檔最需要立即行動？`
      );

      // ── Round 3：進化建議 + 組合調整（合併策略建議與系統改善）──
      const evolveAdvice = await callClaude(
        `你是投資系統優化顧問兼組合管理專家。基於個股研究和系統診斷，提出完整的改善方案。`,
        `個股研究摘要：\n${stockSummaryText}\n\n系統診斷結果：\n${diag}\n\n請提出：

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
結構：{"rules":[...],"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":[...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"日期","evolution":"這次進化摘要一句話"}`,
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
