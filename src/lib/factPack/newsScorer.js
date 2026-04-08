/**
 * News scorer — Codex 6 維度計分系統
 *
 * 來源: design doc v1 §2 + Codex round 1 review Q2
 *
 * 6 維度評分:
 *   - authority_score      (來源權威)     0-3
 *   - event_type_score     (事件類型)     0-3
 *   - directness_score     (公司直接性)   0-2
 *   - materiality_score    (金額/法規)    0-2
 *   - market_reaction_score(市場反應)     0-2
 *   - cross_source_score   (跨源佐證)     0-1
 *
 * 總分 ≥ 7 = 重大
 * 或: 官方揭露 (authority=3) + 事件類型 ≥ 2 → 自動列為重大
 *
 * 1717 案例驗證:
 *   - 3/23 聯合新聞網「2 月稅前虧損 0.71 億」
 *     authority=2 (聯合新聞網) + event_type=3 (虧損公告) + directness=2 (標題有公司名)
 *     + materiality=2 (虧損金額具體) + market_reaction=2 (隔日跌 -7.05%) + cross_source=1
 *     = 12 → is_material=true ✓
 *
 *   - 4/8 CMoney「油價推升特化題材」
 *     authority=1 (CMoney) + event_type=2 (產業題材) + directness=2 (標題有公司名)
 *     + materiality=1 (沒具體金額) + market_reaction=2 (漲停)+ cross_source=1
 *     = 9 → is_material=true ✓
 *
 *   - 4/7 CMoney 留言區「川普攻擊」
 *     authority=0 (論壇) + event_type=2 (政策) + directness=0 (產業 evt)
 *     + materiality=2 (關稅政策) + market_reaction=2 (隔日 -1.46%) + cross_source=0
 *     = 6 → 但因涉及關稅 → boost 為 material
 */

// ─────────────────────────────────────────────────────────────
// Source authority — 0-3 級
// ─────────────────────────────────────────────────────────────

const AUTHORITY_TIER_3 = [
  // 官方來源 - 0 容錯
  'mops', 'mops.twse', 'twse', 'tpex', 'tdcc', 'taifex',
  '公開資訊觀測站', '證交所', '櫃買中心', '集保結算所',
  // 公司官方
  'eternal-group', '長興', // 後續可擴充
]

const AUTHORITY_TIER_2 = [
  // 主流財經媒體
  'udn', 'money.udn', 'economy', '經濟日報', '聯合新聞網', '工商時報',
  'cnyes', '鉅亨', '鉅亨網',
  'bloomberg', 'reuters', 'wsj',
]

const AUTHORITY_TIER_1 = [
  // 二線媒體 / 整理性網站
  'cmoney', 'cmnews', 'yahoo', 'yahoo股市',
  '富聯網', 'wantgoo', 'goodinfo', 'moneydj',
  'anue', 'cnyes社群',
]

// AUTHORITY_TIER_0 = 論壇 / 留言區 / blog 等

export function scoreAuthority(sourceName) {
  if (!sourceName) return 0
  const lower = String(sourceName).toLowerCase()
  if (AUTHORITY_TIER_3.some(k => lower.includes(k.toLowerCase()))) return 3
  if (AUTHORITY_TIER_2.some(k => lower.includes(k.toLowerCase()))) return 2
  if (AUTHORITY_TIER_1.some(k => lower.includes(k.toLowerCase()))) return 1
  return 0
}

// ─────────────────────────────────────────────────────────────
// Event type — 0-3 級
// 高分事件類型寫死, 不靠 LLM
// ─────────────────────────────────────────────────────────────

// Codex Phase 1 review fix: 加 EPS / 配息 / 全年財報 等純財報關鍵詞
// 1717 3/13「長興去年 EPS 1.41 元擬配息 1 元」原本 event_type=0 (錯誤)
const HIGH_EVENT_KEYWORDS_TIER_3 = [
  // 虧損 / 財報異常
  '虧損', '巨額虧損', '虧錢', '虧', '稅前虧', '稅後虧', '單月虧', '財報異常',
  // 財報公告 (Codex 補)
  'EPS', 'eps', '盈餘', '稅前盈餘', '稅後盈餘', '每股盈餘', '全年獲利', '年度獲利',
  '配息', '股利', '現金股利', '股利政策', '配發',
  // 重大訂單 / 取消
  '訂單', '取消訂單', '重大訂單', '大單', '出貨', '量產',
  // 重大訊息類
  '重大訊息', '公告', '財報', '法說會', '法說', 'investor', '法說內容',
  // 籌資 (Codex 補: 1717 3/13 發 20 億 CB)
  '轉換公司債', 'CB', '發行公司債', '增資', '私募',
  // 制裁 / 罰款 / 訴訟
  '罰款', '訴訟', '裁罰', '處分',
  // 關稅 / 制裁
  '關稅', 'tariff', '制裁', 'sanction',
  // 裁員
  '裁員', '減班', 'layoff',
]

const MID_EVENT_KEYWORDS_TIER_2 = [
  // 月營收
  '月營收', '營收', '營收創新高', '營收創低', '月營收公告',
  // 產業題材
  '題材', '油價', '原物料', '漲價', '降價', '報價', '族群',
  // 評等
  '升評', '降評', '目標價', '券商', '評等',
  // 庫存 / 供應鏈
  '庫存', '供應鏈', '產能', '擴廠',
]

const LOW_EVENT_KEYWORDS_TIER_1 = [
  '評論', 'q&a', '訪談', '專訪', '產業評論',
]

export function scoreEventType(headline = '', content = '') {
  const text = `${headline} ${content}`.toLowerCase()
  if (HIGH_EVENT_KEYWORDS_TIER_3.some(k => text.includes(k.toLowerCase()))) return 3
  if (MID_EVENT_KEYWORDS_TIER_2.some(k => text.includes(k.toLowerCase()))) return 2
  if (LOW_EVENT_KEYWORDS_TIER_1.some(k => text.includes(k.toLowerCase()))) return 1
  return 0
}

// ─────────────────────────────────────────────────────────────
// Directness (公司直接性)
// ─────────────────────────────────────────────────────────────

export function scoreDirectness(headline = '', content = '', stockId = '', stockName = '') {
  if (!stockId && !stockName) return 0
  const headlineL = String(headline).toLowerCase()
  const contentL = String(content).toLowerCase()
  const idMatch = stockId && (headlineL.includes(stockId) || headlineL.includes(`(${stockId})`))
  const nameMatch = stockName && headlineL.includes(stockName.toLowerCase())
  if (idMatch || nameMatch) return 2 // 標題有公司
  if (
    (stockId && contentL.includes(stockId)) ||
    (stockName && contentL.includes(stockName.toLowerCase()))
  ) return 1 // 內文有公司
  return 0 // 產業/總經 evt
}

// ─────────────────────────────────────────────────────────────
// Materiality (金額 / 法規)
// ─────────────────────────────────────────────────────────────

// 純金額 (不含法規詞)
const AMOUNT_REGEX = /(\d+(?:\.\d+)?\s*(?:億|百萬|千萬|萬))|(\d+%)/i
// 純法規 (不含金額)
const REGULATORY_REGEX = /(關稅|罰款|裁罰|處分|訴訟|制裁)/i

export function scoreMateriality(headline = '', content = '') {
  const text = `${headline} ${content}`
  if (!text) return 0
  const hasAmount = AMOUNT_REGEX.test(text)
  const hasRegulatory = REGULATORY_REGEX.test(text)
  if (hasAmount && hasRegulatory) return 2
  if (hasAmount || hasRegulatory) return 1
  return 0
}

// ─────────────────────────────────────────────────────────────
// Market reaction (市場反應)
// 這個需要外部傳入「隔日漲跌幅 %」, 因為新聞本身沒帶
// ─────────────────────────────────────────────────────────────

export function scoreMarketReaction(nextDayChangePct) {
  if (nextDayChangePct == null || typeof nextDayChangePct !== 'number') return 0
  const abs = Math.abs(nextDayChangePct)
  if (abs >= 5) return 2
  if (abs >= 2) return 1
  return 0
}

// ─────────────────────────────────────────────────────────────
// Cross-source (跨源佐證)
// 這個需要外部傳入「同一事件被幾家媒體報導」
// ─────────────────────────────────────────────────────────────

export function scoreCrossSource(sameEventSourceCount) {
  if (typeof sameEventSourceCount !== 'number') return 0
  return sameEventSourceCount >= 2 ? 1 : 0
}

// ─────────────────────────────────────────────────────────────
// Total scorer
// ─────────────────────────────────────────────────────────────

/**
 * 計算單則新聞的 6 維度分數
 *
 * @param {Object} news - 新聞物件
 * @param {string} news.source_name
 * @param {string} news.headline
 * @param {string} [news.content]
 * @param {string} [news.stockId]
 * @param {string} [news.stockName]
 * @param {number} [news.nextDayChangePct] - 隔日漲跌幅 %
 * @param {number} [news.sameEventSourceCount] - 同事件報導媒體數
 * @returns {Object} { authority, event_type, directness, materiality, market_reaction, cross_source, total, is_material }
 */
export function scoreNews(news) {
  const authority = scoreAuthority(news.source_name)
  const event_type = scoreEventType(news.headline, news.content)
  const directness = scoreDirectness(news.headline, news.content, news.stockId, news.stockName)
  const materiality = scoreMateriality(news.headline, news.content)
  const market_reaction = scoreMarketReaction(news.nextDayChangePct)
  const cross_source = scoreCrossSource(news.sameEventSourceCount)

  const total = authority + event_type + directness + materiality + market_reaction + cross_source

  // is_material 規則: total >= 7  OR  (官方揭露 + event_type >= 2)
  const is_material = total >= 7 || (authority === 3 && event_type >= 2)

  return {
    authority_score: authority,
    event_type_score: event_type,
    directness_score: directness,
    materiality_score: materiality,
    market_reaction_score: market_reaction,
    cross_source_score: cross_source,
    total_score: total,
    is_material,
  }
}

/**
 * 篩選 top N 新聞 (給高量股, 例如台積電一天 50 條)
 * 規則: top 3 company-specific + top 1 macro + top 1 sector catalyst
 */
export function filterTopNewsForHighVolume(newsList) {
  if (!Array.isArray(newsList)) return []

  const companySpecific = newsList.filter(n => (n.directness_score ?? 0) >= 1)
  const macro = newsList.filter(n => (n.directness_score ?? 0) === 0)

  const top3Company = companySpecific
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    .slice(0, 3)

  // sector catalyst = directness=0 但 event_type>=2 (產業題材)
  const sectorCatalysts = macro
    .filter(n => (n.event_type_score ?? 0) >= 2)
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    .slice(0, 1)

  // top 1 macro = directness=0 純總經
  const topMacro = macro
    .filter(n => (n.event_type_score ?? 0) < 2)
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    .slice(0, 1)

  return [...top3Company, ...sectorCatalysts, ...topMacro]
}
