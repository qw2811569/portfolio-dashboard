const TAIPEI_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const DAILY_PRINCIPLES = Object.freeze([
  '今天不急，明天不吃虧。',
  '看不懂，先不動手。',
  '部位大，期望小。',
  '沒有新證據，就先不改劇本。',
  '漲多先收心，不急著追。',
  '跌下來先看 thesis，有沒有真的變壞。',
  '先留餘裕，再等更好的球。',
  '價格很吵，紀律要安靜。',
  '先看風險，再看空間。',
  '想加碼前，先問自己哪裡更確定了。',
  '市場熱的時候，手要更慢一點。',
  '賺快錢靠運氣，留住錢靠紀律。',
])

function normalizeDateInput(date = new Date()) {
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? new Date() : new Date(date)
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export function getDailyPrincipleDayKey(date = new Date()) {
  const source = normalizeDateInput(date)
  const parts = TAIPEI_DAY_FORMATTER.formatToParts(source)
  const year = parts.find((part) => part.type === 'year')?.value || '1970'
  const month = parts.find((part) => part.type === 'month')?.value || '01'
  const day = parts.find((part) => part.type === 'day')?.value || '01'
  return `${year}-${month}-${day}`
}

export function getDailyPrinciple(date = new Date()) {
  const dayKey = getDailyPrincipleDayKey(date)
  const seed = Number(dayKey.replace(/-/g, '')) || 0
  return DAILY_PRINCIPLES[seed % DAILY_PRINCIPLES.length] || DAILY_PRINCIPLES[0]
}
