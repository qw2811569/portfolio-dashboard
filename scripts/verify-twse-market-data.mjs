import {
  fetchAllStockDailyPrices,
  fetchInstitutionalInvestors,
  fetchListedStocksCatalog,
  fetchValuationMetrics,
} from '../api/_lib/twse-market-data.js'

function formatDateForQuery(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function findInstitutionalSample(maxLookbackDays = 10) {
  const baseDate = new Date()

  for (let offset = 0; offset < maxLookbackDays; offset += 1) {
    const candidate = new Date(baseDate)
    candidate.setDate(baseDate.getDate() - offset)
    const date = formatDateForQuery(candidate)
    const rows = await fetchInstitutionalInvestors(date)

    if (rows.length > 0) {
      return {
        requestedDate: date,
        count: rows.length,
        sample: rows.slice(0, 3),
      }
    }
  }

  return {
    requestedDate: null,
    count: 0,
    sample: [],
  }
}

const [catalog, dailyPrices, valuations, institutional] = await Promise.all([
  fetchListedStocksCatalog(),
  fetchAllStockDailyPrices(),
  fetchValuationMetrics(),
  findInstitutionalSample(),
])

const payload = {
  checkedAt: new Date().toISOString(),
  catalog: {
    count: catalog.length,
    sample: catalog.slice(0, 3),
  },
  dailyPrices: {
    count: dailyPrices.length,
    sample: dailyPrices.slice(0, 3),
  },
  valuations: {
    count: valuations.length,
    sample: valuations.slice(0, 3),
  },
  institutional,
}

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
