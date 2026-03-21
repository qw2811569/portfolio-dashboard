// Vercel Serverless Function — AutoResearch 自動深度研究
// 借鑒 karpathy/autoresearch 的自主研究迴圈概念
// 對持股進行多輪深度分析，累積研究洞察
import { put, list } from '@vercel/blob';

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN;
const API_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(system, user, maxTokens = 4000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!API_KEY) return res.status(500).json({ error: "未設定 ANTHROPIC_API_KEY" });

  // GET: 讀取歷史研究報告
  if (req.method === "GET") {
    try {
      const { code } = req.query;
      const prefix = code ? `research/${code}/` : 'research/';
      const blobs = await list({ prefix, token: TOKEN });
      const reports = [];
      for (const blob of blobs.blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 10)) {
        const r = await fetch(blob.url);
        reports.push(await r.json());
      }
      return res.status(200).json({ reports });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { stocks, holdings, meta, brain, mode } = req.body;
  // stocks: [{code, name, price, cost, pnl, pct, type}]
  // meta: STOCK_META subset
  // brain: current strategy brain
  // mode: "single" | "portfolio"

  try {
    const today = new Date().toLocaleDateString("zh-TW");
    const results = [];

    if (mode === "single" && stocks?.length === 1) {
      // ── 單股深度研究：3 輪迭代 ──
      const s = stocks[0];
      const m = meta?.[s.code] || {};

      // 第 1 輪：基本面深度分析
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

      // 第 2 輪：風險與催化劑分析（基於第 1 輪結果）
      const round2 = await callClaude(
        `你是台股風險評估專家。基於前一輪分析結果，進一步挖掘風險和催化劑。`,
        `前一輪分析結果：
${round1}

請進一步分析：
1. **主要風險因子**：最可能導致下跌的 3 個因素
2. **催化劑時程**：未來 1-3 個月可能推升股價的事件和時間點
3. **同業比較**：vs 同產業對手的估值差異
4. **資金流向**：融資融券變化、周轉率、大戶籌碼
5. **黑天鵝情境**：最壞情況下的股價目標

現有持倉：${s.code} 持有 ${holdings?.find(h=>h.code===s.code)?.qty || "?"}股，成本 ${s.cost}`
      );

      // 第 3 輪：策略建議（綜合前兩輪 + 策略大腦）
      const brainContext = brain ? `策略大腦規則：\n${(brain.rules || []).join("\n")}\n常犯錯誤：${(brain.commonMistakes || []).join("、")}` : "";
      const round3 = await callClaude(
        `你是持倉策略顧問。綜合所有研究結果，給出明確的操作建議。`,
        `基本面分析：
${round1}

風險催化劑分析：
${round2}

${brainContext}

股票：${s.name}(${s.code}) | 策略定位：${m.strategy}/${m.period}期/${m.position}

請給出：
1. **研究結論**：一句話總結（看多/看空/中性+信心度1-10）
2. **操作建議**：具體的買賣策略（何時加碼/減碼/停損，目標價位）
3. **關鍵觀察指標**：接下來最需要追蹤的 3 個指標/事件
4. **持倉調整建議**：是否調整倉位大小、持有週期`
      );

      const report = {
        code: s.code,
        name: s.name,
        date: today,
        timestamp: Date.now(),
        rounds: [
          { title: "基本面深度分析", content: round1 },
          { title: "風險與催化劑", content: round2 },
          { title: "策略建議", content: round3 },
        ],
        meta: m,
        priceAtResearch: s.price,
      };

      // 存到 Vercel Blob
      if (TOKEN) {
        await put(`research/${s.code}/${Date.now()}.json`, JSON.stringify(report), {
          access: 'public', token: TOKEN, contentType: 'application/json',
        });
      }
      results.push(report);

    } else if (mode === "portfolio") {
      // ── 全組合研究：每股 1 輪精要 + 1 輪組合建議 ──
      const stockSummaries = [];

      for (const s of (stocks || []).slice(0, 20)) {
        const m = meta?.[s.code] || {};
        const summary = await callClaude(
          `你是台股分析師。用 100 字內精要分析這檔持股的當前狀態和操作方向。`,
          `${s.name}(${s.code}) | 產業：${m.industry} | 策略：${m.strategy} | 地位：${m.leader}
現價：${s.price} | 成本：${s.cost} | 損益${s.pct >= 0 ? "+" : ""}${s.pct}%
請給出：當前狀態（1句）+ 操作方向（1句）+ 信心度(1-10)`,
          800
        );
        stockSummaries.push({ code: s.code, name: s.name, summary, meta: m });
      }

      // 組合層級分析
      const brainContext = brain ? `策略大腦：${(brain.rules || []).slice(0, 5).join("；")}` : "";
      const portfolioAnalysis = await callClaude(
        `你是投資組合管理專家。基於所有個股研究結果，給出組合層級的建議。`,
        `個股研究摘要：
${stockSummaries.map(s => `${s.name}(${s.code})[${s.meta.industry}/${s.meta.position}]: ${s.summary}`).join("\n\n")}

${brainContext}

請分析：
1. **組合健康度評分** (1-10)：風險分散、收益潛力、策略一致性
2. **最需要行動的 3 檔**：加碼/減碼/停損的具體建議
3. **產業配置調整**：哪些產業過度集中？建議怎麼平衡？
4. **資金調度建議**：如果有額外資金，優先配置到哪裡？為什麼？
5. **未來 1 個月最大風險**：整體組合面臨的系統性風險`
      );

      const report = {
        code: "PORTFOLIO",
        name: "全組合研究",
        date: today,
        timestamp: Date.now(),
        rounds: [
          { title: "個股研究摘要", content: stockSummaries.map(s => `### ${s.name}(${s.code})\n${s.summary}`).join("\n\n") },
          { title: "組合策略建議", content: portfolioAnalysis },
        ],
        stockSummaries,
      };

      if (TOKEN) {
        await put(`research/PORTFOLIO/${Date.now()}.json`, JSON.stringify(report), {
          access: 'public', token: TOKEN, contentType: 'application/json',
        });
      }
      results.push(report);
    }

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: "研究失敗", detail: err.message });
  }
}
