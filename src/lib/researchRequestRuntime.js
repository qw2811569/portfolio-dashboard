function normalizeResearchStock(stock) {
  if (!stock || typeof stock !== 'object') return null
  const code = String(stock.code || '').trim()
  if (!code) return null

  return {
    code,
    name: String(stock.name || stock.label || code).trim(),
    price: Number(stock.price) || 0,
    cost: Number(stock.cost) || 0,
    qty: Number(stock.qty) || 0,
    value:
      Number(stock.value) ||
      Number(stock.price || 0) * Number(stock.qty || 0) ||
      0,
    pnl: Number(stock.pnl) || 0,
    pct: Number(stock.pct) || 0,
    type: String(stock.type || '股票').trim() || '股票',
  }
}

export function resolveResearchMode({ mode, stocks = [], holdings = [], target = null } = {}) {
  const normalizedMode = String(mode || '')
    .trim()
    .toLowerCase()

  if (normalizedMode === 'single' || normalizedMode === 'portfolio' || normalizedMode === 'evolve') {
    return normalizedMode
  }

  if (target || (Array.isArray(stocks) && stocks.length === 1)) {
    return 'single'
  }

  if (
    (Array.isArray(stocks) && stocks.length > 1) ||
    (Array.isArray(holdings) && holdings.length > 0)
  ) {
    return 'portfolio'
  }

  return 'single'
}

export function normalizeResearchRequestInput(body = {}) {
  const holdings = (Array.isArray(body.holdings) ? body.holdings : [])
    .map(normalizeResearchStock)
    .filter(Boolean)
  const requestStocks = (Array.isArray(body.stocks) ? body.stocks : [])
    .map(normalizeResearchStock)
    .filter(Boolean)
  const targetStock = normalizeResearchStock(body.target)
  const mode = resolveResearchMode({
    mode: body.mode,
    stocks: requestStocks,
    holdings,
    target: targetStock,
  })

  let stocks = requestStocks
  if (stocks.length === 0 && targetStock) {
    stocks = [targetStock]
  }
  if ((mode === 'portfolio' || mode === 'evolve') && stocks.length === 0 && holdings.length > 0) {
    stocks = holdings
  }

  return {
    ...body,
    mode,
    holdings,
    stocks,
  }
}

export function validateResearchRequestInput({ mode, stocks = [], holdings = [] } = {}) {
  if (mode === 'single' && stocks.length !== 1) {
    return '深度研究缺少目標股票'
  }

  if ((mode === 'portfolio' || mode === 'evolve') && stocks.length === 0 && holdings.length === 0) {
    return '研究請至少提供一檔持股'
  }

  return null
}

export function summarizeResearchRequestInput({
  mode,
  stocks = [],
  holdings = [],
  holdingDossiers = [],
  events = [],
  analysisHistory = [],
  persist = true,
} = {}) {
  return {
    mode,
    stockCount: Array.isArray(stocks) ? stocks.length : 0,
    holdingCount: Array.isArray(holdings) ? holdings.length : 0,
    dossierCount: Array.isArray(holdingDossiers) ? holdingDossiers.length : 0,
    eventCount: Array.isArray(events) ? events.length : 0,
    analysisHistoryCount: Array.isArray(analysisHistory) ? analysisHistory.length : 0,
    persist: Boolean(persist),
  }
}
