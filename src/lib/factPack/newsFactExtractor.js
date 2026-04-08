/**
 * News fact extractor — 主介面
 *
 * 來源: design doc v1 §3 + Qwen news_facts schema + Codex 6 維度計分
 *
 * 核心責任:
 *   1. 把 raw FinMind news 轉成 NewsFact[] (含 6 維度評分 + sentiment + cluster id)
 *   2. sentiment 用 keyword-based deterministic, 不靠 LLM 解讀
 *   3. 標記 quoted_text (逐字原文, 不允許 paraphrase)
 *   4. 標記 llm_paraphrased=false (預設, LLM 改寫時要設 true 當紅旗)
 *
 * Rule 0 enforcement:
 *   - 這個函式是 first line of defense
 *   - 如果 raw news 為 0, 回傳空陣列 + 標 unresolved (factPackBuilder 會 pre-flight check)
 *   - 如果 raw news 有資料但全部 score=0, 仍要回傳全部 (不過濾), 由 critic 決定
 *
 * Rule 0.5 (1717 v3.2 教訓):
 *   - 新聞 lookback window 必須 >= 21 個交易日, 不可只抓「我覺得重要的日期」
 *   - 1717 v1 抓 4 天 → 結論「散戶陷阱、悲觀」
 *   - 1717 v3.2 抓 14 天 → 結論「混合訊號、微正期望值」
 *   - 同一檔股票, 新聞抓 4 天 vs 14 天得出完全不同結論 → 必須抓夠
 */

/**
 * 預設 lookback days (Rule 0.5)
 * 1717 v3.2 教訓: 至少 21 天才能抓到完整 catalyst chain
 */
export const DEFAULT_NEWS_LOOKBACK_DAYS = 21
export const MIN_NEWS_LOOKBACK_DAYS = 14 // 絕對最低值, 低於這個 critic 會 warn

import { scoreNews, filterTopNewsForHighVolume } from './newsScorer.js'
import { clusterNews } from './newsClusterer.js'

// ─────────────────────────────────────────────────────────────
// Sentiment — keyword-based deterministic, 不靠 LLM
// 對應 Qwen review: sentiment 必須有但不能靠 LLM 主觀判斷
// ─────────────────────────────────────────────────────────────

// Qwen Phase 1 review fix: '出貨' 不該同時在 NEG 與 POS, 會互相中和為 neutral
// 移除歧義詞, 只保留 unambiguous 字詞
const NEGATIVE_KEYWORDS = [
  '虧損', '虧錢', '稅前虧', '稅後虧', '財報異常', '低於預期',
  '砍倉', '賣超', '大賣', '倒貨', '砍單', '取消訂單',
  '裁員', '減班', '罰款', '裁罰', '處分', '訴訟',
  '關稅', '制裁', '禁令', '政策利空',
  '降評', '下修', '調降', '不利', '衰退',
]

const POSITIVE_KEYWORDS = [
  '獲利', '盈餘', '創高', '創新高', '優於預期', '超預期',
  '大買', '買超', '回補', '買回', '加碼',
  '重大訂單', '大單', '量產', '擴產',
  '升評', '上修', '調升', '看好', '推薦', '目標價',
  '漲停', '飆漲', '突破', '站穩', '轉盈', '虧損縮減',
]

export function inferSentimentByKeyword(headline = '', content = '') {
  const text = `${headline} ${content}`.toLowerCase()
  let neg = 0
  let pos = 0
  for (const kw of NEGATIVE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) neg++
  }
  for (const kw of POSITIVE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) pos++
  }
  if (neg > pos) return 'negative'
  if (pos > neg) return 'positive'
  return 'neutral'
}

// ─────────────────────────────────────────────────────────────
// 主介面: extractNewsFacts
// ─────────────────────────────────────────────────────────────

/**
 * 把 raw FinMind news 陣列轉成 NewsFact[]
 *
 * @param {Array} rawNews - FinMind TaiwanStockNews 回傳的 data 陣列
 *   每筆預期欄位:
 *     - date: ISO datetime
 *     - title: string (標題)
 *     - source: string
 *     - link: string
 *     - description: string (可選, content)
 * @param {Object} stockMeta - { stockId, stockName }
 * @param {Object} options
 * @param {Map<string, number>} [options.priceChangeMap] - { 'YYYY-MM-DD': nextDayChangePct }
 * @param {boolean} [options.filterHighVolume=false] - 是否套用高量股篩選
 * @returns {Array<NewsFact>}
 */
export function extractNewsFacts(rawNews, stockMeta = {}, options = {}) {
  if (!Array.isArray(rawNews) || rawNews.length === 0) return []

  const { stockId = '', stockName = '' } = stockMeta
  const { priceChangeMap = new Map(), filterHighVolume = false } = options

  // 1. 第一輪: 計分 + sentiment
  let scored = rawNews.map((raw, idx) => {
    const headline = raw.title || raw.headline || ''
    const content = raw.description || raw.content || ''
    const date = raw.date || raw.published_at || ''
    const dateOnly = String(date).slice(0, 10)
    const sourceName = raw.source || raw.source_name || ''

    const nextDayChangePct = priceChangeMap.get(dateOnly) ?? null

    const scoreInput = {
      source_name: sourceName,
      headline,
      content,
      stockId,
      stockName,
      nextDayChangePct,
      sameEventSourceCount: 1, // 第一輪先設 1, 下面 cluster 後再回頭更新
    }
    const scores = scoreNews(scoreInput)

    const sentiment = inferSentimentByKeyword(headline, content)

    return {
      id: `news_${stockId || 'unknown'}_${dateOnly.replace(/-/g, '')}_${String(idx).padStart(3, '0')}`,
      source_url: raw.link || raw.url || '',
      source_name: sourceName,
      published_at: date,
      headline,
      quoted_text: headline + (content ? `\n${content}` : ''),
      ...scores,
      sentiment,
      sentiment_rationale: 'keyword_match',
      llm_paraphrased: false, // 預設 false, LLM 改寫時要在別處設 true
      related_facts: [],
      event_cluster_id: null, // 會在 cluster 後回填
      used_in_draft_thesis: false,
      used_in_draft_section: null,
      fetched_at: new Date().toISOString(),
    }
  })

  // 2. Cluster 分群
  const clusters = clusterNews(scored, stockId)

  // 3. 把 cluster_id 寫回每個 news, 並更新 cross_source_count
  const clusterMap = new Map()
  for (const cluster of clusters) {
    for (const item of cluster.news) {
      clusterMap.set(item.id, {
        cluster_id: cluster.id,
        cross_source: cluster.cross_source_count,
      })
    }
  }

  scored = scored.map(news => {
    const clusterInfo = clusterMap.get(news.id)
    if (!clusterInfo) return news
    return {
      ...news,
      event_cluster_id: clusterInfo.cluster_id,
      cross_source_score: clusterInfo.cross_source >= 2 ? 1 : 0,
      // 重新計算 total
      total_score:
        news.authority_score +
        news.event_type_score +
        news.directness_score +
        news.materiality_score +
        news.market_reaction_score +
        (clusterInfo.cross_source >= 2 ? 1 : 0),
    }
  })

  // 4. 重新計算 is_material (因為 total_score 可能變)
  scored = scored.map(news => ({
    ...news,
    is_material:
      news.total_score >= 7 || (news.authority_score === 3 && news.event_type_score >= 2),
  }))

  // 5. 高量股過濾 (可選)
  if (filterHighVolume && scored.length > 5) {
    scored = filterTopNewsForHighVolume(scored)
  }

  // 6. 排序: dominant first
  scored.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))

  return scored
}

/**
 * 給定一組 NewsFact[], 找出 dominant news cluster
 * (Rule 7 critic 用: 比對 draft 主結論是否與 dominant cluster 一致)
 */
export function findDominantNewsCluster(newsFacts) {
  if (!Array.isArray(newsFacts) || newsFacts.length === 0) return null
  // 取 is_material 中 total_score 最高的
  const material = newsFacts.filter(n => n.is_material)
  if (material.length === 0) return null
  return material.reduce((best, current) => {
    const bestScore = best?.total_score ?? 0
    const currScore = current?.total_score ?? 0
    return currScore > bestScore ? current : best
  })
}

/**
 * 計算 NewsFact[] 的 dominant sentiment
 * 用「重大新聞權重加權」方式: material news 權重 = total_score
 */
export function computeDominantSentiment(newsFacts) {
  if (!Array.isArray(newsFacts) || newsFacts.length === 0) return null
  const material = newsFacts.filter(n => n.is_material)
  if (material.length === 0) return null

  let posWeight = 0
  let negWeight = 0
  let neuWeight = 0

  for (const news of material) {
    const w = news.total_score ?? 1
    if (news.sentiment === 'positive') posWeight += w
    else if (news.sentiment === 'negative') negWeight += w
    else neuWeight += w
  }

  if (negWeight > posWeight && negWeight > neuWeight) return 'negative'
  if (posWeight > negWeight && posWeight > neuWeight) return 'positive'
  return 'neutral'
}
