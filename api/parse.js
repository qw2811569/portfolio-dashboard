// Vercel Serverless Function — 截圖解析（圖片 → 交易資料）
import { callAiImage, ensureAiConfigured } from "./_lib/ai-provider.js";

function truncateForLog(value, maxLength = 4000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
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
    const { systemPrompt, base64, mediaType } = req.body;
    if (!base64) {
      return res.status(400).json({ error: "缺少圖片內容(base64)" });
    }

    const data = await callAiImage({
      system: systemPrompt,
      base64,
      mediaType: mediaType || "image/jpeg",
      prompt: "解析這張成交截圖",
      maxTokens: 600,
    });

    console.log(
      '[api/parse] OCR AI raw response:',
      truncateForLog({
        mediaType: mediaType || "image/jpeg",
        base64Length: String(base64 || '').length,
        response: data,
      })
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error('[api/parse] OCR parse failed:', err);
    return res.status(500).json({ error: "解析失敗", detail: err.message });
  }
}
