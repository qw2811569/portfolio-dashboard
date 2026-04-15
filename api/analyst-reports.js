import { createHash } from 'crypto'
import { callAiRaw, ensureAiConfigured } from './_lib/ai-provider.js'

function decodeHtml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return decodeHtml(match?.[1] || '')
}

function parseRssItems(xml) {
  const items = Array.from(String(xml || '').matchAll(/<item\b[\s\S]*?<\/item>/gi)).map(
    (match) => match[0]
  )
  return items.map((item) => ({
    title: pickTag(item, 'title'),
    link: pickTag(item, 'link'),
    pubDate: pickTag(item, 'pubDate'),
    description: pickTag(item, 'description'),
    source: pickTag(item, 'source'),
  }))
}

function formatPublishedAt(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-TW')
}

function buildItemHash(item) {
  return createHash('sha1')
    .update([item.title, item.link, item.pubDate, item.source].join('|'))
    .digest('hex')
    .slice(0, 16)
}

const TARGET_CUE_REGEX =
  /(目標價|合理價|評價上修|評價下修|預估目標價|調升目標價|調降目標價|維持目標價)/
const TARGET_VALUE_REGEXES = [
  /目標價(?:[^0-9]{0,12})?([1-9]\d{1,3}(?:\.\d+)?)(?=\s*元)/,
  /合理價(?:[^0-9]{0,12})?([1-9]\d{1,3}(?:\.\d+)?)(?=\s*元)/,
  /預估目標價為\s*([1-9]\d{1,3}(?:\.\d+)?)(?=\s*元)/,
  /目標價上看\s*([1-9]\d{1,3}(?:\.\d+)?)(?=\s*元)/,
]
const RESEARCH_CUE_REGEX = /(投顧|研究報告|券商|評等|Factset|法說|理財周刊|豐雲學堂)/
const SOCIAL_NOISE_REGEX = /(股市爆料同學會|盤中快報|千張大戶|處置股|注意股|主力|漲停|鎖漲停)/

function getItemText(item) {
  return `${item?.title || ''} ${item?.snippet || ''}`
}

export function extractExplicitTarget(value) {
  const text = String(value || '')
  if (!TARGET_CUE_REGEX.test(text)) return null

  for (const regex of TARGET_VALUE_REGEXES) {
    const match = text.match(regex)
    const target = Number(match?.[1])
    if (Number.isFinite(target) && target > 0) return target
  }

  return null
}

export function rankRssItemsForExtraction(items = []) {
  return [...(Array.isArray(items) ? items : [])]
    .map((item, index) => {
      const text = getItemText(item)
      let score = 0

      if (extractExplicitTarget(text) !== null) score += 10
      else if (TARGET_CUE_REGEX.test(text)) score += 6

      if (RESEARCH_CUE_REGEX.test(text)) score += 4
      if (SOCIAL_NOISE_REGEX.test(text)) score -= 3

      return { item, index, score }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })
    .map(({ item }) => item)
}

export function buildGoogleNewsQueries(code, name) {
  const normalizedCode = String(code || '').trim()
  const normalizedName = String(name || '').trim()
  return [
    `${normalizedCode} ${normalizedName} 目標價 when:30d`,
    `${normalizedCode} ${normalizedName} 投顧 when:30d`,
    `${normalizedCode} ${normalizedName} 研究報告 when:30d`,
  ]
}

export function buildRssUrls(code, name) {
  const googleNewsUrls = buildGoogleNewsQueries(code, name).map(
    (query) =>
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
  )

  return [
    ...googleNewsUrls,
    'https://news.cnyes.com/rss/cat/tw_stock',
    'https://money.udn.com/rssfeed/news/1001/5710',
  ]
}

function looksRelevant(item, code, name) {
  const haystack = `${item.title} ${item.description}`.toLowerCase()
  return (
    haystack.includes(String(code || '').toLowerCase()) ||
    haystack.includes(String(name || '').toLowerCase())
  )
}

async function fetchTextWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'portfolio-dashboard/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, text/plain;q=0.8',
      },
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`RSS request failed (${response.status})`)
    return text
  } finally {
    clearTimeout(timer)
  }
}

async function fetchMultipleRss(urls, timeoutMs = 8000) {
  const results = await Promise.allSettled(urls.map((url) => fetchTextWithTimeout(url, timeoutMs)))
  return results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
}

export function normalizeRssItems(xmlPayloads, { code, name }) {
  const parsedItems = (Array.isArray(xmlPayloads) ? xmlPayloads : [])
    .flatMap((xml) => parseRssItems(xml))
    .filter((item) => item.title && item.link)
    .filter((item) => looksRelevant(item, code, name))
    .map((item) => ({
      ...item,
      publishedAt: formatPublishedAt(item.pubDate),
      snippet: item.description,
    }))

  const deduped = []
  const seenUrls = new Set()
  const seenHashes = new Set()

  for (const item of parsedItems) {
    const normalizedUrl = String(item.link || '').trim()
    const id = buildItemHash(item)
    if (!normalizedUrl || seenUrls.has(normalizedUrl) || seenHashes.has(id)) continue

    seenUrls.add(normalizedUrl)
    seenHashes.add(id)
    deduped.push({
      id,
      hash: id,
      title: item.title,
      url: normalizedUrl,
      source: item.source || '',
      publishedAt: item.publishedAt,
      snippet: item.snippet || '',
    })
  }

  return deduped
}

async function extractInsights(stock, items) {
  if (!Array.isArray(items) || items.length === 0) return new Map()
  try {
    ensureAiConfigured()
  } catch {
    return new Map()
  }

  try {
    const data = await callAiRaw({
      system: `你是台股公開報告索引整理器。你會從新聞標題與摘要中，抽出對持股 dossier 最有價值的結構化資訊。
只根據提供的標題與摘要判斷，不可編造全文內容。
回傳純 JSON，不要 markdown。格式：
{"items":[{"id":"原樣回傳","summary":"一句話摘要","target":數字或null,"targetType":"price-target/range/narrative/none","targetEvidence":"原文中的目標價短語或空字串","firm":"券商/來源或空字串","stance":"bullish/neutral/bearish/unknown","tags":["標籤1","標籤2"],"confidence":0到1}]}

規則：
- 只有原文明確提到「目標價 / 合理價 / 預估目標價」才可填 target
- 「漲停至 42.9 元 / 股價來到 61.2 元 / EPS 1.68 元 / 營收 7.73 億」都不是 target，target 必須填 null
- 若提到目標區間但不是單一數字，target 填 null，targetType = "range"，targetEvidence 保留原句
- 若只是偏多/偏空但沒有目標價數字，targetType = "narrative" 或 "none"
- firm 優先抽券商/研究機構，抓不到就留空
- summary 必須短，聚焦這份報告/新聞對投資判斷的意義`,
      allowThinking: false,
      maxTokens: 900,
      messages: [
        {
          role: 'user',
          content: `股票：${stock.name}(${stock.code})
請整理以下公開報告索引：
${items.map((item) => `- [${item.id}] ${item.title}\n  來源：${item.source || '未知'} | 日期：${item.publishedAt || '未知'}\n  摘要：${item.snippet || '無'}`).join('\n\n')}`,
        },
      ],
    })
    const text = Array.isArray(data?.content)
      ? data.content
          .filter((item) => item?.type === 'text')
          .map((item) => item.text)
          .join('\n\n')
      : ''
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    return new Map(
      (Array.isArray(parsed?.items) ? parsed.items : [])
        .filter((item) => item && typeof item.id === 'string')
        .map((item) => [item.id, item])
    )
  } catch {
    return new Map()
  }
}

function normalizeTargetDetails(item, insight) {
  const itemText = getItemText(item)
  const targetFromText = extractExplicitTarget(itemText)
  const targetFromInsight = Number(insight?.target)
  const targetType = ['price-target', 'range', 'narrative', 'none'].includes(insight?.targetType)
    ? insight.targetType
    : targetFromText !== null
      ? 'price-target'
      : TARGET_CUE_REGEX.test(itemText)
        ? 'narrative'
        : 'none'

  if (Number.isFinite(targetFromText) && targetFromText > 0) {
    return {
      target: targetFromText,
      targetType: 'price-target',
      targetEvidence:
        typeof insight?.targetEvidence === 'string' && insight.targetEvidence.trim()
          ? insight.targetEvidence.trim()
          : item.title,
    }
  }

  if (
    Number.isFinite(targetFromInsight) &&
    targetFromInsight > 0 &&
    (targetType === 'price-target' || TARGET_CUE_REGEX.test(itemText))
  ) {
    return {
      target: targetFromInsight,
      targetType: 'price-target',
      targetEvidence:
        typeof insight?.targetEvidence === 'string' && insight.targetEvidence.trim()
          ? insight.targetEvidence.trim()
          : item.title,
    }
  }

  return {
    target: null,
    targetType,
    targetEvidence:
      typeof insight?.targetEvidence === 'string' && insight.targetEvidence.trim()
        ? insight.targetEvidence.trim()
        : '',
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { code, name, knownHashes = [], maxItems = 6, maxExtract = 4 } = req.body || {}
    if (!code || !name) {
      return res.status(400).json({ error: '缺少 code 或 name' })
    }

    const rssUrls = buildRssUrls(code, name)
    const xmlPayloads = await fetchMultipleRss(rssUrls)
    const deduped = normalizeRssItems(xmlPayloads, { code, name })

    const known = new Set((Array.isArray(knownHashes) ? knownHashes : []).filter(Boolean))
    const unseenItems = deduped.filter((item) => !known.has(item.id))
    const newItems = rankRssItemsForExtraction(unseenItems).slice(
      0,
      Math.max(1, Number(maxItems) || 6)
    )
    const itemsForExtraction = newItems.slice(0, Math.max(1, Number(maxExtract) || 4))
    const insights = await extractInsights({ code, name }, itemsForExtraction)

    const items = newItems.map((item) => {
      const insight = insights.get(item.id)
      const targetDetails = normalizeTargetDetails(item, insight)
      const confidence = Number(insight?.confidence)
      return {
        ...item,
        summary: typeof insight?.summary === 'string' ? insight.summary.trim() : '',
        target: targetDetails.target,
        targetType: targetDetails.targetType,
        targetEvidence: targetDetails.targetEvidence,
        firm: typeof insight?.firm === 'string' ? insight.firm.trim() : '',
        stance: ['bullish', 'neutral', 'bearish', 'unknown'].includes(insight?.stance)
          ? insight.stance
          : 'unknown',
        tags: Array.isArray(insight?.tags) ? insight.tags.filter(Boolean).slice(0, 4) : [],
        confidence: Number.isFinite(confidence) ? confidence : null,
        extractedAt: new Date().toISOString(),
      }
    })

    return res.status(200).json({
      query: { code, name, rssUrls },
      fetchedAt: new Date().toISOString(),
      totalFound: deduped.length,
      newCount: items.length,
      items,
    })
  } catch (err) {
    return res.status(500).json({ error: '公開報告索引抓取失敗', detail: err.message })
  }
}
