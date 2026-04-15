import { createHash } from 'crypto'

const CMONEY_TAG_URL = 'https://www.cmoney.tw/notes/?tag=78570'
const CMONEY_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
const VALID_STANCES = new Set([
  'buy',
  'hold',
  'sell',
  'outperform',
  'neutral',
  'underperform',
  'unknown',
])

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeDate(value) {
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

function parseNumber(value) {
  const normalized = String(value || '')
    .replace(/,/g, '')
    .trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeFirm(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .trim()
}

function normalizeStance(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'unknown'

  if (VALID_STANCES.has(raw)) return raw
  if (/(看多|買進|優於大盤|增加持股|加碼)/.test(raw)) return 'buy'
  if (/(中立|持有|區間操作)/.test(raw)) return 'hold'
  if (/(看空|賣出|減碼|劣於大盤)/.test(raw)) return 'sell'
  return 'unknown'
}

function findTitle(html) {
  return (
    decodeHtml(
      html.match(/<h1[^>]*class="[^"]*twoline-ellipsis[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ) || decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1])
  )
}

function findArticleBody(html) {
  return (
    html.match(
      /<div[^>]*itemprop=["']articleBody["'][^>]*class="[^"]*articleBody__font[^"]*"[^>]*>([\s\S]*?)<div id='info-useful'/i
    )?.[1] || ''
  )
}

function findPublishedDate(html) {
  return (
    normalizeDate(html.match(/article:published_time" content="([^"]+)"/i)?.[1]) ||
    normalizeDate(
      html.match(/coauthor__timeContent--publish[^>]*notedate=['"]([^'"]+)['"]/i)?.[1]
    ) ||
    normalizeDate(html.match(/datePublished"\s*:\s*"([^"]+)"/i)?.[1])
  )
}

export function extractCmoneyArticles(html) {
  const rawList = html.match(/var\s+notedatalist\s*=\s*(\[[\s\S]*?\])\s*\|\|\s*\[\];/i)?.[1]
  if (!rawList) return []

  try {
    const parsed = JSON.parse(rawList)
    return parsed
      .filter((item) => Array.isArray(item) && item.length >= 2)
      .map(([url, title]) => ({
        url: String(url || '').trim(),
        title: String(title || '')
          .replace(/^\d+：/, '')
          .trim(),
      }))
      .filter((item) => item.url && item.title)
  } catch {
    return []
  }
}

export function filterCmoneyArticles(articles, { code, name }) {
  const codeRegex = new RegExp(`\\b${escapeRegExp(code)}\\b`)
  const nameText = String(name || '').trim()

  return (Array.isArray(articles) ? articles : []).filter((article) => {
    const title = String(article?.title || '')
    return codeRegex.test(title) || (nameText && title.includes(nameText))
  })
}

function buildEvidence(text, matcher) {
  const match = String(text || '').match(matcher)
  return match?.[0]?.trim() || String(text || '').trim()
}

export function parseCmoneyArticle(html, article = {}) {
  const title = String(article?.title || findTitle(html)).trim()
  const url = String(article?.url || '').trim()
  const publishedAt = findPublishedDate(html)
  const bodyHtml = findArticleBody(html)
  const bodyText = decodeHtml(bodyHtml)
  const combinedText = [title, bodyText].filter(Boolean).join(' ')

  if (!combinedText.includes('績效評等報告')) {
    return { reports: [], aggregate: null, meta: { title, publishedAt, url } }
  }

  const singleFirm =
    combinedText.match(/僅([\u4e00-\u9fa5A-Za-z0-9&．\-]+?(?:投顧|證券))發布績效評等報告/) ||
    combinedText.match(/僅([\u4e00-\u9fa5A-Za-z0-9&．\-]+?)發布績效評等報告/)
  const targetValue =
    parseNumber(combinedText.match(/目標價為\s*([0-9][0-9,]*(?:\.\d+)?)(?=\s*元)/)?.[1]) ||
    parseNumber(combinedText.match(/目標價上看\s*([0-9][0-9,]*(?:\.\d+)?)(?=\s*元)/)?.[1])
  const stanceMatch =
    combinedText.match(/評價為(看多|中立|看空)/)?.[1] ||
    combinedText.match(/評等為(買進|中立|賣出)/)?.[1] ||
    ''

  if (singleFirm && targetValue && publishedAt) {
    const firm = normalizeFirm(singleFirm[1])
    const evidence = buildEvidence(
      bodyText || combinedText,
      /[^。]*發布績效評等報告[^。]*目標價[^。]*元。?/i
    )

    return {
      reports: [
        {
          firm,
          target: targetValue,
          date: publishedAt,
          stance: normalizeStance(stanceMatch),
          source_url: url,
          evidence,
        },
      ],
      aggregate: null,
      meta: { title, publishedAt, url },
    }
  }

  const rangeMatch = combinedText.match(
    /目標價區間為\s*([0-9][0-9,]*(?:\.\d+)?)\s*[～~-]\s*([0-9][0-9,]*(?:\.\d+)?)(?=\s*元)/
  )
  const min = parseNumber(rangeMatch?.[1])
  const max = parseNumber(rangeMatch?.[2])
  const firmCount = Number(combinedText.match(/今日有(\d+)家券商發布績效評等報告/)?.[1] || 0)

  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0 && publishedAt) {
    return {
      reports: [],
      aggregate: {
        firms: [],
        firmsCount: firmCount > 0 ? firmCount : undefined,
        medianTarget: Number(((min + max) / 2).toFixed(2)),
        min,
        max,
        date: publishedAt,
        source_article_url: url,
        evidence: buildEvidence(bodyText || combinedText, /[^。]*目標價區間為[^。]*元。?/i),
      },
      meta: { title, publishedAt, url },
    }
  }

  return { reports: [], aggregate: null, meta: { title, publishedAt, url } }
}

function compareDatesDesc(left, right) {
  const leftDate = normalizeDate(left) || '0000-00-00'
  const rightDate = normalizeDate(right) || '0000-00-00'
  return rightDate.localeCompare(leftDate)
}

function mergeLatestReports(reports) {
  const latestByFirm = new Map()

  for (const report of Array.isArray(reports) ? reports : []) {
    const firm = normalizeFirm(report?.firm)
    const date = normalizeDate(report?.date)
    const target = Number(report?.target)
    const sourceUrl = String(report?.source_url || '').trim()
    if (!firm || !date || !Number.isFinite(target) || target <= 0 || !sourceUrl) continue

    const normalized = {
      firm,
      target,
      date,
      stance: normalizeStance(report?.stance),
      source_url: sourceUrl,
      evidence: String(report?.evidence || '').trim(),
    }
    const previous = latestByFirm.get(firm)
    if (!previous || previous.date < normalized.date) {
      latestByFirm.set(firm, normalized)
    }
  }

  return [...latestByFirm.values()].sort((a, b) => compareDatesDesc(a.date, b.date))
}

function mergeAggregates(aggregates) {
  const validAggregates = (Array.isArray(aggregates) ? aggregates : []).filter(
    (item) =>
      item &&
      Number.isFinite(Number(item.min)) &&
      Number.isFinite(Number(item.max)) &&
      Number(item.min) > 0 &&
      Number(item.max) > 0
  )
  if (validAggregates.length === 0) return null

  const values = validAggregates
    .flatMap((item) => [Number(item.min), Number(item.max)])
    .sort((a, b) => a - b)
  const middle = Math.floor(values.length / 2)
  const medianTarget =
    values.length % 2 === 0
      ? Number(((values[middle - 1] + values[middle]) / 2).toFixed(2))
      : values[middle]

  const latest = [...validAggregates].sort((a, b) => compareDatesDesc(a.date, b.date))[0]
  return {
    firms: [],
    firmsCount:
      validAggregates.reduce((sum, item) => sum + (Number(item.firmsCount) || 0), 0) || undefined,
    medianTarget,
    min: values[0],
    max: values[values.length - 1],
    date: latest?.date || null,
    source_article_url: latest?.source_article_url || null,
    evidence: String(latest?.evidence || '').trim(),
  }
}

async function fetchHtml(url, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': CMONEY_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`CMoney request failed (${response.status})`)
  }
  return text
}

export async function collectCmoneyNotes(
  { code, name },
  { fetchImpl = fetch, tagUrl = CMONEY_TAG_URL } = {}
) {
  const listHtml = await fetchHtml(tagUrl, { fetchImpl })
  const candidateArticles = filterCmoneyArticles(extractCmoneyArticles(listHtml), { code, name })
  const articleHtmlCache = new Map()
  const reports = []
  const aggregates = []

  for (const article of candidateArticles) {
    const url = article.url
    if (!articleHtmlCache.has(url)) {
      articleHtmlCache.set(url, fetchHtml(url, { fetchImpl }))
    }
    const html = await articleHtmlCache.get(url)
    const parsed = parseCmoneyArticle(html, article)
    reports.push(...parsed.reports)
    if (parsed.aggregate) aggregates.push(parsed.aggregate)
  }

  return {
    reports: mergeLatestReports(reports),
    aggregate: mergeAggregates(aggregates),
    source: 'cmoney',
  }
}

export function buildCmoneyInsightItem(stock, report, index) {
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
    tags: ['cmoney-notes'],
    confidence: null,
    extractedAt: new Date().toISOString(),
    rank: index + 1,
  }
}

export function buildCmoneyAggregateItem(stock, aggregate) {
  const id = createHash('sha1')
    .update(
      [stock.code, aggregate.date, aggregate.min, aggregate.max, aggregate.source_article_url].join(
        '|'
      )
    )
    .digest('hex')
    .slice(0, 16)

  return {
    id,
    hash: id,
    title: `${stock.name}(${stock.code}) 券商目標價區間 ${aggregate.min}-${aggregate.max}`,
    url: aggregate.source_article_url,
    source: 'CMoney',
    publishedAt: aggregate.date,
    snippet: aggregate.evidence,
    summary: aggregate.evidence,
    target: null,
    targetType: 'range',
    targetEvidence: aggregate.evidence,
    firm: '',
    stance: 'unknown',
    tags: ['cmoney-notes', 'aggregate'],
    confidence: null,
    extractedAt: new Date().toISOString(),
    rank: 1,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { code, name } = req.body || {}
    if (!code || !name) {
      return res.status(400).json({ error: '缺少 code 或 name' })
    }

    const payload = await collectCmoneyNotes({ code, name })
    return res.status(200).json(payload)
  } catch (error) {
    return res.status(500).json({ error: 'CMoney notes 抓取失敗', detail: error.message })
  }
}
