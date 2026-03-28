/**
 * Holdings 功能測試
 * 測試 holdings 的價格計算、損益計算功能
 */

// 模擬 C 主題常數
const C = {
  subtle: '#f5f5f5',
  border: '#e0e0e0',
}

// applyMarketQuotesToHoldings 函式
function applyMarketQuotesToHoldings(rows, quotes) {
  if (!Array.isArray(rows)) return []
  if (!quotes || typeof quotes !== 'object') return rows

  const quoteMap = new Map(Object.entries(quotes))

  return rows.map((row) => {
    const code = String(row.code || '').trim()
    if (!code) return row

    const marketPrice = quoteMap.get(code)
    if (marketPrice == null || typeof marketPrice !== 'number') return row

    return {
      ...row,
      price: marketPrice,
    }
  })
}

// normalizeHoldingMetrics 函式
function normalizeHoldingMetrics(item, overridePrice = null) {
  const price = overridePrice != null ? overridePrice : Number(item.price)
  const qty = Number(item.qty)
  const cost = Number(item.cost)

  const value =
    Number.isFinite(price) && Number.isFinite(qty) ? Math.round(price * qty * 100) / 100 : 0

  const costValue =
    Number.isFinite(cost) && Number.isFinite(qty) ? Math.round(cost * qty * 100) / 100 : 0

  const pnl =
    Number.isFinite(value) && Number.isFinite(costValue)
      ? Math.round((value - costValue) * 100) / 100
      : 0

  const pct =
    Number.isFinite(costValue) && costValue !== 0 && Number.isFinite(pnl)
      ? Math.round((pnl / costValue) * 10000) / 100
      : 0

  return {
    price: Number.isFinite(price) ? price : 0,
    qty: Number.isFinite(qty) ? qty : 0,
    cost: Number.isFinite(cost) ? cost : 0,
    value,
    costValue,
    pnl,
    pct,
  }
}

// 測試結果追蹤
let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`✓ ${name}`)
  } catch (err) {
    failed++
    failures.push({ name, error: err.message })
    console.log(`✗ ${name}: ${err.message}`)
  }
}

function assertEqual(actual, expected, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertClose(actual, expected, tolerance = 0.01, msg = '') {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg} expected ${expected} (±${tolerance}), got ${actual}`)
  }
}

// ════════════════════════════════════════════════════════════
// 測試案例
// ════════════════════════════════════════════════════════════

console.log('\n📋 Holdings 功能測試\n')

// applyMarketQuotesToHoldings 測試
console.log('\n--- applyMarketQuotesToHoldings ---')

test('applyMarketQuotesToHoldings: 空陣列回傳空陣列', () => {
  assertEqual(applyMarketQuotesToHoldings([], {}), [])
})

test('applyMarketQuotesToHoldings: 無 quotes 回傳原陣列', () => {
  const input = [{ code: '2330', price: 500 }]
  assertEqual(applyMarketQuotesToHoldings(input, null), input)
})

test('applyMarketQuotesToHoldings: 更新匹配的股價', () => {
  const input = [{ code: '2330', price: 500, name: '台積電' }]
  const quotes = { 2330: 550 }
  const result = applyMarketQuotesToHoldings(input, quotes)
  assertEqual(result[0].price, 550)
  assertEqual(result[0].name, '台積電') // 其他欄位不變
})

test('applyMarketQuotesToHoldings: 不更新無匹配的股價', () => {
  const input = [{ code: '2330', price: 500 }]
  const quotes = { 2454: 100 }
  const result = applyMarketQuotesToHoldings(input, quotes)
  assertEqual(result[0].price, 500)
})

test('applyMarketQuotesToHoldings: 處理多檔股票', () => {
  const input = [
    { code: '2330', price: 500 },
    { code: '2454', price: 100 },
    { code: '1234', price: 50 },
  ]
  const quotes = { 2330: 550, 2454: 120 }
  const result = applyMarketQuotesToHoldings(input, quotes)
  assertEqual(result[0].price, 550)
  assertEqual(result[1].price, 120)
  assertEqual(result[2].price, 50) // 無更新
})

// normalizeHoldingMetrics 測試
console.log('\n--- normalizeHoldingMetrics ---')

test('normalizeHoldingMetrics: 正常計算市值和損益', () => {
  const item = { price: 100, qty: 1000, cost: 80 }
  const result = normalizeHoldingMetrics(item)
  assertEqual(result.price, 100)
  assertEqual(result.qty, 1000)
  assertEqual(result.cost, 80)
  assertEqual(result.value, 100000) // 100 * 1000
  assertEqual(result.costValue, 80000) // 80 * 1000
  assertEqual(result.pnl, 20000) // 100000 - 80000
  assertClose(result.pct, 25) // 20000 / 80000 * 100
})

test('normalizeHoldingMetrics: 虧損情況', () => {
  const item = { price: 80, qty: 1000, cost: 100 }
  const result = normalizeHoldingMetrics(item)
  assertEqual(result.value, 80000)
  assertEqual(result.costValue, 100000)
  assertEqual(result.pnl, -20000)
  assertClose(result.pct, -20)
})

test('normalizeHoldingMetrics: 價格為 0 時', () => {
  const item = { price: 0, qty: 1000, cost: 80 }
  const result = normalizeHoldingMetrics(item)
  assertEqual(result.value, 0)
  assertEqual(result.pnl, -80000)
})

test('normalizeHoldingMetrics: 數量為 0 時', () => {
  const item = { price: 100, qty: 0, cost: 80 }
  const result = normalizeHoldingMetrics(item)
  assertEqual(result.value, 0)
  assertEqual(result.costValue, 0)
  assertEqual(result.pnl, 0)
  assertEqual(result.pct, 0)
})

test('normalizeHoldingMetrics: 無效輸入設為 0', () => {
  const item = { price: 'abc', qty: null, cost: undefined }
  const result = normalizeHoldingMetrics(item)
  assertEqual(result.price, 0)
  assertEqual(result.qty, 0)
  assertEqual(result.cost, 0)
  assertEqual(result.value, 0)
})

test('normalizeHoldingMetrics: overridePrice 優先', () => {
  const item = { price: 100, qty: 1000, cost: 80 }
  const result = normalizeHoldingMetrics(item, 120)
  assertEqual(result.price, 120)
  assertEqual(result.value, 120000)
})

test('normalizeHoldingMetrics: 小數點進位', () => {
  const item = { price: 100.123, qty: 100, cost: 80.456 }
  const result = normalizeHoldingMetrics(item)
  assertClose(result.price, 100.123, 0.001)
  assertClose(result.value, 10012.3, 0.1)
  assertClose(result.cost, 80.456, 0.001)
  assertClose(result.costValue, 8045.6, 0.1)
})

// 整合測試
console.log('\n--- 整合測試 ---')

test('整合：先更新股價再計算損益', () => {
  const holdings = [
    { code: '2330', price: 500, qty: 1000, cost: 450 },
    { code: '2454', price: 100, qty: 2000, cost: 120 },
  ]
  const quotes = { 2330: 550, 2454: 110 }

  const updated = applyMarketQuotesToHoldings(holdings, quotes)
  const metrics = updated.map((h) => normalizeHoldingMetrics(h))

  assertEqual(metrics[0].price, 550)
  assertClose(metrics[0].pct, 22.22, 0.1) // (550-450)/450

  assertEqual(metrics[1].price, 110)
  assertClose(metrics[1].pct, -8.33, 0.1) // (110-120)/120
})

// ════════════════════════════════════════════════════════════
// 測試總結
// ════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50))
console.log(`測試結果：${passed} 通過，${failed} 失敗`)
if (failures.length > 0) {
  console.log('\n失敗案例:')
  failures.forEach((f) => console.log(`  - ${f.name}: ${f.error}`))
}
console.log('='.repeat(50) + '\n')

process.exit(failed > 0 ? 1 : 0)
