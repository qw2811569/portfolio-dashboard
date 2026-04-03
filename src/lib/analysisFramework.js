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
