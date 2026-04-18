import { createHash } from 'crypto'
import { list, put } from '@vercel/blob'
import supplyChain from '../src/data/supplyChain.json' with { type: 'json' }
import {
  callAiRaw,
  callGeminiGrounded,
  ensureAiConfigured,
  extractGeminiText,
} from './_lib/ai-provider.js'
import {
  buildCmoneyAggregateItem,
  buildCmoneyInsightItem,
  collectCmoneyNotes,
} from './cmoney-notes.js'
import { buildCnyesAggregateItem, fetchCnyesAggregate } from './_lib/cnyes-target-price.js'
import { INIT_HOLDINGS, INIT_HOLDINGS_JINLIANCHENG } from '../src/seedData.js'

const ANALYST_REPORTS_BLOB_PREFIX = 'analyst-reports'
const VM_ANALYST_REPORTS_PATH = '/internal/analyst-reports'
const VM_POLL_INTERVAL_MS = 1500
const VM_POLL_TIMEOUT_MS = 45000

const STOCK_NAME_BY_CODE = new Map(
  [
    ...Object.entries(supplyChain || {}).map(([code, value]) => ({
      code,
      name: String(value?.name || '').trim(),
    })),
    ...INIT_HOLDINGS,
    ...INIT_HOLDINGS_JINLIANCHENG,
  ]
    .map((item) => [String(item?.code || '').trim(), String(item?.name || '').trim()])
    .filter(([code, name]) => code && name)
)

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

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '')
      .trim()
      .toLowerCase()
  )
}

function getBlobToken() {
  return String(process.env.PUB_BLOB_READ_WRITE_TOKEN || '').trim()
}

function getBridgeBaseUrl() {
  return String(process.env.BRIDGE_BASE_URL || '')
    .trim()
    .replace(/\/$/, '')
}

function getBridgeInternalToken() {
  return String(process.env.BRIDGE_INTERNAL_TOKEN || process.env.BRIDGE_AUTH_TOKEN || '').trim()
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function normalizeTicker(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
}

export function resolveStockInput(input = {}) {
  const code = normalizeTicker(input.code || input.ticker)
  const name = String(input.name || '').trim() || STOCK_NAME_BY_CODE.get(code) || ''
  return { code, name }
}

export async function readAnalystReportsSnapshot(
  code,
  { token = getBlobToken(), fetchImpl = fetch } = {}
) {
  const normalizedCode = normalizeTicker(code)
  if (!normalizedCode || !token) return null

  const { blobs } = await list({
    prefix: `${ANALYST_REPORTS_BLOB_PREFIX}/${normalizedCode}.json`,
    limit: 1,
    token,
  })

  if (!blobs.length) return null

  const response = await fetchImpl(blobs[0].url)
  if (!response.ok) {
    throw new Error(`blob read failed (${response.status})`)
  }

  return response.json()
}

export async function writeAnalystReportsSnapshot(code, payload, { token = getBlobToken() } = {}) {
  const normalizedCode = normalizeTicker(code)
  if (!normalizedCode) throw new Error('code is required')
  if (!token) throw new Error('PUB_BLOB_READ_WRITE_TOKEN is required for analyst-reports writes')

  await put(
    `${ANALYST_REPORTS_BLOB_PREFIX}/${normalizedCode}.json`,
    JSON.stringify(payload, null, 2),
    {
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      access: 'public',
      contentType: 'application/json',
    }
  )
}

export function isCmoneyNotesEnabled() {
  return parseBoolean(process.env.USE_CMONEY_NOTES)
}

export function isGeminiGroundingEnabled() {
  return parseBoolean(process.env.USE_GEMINI_GROUNDING)
}

export function buildGeminiGroundingPrompt(code, name) {
  return `你是台股券商目標價蒐集器。
任務：找出「近30天，${String(code || '').trim()} ${String(name || '').trim()}」公開可驗證的券商/投顧目標價。
只接受同時滿足：
1. 有明確機構名稱 (firm)
2. 有明確 target price 數字
3. 有可追溯日期 (YYYY-MM-DD)
4. 有公開 source_url

只輸出 JSON：
{"reports":[{"firm":"", "target":0, "stance":"buy|hold|sell|outperform|neutral|underperform|unknown", "date":"YYYY-MM-DD", "source_url":"https://...", "evidence":""}]}

規則：
- 同一 firm 重複只保留最新一筆
- 若只有區間/共識均值/媒體轉述且無 firm，丟棄
- 若無法確認，不要猜
- 不要輸出 markdown`
}

function normalizeGeminiJsonText(text) {
  return String(text || '')
    .replace(/```json|```/g, '')
    .trim()
}

function normalizeGeminiStance(value) {
  return ['buy', 'hold', 'sell', 'outperform', 'neutral', 'underperform', 'unknown'].includes(value)
    ? value
    : 'unknown'
}

function normalizeGeminiDate(value) {
  const normalized = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null
  const timestamp = Date.parse(`${normalized}T00:00:00Z`)
  return Number.isNaN(timestamp) ? null : normalized
}

function normalizeSourceUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export function normalizeReportDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const normalized = raw.replace(/[/.]/g, '-')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    const [, year, month, day] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dedupeLatestGeminiReports(reports = []) {
  const latestByFirm = new Map()

  for (const report of Array.isArray(reports) ? reports : []) {
    const firm = String(report?.firm || '').trim()
    const date = normalizeGeminiDate(report?.date)
    const target = Number(report?.target)
    const sourceUrl = normalizeSourceUrl(report?.source_url)

    if (!firm || !date || !Number.isFinite(target) || target <= 0 || !sourceUrl) continue

    const normalized = {
      firm,
      target,
      stance: normalizeGeminiStance(String(report?.stance || '').trim()),
      date,
      source_url: sourceUrl,
      evidence: String(report?.evidence || '').trim(),
    }
    const previous = latestByFirm.get(firm)
    if (!previous || previous.date < normalized.date) {
      latestByFirm.set(firm, normalized)
    }
  }

  return [...latestByFirm.values()].sort((a, b) => b.date.localeCompare(a.date))
}

function buildReportId(stock, report) {
  return createHash('sha1')
    .update([stock.code, report.firm, report.target, report.date, report.source_url].join('|'))
    .digest('hex')
    .slice(0, 16)
}

function normalizeUnifiedStance(value) {
  const raw = String(value || '').trim()
  if (['buy', 'hold', 'sell', 'outperform', 'neutral', 'underperform', 'unknown'].includes(raw)) {
    return raw
  }
  if (raw === 'bullish') return 'buy'
  if (raw === 'neutral') return 'neutral'
  if (raw === 'bearish') return 'sell'
  return 'unknown'
}

function normalizeReportFirm(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .trim()
}

function normalizeStructuredReport(report, source) {
  const firm = normalizeReportFirm(report?.firm)
  const target = Number(report?.target)
  const date = normalizeReportDate(report?.date || report?.publishedAt)
  const sourceUrl = normalizeSourceUrl(report?.source_url || report?.url)
  if (!firm || !date || !Number.isFinite(target) || target <= 0 || !sourceUrl) return null

  return {
    firm,
    target,
    date,
    stance: normalizeUnifiedStance(report?.stance),
    source_url: sourceUrl,
    evidence: String(
      report?.evidence || report?.targetEvidence || report?.summary || report?.snippet || ''
    ).trim(),
    source,
  }
}

export function mergeLatestReportsByFirm(sourceEntries = []) {
  const priority = { gemini: 3, rss: 2, cmoney: 1 }
  const latestByFirm = new Map()

  for (const entry of Array.isArray(sourceEntries) ? sourceEntries : []) {
    const normalized = normalizeStructuredReport(entry, entry?.source)
    if (!normalized) continue

    const previous = latestByFirm.get(normalized.firm)
    if (!previous) {
      latestByFirm.set(normalized.firm, normalized)
      continue
    }

    if (previous.date < normalized.date) {
      latestByFirm.set(normalized.firm, normalized)
      continue
    }

    if (
      previous.date === normalized.date &&
      (priority[normalized.source] || 0) > (priority[previous.source] || 0)
    ) {
      latestByFirm.set(normalized.firm, normalized)
    }
  }

  return [...latestByFirm.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export function parseGeminiGroundedReports(payload) {
  try {
    const parsed = JSON.parse(normalizeGeminiJsonText(payload))
    return dedupeLatestGeminiReports(parsed?.reports)
  } catch {
    return []
  }
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

function buildGeminiInsightItem(stock, report, index) {
  const id = createHash('sha1')
    .update([stock.code, report.firm, report.target, report.date, report.source_url].join('|'))
    .digest('hex')
    .slice(0, 16)

  return {
    id,
    hash: id,
    title: `${report.firm} ${stock.name}(${stock.code}) 目標價 ${report.target}`,
    url: report.source_url,
    source: report.firm,
    publishedAt: report.date,
    snippet: report.evidence,
    summary: report.evidence,
    target: report.target,
    targetType: 'price-target',
    targetEvidence: report.evidence,
    firm: report.firm,
    stance: report.stance,
    tags: ['gemini-grounding'],
    confidence: null,
    extractedAt: new Date().toISOString(),
    rank: index + 1,
  }
}

async function collectGeminiGroundedReports(stock) {
  const prompt = buildGeminiGroundingPrompt(stock.code, stock.name)
  const response = await callGeminiGrounded({ prompt })
  const reports = parseGeminiGroundedReports(extractGeminiText(response))
  const items = reports.map((report, index) => buildGeminiInsightItem(stock, report, index))

  return {
    query: { code: stock.code, name: stock.name, mode: 'gemini-grounding' },
    fetchedAt: new Date().toISOString(),
    totalFound: items.length,
    newCount: items.length,
    items,
    targetPriceSource: items.length > 0 ? 'gemini' : 'rss',
    targetPriceCount: items.length,
  }
}

async function collectRssReports(stock, knownHashes, maxItems, maxExtract) {
  const rssUrls = buildRssUrls(stock.code, stock.name)
  const xmlPayloads = await fetchMultipleRss(rssUrls)
  const deduped = normalizeRssItems(xmlPayloads, { code: stock.code, name: stock.name })

  const known = new Set((Array.isArray(knownHashes) ? knownHashes : []).filter(Boolean))
  const unseenItems = deduped.filter((item) => !known.has(item.id))
  const newItems = rankRssItemsForExtraction(unseenItems).slice(
    0,
    Math.max(1, Number(maxItems) || 6)
  )
  const itemsForExtraction = newItems.slice(0, Math.max(1, Number(maxExtract) || 4))
  const insights = await extractInsights(stock, itemsForExtraction)

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

  const targetPriceCount = items.filter(
    (item) => Number.isFinite(Number(item?.target)) && Number(item.target) > 0
  ).length

  return {
    query: { code: stock.code, name: stock.name, rssUrls, mode: 'rss' },
    fetchedAt: new Date().toISOString(),
    totalFound: deduped.length,
    newCount: items.length,
    items,
    targetPriceSource: targetPriceCount > 0 ? 'rss' : 'per-band',
    targetPriceCount,
  }
}

async function collectCmoneyReports(stock) {
  const payload = await collectCmoneyNotes({ code: stock.code, name: stock.name })
  const items = payload.reports.map((report, index) => buildCmoneyInsightItem(stock, report, index))

  if (payload.aggregate) {
    items.push(buildCmoneyAggregateItem(stock, payload.aggregate))
  }

  return {
    query: { code: stock.code, name: stock.name, mode: 'cmoney' },
    fetchedAt: new Date().toISOString(),
    totalFound: items.length,
    newCount: items.length,
    items,
    reports: payload.reports,
    aggregate: payload.aggregate,
    targetPriceSource: items.length > 0 ? 'cmoney' : 'per-band',
    targetPriceCount: payload.reports.length,
  }
}

async function collectCnyesReports(stock) {
  const payload = await fetchCnyesAggregate(stock.code)
  const items = payload.aggregate ? [buildCnyesAggregateItem(stock, payload.aggregate)] : []

  return {
    query: { code: stock.code, name: stock.name, mode: 'cnyes' },
    fetchedAt: new Date().toISOString(),
    totalFound: items.length,
    newCount: items.length,
    items,
    aggregate: payload.aggregate,
    reason: payload.reason || null,
    targetPriceSource: payload.aggregate ? 'cnyes' : 'per-band',
    targetPriceCount: 0,
  }
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

export async function runAnalystReportsPipeline(input = {}) {
  const { code, name } = resolveStockInput(input)
  const { knownHashes = [], maxItems = 6, maxExtract = 4 } = input || {}
  if (!code || !name) throw new Error('缺少 code 或 name')

  const stock = { code, name }
  let geminiPayload = null
  let rssPayload = null
  let cmoneyPayload = null
  let cnyesPayload = null

  if (isGeminiGroundingEnabled()) {
    try {
      geminiPayload = await collectGeminiGroundedReports(stock)
    } catch {
      geminiPayload = null
    }
  }

  if (!geminiPayload || geminiPayload.targetPriceCount === 0) {
    try {
      rssPayload = await collectRssReports(stock, knownHashes, maxItems, maxExtract)
    } catch {
      rssPayload = {
        query: { code: stock.code, name: stock.name, mode: 'rss' },
        fetchedAt: new Date().toISOString(),
        totalFound: 0,
        newCount: 0,
        items: [],
        targetPriceSource: 'per-band',
        targetPriceCount: 0,
      }
    }
  }

  if (
    isCmoneyNotesEnabled() &&
    (!geminiPayload || geminiPayload.targetPriceCount === 0) &&
    (!rssPayload || rssPayload.targetPriceCount === 0)
  ) {
    try {
      cmoneyPayload = await collectCmoneyReports(stock)
    } catch {
      cmoneyPayload = null
    }
  }

  try {
    cnyesPayload = await collectCnyesReports(stock)
  } catch {
    cnyesPayload = null
  }

  const mergedReports = mergeLatestReportsByFirm([
    ...(geminiPayload?.reports || geminiPayload?.items || []).map((item) => ({
      ...item,
      source: 'gemini',
    })),
    ...(rssPayload?.items || [])
      .filter((item) => Number.isFinite(Number(item?.target)) && Number(item.target) > 0)
      .map((item) => ({ ...item, source: 'rss' })),
    ...(cmoneyPayload?.reports || cmoneyPayload?.items || []).map((item) => ({
      ...item,
      source: 'cmoney',
    })),
  ])

  let payload = null
  if (mergedReports.length > 0) {
    const primarySource = mergedReports[0]?.source || 'rss'
    const items = [
      ...mergedReports.map((report, index) => ({
        id: buildReportId(stock, report),
        hash: buildReportId(stock, report),
        title: `${report.firm} ${stock.name}(${stock.code}) 目標價 ${report.target}`,
        url: report.source_url,
        source: report.firm,
        publishedAt: report.date,
        snippet: report.evidence,
        summary: report.evidence,
        target: report.target,
        targetType: 'price-target',
        targetEvidence: report.evidence,
        firm: report.firm,
        stance: report.stance,
        tags: [`${report.source}-merged`],
        confidence: null,
        extractedAt: new Date().toISOString(),
        rank: index + 1,
      })),
      ...(cnyesPayload?.items || []),
    ]

    payload = {
      query: {
        code: stock.code,
        name: stock.name,
        mode: 'merged',
      },
      fetchedAt:
        geminiPayload?.fetchedAt ||
        rssPayload?.fetchedAt ||
        cmoneyPayload?.fetchedAt ||
        cnyesPayload?.fetchedAt ||
        new Date().toISOString(),
      totalFound: items.length,
      newCount: items.length,
      items,
      aggregate: cnyesPayload?.aggregate || cmoneyPayload?.aggregate || null,
      targetPriceSource: primarySource,
      targetPriceCount: items.length,
    }
  } else if (rssPayload?.targetPriceCount > 0) {
    payload = {
      ...rssPayload,
      items: [...(rssPayload.items || []), ...(cnyesPayload?.items || [])],
      aggregate: cnyesPayload?.aggregate || null,
      totalFound: (rssPayload.items || []).length + (cnyesPayload?.items || []).length,
      newCount: (rssPayload.items || []).length + (cnyesPayload?.items || []).length,
      targetPriceSource: 'rss',
      targetPriceCount: rssPayload.targetPriceCount,
    }
  } else if (cnyesPayload?.aggregate) {
    payload = {
      ...cnyesPayload,
      targetPriceSource: 'cnyes',
      targetPriceCount: 0,
    }
  } else if (cmoneyPayload?.aggregate) {
    payload = {
      ...cmoneyPayload,
      targetPriceSource: 'cmoney',
      targetPriceCount: 0,
    }
  } else if (rssPayload) {
    payload = rssPayload
  } else {
    payload = {
      query: { code: stock.code, name: stock.name, mode: 'per-band' },
      fetchedAt: new Date().toISOString(),
      totalFound: 0,
      newCount: 0,
      items: [],
      targetPriceSource: 'per-band',
      targetPriceCount: 0,
    }
  }

  return payload
}

async function triggerVmRefresh(input = {}, { fetchImpl = fetch } = {}) {
  const baseUrl = getBridgeBaseUrl()
  const token = getBridgeInternalToken()
  if (!baseUrl || !token) throw new Error('VM bridge config missing')

  const response = await fetchImpl(`${baseUrl}${VM_ANALYST_REPORTS_PATH}?wait=1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      payload?.detail || payload?.error || `VM analyst-reports failed (${response.status})`
    )
  }
  if (payload?.result) return payload.result

  const jobId = String(payload?.jobId || '').trim()
  if (!jobId) throw new Error('VM analyst-reports missing jobId')

  const deadline = Date.now() + VM_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(VM_POLL_INTERVAL_MS)
    const pollResponse = await fetchImpl(
      `${baseUrl}${VM_ANALYST_REPORTS_PATH}/${encodeURIComponent(jobId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    const pollPayload = await pollResponse.json().catch(() => null)
    if (!pollResponse.ok) {
      throw new Error(
        pollPayload?.detail || pollPayload?.error || `VM poll failed (${pollResponse.status})`
      )
    }
    if (pollPayload?.status === 'completed' && pollPayload?.result) return pollPayload.result
    if (pollPayload?.status === 'failed') {
      throw new Error(pollPayload?.error || 'VM analyst-reports job failed')
    }
  }

  throw new Error('VM analyst-reports poll timeout')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    if (req.method === 'GET') {
      const { code } = resolveStockInput(req.query || {})
      if (!code) return res.status(400).json({ error: '缺少 code 或 ticker' })

      const snapshot = await readAnalystReportsSnapshot(code)
      if (!snapshot) {
        return res.status(404).json({ error: `no analyst-reports snapshot for ${code}` })
      }

      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
      res.setHeader('x-target-price-source', snapshot?.targetPriceSource || 'rss')
      res.setHeader('x-target-price-count', String(snapshot?.targetPriceCount || 0))
      return res.status(200).json(snapshot)
    }

    const refresh = parseBoolean(req.query?.refresh)
    const input = req.body || {}
    const { code, name } = resolveStockInput(input)
    if (!code || !name) {
      return res.status(400).json({ error: '缺少 code 或 name' })
    }

    let payload = null
    if (refresh) {
      try {
        payload = await triggerVmRefresh({ ...input, code, name })
      } catch (vmError) {
        payload = await runAnalystReportsPipeline({ ...input, code, name })
        try {
          await writeAnalystReportsSnapshot(code, payload)
        } catch {
          // best effort: fallback path should still return fresh payload even if blob write fails
        }
        res.setHeader('x-analyst-reports-fallback', 'local')
        res.setHeader('x-analyst-reports-vm-error', String(vmError?.message || 'unknown'))
      }
    } else {
      payload = await runAnalystReportsPipeline({ ...input, code, name })
    }

    res.setHeader('x-target-price-source', payload.targetPriceSource)
    res.setHeader('x-target-price-count', String(payload.targetPriceCount))
    return res.status(200).json(payload)
  } catch (err) {
    return res.status(500).json({ error: '公開報告索引抓取失敗', detail: err.message })
  }
}
