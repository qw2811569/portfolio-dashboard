function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatRevenueMonth(row) {
  if (!row) return ''
  const year = Number(row.revenueYear)
  const month = Number(row.revenueMonth)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return ''
  return `${year}-${String(month).padStart(2, '0')}`
}

function dateStringToQuarter(dateStr) {
  const match = String(dateStr || '').match(/^(\d{4})-(\d{2})/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month)) return ''
  const quarter = Math.ceil(month / 3)
  if (quarter < 1 || quarter > 4) return ''
  return `${year}Q${quarter}`
}

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10
}

function computeGrossMargin(financialRow) {
  if (!financialRow) return 0
  const revenue = toNumber(financialRow.Revenue)
  const grossProfit = toNumber(financialRow.GrossProfit)
  if (revenue <= 0 || grossProfit === 0) return 0
  return roundOneDecimal((grossProfit / revenue) * 100)
}

function computeRoe(financialRow, balanceRow) {
  if (!financialRow || !balanceRow) return 0
  const netIncome = toNumber(
    financialRow.NetIncome ??
      financialRow.IncomeAfterTaxes ??
      financialRow.EquityAttributableToOwnersOfParent
  )
  const equity = toNumber(
    balanceRow.Equity ?? balanceRow.EquityAttributableToOwnersOfParent ?? balanceRow.TotalEquity
  )
  if (equity <= 0 || netIncome === 0) return 0
  return roundOneDecimal((netIncome / equity) * 100)
}

export function mapFinMindToFundamentals(raw, { code, now = new Date() } = {}) {
  if (!raw || typeof raw !== 'object') return null

  const revenueRows = Array.isArray(raw.revenue) ? raw.revenue : []
  const financialRows = Array.isArray(raw.financials) ? raw.financials : []
  const balanceRows = Array.isArray(raw.balanceSheet) ? raw.balanceSheet : []

  const latestRevenue = revenueRows[0] || null
  const latestFinancials = financialRows[0] || null
  const latestBalance = balanceRows[0] || null

  const revenueMonth = latestRevenue ? formatRevenueMonth(latestRevenue) : ''
  const revenueYoY = latestRevenue ? toNumber(latestRevenue.revenueYoY) : 0
  const revenueMoM = latestRevenue ? toNumber(latestRevenue.revenueMoM) : 0

  const quarter =
    String(latestFinancials?.quarter || '').trim() ||
    (latestFinancials ? dateStringToQuarter(latestFinancials.date) : '')
  const eps = latestFinancials ? toNumber(latestFinancials.EPS) : 0
  const grossMargin = computeGrossMargin(latestFinancials)
  const roe = computeRoe(latestFinancials, latestBalance)
  const statementPeriodMode = String(latestFinancials?.statementPeriodMode || '').trim()
  const statementWarnings = Array.isArray(latestFinancials?.statementWarnings)
    ? latestFinancials.statementWarnings
    : []

  const hasRevenue = Boolean(revenueMonth)
  const hasFinancials = eps !== 0 || grossMargin !== 0 || roe !== 0
  if (!hasRevenue && !hasFinancials) return null

  const completeness = hasRevenue && hasFinancials ? 'fresh' : 'partial'

  return {
    completeness,
    entry: {
      code: String(code || '').trim(),
      revenueMonth,
      revenueYoY,
      revenueMoM,
      quarter,
      eps,
      grossMargin,
      roe,
      source: 'finmind',
      updatedAt: now.toISOString(),
      note: [
        statementPeriodMode ? `statementPeriodMode=${statementPeriodMode}` : '',
        statementWarnings.length > 0 ? `warnings=${statementWarnings.join(',')}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    },
  }
}
