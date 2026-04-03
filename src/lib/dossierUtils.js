import { DEFAULT_FUNDAMENTAL_DRAFT } from '../constants.js'
import { getEventStockCodes } from './eventUtils.js'
import {
  shouldDebugFinMindPromptCoverage,
  summarizeFinMindPromptDatasets,
} from './finmindPromptRuntime.js'
import { getSupplyChain, getThemesForStock } from './dataAdapters/index.js'
import {
  buildCompactKnowledgeContext,
  buildKnowledgeContext,
  getTopKnowledgeRules,
} from './knowledgeBase.js'

function compactPromptText(value, limit = 48) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function formatSignedNumber(value, digits = 0) {
  const number = Number(value) || 0
  return `${number >= 0 ? '+' : ''}${number.toFixed(digits)}`
}

function formatPct(value, digits = 2) {
  return `${formatSignedNumber(value, digits)}%`
}

function summarizeTargetsForPrompt(targets = [], limit = 2) {
  const rows = (Array.isArray(targets) ? targets : [])
    .map((target) => {
      const firm = compactPromptText(target?.firm, 10)
      const price = Number(target?.target)
      if (!firm || !Number.isFinite(price)) return null
      return `${firm} ${price}`
    })
    .filter(Boolean)
    .slice(0, Math.max(1, limit))

  return rows.length > 0 ? rows.join(' | ') : '無'
}

function summarizeEventsForPrompt(events = [], limit = 2) {
  const rows = (Array.isArray(events) ? events : [])
    .map((event) => {
      const date = compactPromptText(event?.date, 12)
      const title = compactPromptText(event?.title, 20)
      if (!title) return null
      return [date, title].filter(Boolean).join(' ')
    })
    .filter(Boolean)
    .slice(0, Math.max(1, limit))

  return rows.length > 0 ? rows.join(' | ') : '無'
}

function summarizeMatchedRulesForPrompt(brainContext = {}, limit = 2) {
  const rows = (Array.isArray(brainContext?.matchedRules) ? brainContext.matchedRules : [])
    .map((rule) => compactPromptText(rule?.text, 28))
    .filter(Boolean)
    .slice(0, Math.max(1, limit))

  return rows.length > 0 ? rows.join(' | ') : '無'
}

function summarizeFreshnessForPrompt(freshness = {}) {
  if (!freshness || typeof freshness !== 'object') return ''
  const entries = [
    ['營收', freshness.fundamentals],
    ['目標價', freshness.targets],
    ['事件', freshness.events],
    ['研究', freshness.research],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}:${value}`)
  return entries.join(' | ')
}

function summarizeThesisForPrompt(thesis) {
  if (!thesis) return '無'
  const statement = compactPromptText(thesis.statement || thesis.reason, 54)
  const direction = thesis.direction ? `方向:${thesis.direction}` : ''
  const conviction = thesis.conviction ? `信心:${thesis.conviction}` : ''
  const target = thesis.targetPrice ? `目標:${thesis.targetPrice}` : ''
  const stopLoss = thesis.stopLoss ? `停損:${thesis.stopLoss}` : ''
  return [statement, direction, conviction, target, stopLoss].filter(Boolean).join(' | ') || '無'
}

function buildCompactFinMindSummary(finmind, { debugLabel = '' } = {}) {
  if (debugLabel && shouldDebugFinMindPromptCoverage()) {
    console.warn('[finmind-summary]', {
      code: debugLabel,
      datasets: summarizeFinMindPromptDatasets(finmind),
    })
  }

  if (
    !finmind ||
    (!finmind.institutional?.length &&
      !finmind.valuation?.length &&
      !finmind.margin?.length &&
      !finmind.revenue?.length &&
      !finmind.shareholding?.length &&
      !finmind.balanceSheet?.length &&
      !finmind.cashFlow?.length)
  ) {
    return '無'
  }

  const parts = []

  if (finmind.institutional?.length > 0) {
    const recent5 = finmind.institutional.slice(0, 5)
    const foreignSum = recent5.reduce((sum, item) => sum + (item.foreign || 0), 0)
    const investmentSum = recent5.reduce((sum, item) => sum + (item.investment || 0), 0)
    parts.push(
      `法人5日 外資${formatSignedNumber(foreignSum)} 投信${formatSignedNumber(investmentSum)}`
    )
  }

  if (finmind.valuation?.length > 0) {
    const latest = finmind.valuation[0]
    const valuation = [
      Number.isFinite(Number(latest?.per)) && latest.per !== 0
        ? `PER ${Number(latest.per).toFixed(1)}`
        : '',
      Number.isFinite(Number(latest?.pbr)) && latest.pbr !== 0
        ? `PBR ${Number(latest.pbr).toFixed(2)}`
        : '',
    ]
      .filter(Boolean)
      .join(' ')
    if (valuation) parts.push(valuation)
  }

  if (finmind.margin?.length > 1) {
    const change = (finmind.margin[0]?.marginBalance || 0) - (finmind.margin[1]?.marginBalance || 0)
    parts.push(`融資${formatSignedNumber(change)}張`)
  }

  if (finmind.revenue?.length > 0) {
    const latest = finmind.revenue[0]
    const revenueMonth = compactPromptText(latest?.revenueMonth || latest?.date, 12)
    const yoy = Number(latest?.revenueYoY)
    const mom = Number(latest?.revenueMoM)
    const revenueParts = [
      revenueMonth ? `營收${revenueMonth}` : '',
      Number.isFinite(yoy) ? `YoY ${formatSignedNumber(yoy, 1)}%` : '',
      Number.isFinite(mom) ? `MoM ${formatSignedNumber(mom, 1)}%` : '',
    ].filter(Boolean)
    if (revenueParts.length > 0) parts.push(revenueParts.join(' '))
  }

  // 資產負債表摘要
  if (finmind.balanceSheet?.length > 0) {
    const latest = finmind.balanceSheet[0]
    const totalAssets = latest?.totalAssets != null ? Number(latest.totalAssets) : null
    const totalLiabilities =
      latest?.totalLiabilities != null ? Number(latest.totalLiabilities) : null
    const shareholderEquity =
      latest?.shareholderEquity != null ? Number(latest.shareholderEquity) : null
    const debtRatio = latest?.debtRatio != null ? Number(latest.debtRatio) : null

    if (totalAssets != null || debtRatio != null) {
      const assetsStr = totalAssets != null ? `總資產${Math.round(totalAssets)}M` : ''
      const liabilitiesStr =
        totalLiabilities != null ? `總負債${Math.round(totalLiabilities)}M` : ''
      const debtStr = debtRatio != null ? `負債比${debtRatio.toFixed(1)}%` : ''
      const equityStr = shareholderEquity != null ? `股東權益${Math.round(shareholderEquity)}M` : ''
      parts.push(
        `資產負債 ${[assetsStr, liabilitiesStr, debtStr, equityStr].filter(Boolean).join(', ')}`
      )
    }
  }

  // 現金流量表摘要
  if (finmind.cashFlow?.length > 0) {
    const latest = finmind.cashFlow[0]
    const operatingCF = latest?.operatingCF != null ? Number(latest.operatingCF) : null
    const investingCF = latest?.investingCF != null ? Number(latest.investingCF) : null
    const financingCF = latest?.financingCF != null ? Number(latest.financingCF) : null

    if (operatingCF != null || investingCF != null) {
      const operatingStr = operatingCF != null ? `營業${Math.round(operatingCF)}M` : ''
      const investingStr = investingCF != null ? `投資${Math.round(investingCF)}M` : ''
      const financingStr = financingCF != null ? `籌資${Math.round(financingCF)}M` : ''
      parts.push(`現金流 ${[operatingStr, investingStr, financingStr].filter(Boolean).join(', ')}`)
    }
  }

  if (finmind.shareholding?.length > 0) {
    const latest = finmind.shareholding[0]
    const prev = finmind.shareholding[1]
    const ratio = Number(latest?.foreignShareRatio)
    const prevRatio = Number(prev?.foreignShareRatio)
    const delta =
      Number.isFinite(ratio) && Number.isFinite(prevRatio)
        ? `${ratio - prevRatio >= 0 ? '+' : ''}${(ratio - prevRatio).toFixed(2)}pp`
        : null
    if (Number.isFinite(ratio)) {
      parts.push(`外資持股 ${ratio.toFixed(2)}%${delta ? `(${delta})` : ''}`)
    }
  }

  return parts.length > 0 ? parts.join(' | ') : '無'
}

export function buildDailyHoldingDossierContext(
  dossier,
  change,
  { blind = false, compact = false } = {}
) {
  if (!dossier) return ''
  const position = dossier.position || {}
  const targets = dossier.targets || []
  const fundamentals = dossier.fundamentals || {}
  const events = dossier.events || []
  const brainContext = dossier.brainContext || {}
  const finmind = dossier.finmind || {}

  const priceInfo = blind
    ? `收盤價: N/A (盲測模式)`
    : `收盤價: ${position.price} (${change.changePct >= 0 ? '+' : ''}${change.changePct.toFixed(2)}%)`

  const targetInfo =
    targets.length > 0
      ? `目標價: ${targets.map((t) => `${t.firm} ${t.target}`).join(', ')}`
      : '目標價: 無'

  const fundamentalInfo = fundamentals.revenueMonth
    ? `營收: ${fundamentals.revenueMonth} ${fundamentals.revenueYoY >= 0 ? '+' : ''}${fundamentals.revenueYoY}% YoY`
    : '營收: 無最新資料'

  const eventInfo =
    events.length > 0 ? `事件: ${events.map((e) => `${e.date} ${e.title}`).join(', ')}` : '事件: 無'

  const brainRuleInfo =
    brainContext.matchedRules?.length > 0
      ? `匹配規則: ${brainContext.matchedRules.map((r) => r.text).join('；')}`
      : '匹配規則: 無'
  const supplyChainInfo = buildSupplyChainContext(dossier.code)
  const themeInfo = dossier.stockMeta ? buildThemeContext(dossier.code, dossier.stockMeta) : ''
  const themeChipsText = buildThemeChipsText(dossier.code)
  const knowledgeInfo = compact
    ? buildCompactKnowledgeContext(dossier.stockMeta ?? {})
    : buildKnowledgeContext(dossier.stockMeta ?? {})
  const finmindInfo = buildFinMindChipContext(finmind)

  if (compact) {
    const closeInfo = blind
      ? '收盤:N/A(盲測)'
      : `收盤:${position.price}(${formatPct(change?.changePct, 2)})`
    const snapshotLine = [
      `數量:${position.qty || 0}`,
      closeInfo,
      `成本:${position.cost || 0}`,
      `市值:${position.value || 0}`,
      `損益:${position.pnl || 0}(${formatPct(position.pct, 2)})`,
    ].join(' | ')
    const lines = [
      `<holding code="${dossier.code}" name="${dossier.name}" strategy="${compactPromptText(dossier?.stockMeta?.strategy || position?.type || '未知', 12)}">`,
      `snapshot=${snapshotLine}`,
      `thesis=${summarizeThesisForPrompt(dossier.thesis)}`,
      `targets=${summarizeTargetsForPrompt(targets)}`,
      `fundamentals=${formatFundamentalsSummary(fundamentals)}`,
      `events=${summarizeEventsForPrompt(events)}`,
      `brain=${summarizeMatchedRulesForPrompt(brainContext)}`,
      `finmind=${buildCompactFinMindSummary(finmind, { debugLabel: dossier.code })}`,
      knowledgeInfo ? `knowledge=${knowledgeInfo}` : '',
      summarizeFreshnessForPrompt(dossier.freshness)
        ? `freshness=${summarizeFreshnessForPrompt(dossier.freshness)}`
        : '',
      `</holding>`,
    ].filter(Boolean)

    return lines.join('\n')
  }

  const result = `
股票代碼: ${dossier.code}
股票名稱: ${dossier.name}
持股數量: ${position.qty}
${priceInfo}
成本: ${position.cost}
市值: ${position.value}
未實現損益: ${position.pnl} (${position.pct >= 0 ? '+' : ''}${position.pct.toFixed(2)}%)

${dossier.thesis ? buildThesisScorecardContext(dossier.thesis) : '投資論文 (Thesis): 無'}
${targetInfo}
${fundamentalInfo}
${eventInfo}
${
  supplyChainInfo
    ? `
供應鏈:
${supplyChainInfo}`
    : ''
}
${themeInfo ? `${themeInfo}` : ''}
${themeChipsText ? `主題標籤：${themeChipsText}` : ''}
${brainRuleInfo}
${
  finmindInfo
    ? `
${finmindInfo}`
    : ''
}
${
  knowledgeInfo
    ? `
${knowledgeInfo}`
    : ''
}
`

  // Prompt 瘦身輔助：記錄字數統計供 Codex 分析
  try {
    const thesisLen = dossier.thesis ? buildThesisScorecardContext(dossier.thesis).length : 0
    const supplyChainLen = supplyChainInfo ? supplyChainInfo.length : 0
    const knowledgeLen = knowledgeInfo ? knowledgeInfo.length : 0
    const finmindLen = finmindInfo ? finmindInfo.length : 0
    if (typeof globalThis !== 'undefined' && globalThis.__DEBUG_PROMPT_BUDGET__) {
      console.warn(
        '[prompt-budget]',
        dossier.code,
        'total:',
        result.length,
        '字 | thesis:',
        thesisLen,
        '| supplyChain:',
        supplyChainLen,
        '| knowledge:',
        knowledgeLen,
        '| finmind:',
        finmindLen
      )
    }
  } catch {
    // silent fail - 不影響主流程
  }

  return result
}

export function buildEventReviewDossiers(reviewedEvent, dossierByCode) {
  if (!reviewedEvent || !dossierByCode) return []
  const codes = getEventStockCodes(reviewedEvent)
  return codes.map((code) => dossierByCode.get(code)).filter(Boolean)
}

export function buildColdStartDossierSummary(
  code,
  finmindData = {},
  events = [],
  knowledgeRules = [],
  { maxChars = 2000 } = {}
) {
  const supplyChain = getSupplyChain(code)
  const topRules = (
    Array.isArray(knowledgeRules) && knowledgeRules.length > 0
      ? knowledgeRules
      : getTopKnowledgeRules({ maxItems: 10 })
  )
    .slice(0, 10)
    .map(
      (rule) => `${compactPromptText(rule.title, 18)}(${Math.round((rule.confidence || 0) * 100)}%)`
    )
    .join('、')

  const recentEvents = (Array.isArray(events) ? events : [])
    .slice(0, 7)
    .map((event) => `${compactPromptText(event.date, 10)} ${compactPromptText(event.title, 18)}`)
    .join('；')

  const finmindSummary = buildCompactFinMindSummary(finmindData, { debugLabel: code })
  const supplySummary = buildSupplyChainContext(code)
  const themeSummary = buildThemeChipsText(code)

  const text = [
    `標的: ${code}`,
    `FinMind七組摘要: ${finmindSummary || '無'}`,
    `知識庫高信心規則: ${topRules || '無'}`,
    `近7天事件: ${recentEvents || '無'}`,
    `供應鏈上下游: ${compactPromptText(supplySummary || supplyChain?.summary || '無', 300)}`,
    themeSummary ? `主題: ${compactPromptText(themeSummary, 180)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text
}

export function buildHoldingDossiers(input, options = {}) {
  const config = Array.isArray(input)
    ? { holdings: input, ...options }
    : input && typeof input === 'object'
      ? input
      : {}

  const {
    holdings = [],
    targets = {},
    fundamentals = {},
    analystReports = {},
    newsEvents = [],
    researchHistory = [],
    stockMeta = {},
  } = config

  const rows = Array.isArray(holdings) ? holdings : []
  return rows.map((holding) => ({
    code: holding.code,
    name: holding.name,
    position: holding,
    targets: targets[holding.code]?.reports || [],
    fundamentals: fundamentals[holding.code] || null,
    analystReports: analystReports[holding.code]?.items || [],
    events: newsEvents.filter((event) => getEventStockCodes(event).includes(holding.code)),
    research: researchHistory.filter((r) => r.code === holding.code),
    stockMeta: stockMeta[holding.code] || null,
    finmind: null, // 由 usePortfolioDerivedData 異步充實
  }))
}

export function buildResearchHoldingDossierContext(dossier, { compact = false } = {}) {
  if (!dossier) return ''
  const position = dossier.position || {}
  const thesis = dossier.thesis || {}
  const targets = dossier.targets || []
  const fundamentals = dossier.fundamentals || {}

  if (compact) {
    return `${dossier.name}(${dossier.code}) - 持股: ${position.qty}股, 成本: ${position.cost}, 現價: ${position.price}, 損益: ${position.pnl} (${position.pct.toFixed(2)}%)`
  }

  return `
股票代碼: ${dossier.code}
股票名稱: ${dossier.name}
持股數量: ${position.qty}
成本: ${position.cost}
現價: ${position.price}
未實現損益: ${position.pnl} (${position.pct.toFixed(2)}%)

投資論文 (Thesis): ${thesis.reason || '無'}
目標價: ${targets.map((t) => `${t.firm} ${t.target}`).join(', ') || '無'}
最新營收: ${fundamentals.revenueMonth ? `${fundamentals.revenueMonth} ${fundamentals.revenueYoY}% YoY` : '無'}
`
}

/**
 * 建立 FinMind 籌碼數據上下文（用於 daily analysis prompt）
 */
export function buildFinMindChipContext(finmind) {
  if (
    !finmind ||
    (!finmind.institutional?.length &&
      !finmind.valuation?.length &&
      !finmind.margin?.length &&
      !finmind.revenue?.length &&
      !finmind.balanceSheet?.length &&
      !finmind.cashFlow?.length &&
      !finmind.shareholding?.length)
  ) {
    return ''
  }

  const lines = ['籌碼數據 (FinMind):']

  // 三大法人近 5 日合計
  if (finmind.institutional?.length > 0) {
    const recent5 = finmind.institutional.slice(0, 5)
    const foreignSum = recent5.reduce((s, d) => s + (d.foreign || 0), 0)
    const investmentSum = recent5.reduce((s, d) => s + (d.investment || 0), 0)
    const dealerSum = recent5.reduce((s, d) => s + (d.dealer || 0), 0)
    lines.push(
      `  三大法人近 5 日：外資${foreignSum >= 0 ? '+' : ''}${foreignSum}張、投信${investmentSum >= 0 ? '+' : ''}${investmentSum}張、自營商${dealerSum >= 0 ? '+' : ''}${dealerSum}張`
    )
  }

  // 最新 PER/PBR
  if (finmind.valuation?.length > 0) {
    const latest = finmind.valuation[0]
    const perStr = latest.per ? `PER=${latest.per.toFixed(1)}` : ''
    const pbrStr = latest.pbr ? `PBR=${latest.pbr.toFixed(2)}` : ''
    const yieldStr = latest.dividendYield
      ? `殖利率=${(latest.dividendYield * 100).toFixed(1)}%`
      : ''
    const metrics = [perStr, pbrStr, yieldStr].filter(Boolean).join('、')
    if (metrics) lines.push(`  估值：${metrics}`)
  }

  // 融資餘額變化
  if (finmind.margin?.length > 0) {
    const recent = finmind.margin.slice(0, 2)
    if (recent.length >= 2) {
      const change = (recent[0].marginBalance || 0) - (recent[1].marginBalance || 0)
      lines.push(`  融資變化：${change >= 0 ? '+' : ''}${change}張`)
    }
  }

  if (finmind.revenue?.length > 0) {
    const latest = finmind.revenue[0]
    const revenueParts = [
      latest.revenueMonth ? `月營收 ${latest.revenueMonth}` : '',
      Number.isFinite(Number(latest.revenueYoY))
        ? `YoY ${Number(latest.revenueYoY) >= 0 ? '+' : ''}${Number(latest.revenueYoY).toFixed(1)}%`
        : '',
      Number.isFinite(Number(latest.revenueMoM))
        ? `MoM ${Number(latest.revenueMoM) >= 0 ? '+' : ''}${Number(latest.revenueMoM).toFixed(1)}%`
        : '',
    ].filter(Boolean)
    if (revenueParts.length > 0) {
      lines.push(`  月營收：${revenueParts.join('、')}`)
    }
  }

  if (finmind.balanceSheet?.length > 0) {
    const latest = finmind.balanceSheet[0]
    const balanceSheetParts = [
      Number.isFinite(Number(latest.totalAssets))
        ? `總資產 ${Math.round(Number(latest.totalAssets))}M`
        : '',
      Number.isFinite(Number(latest.totalLiabilities))
        ? `總負債 ${Math.round(Number(latest.totalLiabilities))}M`
        : '',
      Number.isFinite(Number(latest.debtRatio))
        ? `負債比 ${Number(latest.debtRatio).toFixed(1)}%`
        : '',
      Number.isFinite(Number(latest.shareholderEquity))
        ? `股東權益 ${Math.round(Number(latest.shareholderEquity))}M`
        : '',
    ].filter(Boolean)
    if (balanceSheetParts.length > 0) {
      lines.push(`  資產負債表：${balanceSheetParts.join('、')}`)
    }
  }

  if (finmind.cashFlow?.length > 0) {
    const latest = finmind.cashFlow[0]
    const cashFlowParts = [
      Number.isFinite(Number(latest.operatingCF))
        ? `營業 ${Math.round(Number(latest.operatingCF))}M`
        : '',
      Number.isFinite(Number(latest.investingCF))
        ? `投資 ${Math.round(Number(latest.investingCF))}M`
        : '',
      Number.isFinite(Number(latest.financingCF))
        ? `籌資 ${Math.round(Number(latest.financingCF))}M`
        : '',
    ].filter(Boolean)
    if (cashFlowParts.length > 0) {
      lines.push(`  現金流量表：${cashFlowParts.join('、')}`)
    }
  }

  if (finmind.shareholding?.length > 0) {
    const latest = finmind.shareholding[0]
    const prev = finmind.shareholding[1]
    const latestRatio = Number(latest?.foreignShareRatio)
    const prevRatio = Number(prev?.foreignShareRatio)
    if (Number.isFinite(latestRatio)) {
      const delta = Number.isFinite(prevRatio) ? latestRatio - prevRatio : null
      lines.push(
        `  外資持股比：${latestRatio.toFixed(2)}%${
          delta != null ? `（${delta >= 0 ? '+' : ''}${delta.toFixed(2)}pp）` : ''
        }`
      )
    }
  }

  return lines.join('\n')
}

export function buildTaiwanHardGateEvidenceRefs(dossier, issues) {
  return issues.map((issue) => ({
    type: 'dossier',
    refId: dossier.code,
    code: dossier.code,
    label: `台股硬閘門：${issue.type} - ${issue.message}`,
    date: new Date().toISOString().slice(0, 10),
  }))
}

export function formatTaiwanHardGateIssueList(issues) {
  return issues.map((issue) => `${issue.type}: ${issue.message}`).join('；')
}

export function listTaiwanHardGateIssues(_dossier) {
  const issues = []
  // Placeholder for actual hard gate logic
  // Example:
  // if (!dossier.fundamentals?.revenueMonth) {
  //   issues.push({ type: "fundamentals", message: "月營收資料缺失", status: "missing" });
  // }
  return issues
}

export function normalizeFundamentalsEntry(value) {
  if (!value || typeof value !== 'object') return null
  return {
    code: String(value.code || '').trim(),
    revenueMonth: String(value.revenueMonth || '').trim(),
    revenueYoY: Number(value.revenueYoY) || 0,
    revenueMoM: Number(value.revenueMoM) || 0,
    quarter: String(value.quarter || '').trim(),
    eps: Number(value.eps) || 0,
    grossMargin: Number(value.grossMargin) || 0,
    roe: Number(value.roe) || 0,
    source: String(value.source || '').trim(),
    updatedAt: String(value.updatedAt || '').trim(),
    note: String(value.note || '').trim(),
  }
}

export function normalizeFundamentalsStore(value) {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([code, entry]) => [code, normalizeFundamentalsEntry(entry)])
      .filter(([, entry]) => Boolean(entry))
  )
}

export function formatFundamentalsSummary(entry) {
  const normalized = normalizeFundamentalsEntry(entry)
  if (!normalized) return '無基本面資料'

  const parts = []
  if (normalized.revenueMonth) {
    parts.push(`月營收 ${normalized.revenueMonth}`)
  }
  if (Number.isFinite(normalized.revenueYoY) && normalized.revenueYoY !== 0) {
    parts.push(`YoY ${normalized.revenueYoY >= 0 ? '+' : ''}${normalized.revenueYoY}%`)
  }
  if (Number.isFinite(normalized.revenueMoM) && normalized.revenueMoM !== 0) {
    parts.push(`MoM ${normalized.revenueMoM >= 0 ? '+' : ''}${normalized.revenueMoM}%`)
  }
  if (normalized.quarter) {
    parts.push(`季度 ${normalized.quarter}`)
  }
  if (Number.isFinite(normalized.eps) && normalized.eps !== 0) {
    parts.push(`EPS ${normalized.eps}`)
  }
  if (Number.isFinite(normalized.grossMargin) && normalized.grossMargin !== 0) {
    parts.push(`毛利率 ${normalized.grossMargin}%`)
  }
  if (Number.isFinite(normalized.roe) && normalized.roe !== 0) {
    parts.push(`ROE ${normalized.roe}%`)
  }

  return parts.length > 0 ? parts.join(' · ') : '無可用基本面摘要'
}

export function normalizeHoldingDossiers(value) {
  if (!Array.isArray(value)) return []
  return value.map(normalizeHoldingDossier).filter(Boolean)
}

export function normalizeHoldingDossier(value) {
  if (!value || typeof value !== 'object') return null
  const code = String(value.code || '').trim()
  if (!code) return null
  return {
    code,
    name: String(value.name || code).trim(),
    position: value.position || null, // Assuming normalizeHoldingRow is used here
    thesis: value.thesis || null,
    targets: Array.isArray(value.targets) ? value.targets : [],
    fundamentals: normalizeFundamentalsEntry(value.fundamentals),
    analystReports: Array.isArray(value.analystReports) ? value.analystReports : [],
    events: Array.isArray(value.events) ? value.events : [],
    research: Array.isArray(value.research) ? value.research : [],
    brainContext: value.brainContext || null,
    freshness: value.freshness || null,
    validationSignals: value.validationSignals || null,
  }
}

export function normalizeTaiwanValidationSignalStatus(value) {
  if (!value || typeof value !== 'object') return 'missing'
  return String(value.status || 'missing').trim()
}

export function formatTaiwanValidationSignalLabel(value) {
  const status =
    typeof value === 'string' ? value.trim() : normalizeTaiwanValidationSignalStatus(value)

  switch (status) {
    case 'fresh':
      return '新鮮'
    case 'stale':
      return '過期'
    case 'ok':
      return '正常'
    case 'warning':
      return '需留意'
    case 'missing':
    default:
      return '缺失'
  }
}

/**
 * 建立供應鏈 context 文字（for AI prompt）
 */
export function buildSupplyChainContext(
  code,
  {
    upstreamLimit = 3,
    downstreamLimit = 3,
    customerLimit = 5,
    supplierLimit = 5,
    competitorLimit = 3,
  } = {}
) {
  const chain = getSupplyChain(code)
  if (!chain) return ''

  const parts = []

  if (chain.upstream.length > 0) {
    const upstreamText = chain.upstream
      .slice(0, Math.max(1, upstreamLimit))
      .map((s) => `${s.name}(${s.product}${s.dependency === 'high' ? ',高度依賴' : ''})`)
      .join(', ')
    parts.push(`上游: ${upstreamText}`)
  }

  if (chain.downstream.length > 0) {
    const downstreamText = chain.downstream
      .slice(0, Math.max(1, downstreamLimit))
      .map((s) => `${s.name}(${s.product}${s.revenueShare ? ',' + s.revenueShare + '營收' : ''})`)
      .join(', ')
    parts.push(`下游: ${downstreamText}`)
  }

  if (chain.customers.length > 0) {
    parts.push(`主要客戶: ${chain.customers.slice(0, Math.max(1, customerLimit)).join(', ')}`)
  }

  if (chain.suppliers.length > 0) {
    parts.push(`主要供應商: ${chain.suppliers.slice(0, Math.max(1, supplierLimit)).join(', ')}`)
  }

  if (chain.competitors?.length > 0) {
    parts.push(
      `主要競爭對手：${chain.competitors.slice(0, Math.max(1, competitorLimit)).join(', ')}`
    )
  }

  return parts.join('\n')
}

/**
 * 建立主題 context 文字（for AI prompt）
 */
export function buildThemeContext(code, stockMeta, { maxThemes = 4 } = {}) {
  if (!stockMeta?.themes?.length) return ''

  const themes = stockMeta.themes.slice(0, Math.max(1, maxThemes)).map((name) => {
    const found = getThemesForStock(code).find((t) => t.name === name)
    if (found) return `${name}(${found.count}家)`
    return name
  })

  return `相關主題: ${themes.join(', ')}`
}

export function buildHoldingCoverageContext(
  dossier,
  {
    maxThemes = 4,
    upstreamLimit = 3,
    downstreamLimit = 3,
    customerLimit = 5,
    supplierLimit = 5,
    competitorLimit = 3,
  } = {}
) {
  if (!dossier) return ''
  const supplyChainText = buildSupplyChainContext(dossier.code, {
    upstreamLimit,
    downstreamLimit,
    customerLimit,
    supplierLimit,
    competitorLimit,
  })
    .replace(/\n+/g, ' | ')
    .trim()
  const themeText = buildThemeContext(dossier.code, dossier.stockMeta, { maxThemes }).trim()
  const parts = [supplyChainText, themeText].filter(Boolean)
  if (parts.length === 0) return ''
  return `${dossier.name}(${dossier.code}) | ${parts.join(' | ')}`
}

/**
 * Build thesis scorecard context for AI prompt
 */

/**
 * 建立主題標籤展示（含上中下游位置）- 用於前端 UI
 * 從 themeClassification.json 讀取每檔持股的主題 + 位置
 */
export function buildThemeChips(code) {
  try {
    const fs = require('fs')
    const path = require('path')
    const themeFile = path.join(process.cwd(), 'src/data/themeClassification.json')
    if (!fs.existsSync(themeFile)) return []

    const themeData = JSON.parse(fs.readFileSync(themeFile, 'utf-8'))
    const entry = themeData[code]
    if (!entry?.themes) return []

    return entry.themes.map((t) => ({
      theme: t.theme,
      position: t.position || null,
      label: t.position ? t.theme + '(' + t.position + ')' : t.theme,
    }))
  } catch {
    return []
  }
}

/**
 * 建立主題標籤文字（用於 prompt）
 */
export function buildThemeChipsText(code) {
  const chips = buildThemeChips(code)
  if (chips.length === 0) return ''
  return chips.map((c) => c.label).join(' | ')
}

export function buildThesisScorecardContext(thesis) {
  if (!thesis) return ''

  const statement = thesis.statement || thesis.reason || ''
  const direction = thesis.direction || 'long'
  const conviction = thesis.conviction || 'medium'

  const pillarLines = (thesis.pillars || [])
    .map((p) => `  - ${p.text} [${p.status}] trend:${p.trend || 'stable'}`)
    .join('\n')

  const riskLines = (thesis.risks || [])
    .map((r) => `  - ${r.text}${r.triggered ? ' [TRIGGERED]' : ''}`)
    .join('\n')

  const priceInfo = []
  if (thesis.targetPrice) priceInfo.push(`目標價: ${thesis.targetPrice}`)
  if (thesis.stopLoss) priceInfo.push(`停損價: ${thesis.stopLoss}`)

  return `Thesis (${direction}): ${statement}
Conviction: ${conviction}${
    pillarLines
      ? `
Pillars:
${pillarLines}`
      : ''
  }${
    riskLines
      ? `
Risks:
${riskLines}`
      : ''
  }${
    priceInfo.length > 0
      ? `
${priceInfo.join(' / ')}`
      : ''
  }`
}

export function createDefaultFundamentalDraft(overrides = {}) {
  return { ...DEFAULT_FUNDAMENTAL_DRAFT, ...overrides }
}
