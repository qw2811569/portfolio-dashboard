/**
 * News clusterer — 把同一事件的多篇新聞分群
 *
 * 來源: design doc v1 §2 + Codex round 1 review Q2
 *
 * 為什麼要分群:
 *   - 同一事件 (例如 1717 4/8 漲停) 可能被 5+ 家媒體報導
 *   - 不分群會重複計算 weight / sentiment, 高估 dominant catalyst
 *   - 分群後每個 cluster 只留權威最高的 1 篇做代表
 *
 * 分群策略 (簡化版, 不靠 ML):
 *   1. 同日 + 標題關鍵字交集 ≥ 50% → 同一 cluster
 *   2. 同日 + 標題出現相同數字 (例如「+10%」「漲停」) → 同一 cluster
 *   3. 跨日但 7 天內 + 同一標題核心詞 → 同一 cluster (例如連續報導)
 */

// ─────────────────────────────────────────────────────────────
// Tokenizer (簡化版繁中)
// ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  '的', '了', '是', '在', '和', '與', '或', '但', '也', '都', '會', '對',
  '受', '惠', '受惠', '影響', '由', '從', '到', '上', '下', '前', '後',
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '長興', '1717', // 把 stock id/name 排除避免每篇都 match
])

function tokenize(text = '') {
  if (!text) return []
  // 簡化: 切標點 + 空格, 保留 2 字以上 chunk
  const cleaned = String(text)
    .replace(/[【】「」『』,，。.!！?？;；:：「」"'（）()\[\]/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned
    .split(' ')
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t))
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size === 0 && setB.size === 0) return 0
  const intersection = [...setA].filter(x => setB.has(x))
  const unionSize = setA.size + setB.size - intersection.length
  return unionSize === 0 ? 0 : intersection.length / unionSize
}

// ─────────────────────────────────────────────────────────────
// Cluster ID generator
// ─────────────────────────────────────────────────────────────

function makeClusterId(stockId, date, idx) {
  return `cluster_${stockId}_${date}_${String(idx).padStart(2, '0')}`
}

function dateOnly(iso) {
  if (!iso) return ''
  return String(iso).slice(0, 10)
}

// ─────────────────────────────────────────────────────────────
// 主分群函式
// ─────────────────────────────────────────────────────────────

/**
 * 把新聞陣列分群
 *
 * @param {Array} newsList - 已 score 過的新聞 (含 authority_score 等欄位)
 * @param {string} stockId
 * @returns {Array} clusters: [{ id, news: [...], representative: {...} }]
 */
export function clusterNews(newsList, stockId = '') {
  if (!Array.isArray(newsList) || newsList.length === 0) return []

  // 1. 按日期排序 (新到舊)
  const sorted = [...newsList].sort((a, b) => {
    const ta = a.published_at || a.date || ''
    const tb = b.published_at || b.date || ''
    return tb.localeCompare(ta)
  })

  // 2. 計算每篇 token
  const enriched = sorted.map(n => ({
    ...n,
    _tokens: tokenize(n.headline || n.title || ''),
    _date: dateOnly(n.published_at || n.date),
  }))

  // 3. 線性掃描分群
  const clusters = []
  const SIM_THRESHOLD = 0.5
  let clusterIdx = 0

  for (const news of enriched) {
    let placed = false

    for (const cluster of clusters) {
      // 同 cluster 條件:
      //   - 7 天內
      //   - 任何已在 cluster 內的新聞 jaccard >= 0.5
      const dayDiff = Math.abs(
        new Date(news._date).getTime() - new Date(cluster._earliestDate).getTime()
      ) / (1000 * 60 * 60 * 24)

      if (dayDiff > 7) continue

      const matchesAny = cluster.news.some(existing => {
        return jaccardSimilarity(news._tokens, existing._tokens) >= SIM_THRESHOLD
      })

      if (matchesAny) {
        cluster.news.push(news)
        if (news._date < cluster._earliestDate) {
          cluster._earliestDate = news._date
        }
        placed = true
        break
      }
    }

    if (!placed) {
      const clusterId = makeClusterId(stockId, news._date, clusterIdx++)
      clusters.push({
        id: clusterId,
        news: [news],
        _earliestDate: news._date,
      })
    }
  }

  // 4. 為每個 cluster 選 representative (權威最高 + 總分最高)
  return clusters.map(c => {
    const sortedNews = [...c.news].sort((a, b) => {
      const aAuth = a.authority_score ?? 0
      const bAuth = b.authority_score ?? 0
      if (aAuth !== bAuth) return bAuth - aAuth
      const aTotal = a.total_score ?? 0
      const bTotal = b.total_score ?? 0
      return bTotal - aTotal
    })
    return {
      id: c.id,
      news: c.news.map(({ _tokens, _date, ...rest }) => rest), // 清掉 _ 開頭內部欄位
      representative: (() => {
        const { _tokens, _date, ...rest } = sortedNews[0]
        return rest
      })(),
      cross_source_count: c.news.length,
    }
  })
}

/**
 * 給定 cluster 列表, 找出 dominant cluster (最高 total_score 的 representative)
 */
export function findDominantCluster(clusters) {
  if (!Array.isArray(clusters) || clusters.length === 0) return null
  return clusters.reduce((best, current) => {
    const bestScore = best?.representative?.total_score ?? 0
    const currScore = current?.representative?.total_score ?? 0
    return currScore > bestScore ? current : best
  })
}

/**
 * 給 cluster 一個 sentiment (取 representative 的)
 * 注意: sentiment 必須由 newsScorer 或 keyword-based 算過, 不靠 LLM
 */
export function getClusterSentiment(cluster) {
  if (!cluster?.representative) return 'neutral'
  return cluster.representative.sentiment || 'neutral'
}
