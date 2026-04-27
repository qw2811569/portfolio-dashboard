function toFiniteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeText(value) {
  return String(value || '').trim()
}

function buildDossierMap(dossiers = []) {
  return new Map(
    (Array.isArray(dossiers) ? dossiers : [])
      .filter((dossier) => dossier?.code)
      .map((dossier) => [String(dossier.code), dossier])
  )
}

function pickHoldingName(holding, dossier = null) {
  return normalizeText(holding?.name || dossier?.name || holding?.code || '持倉')
}

function resolveTargetPrice(holding, dossier = null) {
  const direct = toFiniteNumber(holding?.targetPrice)
  if (direct != null) return direct

  const thesisTarget = toFiniteNumber(dossier?.thesis?.targetPrice)
  if (thesisTarget != null) return thesisTarget

  const aggregateTarget = toFiniteNumber(dossier?.targetAggregate?.avgTarget)
  if (aggregateTarget != null) return aggregateTarget

  const latestTarget = (Array.isArray(dossier?.targets) ? dossier.targets : [])
    .map((row) => toFiniteNumber(row?.target))
    .find((value) => value != null)

  return latestTarget ?? null
}

function getPositionPrice(holding, dossier = null) {
  return (
    toFiniteNumber(holding?.price) ??
    toFiniteNumber(dossier?.position?.price) ??
    (toFiniteNumber(holding?.value) != null && toFiniteNumber(holding?.qty) > 0
      ? toFiniteNumber(holding.value) / toFiniteNumber(holding.qty)
      : null)
  )
}

function isRecentDate(value, now = new Date(), days = 2) {
  const raw = normalizeText(value)
  if (!raw) return false
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return false
  const diffMs = now.getTime() - parsed.getTime()
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000
}

function collectUpcomingEvents(holding, dossier = null, alerts = [], now = new Date()) {
  const code = String(holding?.code || '').trim()
  const rows = [
    ...(Array.isArray(dossier?.events) ? dossier.events : []),
    ...(Array.isArray(alerts) ? alerts : []),
  ]

  return rows
    .filter((event) => {
      const stocks = Array.isArray(event?.stocks) ? event.stocks : []
      const codes = stocks.map((stock) => String(stock || ''))
      return !code || codes.length === 0 || codes.some((stock) => stock.includes(code))
    })
    .map((event) => ({
      title: normalizeText(event?.title || event?.name || event?.detail),
      date: normalizeText(event?.eventDate || event?.date || event?.trackingStart),
    }))
    .filter((event) => {
      if (!event.title) return false
      if (!event.date) return true
      const parsed = new Date(`${event.date.slice(0, 10)}T00:00:00+08:00`)
      if (Number.isNaN(parsed.getTime())) return true
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      const diffDays = (parsed.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
      return diffDays >= 0 && diffDays <= 14
    })
}

function buildFallbackItems(items, fallback) {
  return items.length > 0 ? items : fallback
}

export function buildTodayActions({
  holdings = [],
  dossiers = [],
  dailyReport = null,
  alerts = [],
  now = new Date(),
} = {}) {
  const safeHoldings = Array.isArray(holdings) ? holdings : []
  const dossierByCode = buildDossierMap(dossiers)
  const doItems = []
  const dontItems = []
  const riskItems = []
  const totalValue = safeHoldings.reduce(
    (sum, holding) => sum + (toFiniteNumber(holding?.value) || 0),
    0
  )

  for (const holding of safeHoldings) {
    const code = String(holding?.code || '').trim()
    const dossier = dossierByCode.get(code)
    const name = pickHoldingName(holding, dossier)
    const price = getPositionPrice(holding, dossier)
    const target = resolveTargetPrice(holding, dossier)
    const pct = toFiniteNumber(holding?.pct) || 0
    const alertText = normalizeText(holding?.alert).replace(/^⚡\s*/, '')
    const thesisPillars = Array.isArray(dossier?.thesis?.pillars) ? dossier.thesis.pillars : []
    const loosePillar = thesisPillars.find((pillar) =>
      ['at_risk', 'off_track', 'broken', 'watch'].includes(normalizeText(pillar?.status))
    )
    const value = toFiniteNumber(holding?.value) || 0

    if (alertText) {
      doItems.push({
        tone: 'alert',
        code,
        title: name,
        body: alertText,
      })
    } else if (price != null && target != null && target > 0) {
      const distancePct = ((target - price) / target) * 100
      if (distancePct >= 0 && distancePct <= 8) {
        doItems.push({
          tone: 'watch',
          code,
          title: name,
          body: `接近目標價 ${target}，先確認是否分批調節。`,
        })
      }
    }

    if (loosePillar) {
      doItems.push({
        tone: 'warning',
        code,
        title: name,
        body: `${normalizeText(loosePillar.label || loosePillar.id || 'thesis')} 鬆動，今天先補資料。`,
      })
    }

    if (pct >= 10) {
      dontItems.push({
        tone: 'mute',
        code,
        title: name,
        body: `報酬 ${pct.toFixed(1)}%，剛漲多先不要追價。`,
      })
    } else if (
      isRecentDate(holding?.createdAt || holding?.tradeDate || holding?.updatedAt, now, 2)
    ) {
      dontItems.push({
        tone: 'mute',
        code,
        title: name,
        body: '剛建立部位，先等第一個收盤驗證。',
      })
    } else if (price != null && target != null && target > price * 1.18) {
      dontItems.push({
        tone: 'mute',
        code,
        title: name,
        body: '尚未到加碼條件，等價格或事件靠近再動。',
      })
    }

    if (totalValue > 0 && value / totalValue >= 0.25) {
      riskItems.push({
        tone: 'warning',
        code,
        title: name,
        body: `單一部位 ${((value / totalValue) * 100).toFixed(1)}%，先檢查集中度。`,
      })
    }

    if (pct <= -10) {
      riskItems.push({
        tone: 'alert',
        code,
        title: name,
        body: `回撤 ${pct.toFixed(1)}%，確認停損或投資理由是否仍成立。`,
      })
    }

    const upcoming = collectUpcomingEvents(holding, dossier, alerts, now)[0]
    if (upcoming) {
      riskItems.push({
        tone: 'watch',
        code,
        title: name,
        body: `${upcoming.date ? `${upcoming.date} ` : ''}${upcoming.title}`,
      })
    }
  }

  const reportRisks = Array.isArray(dailyReport?.risks) ? dailyReport.risks : []
  for (const risk of reportRisks.slice(0, 2)) {
    riskItems.push({
      tone: 'watch',
      code: normalizeText(risk?.code),
      title: normalizeText(risk?.title || risk?.name || '收盤風險'),
      body: normalizeText(risk?.summary || risk?.body || risk?.detail || risk),
    })
  }

  return {
    doItems: buildFallbackItems(doItems, [
      { tone: 'mute', title: '沒有立即動作', body: '今天先維持觀察，只處理已觸發的提醒。' },
    ]).slice(0, 3),
    dontItems: buildFallbackItems(dontItems, [
      { tone: 'mute', title: '不要為了動而動', body: '未到加碼條件的部位先不追價。' },
      { tone: 'mute', title: '不補資料不調倉', body: 'thesis 沒更新前不要放大部位。' },
    ]).slice(0, 3),
    riskItems: buildFallbackItems(riskItems, [
      { tone: 'mute', title: '風險暫無急迫項', body: '仍需留意集中度、回撤與近 14 天事件。' },
    ]).slice(0, 3),
  }
}
