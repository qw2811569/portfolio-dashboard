/**
 * FinMind PER-band derived target mapper.
 *
 * Given a `fetchStockDossierData(code)` response (raw FinMind dossier), compute
 * a three-point historical PE band (low / mid / high) multiplied by the latest
 * quarterly EPS to produce synthetic "analyst" target reports. These are NOT
 * analyst opinions — they are statistical reference points derived from how the
 * market has historically priced this stock. UI consumers MUST label them as
 * derived, not as real research reports.
 *
 * Inputs used:
 *   - raw.valuation[] from TaiwanStockPER (via api/finmind.js transformValuation)
 *     Each row: { date, per, pbr, dividendYield }
 *     Sorted by date desc (from sortByDateDesc in api/finmind.js)
 *
 *   - raw.financials[] from TaiwanStockFinancialStatements (via pivotStatementRows)
 *     Each row: { date, [type]: value } where `type` includes 'EPS'
 *     Sorted by date desc
 *
 * Gates:
 *   - No valuation rows OR all PER values invalid → null
 *   - No financials rows → null
 *   - Latest EPS <= 0 (zero or loss-making) → null (cannot meaningfully multiply)
 *
 * Output shape (compatible with existing dossier.targets entries):
 *   {
 *     reports: [
 *       { firm: '歷史PE低標', target: <round>, date: 'YYYY/MM/DD' },
 *       { firm: '歷史PE均值', target: <round>, date: 'YYYY/MM/DD' },
 *       { firm: '歷史PE高標', target: <round>, date: 'YYYY/MM/DD' },
 *     ],
 *     source: 'finmind-per-band',
 *     updatedAt: <ISO timestamp>,
 *   }
 */

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return null
  if (sortedValues.length === 1) return sortedValues[0]
  const idx = (sortedValues.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedValues[lo]
  const weight = idx - lo
  return sortedValues[lo] * (1 - weight) + sortedValues[hi] * weight
}

function formatDateSlash(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

export function mapFinMindToPerBandTargets(raw, { code, now = new Date() } = {}) {
  if (!raw || typeof raw !== 'object') return null

  const valuationRows = Array.isArray(raw.valuation) ? raw.valuation : []
  const financialRows = Array.isArray(raw.financials) ? raw.financials : []
  if (valuationRows.length === 0) return null
  if (financialRows.length === 0) return null

  const perValues = valuationRows
    .map((row) => toFiniteNumber(row?.per))
    .filter((v) => v != null && v > 0)
  if (perValues.length === 0) return null

  const latestFinancials = financialRows[0] || null
  const latestEps = toFiniteNumber(latestFinancials?.EPS)
  if (latestEps == null || latestEps <= 0) return null

  const sorted = [...perValues].sort((a, b) => a - b)
  const perLow = percentile(sorted, 0.25)
  const perMid = percentile(sorted, 0.5)
  const perHigh = percentile(sorted, 0.75)

  const reportDate = formatDateSlash(now)
  const reports = [
    { firm: '歷史PE低標', target: Math.round(perLow * latestEps), date: reportDate },
    { firm: '歷史PE均值', target: Math.round(perMid * latestEps), date: reportDate },
    { firm: '歷史PE高標', target: Math.round(perHigh * latestEps), date: reportDate },
  ].filter((report) => Number.isFinite(report.target) && report.target > 0)

  if (reports.length === 0) return null

  return {
    code: String(code || '').trim(),
    reports,
    source: 'finmind-per-band',
    updatedAt: now.toISOString(),
  }
}
