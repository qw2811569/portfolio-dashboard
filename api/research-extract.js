import { callAiRaw, ensureAiConfigured } from "./_lib/ai-provider.js";

function extractText(data) {
  return Array.isArray(data?.content)
    ? data.content
        .filter(item => item?.type === "text" && typeof item.text === "string")
        .map(item => item.text)
        .join("\n\n")
    : "";
}

function normalizeTargetReports(reports, fallbackDate) {
  return Array.isArray(reports)
    ? reports
        .map(report => {
          const firm = String(report?.firm || "").trim();
          const target = Number(report?.target);
          const date = String(report?.date || "").trim() || fallbackDate;
          if (!firm || !Number.isFinite(target) || target <= 0) return null;
          return { firm, target, date };
        })
        .filter(Boolean)
    : [];
}

function inferFallbackTargetReports(text, fallbackDate) {
  const sourceText = String(text || "");
  if (!sourceText) return [];
  const lines = sourceText.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const reports = [];
  const patterns = [
    /(?:目標價|目標價位|目標區間|目標上看|股價目標)[^\d]{0,12}(\d{2,5}(?:\.\d+)?)/,
    /(?:操作建議|策略建議|研究結論).{0,40}?(?:目標|上看|看到)[^\d]{0,10}(\d{2,5}(?:\.\d+)?)/,
  ];

  for (const line of lines) {
    if (!/目標|上看|看到/.test(line)) continue;
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const target = Number(match[1]);
      if (!Number.isFinite(target) || target <= 0) continue;
      const firmMatch = line.match(/(元大|凱基|中信投顧|華南投顧|富邦|大摩|大和|國際共識|FactSet共識|深度研究|研究建議)/);
      reports.push({
        firm: firmMatch?.[1] || "本次深度研究",
        target,
        date: fallbackDate,
      });
      break;
    }
  }

  const unique = [];
  const seen = new Set();
  for (const report of reports) {
    const key = `${report.firm}-${report.target}-${report.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(report);
  }
  return unique.slice(0, 3);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    ensureAiConfigured();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  try {
    const { report, stock, dossier } = req.body || {};
    if (!report?.code || !report?.text) {
      return res.status(400).json({ error: "缺少 report.code 或 report.text" });
    }

    const data = await callAiRaw({
      system: `你是台股研究資料抽取器。你的任務是從研究報告文字中抽出可回寫到持股 dossier 的結構化資料。
只能抽出文字裡有明確提到的數字或來源，不可猜測。
目標價資料規則：
- 優先抽出文字裡明確提到的券商 / 共識目標價
- 如果沒有券商來源，但研究結論或操作建議裡明確寫出本次研究目標價，也要收進 reports，firm 可填「本次深度研究」
如果沒有明確資料，就填 null 或空陣列。
回傳純 JSON，不要 markdown，不要額外說明。

格式：
{
  "fundamentals": {
    "revenueMonth": "YYYY/MM" 或 null,
    "revenueYoY": 數字或 null,
    "revenueMoM": 數字或 null,
    "quarter": "YYYYQn" 或 null,
    "eps": 數字或 null,
    "grossMargin": 數字或 null,
    "roe": 數字或 null,
    "updatedAt": "YYYY/MM/DD" 或 null,
    "source": "資料來源簡述",
    "note": "一句話摘要"
  },
  "targets": {
    "reports": [
      { "firm": "券商/來源", "target": 數字, "date": "YYYY/MM/DD 或 YYYY/MM" }
    ]
  }
}`,
      maxTokens: 900,
      allowThinking: false,
      messages: [{
        role: "user",
        content: `股票：${stock?.name || report.name || ""}(${report.code})
研究日期：${report.date || ""}

現有 dossier 摘要：
${JSON.stringify(dossier || {}, null, 2)}

研究全文：
${report.text}

請抽出可回寫的財報/營收/目標價資料。若數字只是模糊描述或沒有明確來源，不要硬填。`,
      }],
    });

    const text = extractText(data).replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    const fallbackDate = String(report?.date || "").trim() || null;
    const normalizedReports = normalizeTargetReports(parsed?.targets?.reports, fallbackDate);
    const fallbackReports = normalizedReports.length > 0 ? [] : inferFallbackTargetReports(report.text, fallbackDate);
    return res.status(200).json({
      fundamentals: parsed?.fundamentals || null,
      targets: {
        reports: normalizedReports.length > 0 ? normalizedReports : fallbackReports,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "研究資料抽取失敗", detail: err.message });
  }
}
