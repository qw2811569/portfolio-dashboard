import { calculateConcentration } from './concentrationMetrics.js'
import { calculateEventCountdown } from './eventCountdown.js'
import { getEventStockCodes, isClosedEvent, parseFlexibleDate } from './eventUtils.js'

function toFiniteNumber(value) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatSignedNumber(value, suffix = '') {
  const number = toFiniteNumber(value)
  if (number == null) return '—'
  return `${number >= 0 ? '+' : ''}${Math.round(number).toLocaleString('zh-TW')}${suffix}`
}

function formatPercent(value, digits = 0) {
  const number = toFiniteNumber(value)
  if (number == null) return '—'
  return `${Math.round(number * Math.pow(10, digits)) / Math.pow(10, digits)}%`
}

function formatSignedPercent(value, digits = 1) {
  const number = toFiniteNumber(value)
  if (number == null) return '—'
  const base = Math.pow(10, digits)
  const rounded = Math.round(number * base) / base
  return `${rounded >= 0 ? '+' : ''}${rounded}%`
}

function normalizePillarStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (['broken', 'invalidated'].includes(normalized)) return 'broken'
  if (['watch', 'behind', 'weakened'].includes(normalized)) return 'weakened'
  return 'intact'
}

function getThesisLabel(thesis) {
  return String(
    thesis?.statement ||
      thesis?.reason ||
      thesis?.summary ||
      thesis?.expectation ||
      thesis?.text ||
      ''
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDateKey(value) {
  const parsed = parseFlexibleDate(value)
  if (!parsed) return ''
  const copy = new Date(parsed)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString().slice(0, 10)
}

function formatShortDate(value) {
  const parsed = parseFlexibleDate(value)
  if (!parsed) return String(value || '').trim()
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
  }).format(parsed)
}

function buildUnavailableMetric({
  id,
  question,
  routeTab,
  routeLabel,
  detail = '上線時才有，現在先不亂估。',
  currentValue = '上線時才有',
  supportingValue = '這題還沒接到可信來源',
}) {
  return {
    id,
    question,
    tone: 'muted',
    availability: 'placeholder',
    currentValue,
    supportingValue,
    detail,
    routeTab,
    routeLabel,
  }
}

function buildLoadingMetric({
  id,
  question,
  routeTab,
  routeLabel,
  detail = '今天對比大盤還在整理，先讓資料對齊一下。',
}) {
  return {
    id,
    question,
    tone: 'muted',
    availability: 'loading',
    currentValue: '',
    supportingValue: '',
    detail,
    routeTab,
    routeLabel,
  }
}

function extractZScoreFromDailyReport(dailyReport = null) {
  const candidates = [
    dailyReport?.marketContext?.relativeMarketZScore7d,
    dailyReport?.marketContext?.relativeMarketZScore,
    dailyReport?.marketContext?.zScore7d,
    dailyReport?.marketContext?.zScore,
    dailyReport?.anxietyMetrics?.x1?.zScore,
    dailyReport?.anxietyMetrics?.x1?.value,
    dailyReport?.anxietyMetrics?.x1,
  ]

  for (const candidate of candidates) {
    const number = toFiniteNumber(candidate)
    if (number != null) return number
  }

  const rawContext = String(dailyReport?.marketContext || '').trim()
  if (!rawContext) return null

  const matched = rawContext.match(/z-?score[:：]?\s*([+-]?\d+(?:\.\d+)?)/i)
  return matched ? toFiniteNumber(matched[1]) : null
}

function buildReadyX1Metric({
  zScore,
  interpretation = 'normal',
  latestDate = '',
  latestPortfolioReturnPct = null,
  latestBenchmarkReturnPct = null,
  benchmarkCode = '0050',
} = {}) {
  const abs = Math.abs(zScore)
  const tone = abs < 1 ? 'ok' : abs < 2 ? 'warn' : 'alert'
  const dateLabel = latestDate ? formatShortDate(latestDate) : ''
  const hasReturnPair =
    toFiniteNumber(latestPortfolioReturnPct) != null &&
    toFiniteNumber(latestBenchmarkReturnPct) != null
  const supportingValue = hasReturnPair
    ? dateLabel
      ? `${dateLabel} 組合 ${formatSignedPercent(latestPortfolioReturnPct)} · ${benchmarkCode} ${formatSignedPercent(latestBenchmarkReturnPct)}`
      : `組合 ${formatSignedPercent(latestPortfolioReturnPct)} · ${benchmarkCode} ${formatSignedPercent(latestBenchmarkReturnPct)}`
    : interpretation === 'anomaly'
      ? '今天和大盤 proxy 的距離明顯放大'
      : interpretation === 'outperform'
        ? '今天比大盤 proxy 快一點'
        : interpretation === 'underperform'
          ? '今天比大盤 proxy 慢一點'
          : '今天和大盤 proxy 大致同拍'
  const detail =
    interpretation === 'anomaly'
      ? '今天和大盤 proxy 的距離比平常明顯大，先回 Daily 看是誰在放大聲量。'
      : interpretation === 'outperform'
        ? '今天比大盤 proxy 快一點，先確認是 thesis 在發力，還是單日情緒拉高。'
        : interpretation === 'underperform'
          ? '今天比大盤 proxy 慢一點，先看是個股噪音，還是組合主線一起轉弱。'
          : '今天和大盤 proxy 大致同拍，暫時還在平常節奏裡。'

  return {
    id: 'x1',
    question: '今天漲跌正常嗎？',
    tone,
    availability: 'ready',
    currentValue: `${zScore >= 0 ? '+' : ''}${zScore.toFixed(1)}σ`,
    supportingValue,
    detail,
    routeTab: 'daily',
    routeLabel: '去看收盤分析',
  }
}

function buildX1Metric({ dailyReport = null, x1Benchmark = null } = {}) {
  if (x1Benchmark?.status === 'loading') {
    return buildLoadingMetric({
      id: 'x1',
      question: '今天漲跌正常嗎？',
      routeTab: 'daily',
      routeLabel: '去看收盤分析',
    })
  }

  if (x1Benchmark?.status === 'ready' && x1Benchmark?.data?.zScore != null) {
    return buildReadyX1Metric({
      zScore: Number(x1Benchmark.data.zScore),
      interpretation: x1Benchmark.data.interpretation,
      latestDate: x1Benchmark.data.marketDate,
      latestPortfolioReturnPct: x1Benchmark.data.latestPortfolioReturnPct,
      latestBenchmarkReturnPct: x1Benchmark.data.latestBenchmarkReturnPct,
      benchmarkCode: x1Benchmark.data?.benchmark?.code || '0050',
    })
  }

  if (x1Benchmark?.status === 'unavailable' || x1Benchmark?.status === 'error') {
    return buildUnavailableMetric({
      id: 'x1',
      question: '今天漲跌正常嗎？',
      routeTab: 'daily',
      routeLabel: '去看收盤分析',
      currentValue: '稍後再看',
      supportingValue: '今天對比大盤還在整理',
      detail: String(x1Benchmark?.data?.message || '').trim() || '今天對比大盤，稍後再看。',
    })
  }

  const zScore = extractZScoreFromDailyReport(dailyReport)
  if (zScore == null) {
    return buildUnavailableMetric({
      id: 'x1',
      question: '今天漲跌正常嗎？',
      routeTab: 'daily',
      routeLabel: '去看收盤分析',
      detail: '現在只有單日盤面線索，還沒接到 7 日相對大盤 z-score。',
    })
  }
  return buildReadyX1Metric({
    zScore,
    interpretation:
      Math.abs(zScore) >= 2
        ? 'anomaly'
        : zScore >= 1
          ? 'outperform'
          : zScore <= -1
            ? 'underperform'
            : 'normal',
  })
}

function buildX2Metric(holdingDossiers = []) {
  const safeDossiers = Array.isArray(holdingDossiers) ? holdingDossiers : []
  const rows = safeDossiers
    .map((dossier) => {
      const thesis = dossier?.thesis
      const pillars = Array.isArray(thesis?.pillars)
        ? thesis.pillars
            .map((pillar, index) => ({
              id: pillar?.id || `${dossier?.code || 'holding'}-${index}`,
              label: String(pillar?.label || pillar?.text || '').trim(),
              status: normalizePillarStatus(pillar?.status),
              code: dossier?.code || '',
              name: dossier?.name || dossier?.code || '',
            }))
            .filter((pillar) => pillar.label)
        : []
      return {
        code: dossier?.code || '',
        name: dossier?.name || dossier?.code || '',
        thesisLabel: getThesisLabel(thesis),
        pillars,
      }
    })
    .filter((item) => item.pillars.length > 0 || item.thesisLabel)

  const pillars = rows.flatMap((item) => item.pillars)
  if (pillars.length === 0) {
    return buildUnavailableMetric({
      id: 'x2',
      question: 'Thesis 還成立嗎？',
      routeTab: 'holdings',
      routeLabel: '去看持倉論述',
      detail: 'thesis pillar 還沒拆成可追蹤欄位，先留白不亂講。',
    })
  }

  const broken = pillars.filter((pillar) => pillar.status === 'broken')
  const weakened = pillars.filter((pillar) => pillar.status === 'weakened')
  const intact = pillars.filter((pillar) => pillar.status === 'intact')
  const tone = broken.length > 0 ? 'alert' : weakened.length > 0 ? 'warn' : 'ok'

  let currentValue = `${intact.length} 根主線大致穩`
  let supportingValue = `${rows.length} 檔有 thesis 追蹤`
  let detail = '大部分 thesis pillar 目前沒有看到失真。'

  if (broken.length > 0) {
    currentValue = `${broken.length} 根主線要重看`
    supportingValue = broken
      .slice(0, 3)
      .map((pillar) => pillar.name)
      .join('、')
    detail = '先回 Holdings 看是哪幾根 pillar 已經失真。'
  } else if (weakened.length > 0) {
    currentValue = `${weakened.length} 根主線轉弱`
    supportingValue = weakened
      .slice(0, 3)
      .map((pillar) => pillar.name)
      .join('、')
    detail = '論點還沒翻車，但有幾根 pillar 已經在搖。'
  }

  return {
    id: 'x2',
    question: 'Thesis 還成立嗎？',
    tone,
    availability: 'ready',
    currentValue,
    supportingValue,
    detail,
    routeTab: 'holdings',
    routeLabel: '去看持倉論述',
  }
}

function resolveInstitutionalRowTotal(row = {}) {
  const explicitTotal = toFiniteNumber(row.total)
  if (explicitTotal != null) return explicitTotal

  const foreign = toFiniteNumber(row.foreign) ?? toFiniteNumber(row.foreignInvestor) ?? 0
  const investment =
    toFiniteNumber(row.investment) ??
    toFiniteNumber(row.investmentTrust) ??
    toFiniteNumber(row.trust) ??
    0
  const dealer = toFiniteNumber(row.dealer) ?? 0
  return foreign + investment + dealer
}

function collectInstitutionalSeries(holdingDossiers = []) {
  const safeDossiers = Array.isArray(holdingDossiers) ? holdingDossiers : []
  const buckets = new Map()
  const coveredCodes = new Set()

  for (const dossier of safeDossiers) {
    const code = String(dossier?.code || '').trim()
    const rows = Array.isArray(dossier?.finmind?.institutional) ? dossier.finmind.institutional : []
    if (rows.length === 0) continue
    coveredCodes.add(code)

    for (const row of rows.slice(0, 5)) {
      const dateKey = normalizeDateKey(row?.date || row?.tradeDate || row?.Date)
      if (!dateKey) continue

      const existing = buckets.get(dateKey) || { date: dateKey, total: 0, codes: new Set() }
      existing.total += resolveInstitutionalRowTotal(row)
      existing.codes.add(code)
      buckets.set(dateKey, existing)
    }
  }

  const series = Array.from(buckets.values())
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => ({
      date: row.date,
      total: Math.round(row.total),
      coverageCount: row.codes.size,
    }))

  return {
    series,
    coverageCount: coveredCodes.size,
  }
}

function buildX3Metric(holdingDossiers = []) {
  const { series, coverageCount } = collectInstitutionalSeries(holdingDossiers)
  if (series.length === 0) {
    return buildUnavailableMetric({
      id: 'x3',
      question: '法人在我持股怎麼動？',
      routeTab: 'holdings',
      routeLabel: '去看持倉籌碼',
      detail: '5 日法人買賣超還沒補齊，現在先不畫假 sparkline。',
    })
  }

  const cumulative = series.reduce((sum, item) => sum + item.total, 0)
  const negativeDays = series.filter((item) => item.total < 0).length
  const tone =
    cumulative >= 0 ? 'ok' : negativeDays >= Math.max(3, series.length - 1) ? 'alert' : 'warn'
  const latest = series[series.length - 1] || null

  return {
    id: 'x3',
    question: '法人在我持股怎麼動？',
    tone,
    availability: 'ready',
    currentValue:
      cumulative === 0 ? '5 日差不多打平' : `5 日累計 ${formatSignedNumber(cumulative, ' 張')}`,
    supportingValue: latest
      ? `${formatShortDate(latest.date)} ${formatSignedNumber(latest.total, ' 張')}`
      : `${coverageCount} 檔有籌碼資料`,
    detail: `先看這 ${coverageCount} 檔持股，法人最近 5 天是偏買還是偏賣。`,
    sparkline: series.map((item) => item.total),
    sparklineDates: series.map((item) => item.date),
    routeTab: 'holdings',
    routeLabel: '去看持倉籌碼',
  }
}

function buildX4Metric({ holdings = [], stockMeta = null } = {}) {
  const safeHoldings = Array.isArray(holdings) ? holdings : []
  const concentration = calculateConcentration(safeHoldings, { stockMeta })
  const hasHoldings = safeHoldings.some(
    (holding) => toFiniteNumber(holding?.value) != null || toFiniteNumber(holding?.qty) != null
  )

  if (!hasHoldings || concentration.hhi <= 0) {
    return buildUnavailableMetric({
      id: 'x4',
      question: '部位集中度是否過高？',
      routeTab: 'overview',
      routeLabel: '去看投組結構',
      detail: '目前還沒有可計算的部位結構，先不硬塞 HHI。',
    })
  }

  const tone =
    concentration.risk === 'critical' || concentration.risk === 'high'
      ? 'alert'
      : concentration.risk === 'moderate'
        ? 'warn'
        : 'ok'
  const topIndustry = concentration.industryBreakdown[0] || null
  const detail = topIndustry
    ? `${topIndustry.industry} 目前約佔 ${formatPercent(topIndustry.weight * 100)}。`
    : '先看 Top 1 / Top 3 的擠壓程度。'

  return {
    id: 'x4',
    question: '部位集中度是否過高？',
    tone,
    availability: 'ready',
    currentValue: `HHI ${concentration.hhi.toLocaleString('zh-TW')}`,
    supportingValue: `Top 3 ${formatPercent(concentration.top3Weight * 100)}`,
    detail,
    routeTab: 'overview',
    routeLabel: '去看投組結構',
  }
}

function buildX5Metric(newsEvents = [], now = new Date()) {
  const safeEvents = Array.isArray(newsEvents) ? newsEvents : []
  const upcoming = safeEvents
    .filter((event) => !isClosedEvent(event))
    .map((event) => ({
      event,
      countdown: calculateEventCountdown(
        {
          ...event,
          date: event?.date || event?.eventDate || null,
        },
        now
      ),
      codes: getEventStockCodes(event),
    }))
    .filter(
      ({ countdown }) =>
        Number.isFinite(countdown?.daysUntil) &&
        countdown.daysUntil >= 0 &&
        countdown.daysUntil <= 3
    )
    .sort((left, right) => left.countdown.daysUntil - right.countdown.daysUntil)

  if (safeEvents.length === 0) {
    return {
      id: 'x5',
      question: '三天內有沒有事件？',
      tone: 'ok',
      availability: 'ready',
      currentValue: '這三天安靜',
      supportingValue: '目前沒有排進視窗的事件',
      detail: '暫時不用被事件日程追著跑。',
      routeTab: 'events',
      routeLabel: '去看事件日程',
    }
  }

  if (upcoming.length === 0) {
    return {
      id: 'x5',
      question: '三天內有沒有事件？',
      tone: 'ok',
      availability: 'ready',
      currentValue: '這三天安靜',
      supportingValue: '未看到 3 天內催化事件',
      detail: '可以把注意力放回 thesis 與部位節奏。',
      routeTab: 'events',
      routeLabel: '去看事件日程',
    }
  }

  const nearest = upcoming[0]
  const tone = nearest?.countdown?.daysUntil <= 1 ? 'alert' : 'warn'
  const names = upcoming
    .slice(0, 3)
    .map(({ event }) => event?.title || '未命名事件')
    .join('、')

  return {
    id: 'x5',
    question: '三天內有沒有事件？',
    tone,
    availability: 'ready',
    currentValue: `3 天內 ${upcoming.length} 件`,
    supportingValue: `${nearest.countdown.label} · ${nearest.event?.title || '未命名事件'}`,
    detail: names,
    routeTab: 'events',
    routeLabel: '去看事件日程',
  }
}

export function buildAnxietyMetrics({
  holdings = [],
  holdingDossiers = [],
  newsEvents = [],
  dailyReport = null,
  x1Benchmark = null,
  stockMeta = null,
  loading = false,
  now = new Date(),
} = {}) {
  const metrics = [
    buildX1Metric({ dailyReport, x1Benchmark }),
    buildX2Metric(holdingDossiers),
    buildX3Metric(holdingDossiers),
    buildX4Metric({ holdings, stockMeta }),
    buildX5Metric(newsEvents, now),
  ]

  return {
    loading: Boolean(loading),
    metrics,
    readyCount: metrics.filter((metric) => metric.availability === 'ready').length,
    placeholderCount: metrics.filter((metric) => metric.availability === 'placeholder').length,
    loadingCount: metrics.filter((metric) => metric.availability === 'loading').length,
    generatedAt: new Date(now).toISOString(),
  }
}
