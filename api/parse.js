// Vercel Serverless Function — 截圖解析（圖片 → 交易資料）
import { callAiImage, ensureAiConfigured } from "./_lib/ai-provider.js";

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
    const data = await callAiImage({
      system: systemPrompt,
      base64,
      mediaType: mediaType || "image/jpeg",
      prompt: "解析這張成交截圖",
      maxTokens: 600,
    });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "解析失敗", detail: err.message });
  }
}
