// Vercel Serverless Function — AI 收盤策略分析
// API Key 安全地存在後端，前端不會暴露
import { callAiRaw, ensureAiConfigured } from "./_lib/ai-provider.js";

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
    const {
      systemPrompt,
      userPrompt,
      maxTokens = 2200,
      allowThinking = false,
    } = req.body || {};
    const data = await callAiRaw({
      system: systemPrompt,
      maxTokens,
      allowThinking,
      messages: [{ role: "user", content: userPrompt }],
    });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "AI 分析失敗", detail: err.message });
  }
}
