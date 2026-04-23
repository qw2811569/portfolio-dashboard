import { displayPortfolioName } from './portfolioDisplay.js'

function toFiniteNumber(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function formatSignedNumber(value, digits = 1) {
  const number = toFiniteNumber(value, 0)
  const safeNumber = Math.abs(number) < Number.EPSILON ? 0 : number
  const sign = safeNumber > 0 ? '+' : ''
  return `${sign}${safeNumber.toFixed(digits)}`
}

function formatSignedPercent(value, digits = 1) {
  return `${formatSignedNumber(value, digits)}%`
}

function formatSignedDeltaPp(value, digits = 1) {
  return `${formatSignedNumber(value, digits)}pp`
}

function normalizeComparePortfolio(portfolio) {
  if (!portfolio || typeof portfolio !== 'object') return null

  const todayRetPct = toFiniteNumber(portfolio.todayRetPct)
  if (todayRetPct == null) return null

  return {
    ...portfolio,
    label: displayPortfolioName(portfolio),
    todayRetPct,
    todayTotalPnl: toFiniteNumber(portfolio.todayTotalPnl, 0),
    todayTopContributor:
      portfolio.todayTopContributor && typeof portfolio.todayTopContributor === 'object'
        ? portfolio.todayTopContributor
        : null,
    todayTopDrag:
      portfolio.todayTopDrag && typeof portfolio.todayTopDrag === 'object'
        ? portfolio.todayTopDrag
        : null,
  }
}

function pickComparePair(portfolios, activePortfolioId = '') {
  const safePortfolios = (Array.isArray(portfolios) ? portfolios : [])
    .map((portfolio) => normalizeComparePortfolio(portfolio))
    .filter(Boolean)

  if (safePortfolios.length < 2) return []

  const ownerPortfolio = safePortfolios.find((portfolio) => portfolio.id === 'me') || null
  const activePortfolio =
    safePortfolios.find((portfolio) => portfolio.id === activePortfolioId) || safePortfolios[0]

  if (ownerPortfolio) {
    const preferredSecondary = ownerPortfolio.id !== activePortfolio?.id ? activePortfolio : null
    const secondaryPortfolio =
      preferredSecondary ||
      safePortfolios.find((portfolio) => portfolio.id !== ownerPortfolio.id) ||
      null

    if (secondaryPortfolio) return [ownerPortfolio, secondaryPortfolio]
  }

  const fallbackSecondary =
    safePortfolios.find((portfolio) => portfolio.id !== activePortfolio?.id) || null
  if (activePortfolio && fallbackSecondary) return [activePortfolio, fallbackSecondary]

  return safePortfolios.slice(0, 2)
}

function readDriverLabel(item) {
  if (!item || typeof item !== 'object') return ''
  const code = String(item.code || '').trim()
  const name = String(item.name || '').trim()
  if (name && code) return `${name} (${code})`
  return name || code
}

function buildCompareInsight(primary, secondary, deltaPp) {
  const absDelta = Math.abs(deltaPp)
  if (absDelta < 0.05) {
    return {
      tone: 'calm',
      text: '兩組節奏接近 · 都停在觀察區',
    }
  }

  if (deltaPp > 0) {
    const driverLabel = readDriverLabel(primary.todayTopContributor)
    return {
      tone: absDelta >= 0.2 ? 'watch' : 'calm',
      text: driverLabel
        ? `${primary.label} 今天比 ${secondary.label} 快 ${formatSignedDeltaPp(deltaPp)} · 主要拉動是 ${driverLabel}`
        : `${primary.label} 今天比 ${secondary.label} 快 ${formatSignedDeltaPp(deltaPp)} · 主線還在領先組合這邊`,
    }
  }

  const pressureLabel = readDriverLabel(primary.todayTopDrag)
  return {
    tone: 'watch',
    text: pressureLabel
      ? `${secondary.label} 今天更穩 · ${primary.label} 有 ${pressureLabel} 一檔壓在平均`
      : `${secondary.label} 今天更穩 · ${primary.label} 還有一檔壓在平均`,
  }
}

export function buildDashboardCompareStrip(
  portfolios = [],
  { activePortfolioId = '', staleStatus = '' } = {}
) {
  const [primary, secondary] = pickComparePair(portfolios, activePortfolioId)
  if (!primary || !secondary) return null

  const deltaPp = primary.todayRetPct - secondary.todayRetPct
  const insight = buildCompareInsight(primary, secondary, deltaPp)

  return {
    primary,
    secondary,
    deltaPp,
    deltaText: formatSignedDeltaPp(deltaPp),
    summaryText: `${primary.label} ${formatSignedPercent(primary.todayRetPct)} · ${secondary.label} ${formatSignedPercent(secondary.todayRetPct)} · 今日差距 ${formatSignedDeltaPp(deltaPp)}`,
    insightText: insight.text,
    tone: insight.tone,
    staleStatus: String(staleStatus || '')
      .trim()
      .toLowerCase(),
  }
}

export function buildOverviewDashboardHeadline({
  compareStrip = null,
  portfolioCount = 0,
  duplicateHoldingsCount = 0,
  pendingItemsCount = 0,
} = {}) {
  if (compareStrip?.insightText) {
    return {
      headline: compareStrip.insightText,
      tone: compareStrip.tone || 'calm',
    }
  }

  if (pendingItemsCount > 0) {
    return {
      headline: `跨組合還有 ${pendingItemsCount} 件事件排隊 · 先看哪組需要先打開`,
      tone: 'watch',
    }
  }

  if (duplicateHoldingsCount > 0) {
    return {
      headline: `${duplicateHoldingsCount} 檔重複部位疊在一起 · 可以先看 thesis 有沒有說同一件事`,
      tone: 'watch',
    }
  }

  if (portfolioCount > 1) {
    return {
      headline: `${portfolioCount} 組先擺一起看 · 哪組需要深挖會更清楚`,
      tone: 'calm',
    }
  }

  return {
    headline: '這裡先看跨組合節奏 · 細節再往下拆',
    tone: 'calm',
  }
}
