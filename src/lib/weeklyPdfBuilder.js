import { getDailyPrinciple } from './dailyPrinciples.js'

function money(value) {
  const number = Number(value) || 0
  return number.toLocaleString('zh-TW')
}

function pct(value) {
  const number = Number(value) || 0
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`
}

function topByPnl(holdings = [], direction = 'desc') {
  return [...(Array.isArray(holdings) ? holdings : [])]
    .map((holding) => {
      const pnl =
        Number(holding?.pnl) ||
        ((Number(holding?.price) || 0) - (Number(holding?.cost) || 0)) * (Number(holding?.qty) || 0)
      return {
        code: String(holding?.code || ''),
        name: String(holding?.name || holding?.code || ''),
        pnl,
      }
    })
    .sort((a, b) => (direction === 'desc' ? b.pnl - a.pnl : a.pnl - b.pnl))
    .slice(0, 5)
}

function eventRows(events = [], closed = false, isClosedEvent = () => false) {
  return (Array.isArray(events) ? events : [])
    .filter((event) => Boolean(isClosedEvent(event)) === closed)
    .slice(0, 6)
    .map((event) => ({
      date: String(event?.date || ''),
      title: String(event?.title || event?.name || ''),
      status: closed ? '已驗證' : '待處理',
    }))
}

export function buildWeeklyPdfData({
  portfolioName = '持倉看板',
  holdings = [],
  newsEvents = [],
  totalVal = 0,
  totalPnl = 0,
  retPct = 0,
  isClosedEvent = () => false,
  now = new Date(),
} = {}) {
  const principle = getDailyPrinciple(now)
  const hasInsider7865 = (Array.isArray(holdings) ? holdings : []).some(
    (holding) => String(holding?.code || '') === '7865'
  )

  return {
    title: `${portfolioName} Weekly`,
    generatedAt: now.toISOString(),
    pnl: {
      totalVal,
      totalPnl,
      retPct,
    },
    topContributors: topByPnl(holdings, 'desc'),
    topDrags: topByPnl(holdings, 'asc'),
    verifiedEvents: eventRows(newsEvents, true, isClosedEvent),
    pendingEvents: eventRows(newsEvents, false, isClosedEvent),
    principle: {
      quote: principle.quote,
      author: principle.author,
    },
    insiderSection: hasInsider7865
      ? {
          title: 'Insider section · 金聯成 7865',
          copy: '本區僅列風險、狀態與公開資訊整理；不輸出 AI 買賣建議，不提供加碼、減碼或出場指令。',
          rows: [
            '狀態：列入本週追蹤清單。',
            '風險：留意流動性、資訊揭露時點與單一事件依賴。',
            '公開資訊：以公司公告、財報與主管機關公開資料為準。',
          ],
        }
      : null,
  }
}

export function buildWeeklyPdfDefinition(data) {
  const table = (title, rows) => [
    { text: title, style: 'section' },
    rows.length
      ? {
          table: {
            widths: ['*', '*', '*'],
            body: rows.map((row) => [
              row.code || row.date || '-',
              row.name || row.title || '-',
              money(row.pnl),
            ]),
          },
          layout: 'lightHorizontalLines',
        }
      : { text: '無', style: 'muted' },
  ]

  return {
    content: [
      { text: data.title, style: 'title' },
      { text: `產生時間：${data.generatedAt}`, style: 'muted' },
      {
        columns: [
          { text: `本週市值 ${money(data.pnl.totalVal)}` },
          { text: `本週損益 ${money(data.pnl.totalPnl)}` },
          { text: `報酬 ${pct(data.pnl.retPct)}` },
        ],
        margin: [0, 12, 0, 8],
      },
      ...table('Top contributors', data.topContributors),
      ...table('Top drags', data.topDrags),
      ...table('已驗證事件', data.verifiedEvents),
      ...table('待處理事件', data.pendingEvents),
      { text: '心法週語錄', style: 'section' },
      { text: `${data.principle.quote} — ${data.principle.author}` },
      ...(data.insiderSection
        ? [
            { text: data.insiderSection.title, style: 'section' },
            { text: data.insiderSection.copy, style: 'muted' },
            { ul: data.insiderSection.rows },
          ]
        : []),
    ],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
    },
    styles: {
      title: { fontSize: 18, bold: true },
      section: { fontSize: 13, bold: true, margin: [0, 12, 0, 6] },
      muted: { color: '#666666', fontSize: 9 },
    },
  }
}

export async function downloadWeeklyPdf(filename, definition) {
  const pdfMakeModule = await import('pdfmake/build/pdfmake')
  const vfsModule = await import('pdfmake/build/vfs_fonts')
  const pdfMake = pdfMakeModule.default || pdfMakeModule
  pdfMake.vfs = (vfsModule.default || vfsModule).vfs
  pdfMake.createPdf(definition).download(filename)
}
