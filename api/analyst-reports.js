import { createHash } from "crypto";
import { callAiRaw, ensureAiConfigured } from "./_lib/ai-provider.js";

function decodeHtml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeHtml(match?.[1] || "");
}

function parseRssItems(xml) {
  const items = Array.from(String(xml || "").matchAll(/<item\b[\s\S]*?<\/item>/gi)).map(match => match[0]);
  return items.map(item => ({
    title: pickTag(item, "title"),
    link: pickTag(item, "link"),
    pubDate: pickTag(item, "pubDate"),
    description: pickTag(item, "description"),
    source: pickTag(item, "source"),
  }));
}

function formatPublishedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("zh-TW");
}

function buildItemHash(item) {
  return createHash("sha1")
    .update([item.title, item.link, item.pubDate, item.source].join("|"))
    .digest("hex")
    .slice(0, 16);
}

function looksRelevant(item, code, name) {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  return haystack.includes(String(code || "").toLowerCase()) || haystack.includes(String(name || "").toLowerCase());
}

async function fetchTextWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "portfolio-dashboard/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, text/plain;q=0.8",
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`RSS request failed (${response.status})`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMultipleRss(urls, timeoutMs = 8000) {
  const results = await Promise.allSettled(
    urls.map(url => fetchTextWithTimeout(url, timeoutMs))
  );
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .join('\n');
}

async function extractInsights(stock, items) {
  if (!Array.isArray(items) || items.length === 0) return new Map();
  try {
    ensureAiConfigured();
  } catch {
    return new Map();
  }

  try {
    const data = await callAiRaw({
      system: `你是台股公開報告索引整理器。你會從新聞標題與摘要中，抽出對持股 dossier 最有價值的結構化資訊。
只根據提供的標題與摘要判斷，不可編造全文內容。
回傳純 JSON，不要 markdown。格式：
{"items":[{"id":"原樣回傳","summary":"一句話摘要","target":數字或null,"firm":"券商/來源或空字串","stance":"bullish/neutral/bearish/unknown","tags":["標籤1","標籤2"],"confidence":0到1}]}

規則：
- 若明確提到目標價就填 target
- 若只是偏多/偏空但沒有數字，target 填 null
- firm 優先抽券商/研究機構，抓不到就留空
- summary 必須短，聚焦這份報告/新聞對投資判斷的意義`,
      allowThinking: false,
      maxTokens: 900,
      messages: [{
        role: "user",
        content: `股票：${stock.name}(${stock.code})
請整理以下公開報告索引：
${items.map(item => `- [${item.id}] ${item.title}\n  來源：${item.source || "未知"} | 日期：${item.publishedAt || "未知"}\n  摘要：${item.snippet || "無"}`).join("\n\n")}`,
      }],
    });
    const text = Array.isArray(data?.content)
      ? data.content.filter(item => item?.type === "text").map(item => item.text).join("\n\n")
      : "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return new Map(
      (Array.isArray(parsed?.items) ? parsed.items : [])
        .filter(item => item && typeof item.id === "string")
        .map(item => [item.id, item])
    );
  } catch {
    return new Map();
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { code, name, knownHashes = [], maxItems = 6, maxExtract = 2 } = req.body || {};
    if (!code || !name) {
      return res.status(400).json({ error: "缺少 code 或 name" });
    }

    // 多個 RSS 來源：Google News + 鉅亨網 + 經濟日報
    const rssUrls = [
      `https://news.google.com/rss/search?q=${encodeURIComponent(`${code} ${name} 台股 目標價 投顧 研究報告 法說 財報 when:30d`)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
      `https://news.cnyes.com/rss/cat/tw_stock`,
      `https://money.udn.com/rssfeed/news/1001/5710`,
    ];
    const xml = await fetchMultipleRss(rssUrls);
    const parsedItems = parseRssItems(xml)
      .filter(item => item.title && item.link)
      .filter(item => looksRelevant(item, code, name))
      .map(item => ({
        ...item,
        publishedAt: formatPublishedAt(item.pubDate),
        snippet: item.description,
      }));

    const deduped = [];
    const seen = new Set();
    for (const item of parsedItems) {
      const id = buildItemHash(item);
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push({
        id,
        hash: id,
        title: item.title,
        url: item.link,
        source: item.source || "",
        publishedAt: item.publishedAt,
        snippet: item.snippet || "",
      });
    }

    const known = new Set((Array.isArray(knownHashes) ? knownHashes : []).filter(Boolean));
    const newItems = deduped.filter(item => !known.has(item.id)).slice(0, Math.max(1, Number(maxItems) || 6));
    const insights = await extractInsights({ code, name }, newItems.slice(0, Math.max(1, Number(maxExtract) || 2)));

    const items = newItems.map(item => {
      const insight = insights.get(item.id);
      const target = Number(insight?.target);
      const confidence = Number(insight?.confidence);
      return {
        ...item,
        summary: typeof insight?.summary === "string" ? insight.summary.trim() : "",
        target: Number.isFinite(target) && target > 0 ? target : null,
        firm: typeof insight?.firm === "string" ? insight.firm.trim() : "",
        stance: ["bullish", "neutral", "bearish", "unknown"].includes(insight?.stance) ? insight.stance : "unknown",
        tags: Array.isArray(insight?.tags) ? insight.tags.filter(Boolean).slice(0, 4) : [],
        confidence: Number.isFinite(confidence) ? confidence : null,
        extractedAt: new Date().toISOString(),
      };
    });

    return res.status(200).json({
      query,
      fetchedAt: new Date().toISOString(),
      totalFound: deduped.length,
      newCount: items.length,
      items,
    });
  } catch (err) {
    return res.status(500).json({ error: "公開報告索引抓取失敗", detail: err.message });
  }
}
