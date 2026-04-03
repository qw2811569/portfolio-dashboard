/**
 * 四人格時間軸分析引擎
 *
 * 根據持股的持有週期，切換成完全不同的分析人格：
 * - Scalper（短線客）：極短 1-2 週，看日K/暴量/權證Greeks
 * - Swing（波段手）：短期 1-2 月，看法人轉向/月營收/事件催化
 * - Trend（趨勢家）：中期 3-6 月，看營收YoY/產業循環/估值區間
 * - Value（價值者）：長期 1-5 年，看ROE/現金流/護城河
 */

export const PERSONAS = {
  scalper: {
    id: 'scalper',
    label: '短線客',
    horizon: '1-2 週',
    horizonDays: 14,
    evaluationDays: 45, // 回測用 1-2 月看結果
    knowledgeWeights: {
      'technical-analysis': 0.6,
      'risk-management': 0.3,
      'news-correlation': 0.1,
    },
    promptPrefix:
      '你現在是「短線客」人格。只看技術面、成交量、權證希臘值。不要談基本面或長期展望。',
    scoringFactors: ['volumeSpike', 'priceBreakout', 'rsi', 'warrantGreeks', 'foreignShortTerm'],
  },
  swing: {
    id: 'swing',
    label: '波段手',
    horizon: '1-2 月',
    horizonDays: 45,
    evaluationDays: 45,
    knowledgeWeights: {
      'chip-analysis': 0.35,
      'news-correlation': 0.3,
      'technical-analysis': 0.25,
      'risk-management': 0.1,
    },
    promptPrefix:
      '你現在是「波段手」人格。看法人連續買賣超、月營收月增、事件催化。不要談年度展望。',
    scoringFactors: [
      'institutionalStreak',
      'revenueMonthly',
      'eventWindow',
      'marginSentiment',
      'maAlignment',
    ],
  },
  trend: {
    id: 'trend',
    label: '趨勢家',
    horizon: '3-6 月',
    horizonDays: 135,
    evaluationDays: 135,
    knowledgeWeights: {
      'fundamental-analysis': 0.35,
      'industry-trends': 0.3,
      'chip-analysis': 0.2,
      'strategy-cases': 0.15,
    },
    promptPrefix:
      '你現在是「趨勢家」人格。看營收趨勢、產業循環、估值位階。用中期視角，不要被短線雜訊干擾。',
    scoringFactors: [
      'revenueYoY',
      'trendMA',
      'valuationBand',
      'foreignAccumulation',
      'industryCycle',
      'seasonal',
    ],
  },
  value: {
    id: 'value',
    label: '價值者',
    horizon: '1-5 年',
    horizonDays: 365,
    evaluationDays: 365,
    knowledgeWeights: {
      'fundamental-analysis': 0.4,
      'strategy-cases': 0.3,
      'industry-trends': 0.25,
      'risk-management': 0.05,
    },
    promptPrefix:
      '你現在是「價值者」人格。看 ROE 趨勢、自由現金流、護城河、產業龍頭地位。忽略短期波動。',
    scoringFactors: ['roe', 'freeCashFlow', 'moat', 'dividendStability', 'debtRatio', 'pbr'],
  },
}

/**
 * 根據持股屬性選擇分析人格
 */
export function selectPersona(stockMeta = {}) {
  const strategy = (stockMeta.strategy || '').toLowerCase()
  const period = (stockMeta.period || '').toLowerCase()
  const code = stockMeta.code || ''

  // 權證 → 一律短線客
  if (
    strategy.includes('權證') ||
    code.length === 6 ||
    (stockMeta.name || '').includes('購') ||
    (stockMeta.name || '').includes('售')
  ) {
    return PERSONAS.scalper
  }

  // ETF → 價值者（長期配置）
  if (strategy.includes('etf') || strategy.includes('指數') || /^00\d{3}/.test(code)) {
    return PERSONAS.value
  }

  // 事件驅動 → 波段手
  if (strategy.includes('事件')) {
    return PERSONAS.swing
  }

  // 根據 period 欄位
  if (period.includes('短') && !period.includes('中')) return PERSONAS.swing
  if (period.includes('中') && period.includes('長')) return PERSONAS.trend
  if (period.includes('長')) return PERSONAS.value
  if (period.includes('中')) return PERSONAS.trend

  // 成長股 → 趨勢家
  if (strategy.includes('成長')) return PERSONAS.trend

  // 景氣循環 → 趨勢家
  if (strategy.includes('景氣循環') || strategy.includes('循環')) return PERSONAS.trend

  // 轉型/轉機 → 波段手
  if (strategy.includes('轉') || strategy.includes('價值')) return PERSONAS.swing

  return PERSONAS.trend // 預設趨勢家
}

/**
 * 短線客打分（完全不同的邏輯）
 */
export function scoreScalper(signals = {}) {
  let score = 0
  const reasons = []

  // 量比（近5日均量 / 近20日均量）
  const volRatio = signals.volumeRatio || 1
  if (volRatio > 2.0) {
    score += 2
    reasons.push(`暴量 ${volRatio.toFixed(1)}x`)
  } else if (volRatio > 1.5) {
    score += 1
    reasons.push(`放量 ${volRatio.toFixed(1)}x`)
  }

  // 突破（股價 vs 近5日高點）
  if (signals.priceVs5dHigh > 0) {
    score += 1
    reasons.push('突破5日高')
  }
  if (signals.priceVs5dLow < 0) {
    score -= 1
    reasons.push('跌破5日低')
  }

  // RSI
  if (signals.rsi > 80) {
    score -= 1
    reasons.push('RSI超買')
  }
  if (signals.rsi < 20) {
    score += 1
    reasons.push('RSI超賣')
  }

  // 權證 Greeks
  if (signals.delta > 0.5) {
    score += 1
    reasons.push('Delta夠')
  }
  if (signals.delta < 0.3 && signals.delta > 0) {
    score -= 2
    reasons.push('Delta太低，時間衰減致命')
  }

  // 到期日保護（權證獨有）
  if (signals.daysToExpiry != null) {
    if (signals.daysToExpiry < 14) {
      score -= 3
      reasons.push('距到期<14天，時間衰減致命')
    } else if (signals.daysToExpiry < 30) {
      score -= 1
      reasons.push('距到期<30天，注意時間價值')
    }
  }

  // 外資短線
  if (signals.foreignShort5d > 0) {
    score += 1
    reasons.push('外資短線買')
  }
  if (signals.foreignShort5d < 0) {
    score -= 1
    reasons.push('外資短線賣')
  }

  return { score, reasons, verdict: score >= 3 ? '做多' : score <= -3 ? '做空' : '不碰' }
}

/**
 * 波段手打分
 */
export function scoreSwing(signals = {}) {
  let score = 0
  const reasons = []

  // 法人連續買賣超天數
  if (signals.institutionalStreakDays > 3) {
    score += 2
    reasons.push(`法人連買${signals.institutionalStreakDays}天`)
  }
  if (signals.institutionalStreakDays < -3) {
    score -= 2
    reasons.push(`法人連賣${Math.abs(signals.institutionalStreakDays)}天`)
  }

  // 月營收月增率
  if (signals.revenueMoM > 10) {
    score += 1
    reasons.push('月營收月增')
  }
  if (signals.revenueMoM < -10) {
    score -= 1
    reasons.push('月營收月減')
  }

  // 事件窗口
  if (signals.daysToEvent >= 0 && signals.daysToEvent <= 7) {
    score += 1
    reasons.push('事件窗口內')
  }

  // 融資情緒
  if (signals.marginDelta > 0 && signals.priceChange < 0) {
    score -= 2
    reasons.push('融資增+股價跌=散戶接刀')
  }

  // 均線
  if (signals.priceVsMA20 < 0) {
    score -= 1
    reasons.push('跌破月線')
  }

  return { score, reasons, verdict: score >= 3 ? '做多' : score <= -3 ? '做空' : '觀望' }
}

/**
 * 趨勢家打分（已有的 v6 邏輯）
 */
export function scoreTrend(signals = {}) {
  let score = 0
  const reasons = []

  if ((signals.revenueYoY || 0) >= 20) {
    score += 2
    reasons.push('營收YoY強勁')
  } else if ((signals.revenueYoY || 0) >= 5) {
    score += 1
    reasons.push('營收溫和成長')
  } else if ((signals.revenueYoY || 0) <= -10) {
    score -= 2
    reasons.push('營收大幅衰退')
  } else if ((signals.revenueYoY || 0) < 0) {
    score -= 1
    reasons.push('營收小幅衰退')
  }

  if (signals.foreignBuy > 0 && signals.trustBuy > 0) {
    score += 2
    reasons.push('外資+投信同買')
  } else if (signals.foreignBuy > 0) {
    score += 1
    reasons.push('外資偏多')
  } else if (signals.foreignBuy < 0 && signals.trustBuy < 0) {
    score -= 2
    reasons.push('外資+投信同賣')
  } else if (signals.foreignBuy < 0) {
    score -= 1
    reasons.push('外資偏空')
  }

  if ((signals.per || 0) > 30) {
    score -= 1
    reasons.push('PER偏高')
  } else if ((signals.per || 0) > 0 && (signals.per || 0) < 12) {
    score += 1
    reasons.push('PER偏低')
  }

  if (signals.ma20 > signals.ma60 * 1.03 && signals.price > signals.ma20) {
    score += 2
    reasons.push('強多頭趨勢')
  } else if (signals.ma20 > signals.ma60) {
    score += 1
    reasons.push('多頭')
  } else if (signals.ma20 < signals.ma60 * 0.97 && signals.price < signals.ma20) {
    score -= 2
    reasons.push('強空頭趨勢')
  } else if (signals.ma20 < signals.ma60) {
    score -= 1
    reasons.push('空頭')
  }

  const month = new Date().getMonth() + 1
  if ([12, 1].includes(month)) score -= 1
  if ([3, 9].includes(month)) score -= 1
  if ([4, 10].includes(month)) score += 1

  return { score, reasons, verdict: score >= 4 ? '看多' : score <= -4 ? '看空' : '觀望' }
}

/**
 * 價值者打分
 */
export function scoreValue(signals = {}) {
  let score = 0
  const reasons = []

  if ((signals.roe || 0) > 15) {
    score += 2
    reasons.push(`ROE ${signals.roe}%`)
  } else if ((signals.roe || 0) > 10) {
    score += 1
    reasons.push('ROE合格')
  }

  if (signals.freeCashFlowPositive) {
    score += 1
    reasons.push('自由現金流正')
  }

  if (signals.isLeader) {
    score += 1
    reasons.push('產業龍頭')
  }

  if ((signals.pbr || 0) < 1.5 && (signals.roe || 0) > 10) {
    score += 2
    reasons.push('PBR低估+ROE佳')
  }

  if ((signals.debtRatio || 0) > 60) {
    score -= 2
    reasons.push('負債比過高')
  }

  if (signals.dividendYears >= 5) {
    score += 1
    reasons.push('連續配息')
  }

  return { score, reasons, verdict: score >= 4 ? '長抱' : score <= -3 ? '考慮出場' : '持有觀察' }
}

/**
 * 根據人格選擇打分函數
 */
export function scoreByPersona(persona, signals) {
  switch (persona.id) {
    case 'scalper':
      return scoreScalper(signals)
    case 'swing':
      return scoreSwing(signals)
    case 'trend':
      return scoreTrend(signals)
    case 'value':
      return scoreValue(signals)
    default:
      return scoreTrend(signals)
  }
}

/**
 * 為收盤分析產出人格 context
 */
export function formatPersonaContext(holdings) {
  if (!Array.isArray(holdings) || holdings.length === 0) return ''

  const groups = {}
  for (const h of holdings) {
    const meta = h.meta || h.stockMeta || h
    const persona = selectPersona(meta)
    if (!groups[persona.id]) groups[persona.id] = { persona, stocks: [] }
    groups[persona.id].stocks.push(h.code || h)
  }

  const lines = ['## 持股人格分組']
  for (const { persona, stocks } of Object.values(groups)) {
    lines.push(
      `**${persona.label}**（${persona.horizon}）：${stocks.join(', ')} → ${persona.promptPrefix}`
    )
  }
  return lines.join('\n')
}
