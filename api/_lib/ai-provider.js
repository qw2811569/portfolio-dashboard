// Central AI adapter.
// If you want to swap Claude / endpoint / model later, update this file only.
//
// Preferred env vars:
// - AI_API_KEY
// - AI_MODEL
// - AI_MODE (alias of AI_MODEL)
// - AI_API_ENDPOINT
// - AI_ENABLE_EXTENDED_THINKING
// - AI_THINKING_BUDGET_TOKENS
//
// Backward-compatible fallback:
// - ANTHROPIC_API_KEY
// - ANTHROPIC_MODEL

const DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_VERSION = "2023-06-01";
const MIN_THINKING_BUDGET = 1024;

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export function getAiConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  const thinkingBudget = Number(process.env.AI_THINKING_BUDGET_TOKENS || 2048);
  return {
    provider: process.env.AI_PROVIDER || "anthropic",
    displayName: process.env.AI_PROVIDER_NAME || "Claude",
    endpoint: process.env.AI_API_ENDPOINT || DEFAULT_ENDPOINT,
    apiKey,
    apiKeyEnv: process.env.AI_API_KEY ? "AI_API_KEY" : "ANTHROPIC_API_KEY",
    model: process.env.AI_MODEL || process.env.AI_MODE || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    apiVersion: process.env.AI_API_VERSION || DEFAULT_VERSION,
    enableExtendedThinking: parseBoolean(process.env.AI_ENABLE_EXTENDED_THINKING),
    thinkingBudgetTokens: Number.isFinite(thinkingBudget) ? thinkingBudget : 2048,
  };
}

export function ensureAiConfigured() {
  const config = getAiConfig();
  if (!config.apiKey) {
    throw new Error("未設定 AI_API_KEY（或相容的 ANTHROPIC_API_KEY）");
  }
  return config;
}

export function extractAiText(data) {
  const parts = Array.isArray(data?.content)
    ? data.content
        .filter(item => item?.type === "text" && typeof item.text === "string")
        .map(item => item.text)
    : [];
  return parts.join("\n\n");
}

export async function callAiRaw({ system, messages, maxTokens = 3000, allowThinking = true }) {
  const config = ensureAiConfigured();
  const thinking =
    allowThinking &&
    config.enableExtendedThinking &&
    config.thinkingBudgetTokens >= MIN_THINKING_BUDGET &&
    config.thinkingBudgetTokens < maxTokens
      ? {
          type: "enabled",
          budget_tokens: config.thinkingBudgetTokens,
        }
      : undefined;
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": config.apiVersion,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      system,
      ...(thinking ? { thinking } : {}),
      messages,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.error ||
      data?.detail ||
      `AI request failed (${response.status})`;
    throw new Error(detail);
  }
  return data;
}

export async function callAiText({ system, user, maxTokens = 3000 }) {
  const data = await callAiRaw({
    system,
    maxTokens,
    messages: [{ role: "user", content: user }],
  });
  return extractAiText(data);
}

export async function callAiImage({ system, base64, mediaType = "image/jpeg", prompt = "解析這張成交截圖", maxTokens = 600 }) {
  return callAiRaw({
    system,
    maxTokens,
    allowThinking: false,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
}
