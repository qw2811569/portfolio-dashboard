/**
 * 事件自動預測引擎 — 不用 AI，用知識庫 + 收盤分析/研究的歷史反饋
 *
 * 邏輯：
 * 1. 事件類型比對知識庫的 news-correlation 規則
 * 2. 歷史分析反饋：之前類似事件的預測準確度
 * 3. 籌碼面佐證：法人在事件前的動向
 */

// 事件類型 → 預設方向（從知識庫歸納）
const EVENT_TYPE_BIAS = {
  // 利多型事件
  法說: 'neutral', // 法說會前不確定，要看預期差
  營收: 'neutral', // 營收公布要看 YoY
  新品: 'positive',
  訂單: 'positive',
  擴產: 'positive',
  漲價: 'positive',
  // 利空型事件
  降價: 'negative',
  裁員: 'negative',
  減資: 'negative',
  下修: 'negative',
  // 中性
  除權息: 'neutral',
  股東會: 'neutral',
  FOMC: 'neutral',
  央行: 'neutral',
}

/**
 * 自動預測事件方向
 * @param {Object} event — 事件物件 {title, type, stocks, date, ...}
 * @param {Object} context — 額外 context
 *   - revenueYoY: 相關個股的營收 YoY
 *   - foreignFlow: 外資近 5 日買賣超
 *   - lastAnalysisVerdict: 上次收盤分析對該股的結論
 *   - historicalAccuracy: 歷史同類事件的預測準確度
 * @returns {{ direction: 'up'|'down'|'flat', confidence: number, reasons: string[] }}
 */
export function predictEventDirection(event, context = {}) {
  const title = (event.title || event.type || '').toLowerCase()
  const reasons = []
  let score = 0

  // 1. 事件類型基礎判斷
  for (const [keyword, bias] of Object.entries(EVENT_TYPE_BIAS)) {
    if (title.includes(keyword)) {
      if (bias === 'positive') {
        score += 1
        reasons.push(`${keyword}事件偏多`)
      }
      if (bias === 'negative') {
        score -= 1
        reasons.push(`${keyword}事件偏空`)
      }
      break
    }
  }

  // 2. 營收佐證（如果有）
  if (context.revenueYoY != null) {
    if (context.revenueYoY > 15) {
      score += 1
      reasons.push(`營收YoY +${context.revenueYoY.toFixed(0)}% 佐證`)
    }
    if (context.revenueYoY < -10) {
      score -= 1
      reasons.push(`營收YoY ${context.revenueYoY.toFixed(0)}% 拖累`)
    }
  }

  // 3. 法人動向佐證
  if (context.foreignFlow != null) {
    if (context.foreignFlow > 0) {
      score += 1
      reasons.push('外資偏多佐證')
    }
    if (context.foreignFlow < 0) {
      score -= 1
      reasons.push('外資偏空佐證')
    }
  }

  // 4. 上次分析結論回饋
  if (context.lastAnalysisVerdict) {
    const v = context.lastAnalysisVerdict.toLowerCase()
    if (v.includes('看多') || v.includes('加碼') || v.includes('買進')) {
      score += 1
      reasons.push('收盤分析偏多')
    }
    if (v.includes('看空') || v.includes('減碼') || v.includes('停損')) {
      score -= 1
      reasons.push('收盤分析偏空')
    }
  }

  // 5. 歷史同類事件準確度
  if (context.historicalAccuracy != null && context.historicalAccuracy > 0.6) {
    reasons.push(`歷史同類事件準確度 ${(context.historicalAccuracy * 100).toFixed(0)}%`)
  }

  // 判定
  const direction = score >= 2 ? 'up' : score <= -2 ? 'down' : 'flat'
  const confidence = Math.min(0.9, Math.max(0.2, 0.5 + Math.abs(score) * 0.1))

  if (reasons.length === 0) reasons.push('訊號不足，預設中性')

  return { direction, confidence, reasons }
}

/**
 * 批次預測所有待觀察事件
 */
export function predictAllEvents(events, contextByStock = {}) {
  return (events || []).map((event) => {
    const stockCode = (event.stocks || [])[0] || ''
    const ctx = contextByStock[stockCode] || {}
    const prediction = predictEventDirection(event, ctx)
    return {
      ...event,
      pred: prediction.direction,
      predConfidence: prediction.confidence,
      predReasons: prediction.reasons,
      predSource: 'knowledge-engine', // 標記是知識庫引擎判的，不是 AI
    }
  })
}
