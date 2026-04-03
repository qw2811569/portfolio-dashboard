function hasRecentEvent(events = [], keywords = []) {
  return (Array.isArray(events) ? events : []).some((event) => {
    const text = [event?.type, event?.title, event?.detail].filter(Boolean).join(' ')
    return keywords.some((keyword) => text.includes(keyword))
  })
}

export function selectAnalysisFramework(stockMeta = {}, dossier = {}, events = []) {
  const strategy = String(stockMeta?.strategy || dossier?.stockMeta?.strategy || '')
  const period = String(
    stockMeta?.period || stockMeta?.holdingPeriod || dossier?.stockMeta?.period || ''
  )

  if (strategy.includes('權證')) {
    return {
      mode: 'event-driven',
      sections: ['催化事件', '時間價值', '風險控制', '進出時機'],
      reason: '權證/短線策略優先看事件與時間衰減',
    }
  }

  if (strategy.includes('景氣循環')) {
    return {
      mode: 'cyclical',
      sections: ['營收拐點', '法人動向', '產業位階', '估值區間'],
      reason: '景氣循環股優先看營收轉折與產業位階',
    }
  }

  if (strategy.includes('成長')) {
    // 成長股 + 短期持有 → 做波段，不是長抱
    if (period.includes('短')) {
      return {
        mode: 'event-driven',
        sections: ['催化事件', '技術面突破', '風險控制', '進出時機'],
        reason: '成長股短期持有，以事件催化和技術面為主',
      }
    }
    // 成長股 + 中期 → 看營收拐點做波段
    if (period.includes('中') && !period.includes('長')) {
      return {
        mode: 'cyclical',
        sections: ['營收拐點', '成長動能', '法人動向', '估值區間'],
        reason: '成長股中期持有，追蹤營收趨勢做波段',
      }
    }
    // 成長股 + 長期 → compounder
    return {
      mode: 'compounder',
      sections: ['成長動能', '競爭護城河', '估值合理性', '長期展望'],
      reason: '成長股長期持有，看複利邏輯',
    }
  }

  if (strategy.includes('ETF')) {
    return {
      mode: 'income',
      sections: ['追蹤誤差', '溢折價', '成分股變化', '配息率'],
      reason: 'ETF/指數商品優先看追蹤品質與收益結構',
    }
  }

  if (hasRecentEvent(events, ['法說', '財報', '除息', '除權'])) {
    return {
      mode: 'event-driven',
      sections: ['催化事件', '時間窗口', '風險控制', '交易計畫'],
      reason: '近期事件密集，改用事件驅動框架',
    }
  }

  return {
    mode: 'balanced',
    sections: ['基本面', '技術面', '籌碼面', '事件催化'],
    reason: '未命中特定策略，採平衡框架',
  }
}

export function formatFrameworkSections(framework = {}, dossier = {}) {
  const fundamentals = dossier?.fundamentals || {}
  const events = Array.isArray(dossier?.events) ? dossier.events : []
  const targets = Array.isArray(dossier?.targets) ? dossier.targets : []
  const sections = Array.isArray(framework?.sections) ? framework.sections : []

  const sectionLines = sections.map((section) => {
    if (section === '催化事件') {
      return `- ${section}：${
        events
          .slice(0, 3)
          .map((event) => event.title || event.date)
          .join('；') || '無明顯催化'
      }`
    }
    if (section === '時間價值' || section === '時間窗口') {
      return `- ${section}：${dossier?.stockMeta?.period || '未標記週期'}，近期事件 ${events.length} 件`
    }
    if (section === '風險控制') {
      return `- ${section}：目標價 ${targets[0]?.target || '無'}，需確認停損與部位大小`
    }
    if (section === '進出時機' || section === '交易計畫') {
      return `- ${section}：結合事件日期、法人與估值決定，不要只看單日漲跌`
    }
    if (section === '營收拐點') {
      return `- ${section}：最新營收 YoY ${fundamentals?.revenueYoY ?? 'NA'}，觀察是否連續改善`
    }
    if (section === '法人動向' || section === '籌碼面') {
      return `- ${section}：以近5日外資/投信/自營商方向為主，避免逆勢硬做`
    }
    if (section === '產業位階' || section === '競爭護城河') {
      return `- ${section}：${dossier?.stockMeta?.industry || '未分類'} / ${dossier?.stockMeta?.leader || '未標記龍頭位階'}`
    }
    if (section === '估值區間' || section === '估值合理性') {
      return `- ${section}：目標價數 ${targets.length} 筆，搭配 PER/PBR 判斷高估或低估`
    }
    if (section === '成長動能' || section === '長期展望') {
      return `- ${section}：結合月營收、產業趨勢、供應鏈地位，不只看短線新聞`
    }
    if (
      section === '追蹤誤差' ||
      section === '溢折價' ||
      section === '成分股變化' ||
      section === '配息率'
    ) {
      return `- ${section}：ETF 類商品需補追蹤品質與配息資料，目前以前台資料/外部數據補足`
    }
    return `- ${section}：請依 dossier 既有資料補足分析。`
  })

  return [
    `分析框架：${framework?.mode || 'balanced'}`,
    `原因：${framework?.reason || '無'}`,
    ...sectionLines,
  ].join('\n')
}

/**
 * 回測驗證的量化訊號可信度
 * 基於 540 回歷史回測（27 檔 x 20 日期）
 */
const BACKTEST_RELIABILITY = {
  3013: { rate: 89, tier: 'high', note: '法人+營收趨勢可直接判定方向' },
  4562: { rate: 78, tier: 'high', note: '中小型循環股數據敏感度高' },
  1799: { rate: 73, tier: 'high', note: '轉機題材對數據反應明確' },
  3017: { rate: 67, tier: 'high', note: 'AI 伺服器題材+法人動向可判' },
  6770: { rate: 63, tier: 'medium', note: '晶圓代工受國際市場干擾' },
  2543: { rate: 60, tier: 'medium', note: '營建股受政策影響需定性補充' },
  2489: { rate: 43, tier: 'low', note: '轉型股波動大，靠定性分析' },
  3006: { rate: 43, tier: 'low', note: 'IC 設計受國際報價主導' },
  3443: { rate: 33, tier: 'low', note: 'CoWoS 題材受台積電資本支出主導' },
  6446: { rate: 29, tier: 'low', note: '新藥股靠臨床進度，不看量化' },
  1503: { rate: 27, tier: 'low', note: '重電受政策標案影響' },
  3231: { rate: 22, tier: 'low', note: 'AI 代工受國際大廠訂單主導' },
  2313: { rate: 14, tier: 'low', note: 'PCB 大廠受蘋果週期主導' },
}

export function getBacktestReliability(code) {
  return (
    BACKTEST_RELIABILITY[code] || { rate: 47, tier: 'medium', note: '無回測資料，量化+定性並重' }
  )
}

export function formatReliabilityContext(holdings) {
  if (!Array.isArray(holdings) || holdings.length === 0) return ''
  const lines = ['量化訊號可信度（基於 540 回歷史回測）：']
  for (const h of holdings) {
    const code = h.code || h
    const rel = getBacktestReliability(code)
    const icon = rel.tier === 'high' ? '🟢' : rel.tier === 'medium' ? '🟡' : '🔴'
    lines.push(`${icon} ${code} ${h.name || ''}: ${rel.note} (命中${rel.rate}%)`)
  }
  lines.push('🟢=信數字 🟡=量化+定性 🔴=做深度定性分析')
  return lines.join('\n')
}
