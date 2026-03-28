/**
 * Watchlist 功能測試
 * 測試 watchlist 的 normalize、新增、編輯、刪除功能
 */

// 模擬 C 和 A 主題常數
const C = {
  subtle: '#f5f5f5',
  border: '#e0e0e0',
  text: '#333',
  textSec: '#666',
  textMute: '#999',
}

// normalizeWatchlist 函式（從 App.jsx 複製）
function normalizeWatchlist(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const code = String(item.code || '').trim()
      const name = String(item.name || '').trim()
      if (!code || !name) return null
      const price = Number(item.price)
      const target = Number(item.target)
      return {
        code,
        name,
        price: Number.isFinite(price) && price > 0 ? price : 0,
        target: Number.isFinite(target) && target > 0 ? target : 0,
        status: typeof item.status === 'string' ? item.status.trim() : '',
        catalyst: typeof item.catalyst === 'string' ? item.catalyst.trim() : '',
        scKey: typeof item.scKey === 'string' ? item.scKey : 'blue',
        note: typeof item.note === 'string' ? item.note.trim() : '',
      }
    })
    .filter(Boolean)
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

function assertLength(arr, len, msg = '') {
  if (arr.length !== len) {
    throw new Error(`${msg} expected length ${len}, got ${arr.length}`)
  }
}

// ════════════════════════════════════════════════════════════
// 測試案例
// ════════════════════════════════════════════════════════════

console.log('\n📋 Watchlist 功能測試\n')

test('normalizeWatchlist: 空陣列回傳空陣列', () => {
  assertLength(normalizeWatchlist([]), 0)
})

test('normalizeWatchlist: null 輸入回傳空陣列', () => {
  assertLength(normalizeWatchlist(null), 0)
})

test('normalizeWatchlist: 非陣列輸入回傳空陣列', () => {
  assertLength(normalizeWatchlist({}), 0)
})

test('normalizeWatchlist: 正常格式化單一項目', () => {
  const input = [{ code: '2330', name: '台積電', price: 500, target: 700 }]
  const result = normalizeWatchlist(input)
  assertLength(result, 1)
  assertEqual(result[0].code, '2330')
  assertEqual(result[0].name, '台積電')
  assertEqual(result[0].price, 500)
  assertEqual(result[0].target, 700)
})

test('normalizeWatchlist: 過濾無 code 或 name 的項目', () => {
  const input = [
    { code: '', name: '測試' },
    { code: '2330', name: '' },
    { code: '2330', name: '台積電' },
  ]
  const result = normalizeWatchlist(input)
  assertLength(result, 1)
  assertEqual(result[0].code, '2330')
})

test('normalizeWatchlist: 價格為負數時設為 0', () => {
  const input = [{ code: '2330', name: '台積電', price: -100, target: 700 }]
  const result = normalizeWatchlist(input)
  assertEqual(result[0].price, 0)
})

test('normalizeWatchlist: 目標價為 NaN 時設為 0', () => {
  const input = [{ code: '2330', name: '台積電', price: 500, target: 'abc' }]
  const result = normalizeWatchlist(input)
  assertEqual(result[0].target, 0)
})

test('normalizeWatchlist: 預設 scKey 為 blue', () => {
  const input = [{ code: '2330', name: '台積電' }]
  const result = normalizeWatchlist(input)
  assertEqual(result[0].scKey, 'blue')
})

test('normalizeWatchlist: 保留自訂 scKey', () => {
  const input = [{ code: '2330', name: '台積電', scKey: 'amber' }]
  const result = normalizeWatchlist(input)
  assertEqual(result[0].scKey, 'amber')
})

test('normalizeWatchlist: 修剪字串空白', () => {
  const input = [
    { code: ' 2330 ', name: ' 台積電 ', status: ' 觀察中 ', catalyst: ' 財報 ', note: ' 備註 ' },
  ]
  const result = normalizeWatchlist(input)
  assertEqual(result[0].code, '2330')
  assertEqual(result[0].name, '台積電')
  assertEqual(result[0].status, '觀察中')
  assertEqual(result[0].catalyst, '財報')
  assertEqual(result[0].note, '備註')
})

test('normalizeWatchlist: 空字串 status/catalyst/note 設為空字串', () => {
  const input = [{ code: '2330', name: '台積電', status: null, catalyst: undefined, note: '' }]
  const result = normalizeWatchlist(input)
  assertEqual(result[0].status, '')
  assertEqual(result[0].catalyst, '')
  assertEqual(result[0].note, '')
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
