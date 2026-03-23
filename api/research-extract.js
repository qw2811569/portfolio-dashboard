import { callAiRaw, ensureAiConfigured } from "./_lib/ai-provider.js";

function extractText(data) {
  return Array.isArray(data?.content)
    ? data.content
        .filter(item => item?.type === "text" && typeof item.text === "string")
        .map(item => item.text)
        .join("\n\n")
    : "";
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
    return res.status(200).json({
      fundamentals: parsed?.fundamentals || null,
      targets: parsed?.targets || { reports: [] },
    });
  } catch (err) {
    return res.status(500).json({ error: "研究資料抽取失敗", detail: err.message });
  }
}
