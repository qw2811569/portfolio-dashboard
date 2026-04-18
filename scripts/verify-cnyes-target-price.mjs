import { fetchCnyesAggregate } from '../api/_lib/cnyes-target-price.js'

const codes = process.argv.slice(2).filter(Boolean)
const targets = codes.length > 0 ? codes : ['2330', '3055', '1234']

const results = await Promise.all(
  targets.map(async (code) => {
    try {
      const result = await fetchCnyesAggregate(code)
      return { code, ...result }
    } catch (error) {
      return {
        code,
        source: 'cnyes',
        aggregate: null,
        reason: error?.message || 'unknown_error',
      }
    }
  })
)

process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2)}\n`)
